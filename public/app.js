import { configLooksEmpty } from "./firebase.js";
import {
  fetchMyProfile,
  usernameAvailable,
  watchAuthState,
  logout,
  touchPresence,
  resendVerificationEmail,
} from "./auth.js";
import { searchUser, addContact, listenContacts, getProfile } from "./contacts.js";
import { ensureChat, listenMyChats, listenMessages, sendMessage } from "./chats.js";
import { updateProfileFields, changeUsername, updatePrivacy, updateNotifications } from "./settings.js";
import {
  colorForUid,
  initials,
  debounce,
  normalizeUsername,
  isValidUsername,
  fmtTime,
  fmtRelative,
  isRecentlyOnline,
  avatarHTML,
  escapeHTML,
  resizeImageToDataUrl,
} from "./utils.js";

// ---------- DOM refs ----------

const appEl = document.getElementById("app");

const sidebar = document.getElementById("sidebar");
const meName = document.getElementById("me-name");
const menuTriggerBtn = document.getElementById("menu-trigger-btn");
const profileDropdown = document.getElementById("profile-dropdown");
const menuSettingsBtn = document.getElementById("menu-settings-btn");
const menuLogoutBtn = document.getElementById("menu-logout-btn");

const verifyBanner = document.getElementById("verify-banner");
const verifyResendBtn = document.getElementById("verify-resend-btn");

const searchInput = document.getElementById("search-input");
const searchResultEl = document.getElementById("search-result");

const tabBtns = document.querySelectorAll("#tabs .tab-btn");
const chatListEl = document.getElementById("chat-list");
const contactListEl = document.getElementById("contact-list");

const emptyState = document.getElementById("empty-state");
const chatHeader = document.getElementById("chat-header");
const chatHeaderAvatar = document.getElementById("chat-header-avatar");
const chatTitle = document.getElementById("chat-title");
const chatSub = document.getElementById("chat-sub");
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");
const backToListBtn = document.getElementById("back-to-list-btn");

const settingsOverlay = document.getElementById("settings-overlay");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const settingsTabBtns = document.querySelectorAll("#settings-tabs .tab-btn");
const settingsAvatarPreview = document.getElementById("settings-avatar-preview");
const settingsAvatarPickBtn = document.getElementById("settings-avatar-pick-btn");
const settingsAvatarInput = document.getElementById("settings-avatar-input");
const settingsAvatarRemoveBtn = document.getElementById("settings-avatar-remove-btn");
const settingsDisplayname = document.getElementById("settings-displayname");
const settingsUsername = document.getElementById("settings-username");
const settingsUsernameHint = document.getElementById("settings-username-hint");
const settingsBio = document.getElementById("settings-bio");
const settingsEmail = document.getElementById("settings-email");
const settingsProfileSave = document.getElementById("settings-profile-save");
const settingsProfileError = document.getElementById("settings-profile-error");

const privacyEmail = document.getElementById("privacy-email");
const privacyLastseen = document.getElementById("privacy-lastseen");
const privacyFindbyemail = document.getElementById("privacy-findbyemail");
const settingsPrivacySave = document.getElementById("settings-privacy-save");
const settingsPrivacyError = document.getElementById("settings-privacy-error");

const notifSound = document.getElementById("notif-sound");
const notifDesktop = document.getElementById("notif-desktop");
const notifPreview = document.getElementById("notif-preview");
const settingsNotifSave = document.getElementById("settings-notif-save");
const settingsNotifError = document.getElementById("settings-notif-error");

// ---------- State ----------

let currentUser = null;
let myProfile = null;
let selectedSettingsAvatarImage = null;
let verifyResendTimer = null;

let chats = [];
let contacts = [];
let contactsMap = new Map();
let currentChatId = null;
let currentOtherUid = null;
let currentOtherProfile = null;

let unsubChats = null;
let unsubMessages = null;
let unsubContacts = null;
let chatsInitialized = false;
let presenceInterval = null;

// ---------- Settings avatar upload ----------

function renderSettingsAvatarPreview() {
  const color = myProfile.avatarColor || colorForUid(currentUser.uid);
  settingsAvatarPreview.style.background = color;
  if (selectedSettingsAvatarImage) {
    settingsAvatarPreview.innerHTML = `<img src="${selectedSettingsAvatarImage}" alt="" />`;
    settingsAvatarRemoveBtn.hidden = false;
  } else {
    settingsAvatarPreview.textContent = initials(myProfile.displayName);
    settingsAvatarRemoveBtn.hidden = true;
  }
}

