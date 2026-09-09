import { configLooksEmpty } from "./firebase.js";
import {
  fetchMyProfile,
  usernameAvailable,
  watchAuthState,
  logout,
  touchPresence,
  listenSessions,
  forgetSession,
  changePassword,
  deleteAccount,
} from "./auth.js";
import { searchUser, addContact, listenContacts, getProfile, setContactAlias, contactDisplayName } from "./contacts.js";
import { ensureChat, listenMyChats, listenMessages, sendMessage, listenChatDoc, setTyping } from "./chats.js";
import { listenSavedMessages, addSavedMessage } from "./saved.js";
import { listenNotificationsFeed, addBroadcast } from "./notify.js";
import { createGroup, listenMyGroups, listenGroupMessages, sendGroupMessage } from "./groups.js";
import { updateProfileFields, changeUsername, updatePrivacy, updateNotifications } from "./settings.js";
import {
  colorForUid,
  initials,
  debounce,
  normalizeUsername,
  isValidUsername,
  fmtTime,
  fmtRelative,
  fmtDateTime,
  isRecentlyOnline,
  avatarHTML,
  escapeHTML,
  resizeImageToDataUrl,
  attachPasswordToggle,
} from "./utils.js";

const ADMIN_USERNAME = "danik";
const SAVED_ID = "__saved__";
const NOTIFICATIONS_ID = "__notifications__";

// ---------- DOM refs ----------

const appEl = document.getElementById("app");

const sidebar = document.getElementById("sidebar");
const meName = document.getElementById("me-name");
const menuTriggerBtn = document.getElementById("menu-trigger-btn");

const searchInput = document.getElementById("search-input");
const searchResultEl = document.getElementById("search-result");
const fabNewChat = document.getElementById("fab-new-chat");

const chatListEl = document.getElementById("chat-list");

const emptyState = document.getElementById("empty-state");
const chatHeader = document.getElementById("chat-header");
const chatHeaderAvatar = document.getElementById("chat-header-avatar");
const chatTitle = document.getElementById("chat-title");
const chatSub = document.getElementById("chat-sub");
const editContactBtn = document.getElementById("edit-contact-btn");
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");
const backToListBtn = document.getElementById("back-to-list-btn");

const aliasOverlay = document.getElementById("alias-overlay");
const aliasFirstname = document.getElementById("alias-firstname");
const aliasLastname = document.getElementById("alias-lastname");
const aliasCancelBtn = document.getElementById("alias-cancel-btn");
const aliasSaveBtn = document.getElementById("alias-save-btn");

const newChatOverlay = document.getElementById("new-chat-overlay");
const newChatCloseBtn = document.getElementById("new-chat-close-btn");
const newChatMenu = document.getElementById("new-chat-menu");
const newChatContactBtn = document.getElementById("new-chat-contact-btn");
const newChatGroupOpenBtn = document.getElementById("new-chat-group-open-btn");
const newChatChannelOpenBtn = document.getElementById("new-chat-channel-open-btn");

const newChatContactStep = document.getElementById("new-chat-contact-step");
const newChatContactBackBtn = document.getElementById("new-chat-contact-back-btn");
const newChatUsernameInput = document.getElementById("new-chat-username-input");
const newChatContactResult = document.getElementById("new-chat-contact-result");

const newChatGroupStep = document.getElementById("new-chat-group-step");
const newChatGroupBackBtn = document.getElementById("new-chat-group-back-btn");
const newChatGroupTitle = document.getElementById("new-chat-group-title");
const newChatGroupAvatarPreview = document.getElementById("new-chat-group-avatar-preview");
const newChatGroupAvatarPickBtn = document.getElementById("new-chat-group-avatar-pick-btn");
const newChatGroupAvatarInput = document.getElementById("new-chat-group-avatar-input");
const newChatGroupNameLabel = document.getElementById("new-chat-group-name-label");
const newChatGroupNameInput = document.getElementById("new-chat-group-name-input");
const newChatGroupMemberInput = document.getElementById("new-chat-group-member-input");
const newChatGroupMemberResult = document.getElementById("new-chat-group-member-result");
const newChatGroupMembersChips = document.getElementById("new-chat-group-members-chips");
const newChatGroupCreateBtn = document.getElementById("new-chat-group-create-btn");
const newChatGroupError = document.getElementById("new-chat-group-error");