settingsAvatarPickBtn.addEventListener("click", () => settingsAvatarInput.click());

settingsAvatarInput.addEventListener("change", async () => {
  const file = settingsAvatarInput.files?.[0];
  settingsAvatarInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    settingsProfileError.textContent = "Выберите файл изображения";
    return;
  }
  try {
    selectedSettingsAvatarImage = await resizeImageToDataUrl(file);
    settingsProfileError.textContent = "";
    renderSettingsAvatarPreview();
  } catch (err) {
    console.error(err);
    settingsProfileError.textContent = "Не удалось загрузить фото";
  }
});

settingsAvatarRemoveBtn.addEventListener("click", () => {
  selectedSettingsAvatarImage = null;
  renderSettingsAvatarPreview();
});

// ---------- Auth state ----------
// This page assumes an authenticated user with a completed profile.
// Anything else redirects to /login, which owns the email/password/profile-setup flow.

function goToLogin() {
  window.location.href = "/login";
}

if (configLooksEmpty) {
  goToLogin();
} else {
  watchAuthState(async (user) => {
    if (!user) {
      currentUser = null;
      myProfile = null;
      cleanupSubscriptions();
      goToLogin();
      return;
    }
    currentUser = user;
    myProfile = await fetchMyProfile(user.uid);
    if (!myProfile) {
      goToLogin();
      return;
    }
    enterApp();
  });
}

function cleanupSubscriptions() {
  if (unsubChats) unsubChats();
  if (unsubMessages) unsubMessages();
  if (unsubContacts) unsubContacts();
  if (presenceInterval) clearInterval(presenceInterval);
  unsubChats = unsubMessages = unsubContacts = presenceInterval = null;
  chatsInitialized = false;
}

// ---------- Main app ----------

function enterApp() {
  appEl.classList.remove("hidden");
  renderMe();
  updateVerifyBanner();
  listenContactsList();
  listenChatsList();
  touchPresence(currentUser.uid);
  presenceInterval = setInterval(() => touchPresence(currentUser.uid), 45000);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function onVisibilityChange() {
  if (!document.hidden && currentUser) touchPresence(currentUser.uid);
}

function renderMe() {
  menuTriggerBtn.innerHTML = avatarHTML(myProfile, currentUser.uid);
  meName.textContent = myProfile.displayName;
}

// ---------- Profile dropdown menu ----------

menuTriggerBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!profileDropdown.classList.contains("hidden") && !profileDropdown.contains(e.target) && e.target !== menuTriggerBtn) {
    profileDropdown.classList.add("hidden");
  }
});

menuSettingsBtn.addEventListener("click", () => {
  profileDropdown.classList.add("hidden");
  openSettings();
});

menuLogoutBtn.addEventListener("click", async () => {
  profileDropdown.classList.add("hidden");
  cleanupSubscriptions();
  await logout();
});

// ---------- Email verification banner ----------

async function updateVerifyBanner() {
  try {
    await currentUser.reload();
  } catch (_) {
    /* ignore */
  }
  verifyBanner.classList.toggle("hidden", !!currentUser.emailVerified);
}

verifyResendBtn.addEventListener("click", async () => {
  verifyResendBtn.disabled = true;
  try {
    await resendVerificationEmail(currentUser);
    verifyResendBtn.textContent = "Письмо отправлено";
  } catch (err) {
    console.error(err);
    verifyResendBtn.textContent = "Не удалось отправить";
  }
  let seconds = 30;
  clearInterval(verifyResendTimer);
  verifyResendTimer = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(verifyResendTimer);
      verifyResendBtn.disabled = false;
      verifyResendBtn.textContent = "Отправить повторно";
    }
  }, 1000);
});

// ---------- Search ----------

const runSearch = debounce(async (raw) => {
  const q = raw.trim();
  if (!q) {
    searchResultEl.classList.add("hidden");
    searchResultEl.innerHTML = "";
    return;
  }
  const result = await searchUser(q, currentUser.uid);
  searchResultEl.classList.remove("hidden");
  if (!result || result.self) {
    searchResultEl.innerHTML = `<div class="search-empty">${
      result?.self ? "Это вы 🙂" : "Пользователь не найден"
    }</div>`;
    return;
  }
  const { uid, profile } = result;
  const isContact = contactsMap.has(uid);
  const card = document.createElement("div");
  card.className = "search-result-card";
  card.innerHTML = `
    ${avatarHTML(profile, uid)}
    <div class="search-result-meta">
      <div class="search-result-name"></div>
      <div class="search-result-sub">@${escapeHTML(profile.username)}</div>
    </div>
    <div class="search-result-actions">
      ${isContact ? "" : '<button class="small-btn secondary" id="sr-add">Добавить</button>'}
      <button class="small-btn" id="sr-message">Написать</button>
    </div>
  `;
  card.querySelector(".search-result-name").textContent = profile.displayName;
  searchResultEl.innerHTML = "";
  searchResultEl.appendChild(card);

  const addBtn = card.querySelector("#sr-add");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      await addContact(currentUser.uid, uid);
    });
  }
  card.querySelector("#sr-message").addEventListener("click", async () => {
    await addContact(currentUser.uid, uid);
    const chatId = await ensureChat(currentUser.uid, uid);
    openChat(chatId, uid, profile);
    searchInput.value = "";
    searchResultEl.classList.add("hidden");
  });
}, 350);

searchInput.addEventListener("input", () => runSearch(searchInput.value));

// ---------- Tabs ----------

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    chatListEl.classList.toggle("hidden", tab !== "chats");
    contactListEl.classList.toggle("hidden", tab !== "contacts");
  });
});

// ---------- Contacts ----------

function listenContactsList() {
  unsubContacts = listenContacts(currentUser.uid, (list) => {
    contacts = list;
    contactsMap = new Map(list.map((c) => [c.uid, c.profile]));
    renderContacts();
  });
}

function renderContacts() {
  if (contacts.length === 0) {
    contactListEl.innerHTML = '<div class="empty-list">Пока нет контактов.<br />Найдите кого-то по юзернейму или email выше ↑</div>';
    return;
  }
  contactListEl.innerHTML = "";
  contacts.forEach(({ uid, profile }) => {
    const item = document.createElement("div");
    item.className = "contact-item";
    item.innerHTML = `
      ${avatarHTML(profile, uid)}
      <div class="contact-meta">
        <div class="contact-name"></div>
        <div class="contact-sub">@${escapeHTML(profile.username)}</div>
      </div>
    `;
    item.querySelector(".contact-name").textContent = profile.displayName;
    item.addEventListener("click", async () => {
      const chatId = await ensureChat(currentUser.uid, uid);
      openChat(chatId, uid, profile);
    });
    contactListEl.appendChild(item);
  });
}

// ---------- Chats list ----------

function listenChatsList() {
  unsubChats = listenMyChats(currentUser.uid, (list, changes) => {
    chats = list;
    renderChats();
    if (chatsInitialized) {
      changes.forEach((c) => {
        if (c.type === "removed") return;
        maybeNotify(c.data);
      });
    }
    chatsInitialized = true;
  });
}

async function renderChats() {
  if (chats.length === 0) {
    chatListEl.innerHTML = '<div class="empty-list">Пока нет чатов.<br />Найдите контакт по юзернейму или email выше ↑</div>';
    return;
  }
  chatListEl.innerHTML = "";
  for (const chat of chats) {
    const otherUid = chat.participants.find((p) => p !== currentUser.uid);
    const profile = contactsMap.get(otherUid) || (await getProfile(otherUid));
    if (!profile) continue;

    const item = document.createElement("div");
    item.className = "room-item" + (chat.id === currentChatId ? " active" : "");
    item.innerHTML = `
      ${avatarHTML(profile, otherUid)}
      <div class="room-meta">
        <div class="room-name"></div>
        <div class="room-last"></div>
      </div>
    `;
    item.querySelector(".room-name").textContent = profile.displayName;
    const lastPrefix = chat.lastMessageSenderId === currentUser.uid ? "Вы: " : "";
    item.querySelector(".room-last").textContent = chat.lastMessage ? lastPrefix + chat.lastMessage : "Нет сообщений";
    item.addEventListener("click", () => openChat(chat.id, otherUid, profile));
    chatListEl.appendChild(item);
  }
}