const settingsOverlay = document.getElementById("settings-overlay");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const settingsBackBtn = document.getElementById("settings-back-btn");
const settingsHeaderTitle = document.getElementById("settings-header-title");
const settingsMenu = document.getElementById("settings-menu");
const settingsMenuItems = document.querySelectorAll(".settings-menu-item");
const sessionsLogoutBtn = document.getElementById("sessions-logout-btn");
const settingsAvatarPreview = document.getElementById("settings-avatar-preview");
const settingsAvatarPickBtn = document.getElementById("settings-avatar-pick-btn");
const settingsAvatarInput = document.getElementById("settings-avatar-input");
const settingsAvatarRemoveBtn = document.getElementById("settings-avatar-remove-btn");
const settingsDisplayname = document.getElementById("settings-displayname");
const settingsUsername = document.getElementById("settings-username");
const settingsUsernameHint = document.getElementById("settings-username-hint");
const settingsBio = document.getElementById("settings-bio");
const settingsProfileSave = document.getElementById("settings-profile-save");
const settingsProfileError = document.getElementById("settings-profile-error");

const privacyLastseen = document.getElementById("privacy-lastseen");
const settingsPrivacySave = document.getElementById("settings-privacy-save");
const settingsPrivacyError = document.getElementById("settings-privacy-error");

const notifSound = document.getElementById("notif-sound");
const notifDesktop = document.getElementById("notif-desktop");
const notifPreview = document.getElementById("notif-preview");
const settingsNotifSave = document.getElementById("settings-notif-save");
const settingsNotifError = document.getElementById("settings-notif-error");

const pwCurrent = document.getElementById("pw-current");
const pwNew = document.getElementById("pw-new");
const pwConfirm = document.getElementById("pw-confirm");
const pwSaveBtn = document.getElementById("pw-save-btn");
const pwError = document.getElementById("pw-error");
const sessionsListEl = document.getElementById("sessions-list");
const deleteAccountOpenBtn = document.getElementById("delete-account-open-btn");
const deleteAccountConfirm = document.getElementById("delete-account-confirm");
const deleteAccountPassword = document.getElementById("delete-account-password");
const deleteAccountCancelBtn = document.getElementById("delete-account-cancel-btn");
const deleteAccountConfirmBtn = document.getElementById("delete-account-confirm-btn");
const deleteAccountError = document.getElementById("delete-account-error");

attachPasswordToggle(pwCurrent, document.getElementById("pw-current-toggle"));
attachPasswordToggle(pwNew, document.getElementById("pw-new-toggle"));
attachPasswordToggle(pwConfirm, document.getElementById("pw-confirm-toggle"));
attachPasswordToggle(deleteAccountPassword, document.getElementById("delete-account-password-toggle"));

// ---------- State ----------

let currentUser = null;
let myProfile = null;
let selectedSettingsAvatarImage = null;

let chats = [];
let groups = [];
let contacts = [];
let contactsMap = new Map();
let currentChatId = null; // real chatId, group id, or SAVED_ID / NOTIFICATIONS_ID
let currentChatType = null; // "contact" | "group" | "channel" | "saved" | "notifications"
let currentOtherUid = null;
let currentOtherProfile = null;

let unsubChats = null;
let unsubGroups = null;
let unsubMessages = null;
let unsubChatDoc = null;
let unsubContacts = null;
let chatsInitialized = false;
let presenceInterval = null;
let typingClearTimer = null;
let sessionsUnsub = null;

let pendingGroupType = "group";
let pendingGroupAvatarImage = null;
let pendingGroupMembers = new Map(); // uid -> profile

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
// Anything else redirects to /login, which owns the username/password/registration flow.

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
  if (unsubGroups) unsubGroups();
  if (unsubMessages) unsubMessages();
  if (unsubChatDoc) unsubChatDoc();
  if (unsubContacts) unsubContacts();
  if (sessionsUnsub) sessionsUnsub();
  if (presenceInterval) clearInterval(presenceInterval);
  unsubChats = unsubGroups = unsubMessages = unsubChatDoc = unsubContacts = sessionsUnsub = presenceInterval = null;
  chatsInitialized = false;
}

// ---------- Main app ----------

function enterApp() {
  appEl.classList.remove("hidden");
  renderMe();
  listenContactsList();
  listenChatsList();
  listenGroupsList();
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

// ---------- Avatar click -> settings ----------

menuTriggerBtn.addEventListener("click", () => openSettings());

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
    openContactChat(chatId, uid, profile);
    searchInput.value = "";
    searchResultEl.classList.add("hidden");
  });
}, 350);

searchInput.addEventListener("input", () => runSearch(searchInput.value));

// ---------- New chat modal (contact / group / channel) ----------

fabNewChat.addEventListener("click", () => openNewChatMenu());
newChatCloseBtn.addEventListener("click", () => newChatOverlay.classList.add("hidden"));
newChatOverlay.addEventListener("click", (e) => {
  if (e.target === newChatOverlay) newChatOverlay.classList.add("hidden");
});

function showNewChatStep(step) {
  [newChatMenu, newChatContactStep, newChatGroupStep].forEach((el) => el.classList.add("hidden"));
  step.classList.remove("hidden");
}

function openNewChatMenu() {
  newChatUsernameInput.value = "";
  newChatContactResult.innerHTML = "";
  showNewChatStep(newChatMenu);
  newChatOverlay.classList.remove("hidden");
}

newChatContactBtn.addEventListener("click", () => showNewChatStep(newChatContactStep));
newChatContactBackBtn.addEventListener("click", () => showNewChatStep(newChatMenu));

const runNewChatContactSearch = debounce(async (raw) => {
  const q = raw.trim();
  if (!q) {
    newChatContactResult.innerHTML = "";
    return;
  }
  const result = await searchUser(q, currentUser.uid);
  if (!result || result.self) {
    newChatContactResult.innerHTML = `<div class="search-empty">${
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
      ${isContact ? "" : '<button class="small-btn secondary" id="ncr-add">Добавить</button>'}
      <button class="small-btn" id="ncr-message">Написать</button>
    </div>
  `;
  card.querySelector(".search-result-name").textContent = profile.displayName;
  newChatContactResult.innerHTML = "";
  newChatContactResult.appendChild(card);

  const addBtn = card.querySelector("#ncr-add");
  if (addBtn) addBtn.addEventListener("click", async () => addContact(currentUser.uid, uid));

  card.querySelector("#ncr-message").addEventListener("click", async () => {
    await addContact(currentUser.uid, uid);
    const chatId = await ensureChat(currentUser.uid, uid);
    openContactChat(chatId, uid, profile);
    newChatOverlay.classList.add("hidden");
  });
}, 350);

newChatUsernameInput.addEventListener("input", () => runNewChatContactSearch(newChatUsernameInput.value));

// ---------- New chat modal: group / channel creation ----------

function renderGroupAvatarPreview() {
  const color = "#5b8cff";
  newChatGroupAvatarPreview.style.background = color;
  if (pendingGroupAvatarImage) {
    newChatGroupAvatarPreview.innerHTML = `<img src="${pendingGroupAvatarImage}" alt="" />`;
  } else {
    newChatGroupAvatarPreview.textContent = pendingGroupType === "channel" ? "📢" : "👥";
  }
}

function renderGroupMemberChips() {
  newChatGroupMembersChips.innerHTML = "";
  pendingGroupMembers.forEach((profile, uid) => {
    const chip = document.createElement("div");
    chip.className = "member-chip";
    chip.innerHTML = `<span></span><button type="button" title="Убрать">✕</button>`;
    chip.querySelector("span").textContent = profile.displayName;
    chip.querySelector("button").addEventListener("click", () => {
      pendingGroupMembers.delete(uid);
      renderGroupMemberChips();
    });
    newChatGroupMembersChips.appendChild(chip);
  });
}

function openNewChatGroupStep(type) {
  pendingGroupType = type;
  pendingGroupAvatarImage = null;
  pendingGroupMembers = new Map();
  newChatGroupTitle.textContent = type === "channel" ? "Новый канал" : "Новая группа";
  newChatGroupNameLabel.textContent = type === "channel" ? "Название канала" : "Название группы";
  newChatGroupNameInput.value = "";
  newChatGroupMemberInput.value = "";
  newChatGroupMemberResult.innerHTML = "";
  newChatGroupError.textContent = "";
  renderGroupAvatarPreview();
  renderGroupMemberChips();
  showNewChatStep(newChatGroupStep);
}

newChatGroupOpenBtn.addEventListener("click", () => openNewChatGroupStep("group"));
newChatChannelOpenBtn.addEventListener("click", () => openNewChatGroupStep("channel"));
newChatGroupBackBtn.addEventListener("click", () => showNewChatStep(newChatMenu));

newChatGroupAvatarPickBtn.addEventListener("click", () => newChatGroupAvatarInput.click());

newChatGroupAvatarInput.addEventListener("change", async () => {
  const file = newChatGroupAvatarInput.files?.[0];
  newChatGroupAvatarInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    newChatGroupError.textContent = "Выберите файл изображения";
    return;
  }
  try {
    pendingGroupAvatarImage = await resizeImageToDataUrl(file);
    newChatGroupError.textContent = "";
    renderGroupAvatarPreview();
  } catch (err) {
    console.error(err);
    newChatGroupError.textContent = "Не удалось загрузить фото";
  }
});