// ---------- Chat view ----------

function openChat(chatId, otherUid, profile) {
  if (unsubMessages) unsubMessages();
  currentChatId = chatId;
  currentOtherUid = otherUid;
  currentOtherProfile = profile;

  emptyState.classList.add("hidden");
  chatHeader.classList.remove("hidden");
  messagesEl.classList.remove("hidden");
  composer.classList.remove("hidden");
  sidebar.classList.add("chat-open");

  chatHeaderAvatar.innerHTML = avatarHTML(profile, otherUid);
  chatTitle.textContent = profile.displayName;
  updateChatSub(profile);

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  unsubMessages = listenMessages(chatId, (msgs) => {
    messagesEl.innerHTML = "";
    if (msgs.length === 0) {
      messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет. Начните переписку!</div>';
      return;
    }
    msgs.forEach(renderMessage);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function updateChatSub(profile) {
  const visibility = profile.privacy?.lastSeenVisibility || "everyone";
  const isContact = contactsMap.has(currentOtherUid);
  const canSee = visibility === "everyone" || (visibility === "contacts" && isContact);
  if (!canSee) {
    chatSub.textContent = "@" + profile.username;
    return;
  }
  if (isRecentlyOnline(profile.lastSeenAt)) {
    chatSub.textContent = "в сети";
  } else if (profile.lastSeenAt) {
    chatSub.textContent = "был(а) " + fmtRelative(profile.lastSeenAt);
  } else {
    chatSub.textContent = "@" + profile.username;
  }
}

backToListBtn.addEventListener("click", () => {
  sidebar.classList.remove("chat-open");
});

function renderMessage(msg) {
  const isMe = msg.senderId === currentUser.uid;
  const row = document.createElement("div");
  row.className = "msg-row" + (isMe ? " me" : "");
  row.innerHTML = `
    <div class="msg-group">
      <div class="bubble"></div>
      <div class="msg-time"></div>
    </div>
  `;
  row.querySelector(".bubble").textContent = msg.text;
  row.querySelector(".msg-time").textContent = fmtTime(msg.createdAt);
  messagesEl.appendChild(row);
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  await doSendMessage();
});

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    doSendMessage();
  }
});

msgInput.addEventListener("input", () => {
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
});

async function doSendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentChatId) return;
  msgInput.value = "";
  msgInput.style.height = "auto";
  sendBtn.disabled = true;
  try {
    await sendMessage(currentChatId, currentUser.uid, text);
  } catch (err) {
    console.error(err);
    alert("Не удалось отправить сообщение: " + err.message);
  } finally {
    sendBtn.disabled = false;
  }
}

// ---------- Notifications ----------

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 720;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (_) {
    /* audio not available */
  }
}

async function maybeNotify(chatData) {
  if (!chatData.lastMessageSenderId || chatData.lastMessageSenderId === currentUser.uid) return;
  const isViewingThisChat =
    currentChatId &&
    chatData.participants &&
    chatData.participants.includes(currentUser.uid) &&
    !document.hidden &&
    chatData.lastMessageSenderId !== currentUser.uid &&
    [...chatData.participants].sort().join("_") === currentChatId;
  if (isViewingThisChat) return;

  const notifPrefs = myProfile?.notifications || {};
  if (notifPrefs.sound !== false) beep();

  if (notifPrefs.desktop && "Notification" in window && Notification.permission === "granted") {
    const senderUid = chatData.lastMessageSenderId;
    const senderProfile = contactsMap.get(senderUid) || (await getProfile(senderUid));
    const title = senderProfile?.displayName || "Новое сообщение";
    const body = notifPrefs.preview !== false ? chatData.lastMessage : "Новое сообщение";
    new Notification(title, { body });
  }
}

// ---------- Settings overlay ----------

settingsCloseBtn.addEventListener("click", () => settingsOverlay.classList.add("hidden"));
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.add("hidden");
});

settingsTabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    settingsTabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".settings-tab-panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.spanel !== btn.dataset.stab);
    });
  });
});