const runGroupMemberSearch = debounce(async (raw) => {
  const q = raw.trim();
  if (!q) {
    newChatGroupMemberResult.innerHTML = "";
    return;
  }
  const result = await searchUser(q, currentUser.uid);
  if (!result || result.self || pendingGroupMembers.has(result.uid)) {
    newChatGroupMemberResult.innerHTML = result?.self
      ? '<div class="search-empty">Это вы 🙂</div>'
      : pendingGroupMembers.has(result?.uid)
      ? '<div class="search-empty">Уже добавлен(а)</div>'
      : '<div class="search-empty">Пользователь не найден</div>';
    return;
  }
  const { uid, profile } = result;
  const card = document.createElement("div");
  card.className = "search-result-card";
  card.innerHTML = `
    ${avatarHTML(profile, uid)}
    <div class="search-result-meta">
      <div class="search-result-name"></div>
      <div class="search-result-sub">@${escapeHTML(profile.username)}</div>
    </div>
    <div class="search-result-actions">
      <button class="small-btn" id="gmr-add">Добавить</button>
    </div>
  `;
  card.querySelector(".search-result-name").textContent = profile.displayName;
  newChatGroupMemberResult.innerHTML = "";
  newChatGroupMemberResult.appendChild(card);

  card.querySelector("#gmr-add").addEventListener("click", () => {
    pendingGroupMembers.set(uid, profile);
    renderGroupMemberChips();
    newChatGroupMemberInput.value = "";
    newChatGroupMemberResult.innerHTML = "";
  });
}, 350);

newChatGroupMemberInput.addEventListener("input", () => runGroupMemberSearch(newChatGroupMemberInput.value));

newChatGroupCreateBtn.addEventListener("click", async () => {
  newChatGroupError.textContent = "";
  const name = newChatGroupNameInput.value.trim();
  if (!name) {
    newChatGroupError.textContent = "Введите название";
    return;
  }
  newChatGroupCreateBtn.disabled = true;
  try {
    const memberUids = Array.from(pendingGroupMembers.keys());
    const groupId = await createGroup({
      type: pendingGroupType,
      name,
      avatarImage: pendingGroupAvatarImage,
      avatarColor: colorForUid(name + Date.now()),
      ownerId: currentUser.uid,
      memberUids,
    });
    const newGroup = {
      id: groupId,
      type: pendingGroupType,
      name,
      avatarImage: pendingGroupAvatarImage,
      avatarColor: colorForUid(name),
      ownerId: currentUser.uid,
      admins: [currentUser.uid],
      members: [currentUser.uid, ...memberUids],
      lastMessage: "",
      lastMessageSenderId: null,
    };
    newChatOverlay.classList.add("hidden");
    openGroupChat(newGroup);
  } catch (err) {
    console.error(err);
    newChatGroupError.textContent = err.message || "Не удалось создать";
  } finally {
    newChatGroupCreateBtn.disabled = false;
  }
});

// ---------- Contacts (background data only - no separate tab) ----------

function listenContactsList() {
  unsubContacts = listenContacts(currentUser.uid, (list) => {
    contacts = list;
    contactsMap = new Map(list.map((c) => [c.uid, c]));
    renderChats();
  });
}

// ---------- Chats list (pinned Избранное + Linkage Notifications, then real chats/groups) ----------

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

function listenGroupsList() {
  unsubGroups = listenMyGroups(currentUser.uid, (list) => {
    groups = list;
    renderChats();
  });
}

function pinnedItemHTML(id, iconSvg, title, subtitle) {
  const item = document.createElement("div");
  item.className = "room-item pinned-item" + (id === currentChatId ? " active" : "");
  item.innerHTML = `
    <div class="avatar pinned-avatar">${iconSvg}</div>
    <div class="room-meta">
      <div class="room-name"></div>
      <div class="room-last"></div>
    </div>
  `;
  item.querySelector(".room-name").textContent = title;
  item.querySelector(".room-last").textContent = subtitle;
  return item;
}