function openSettings() {
  settingsProfileError.textContent = "";
  settingsPrivacyError.textContent = "";
  settingsNotifError.textContent = "";

  selectedSettingsAvatarImage = myProfile.avatarImage || null;
  renderSettingsAvatarPreview();

  settingsDisplayname.value = myProfile.displayName || "";
  settingsUsername.value = myProfile.username || "";
  settingsUsernameHint.textContent = "";
  settingsBio.value = myProfile.bio || "";
  settingsEmail.value = currentUser.email || "";

  privacyEmail.value = myProfile.privacy?.emailVisibility || "contacts";
  privacyLastseen.value = myProfile.privacy?.lastSeenVisibility || "everyone";
  privacyFindbyemail.value = myProfile.privacy?.findByEmail || "everyone";

  notifSound.checked = myProfile.notifications?.sound !== false;
  notifDesktop.checked = !!myProfile.notifications?.desktop;
  notifPreview.checked = myProfile.notifications?.preview !== false;

  settingsOverlay.classList.remove("hidden");
}

const checkSettingsUsernameDebounced = debounce(async (raw) => {
  const uname = normalizeUsername(raw);
  if (uname === myProfile.username) {
    settingsUsernameHint.textContent = "";
    return;
  }
  if (!isValidUsername(uname)) {
    settingsUsernameHint.textContent = "3-20 символов: латиница, цифры, _";
    settingsUsernameHint.className = "field-hint bad";
    return;
  }
  const available = await usernameAvailable(uname);
  settingsUsernameHint.textContent = available ? "Юзернейм свободен" : "Уже занят";
  settingsUsernameHint.className = "field-hint " + (available ? "ok" : "bad");
}, 400);

settingsUsername.addEventListener("input", () => checkSettingsUsernameDebounced(settingsUsername.value));

settingsProfileSave.addEventListener("click", async () => {
  settingsProfileError.textContent = "";
  settingsProfileSave.disabled = true;
  try {
    const newUsernameRaw = settingsUsername.value;
    const newUsername = normalizeUsername(newUsernameRaw);
    if (newUsername !== myProfile.username) {
      const finalUsername = await changeUsername(currentUser.uid, myProfile.username, newUsernameRaw);
      myProfile.username = finalUsername;
    }
    await updateProfileFields(currentUser.uid, {
      displayName: settingsDisplayname.value.trim().slice(0, 40) || myProfile.username,
      bio: settingsBio.value.trim().slice(0, 140),
      avatarImage: selectedSettingsAvatarImage,
      avatarEmoji: null,
    });
    myProfile = await fetchMyProfile(currentUser.uid);
    renderMe();
    renderChats();
    settingsOverlay.classList.add("hidden");
  } catch (err) {
    console.error(err);
    settingsProfileError.textContent = err.message || "Не удалось сохранить";
  } finally {
    settingsProfileSave.disabled = false;
  }
});

settingsPrivacySave.addEventListener("click", async () => {
  settingsPrivacyError.textContent = "";
  settingsPrivacySave.disabled = true;
  try {
    const privacy = {
      emailVisibility: privacyEmail.value,
      lastSeenVisibility: privacyLastseen.value,
      findByEmail: privacyFindbyemail.value,
    };
    await updatePrivacy(currentUser.uid, privacy);
    myProfile.privacy = privacy;
    settingsOverlay.classList.add("hidden");
  } catch (err) {
    console.error(err);
    settingsPrivacyError.textContent = err.message || "Не удалось сохранить";
  } finally {
    settingsPrivacySave.disabled = false;
  }
});

settingsNotifSave.addEventListener("click", async () => {
  settingsNotifError.textContent = "";
  settingsNotifSave.disabled = true;
  try {
    if (notifDesktop.checked && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const desktopEnabled = notifDesktop.checked && "Notification" in window && Notification.permission === "granted";
    const notifications = {
      sound: notifSound.checked,
      desktop: desktopEnabled,
      preview: notifPreview.checked,
    };
    await updateNotifications(currentUser.uid, notifications);
    myProfile.notifications = notifications;
    notifDesktop.checked = desktopEnabled;
    settingsOverlay.classList.add("hidden");
  } catch (err) {
    console.error(err);
    settingsNotifError.textContent = err.message || "Не удалось сохранить";
  } finally {
    settingsNotifSave.disabled = false;
  }
});