const SAVED_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
const BELL_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

function groupAvatarHTML(group) {
  const color = group.avatarColor || colorForUid(group.id || group.name || "?");
  if (group.avatarImage) {
    return `<div class="avatar" style="background:${color}"><img src="${group.avatarImage}" alt="" /></div>`;
  }
  const icon = group.type === "channel" ? "📢" : "👥";
  return `<div class="avatar" style="background:${color}">${icon}</div>`;
}

async function renderChats() {
  chatListEl.innerHTML = "";

  const savedItem = pinnedItemHTML(SAVED_ID, SAVED_ICON, "Избранное", "Ваши заметки");
  savedItem.querySelector(".pinned-avatar").style.background = "#5b8cff";
  savedItem.addEventListener("click", openSavedChat);
  chatListEl.appendChild(savedItem);

  const notifItem = pinnedItemHTML(NOTIFICATIONS_ID, BELL_ICON, "Linkage Notifications", "Обновления и уведомления о входе");
  notifItem.querySelector(".pinned-avatar").style.background = "#8b5cf6";
  notifItem.addEventListener("click", openNotificationsChat);
  chatListEl.appendChild(notifItem);

  const combined = [
    ...chats.map((data) => ({ kind: "contact", data })),
    ...groups.map((data) => ({ kind: "group", data })),
  ].sort((a, b) => {
    const ta = a.data.lastMessageAt?.toMillis ? a.data.lastMessageAt.toMillis() : 0;
    const tb = b.data.lastMessageAt?.toMillis ? b.data.lastMessageAt.toMillis() : 0;
    return tb - ta;
  });

  for (const entry of combined) {
    if (entry.kind === "group") {
      const group = entry.data;
      const item = document.createElement("div");
      item.className = "room-item" + (group.id === currentChatId ? " active" : "");
      item.innerHTML = `
        ${groupAvatarHTML(group)}
        <div class="room-meta">
          <div class="room-name"></div>
          <div class="room-last"></div>
        </div>
      `;
      item.querySelector(".room-name").textContent = group.name;
      const lastPrefix = group.lastMessageSenderId === currentUser.uid ? "Вы: " : "";
      item.querySelector(".room-last").textContent = group.lastMessage
        ? lastPrefix + group.lastMessage
        : group.type === "channel"
        ? "Канал"
        : "Группа";
      item.addEventListener("click", () => openGroupChat(group));
      chatListEl.appendChild(item);
      continue;
    }

    const chat = entry.data;
    const otherUid = chat.participants.find((p) => p !== currentUser.uid);
    const contact = contactsMap.get(otherUid);
    const profile = contact?.profile || (await getProfile(otherUid));
    if (!profile) continue;

    const name = contact ? contactDisplayName(contact.alias, profile) : profile.displayName;

    const item = document.createElement("div");
    item.className = "room-item" + (chat.id === currentChatId ? " active" : "");
    item.innerHTML = `
      ${avatarHTML(profile, otherUid)}
      <div class="room-meta">
        <div class="room-name"></div>
        <div class="room-last"></div>
      </div>
    `;
    item.querySelector(".room-name").textContent = name;
    const lastPrefix = chat.lastMessageSenderId === currentUser.uid ? "Вы: " : "";
    item.querySelector(".room-last").textContent = chat.lastMessage ? lastPrefix + chat.lastMessage : "Нет сообщений";
    item.addEventListener("click", () => openContactChat(chat.id, otherUid, profile));
    chatListEl.appendChild(item);
  }
}

// ---------- Shared chat-view plumbing ----------

function resetChatView() {
  if (unsubMessages) unsubMessages();
  if (unsubChatDoc) unsubChatDoc();
  unsubMessages = unsubChatDoc = null;
  clearTimeout(typingClearTimer);

  emptyState.classList.add("hidden");
  chatHeader.classList.remove("hidden");
  messagesEl.classList.remove("hidden");
  composer.classList.remove("hidden");
  sidebar.classList.add("chat-open");
  chatSub.textContent = "";
  chatSub.classList.remove("typing");
  editContactBtn.classList.add("hidden");
}

function renderPlainMessages(msgs, isMineFn) {
  messagesEl.innerHTML = "";
  if (msgs.length === 0) {
    messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>';
    return;
  }
  msgs.forEach((msg) => renderMessage(msg, isMineFn(msg)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------- Избранное (Saved) ----------

function openSavedChat() {
  resetChatView();
  currentChatId = SAVED_ID;
  currentChatType = "saved";
  currentOtherUid = null;
  currentOtherProfile = null;

  chatHeaderAvatar.innerHTML = `<div class="avatar pinned-avatar" style="background:#5b8cff">${SAVED_ICON}</div>`;
  chatTitle.textContent = "Избранное";
  chatSub.textContent = "Заметки, которые видите только вы";

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка…</div>';
  unsubMessages = listenSavedMessages(currentUser.uid, (msgs) => renderPlainMessages(msgs, () => true));
}

// ---------- Linkage Notifications ----------

function openNotificationsChat() {
  resetChatView();
  currentChatId = NOTIFICATIONS_ID;
  currentChatType = "notifications";
  currentOtherUid = null;
  currentOtherProfile = null;

  chatHeaderAvatar.innerHTML = `<div class="avatar pinned-avatar" style="background:#8b5cf6">${BELL_ICON}</div>`;
  chatTitle.textContent = "Linkage Notifications";
  chatSub.textContent = myProfile.username === ADMIN_USERNAME ? "Только вы можете писать сюда всем" : "Официальный канал уведомлений";

  composer.classList.toggle("hidden", myProfile.username !== ADMIN_USERNAME);

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка…</div>';
  unsubMessages = listenNotificationsFeed(currentUser.uid, (msgs) => renderPlainMessages(msgs, () => false));
}

// ---------- 1:1 contact chat ----------

function openContactChat(chatId, otherUid, profile) {
  resetChatView();
  currentChatId = chatId;
  currentChatType = "contact";
  currentOtherUid = otherUid;
  currentOtherProfile = profile;

  const contact = contactsMap.get(otherUid);
  chatHeaderAvatar.innerHTML = avatarHTML(profile, otherUid);
  chatTitle.textContent = contact ? contactDisplayName(contact.alias, profile) : profile.displayName;
  chatSub.textContent = "@" + profile.username;
  editContactBtn.classList.remove("hidden");

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  unsubMessages = listenMessages(chatId, (msgs) => {
    if (currentChatId !== chatId) return;
    renderPlainMessages(msgs, (msg) => msg.senderId === currentUser.uid);
  });
  unsubChatDoc = listenChatDoc(chatId, (data) => {
    if (currentChatId !== chatId || !data) return;
    updateChatSub(profile, data);
  });
}

// ---------- Groups & channels ----------

function pluralMembers(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} участник`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} участника`;
  return `${n} участников`;
}

function openGroupChat(group) {
  resetChatView();
  currentChatId = group.id;
  currentChatType = group.type;
  currentOtherUid = null;
  currentOtherProfile = null;

  chatHeaderAvatar.innerHTML = groupAvatarHTML(group);
  chatTitle.textContent = group.name;
  chatSub.textContent = pluralMembers((group.members || []).length);

  const canPost = group.type === "group" || (group.admins || []).includes(currentUser.uid);
  composer.classList.toggle("hidden", !canPost);

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  const senderCache = new Map();
  unsubMessages = listenGroupMessages(group.id, async (msgs) => {
    if (currentChatId !== group.id) return;
    messagesEl.innerHTML = "";
    if (msgs.length === 0) {
      messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>';
      return;
    }
    for (const msg of msgs) {
      const isMine = msg.senderId === currentUser.uid;
      let senderName = null;
      if (!isMine) {
        if (!senderCache.has(msg.senderId)) {
          const p = contactsMap.get(msg.senderId)?.profile || (await getProfile(msg.senderId));
          senderCache.set(msg.senderId, p);
        }
        senderName = senderCache.get(msg.senderId)?.displayName || "—";
      }
      renderMessage(msg, isMine, senderName);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function updateChatSub(profile, chatData) {
  const otherTyping = chatData?.typing?.[currentOtherUid];
  if (otherTyping?.toDate && Date.now() - otherTyping.toDate().getTime() < 6000) {
    chatSub.textContent = "печатает…";
    chatSub.classList.add("typing");
    return;
  }
  chatSub.classList.remove("typing");

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

function renderMessage(msg, isMine, senderName) {
  const row = document.createElement("div");
  row.className = "msg-row" + (isMine ? " me" : "");
  row.innerHTML = `
    <div class="msg-group">
      ${senderName ? '<div class="msg-sender"></div>' : ""}
      <div class="bubble"></div>
      <div class="msg-time"></div>
    </div>
  `;
  if (senderName) row.querySelector(".msg-sender").textContent = senderName;
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

  if (currentChatType === "contact") {
    setTyping(currentChatId, currentUser.uid, true);
    clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => setTyping(currentChatId, currentUser.uid, false), 3000);
  }
});

async function doSendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentChatId) return;
  msgInput.value = "";
  msgInput.style.height = "auto";
  sendBtn.disabled = true;
  clearTimeout(typingClearTimer);
  try {
    if (currentChatType === "saved") {
      await addSavedMessage(currentUser.uid, text);
    } else if (currentChatType === "notifications") {
      await addBroadcast(currentUser.uid, text);
    } else if (currentChatType === "group" || currentChatType === "channel") {
      await sendGroupMessage(currentChatId, currentUser.uid, text);
    } else {
      await sendMessage(currentChatId, currentUser.uid, text);
    }
  } catch (err) {
    console.error(err);
    alert("Не удалось отправить сообщение: " + err.message);
  } finally {
    sendBtn.disabled = false;
  }
}

// ---------- Contact alias editing ----------

editContactBtn.addEventListener("click", () => {
  if (!currentOtherUid) return;
  const contact = contactsMap.get(currentOtherUid);
  aliasFirstname.value = contact?.alias?.firstName || "";
  aliasLastname.value = contact?.alias?.lastName || "";
  aliasOverlay.classList.remove("hidden");
});

aliasCancelBtn.addEventListener("click", () => aliasOverlay.classList.add("hidden"));
aliasOverlay.addEventListener("click", (e) => {
  if (e.target === aliasOverlay) aliasOverlay.classList.add("hidden");
});

aliasSaveBtn.addEventListener("click", async () => {
  if (!currentOtherUid) return;
  await setContactAlias(currentUser.uid, currentOtherUid, {
    firstName: aliasFirstname.value,
    lastName: aliasLastname.value,
  });
  aliasOverlay.classList.add("hidden");
  const contact = contactsMap.get(currentOtherUid);
  if (contact) {
    chatTitle.textContent = contactDisplayName(
      { firstName: aliasFirstname.value.trim(), lastName: aliasLastname.value.trim() },
      currentOtherProfile
    );
  }
});

// ---------- Notifications (sound / desktop) ----------

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
    [...chatData.participants].sort().join("_") === currentChatId;
  if (isViewingThisChat) return;

  const notifPrefs = myProfile?.notifications || {};
  if (notifPrefs.sound !== false) beep();

  if (notifPrefs.desktop && "Notification" in window && Notification.permission === "granted") {
    const senderUid = chatData.lastMessageSenderId;
    const senderProfile = contactsMap.get(senderUid)?.profile || (await getProfile(senderUid));
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

const SETTINGS_SECTION_TITLES = {
  profile: "Профиль",
  privacy: "Приватность",
  notifications: "Уведомления",
  sessions: "Сессии",
};

function showSettingsMenu() {
  settingsMenu.classList.remove("hidden");
  document.querySelectorAll(".settings-tab-panel").forEach((p) => p.classList.add("hidden"));
  settingsHeaderTitle.textContent = "Настройки";
  settingsBackBtn.classList.add("hidden");
}

function showSettingsSection(section) {
  settingsMenu.classList.add("hidden");
  document.querySelectorAll(".settings-tab-panel").forEach((p) => {
    p.classList.toggle("hidden", p.dataset.spanel !== section);
  });
  settingsHeaderTitle.textContent = SETTINGS_SECTION_TITLES[section] || "Настройки";
  settingsBackBtn.classList.remove("hidden");
  if (section === "sessions") loadSessions();
}

settingsMenuItems.forEach((btn) => {
  btn.addEventListener("click", () => showSettingsSection(btn.dataset.section));
});

settingsBackBtn.addEventListener("click", showSettingsMenu);

function openSettings() {
  settingsProfileError.textContent = "";
  settingsPrivacyError.textContent = "";
  settingsNotifError.textContent = "";
  pwError.textContent = "";
  deleteAccountError.textContent = "";
  pwCurrent.value = pwNew.value = pwConfirm.value = "";
  deleteAccountConfirm.classList.add("hidden");
  deleteAccountPassword.value = "";

  selectedSettingsAvatarImage = myProfile.avatarImage || null;
  renderSettingsAvatarPreview();

  settingsDisplayname.value = myProfile.displayName || "";
  settingsUsername.value = myProfile.username || "";
  settingsUsernameHint.textContent = "";
  settingsBio.value = myProfile.bio || "";

  privacyLastseen.value = myProfile.privacy?.lastSeenVisibility || "everyone";

  notifSound.checked = myProfile.notifications?.sound !== false;
  notifDesktop.checked = !!myProfile.notifications?.desktop;
  notifPreview.checked = myProfile.notifications?.preview !== false;

  showSettingsMenu();
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
    const privacy = { lastSeenVisibility: privacyLastseen.value };
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

// ---------- Sessions tab: password change, session history, delete account ----------

pwSaveBtn.addEventListener("click", async () => {
  pwError.textContent = "";
  if (!pwNew.value || pwNew.value.length < 6) {
    pwError.textContent = "Новый пароль минимум 6 символов";
    return;
  }
  if (pwNew.value !== pwConfirm.value) {
    pwError.textContent = "Пароли не совпадают";
    return;
  }
  pwSaveBtn.disabled = true;
  try {
    await changePassword(currentUser, pwCurrent.value, pwNew.value);
    pwCurrent.value = pwNew.value = pwConfirm.value = "";
    pwError.textContent = "";
    pwError.classList.add("ok-text");
    pwError.textContent = "Пароль изменён";
  } catch (err) {
    console.error(err);
    pwError.classList.remove("ok-text");
    pwError.textContent = err.message || "Не удалось сменить пароль";
  } finally {
    pwSaveBtn.disabled = false;
  }
});

function loadSessions() {
  if (sessionsUnsub) return;
  let currentSessionId = null;
  try {
    currentSessionId = sessionStorage.getItem("currentSessionId");
  } catch (_) {
    /* ignore */
  }

  sessionsUnsub = listenSessions(currentUser.uid, (sessions) => {
    if (sessions.length === 0) {
      sessionsListEl.innerHTML = '<div class="empty-list">История пуста</div>';
      return;
    }
    sessionsListEl.innerHTML = "";
    sessions.forEach((s) => {
      const isCurrent = s.id === currentSessionId;
      const row = document.createElement("div");
      row.className = "session-row" + (isCurrent ? " current" : "");
      row.innerHTML = `
        <div>
          <div class="session-device"></div>
          <div class="session-time"></div>
        </div>
      `;
      row.querySelector(".session-device").textContent = s.device || "Неизвестное устройство";
      row.querySelector(".session-time").textContent = isCurrent
        ? "Текущая сессия"
        : fmtDateTime(s.createdAt);
      if (isCurrent) {
        row.querySelector(".session-time").classList.add("session-current-badge");
      } else {
        const forgetBtn = document.createElement("button");
        forgetBtn.type = "button";
        forgetBtn.className = "link-btn";
        forgetBtn.title = "Забыть эту запись";
        forgetBtn.textContent = "Забыть";
        forgetBtn.addEventListener("click", () => forgetSession(currentUser.uid, s.id));
        row.appendChild(forgetBtn);
      }
      sessionsListEl.appendChild(row);
    });
  });
}

sessionsLogoutBtn.addEventListener("click", async () => {
  cleanupSubscriptions();
  await logout();
});

deleteAccountOpenBtn.addEventListener("click", () => {
  deleteAccountConfirm.classList.remove("hidden");
});

deleteAccountCancelBtn.addEventListener("click", () => {
  deleteAccountConfirm.classList.add("hidden");
  deleteAccountPassword.value = "";
  deleteAccountError.textContent = "";
});

deleteAccountConfirmBtn.addEventListener("click", async () => {
  deleteAccountError.textContent = "";
  if (!deleteAccountPassword.value) {
    deleteAccountError.textContent = "Введите пароль";
    return;
  }
  deleteAccountConfirmBtn.disabled = true;
  try {
    cleanupSubscriptions();
    await deleteAccount(currentUser, deleteAccountPassword.value, myProfile.username);
    window.location.href = "/login";
  } catch (err) {
    console.error(err);
    deleteAccountError.textContent = err.message || "Не удалось удалить аккаунт";
    deleteAccountConfirmBtn.disabled = false;
  }
});
