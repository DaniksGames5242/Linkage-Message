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
import {
  ensureChat,
  listenMyChats,
  listenMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  listenChatDoc,
  setTyping,
  hideChatForMe,
  clearChatForMe,
} from "./chats.js";
import { listenSavedMessages, addSavedMessage, editSavedMessage, deleteSavedMessage } from "./saved.js";
import { listenNotificationsFeed, addBroadcast } from "./notify.js";
import {
  createGroup,
  listenMyGroups,
  listenGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  toggleGroupReaction,
  hideGroupForMe,
  clearGroupForMe,
} from "./groups.js";
import { addStory, deleteStory, listenRecentStories, STORY_LIFETIME_MS } from "./stories.js";
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
  imageFileToDataUrl,
  fmtFileSize,
  attachPasswordToggle,
  EMOJI_PICKER_SET,
  REACTION_EMOJIS,
} from "./utils.js";
import { uploadToCloudinary } from "./upload.js";

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
const chatMenuBtn = document.getElementById("chat-menu-btn");
const chatMenuDropdown = document.getElementById("chat-menu-dropdown");
const chatMenuClearBtn = document.getElementById("chat-menu-clear-btn");
const chatMenuDeleteBtn = document.getElementById("chat-menu-delete-btn");
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");
const backToListBtn = document.getElementById("back-to-list-btn");

const emojiBtn = document.getElementById("emoji-btn");
const emojiPicker = document.getElementById("emoji-picker");
const attachBtn = document.getElementById("attach-btn");
const attachInput = document.getElementById("attach-input");
const voiceBtn = document.getElementById("voice-btn");
const attachErrorEl = document.getElementById("attach-error");

const replyPreviewEl = document.getElementById("reply-preview");
const replyPreviewSenderEl = document.getElementById("reply-preview-sender");
const replyPreviewTextEl = document.getElementById("reply-preview-text");
const replyCancelBtn = document.getElementById("reply-cancel-btn");

const storiesStripEl = document.getElementById("stories-strip");
const storyAddInput = document.getElementById("story-add-input");
const storyViewerOverlay = document.getElementById("story-viewer-overlay");
const storyProgressTrack = document.getElementById("story-progress-track");
const storyViewerAvatar = document.getElementById("story-viewer-avatar");
const storyViewerName = document.getElementById("story-viewer-name");
const storyViewerTime = document.getElementById("story-viewer-time");
const storyViewerImage = document.getElementById("story-viewer-image");
const storyDeleteBtn = document.getElementById("story-delete-btn");
const storyCloseBtn = document.getElementById("story-close-btn");
const storyPrevBtn = document.getElementById("story-prev-btn");
const storyNextBtn = document.getElementById("story-next-btn");

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
const settingsBirthday = document.getElementById("settings-birthday");
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
let replyToMessage = null;

let unsubChats = null;
let unsubGroups = null;
let unsubMessages = null;
let unsubChatDoc = null;
let unsubContacts = null;
let unsubStories = null;
let chatsInitialized = false;
let presenceInterval = null;
let typingClearTimer = null;
let sessionsUnsub = null;

let pendingGroupType = "group";
let pendingGroupAvatarImage = null;
let pendingGroupMembers = new Map(); // uid -> profile

let currentClearedAt = 0; // ms threshold - messages at/before this are hidden from my view
let currentChatRawMessages = [];
let editingMessageId = null;
let mediaRecorder = null;
let recordedChunks = [];
let stories = [];
let activeStoryGroup = null; // { ownerUid, profile, items: [...] } currently being viewed
let activeStoryIndex = 0;
let storyAdvanceTimer = null;
const STORY_DURATION_MS = 5000;

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
  if (unsubStories) unsubStories();
  if (sessionsUnsub) sessionsUnsub();
  if (presenceInterval) clearInterval(presenceInterval);
  unsubChats = unsubGroups = unsubMessages = unsubChatDoc = unsubContacts = unsubStories = sessionsUnsub = presenceInterval = null;
  chatsInitialized = false;
}

// ---------- Main app ----------

function enterApp() {
  appEl.classList.remove("hidden");
  renderMe();
  listenContactsList();
  listenChatsList();
  listenGroupsList();
  listenStoriesList();
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

function showChatsLoadError(err) {
  const isIndexError = err?.code === "failed-precondition" || /index/i.test(err?.message || "");
  chatListEl.innerHTML = `<div class="empty-list">
    Не удалось загрузить список чатов.<br />
    ${
      isIndexError
        ? "Firestore просит создать составной индекс — откройте консоль браузера (F12), там будет ссылка вида «Create index», перейдите по ней и нажмите «Create». Через 1-2 минуты обновите страницу."
        : "Проверьте правила Firestore (firestore.rules) и консоль браузера для деталей."
    }
  </div>`;
}

function listenChatsList() {
  unsubChats = listenMyChats(
    currentUser.uid,
    (list, changes) => {
      chats = list;
      renderChats();
      if (chatsInitialized) {
        changes.forEach((c) => {
          if (c.type === "removed") return;
          maybeNotify(c.data);
        });
      }
      chatsInitialized = true;
    },
    showChatsLoadError
  );
}

function listenGroupsList() {
  unsubGroups = listenMyGroups(
    currentUser.uid,
    (list) => {
      groups = list;
      renderChats();
    },
    showChatsLoadError
  );
}

// ---------- Stories ----------

function listenStoriesList() {
  unsubStories = listenRecentStories(
    (list) => {
      stories = list;
      renderStoriesStrip();
    },
    (err) => console.error("Stories load failed:", err)
  );
}

function renderStoriesStrip() {
  storiesStripEl.innerHTML = "";

  const byOwner = new Map();
  stories.forEach((s) => {
    if (!byOwner.has(s.ownerId)) byOwner.set(s.ownerId, []);
    byOwner.get(s.ownerId).push(s);
  });
  byOwner.forEach((list) => list.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)));

  const myStories = byOwner.get(currentUser.uid) || [];
  const myBubble = document.createElement("div");
  myBubble.className = "story-bubble";
  myBubble.innerHTML = `
    <div class="story-ring${myStories.length ? "" : " story-add-badge"}">${avatarHTML(myProfile, currentUser.uid)}</div>
    <div class="story-bubble-label">Вы</div>
  `;
  myBubble.addEventListener("click", () => {
    if (myStories.length > 0) openStoryViewer(currentUser.uid, myProfile, myStories);
    else storyAddInput.click();
  });
  storiesStripEl.appendChild(myBubble);

  const otherEntries = Array.from(byOwner.entries())
    .filter(([uid]) => uid !== currentUser.uid)
    .sort((a, b) => {
      const ta = a[1][a[1].length - 1]?.createdAt?.toMillis?.() || 0;
      const tb = b[1][b[1].length - 1]?.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

  otherEntries.forEach(async ([uid, list]) => {
    const profile = contactsMap.get(uid)?.profile || (await getProfile(uid));
    if (!profile) return;
    const bubble = document.createElement("div");
    bubble.className = "story-bubble";
    bubble.innerHTML = `
      <div class="story-ring">${avatarHTML(profile, uid)}</div>
      <div class="story-bubble-label"></div>
    `;
    bubble.querySelector(".story-bubble-label").textContent = profile.displayName;
    bubble.addEventListener("click", () => openStoryViewer(uid, profile, list));
    storiesStripEl.appendChild(bubble);
  });
}

storyAddInput.addEventListener("change", async () => {
  const file = storyAddInput.files?.[0];
  storyAddInput.value = "";
  if (!file) return;
  try {
    const dataUrl = await imageFileToDataUrl(file, 1080, 0.7);
    await addStory(currentUser.uid, dataUrl);
  } catch (err) {
    console.error(err);
    alert(err.message || "Не удалось опубликовать историю");
  }
});

function openStoryViewer(ownerUid, profile, items) {
  activeStoryGroup = { ownerUid, profile, items: [...items] };
  activeStoryIndex = 0;
  storyViewerAvatar.innerHTML = avatarHTML(profile, ownerUid);
  storyViewerName.textContent = profile.displayName;
  storyDeleteBtn.classList.toggle("hidden", ownerUid !== currentUser.uid);
  buildStoryProgress();
  showStoryAt(0);
  storyViewerOverlay.classList.remove("hidden");
}

function buildStoryProgress() {
  storyProgressTrack.innerHTML = "";
  activeStoryGroup.items.forEach(() => {
    const bar = document.createElement("div");
    bar.className = "story-progress-bar";
    bar.innerHTML = '<div class="story-progress-fill"></div>';
    storyProgressTrack.appendChild(bar);
  });
}

function showStoryAt(index) {
  clearTimeout(storyAdvanceTimer);
  if (!activeStoryGroup || index < 0 || index >= activeStoryGroup.items.length) {
    closeStoryViewer();
    return;
  }
  activeStoryIndex = index;
  const story = activeStoryGroup.items[index];
  storyViewerImage.src = story.image;
  storyViewerTime.textContent = fmtRelative(story.createdAt);

  const bars = storyProgressTrack.querySelectorAll(".story-progress-bar");
  bars.forEach((bar, i) => {
    bar.classList.toggle("done", i < index);
    const fill = bar.querySelector(".story-progress-fill");
    if (i < index) {
      fill.style.transition = "none";
      fill.style.width = "100%";
    } else if (i === index) {
      fill.style.transition = "none";
      fill.style.width = "0%";
      requestAnimationFrame(() => {
        fill.style.transition = `width ${STORY_DURATION_MS}ms linear`;
        fill.style.width = "100%";
      });
    } else {
      fill.style.transition = "none";
      fill.style.width = "0%";
    }
  });

  storyAdvanceTimer = setTimeout(() => showStoryAt(index + 1), STORY_DURATION_MS);
}

function closeStoryViewer() {
  clearTimeout(storyAdvanceTimer);
  storyViewerOverlay.classList.add("hidden");
  activeStoryGroup = null;
}

storyPrevBtn.addEventListener("click", () => showStoryAt(activeStoryIndex - 1));
storyNextBtn.addEventListener("click", () => showStoryAt(activeStoryIndex + 1));
storyCloseBtn.addEventListener("click", closeStoryViewer);

storyDeleteBtn.addEventListener("click", async () => {
  if (!activeStoryGroup) return;
  if (!confirm("Удалить историю?")) return;
  const story = activeStoryGroup.items[activeStoryIndex];
  try {
    await deleteStory(story.id);
  } catch (err) {
    console.error(err);
    alert(err.message || "Не удалось удалить историю");
    return;
  }
  activeStoryGroup.items.splice(activeStoryIndex, 1);
  if (activeStoryGroup.items.length === 0) {
    closeStoryViewer();
  } else {
    buildStoryProgress();
    showStoryAt(Math.min(activeStoryIndex, activeStoryGroup.items.length - 1));
  }
});

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
    ...chats.filter((c) => !(c.hiddenFor || []).includes(currentUser.uid)).map((data) => ({ kind: "contact", data })),
    ...groups.filter((g) => !(g.hiddenFor || []).includes(currentUser.uid)).map((data) => ({ kind: "group", data })),
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
  stopVoiceRecording(true);

  emptyState.classList.add("hidden");
  chatHeader.classList.remove("hidden");
  messagesEl.classList.remove("hidden");
  composer.classList.remove("hidden");
  sidebar.classList.add("chat-open");
  chatSub.textContent = "";
  chatSub.classList.remove("typing");
  editContactBtn.classList.add("hidden");
  chatMenuBtn.classList.add("hidden");
  chatMenuDropdown.classList.add("hidden");
  emojiPicker.classList.add("hidden");
  attachErrorEl.textContent = "";
  currentClearedAt = 0;
  editingMessageId = null;
  cancelReply();
  msgInput.value = "";
  msgInput.style.height = "auto";
  updateComposerButtons();
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
  currentChatRawMessages = [];

  const chatData = chats.find((c) => c.id === chatId);
  currentClearedAt = chatData?.clearedFor?.[currentUser.uid]?.toMillis?.() || 0;

  const contact = contactsMap.get(otherUid);
  chatHeaderAvatar.innerHTML = avatarHTML(profile, otherUid);
  chatTitle.textContent = contact ? contactDisplayName(contact.alias, profile) : profile.displayName;
  chatSub.textContent = "@" + profile.username;
  editContactBtn.classList.remove("hidden");
  chatMenuBtn.classList.remove("hidden");

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  unsubMessages = listenMessages(chatId, (msgs) => {
    if (currentChatId !== chatId) return;
    currentChatRawMessages = msgs;
    rerenderMessages();
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

let groupSenderCache = new Map();
let currentGroupRef = null;

function openGroupChat(group) {
  resetChatView();
  currentChatId = group.id;
  currentChatType = group.type;
  currentOtherUid = null;
  currentOtherProfile = null;
  currentChatRawMessages = [];
  currentGroupRef = group;
  groupSenderCache = new Map();
  currentClearedAt = group.clearedFor?.[currentUser.uid]?.toMillis?.() || 0;

  chatHeaderAvatar.innerHTML = groupAvatarHTML(group);
  chatTitle.textContent = group.name;
  chatSub.textContent = pluralMembers((group.members || []).length);
  chatMenuBtn.classList.remove("hidden");

  const canPost = group.type === "group" || (group.admins || []).includes(currentUser.uid);
  composer.classList.toggle("hidden", !canPost);

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  unsubMessages = listenGroupMessages(group.id, (msgs) => {
    if (currentChatId !== group.id) return;
    currentChatRawMessages = msgs;
    rerenderMessages();
  });
}

async function renderGroupMessagesList(msgs) {
  messagesEl.innerHTML = "";
  if (msgs.length === 0) {
    messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>';
    return;
  }
  for (const msg of msgs) {
    const isMine = msg.senderId === currentUser.uid;
    let senderName = null;
    if (!isMine) {
      if (!groupSenderCache.has(msg.senderId)) {
        const p = contactsMap.get(msg.senderId)?.profile || (await getProfile(msg.senderId));
        groupSenderCache.set(msg.senderId, p);
      }
      senderName = groupSenderCache.get(msg.senderId)?.displayName || "—";
    }
    renderMessage(msg, isMine, senderName);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function rerenderMessages() {
  const visible = currentChatRawMessages.filter(
    (m) => !currentClearedAt || !m.createdAt?.toMillis || m.createdAt.toMillis() > currentClearedAt
  );
  if (currentChatType === "contact") {
    renderPlainMessages(visible, (msg) => msg.senderId === currentUser.uid);
  } else if (currentChatType === "group" || currentChatType === "channel") {
    renderGroupMessagesList(visible);
  }
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

// Returns {edit, del, react} functions bound to the currently open chat, or
// nulls where an action isn't supported (e.g. read-only Notifications feed).
function messageOps() {
  if (currentChatType === "saved") {
    return {
      edit: (id, text) => editSavedMessage(currentUser.uid, id, text),
      del: (id) => deleteSavedMessage(currentUser.uid, id),
      react: null,
    };
  }
  if (currentChatType === "group" || currentChatType === "channel") {
    return {
      edit: (id, text) => editGroupMessage(currentChatId, id, text),
      del: (id) => deleteGroupMessage(currentChatId, id),
      react: (id, emoji, add) => toggleGroupReaction(currentChatId, id, emoji, currentUser.uid, add),
    };
  }
  if (currentChatType === "contact") {
    return {
      edit: (id, text) => editMessage(currentChatId, id, text),
      del: (id) => deleteMessage(currentChatId, id),
      react: (id, emoji, add) => toggleReaction(currentChatId, id, emoji, currentUser.uid, add),
    };
  }
  return { edit: null, del: null, react: null };
}

const DEFAULT_CAPTIONS = ["📷", "🎬", "🎤"];

// ---------- Reply-to-message ----------

function replySenderLabel(msg) {
  if (msg.senderId === currentUser.uid) return "Вы";
  if (currentChatType === "group" || currentChatType === "channel") {
    return groupSenderCache.get(msg.senderId)?.displayName || "…";
  }
  return chatTitle.textContent || "…";
}

function replyPreviewText(msg) {
  if (msg.imageUrl) return "📷 Фото";
  if (msg.voiceUrl) return "🎤 Голосовое сообщение";
  if (msg.fileUrl) {
    if ((msg.fileType || "").startsWith("video/")) return "🎬 Видео";
    return `📎 ${msg.fileName || "Файл"}`;
  }
  return msg.text || "";
}

function startReply(msg) {
  replyToMessage = msg;
  replyPreviewSenderEl.textContent = replySenderLabel(msg);
  replyPreviewTextEl.textContent = replyPreviewText(msg).slice(0, 120);
  replyPreviewEl.classList.remove("hidden");
  msgInput.focus();
}

function cancelReply() {
  replyToMessage = null;
  replyPreviewEl?.classList.add("hidden");
}

replyCancelBtn?.addEventListener("click", cancelReply);

function scrollToMessage(messageId) {
  const row = messagesEl.querySelector(`[data-msg-id="${CSS.escape(messageId)}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  row.classList.add("flash-highlight");
  setTimeout(() => row.classList.remove("flash-highlight"), 1000);
}

function renderBubbleContent(bubble, msg) {
  bubble.innerHTML = "";
  if (msg.imageUrl) {
    const img = document.createElement("img");
    img.className = "msg-image";
    img.src = msg.imageUrl;
    img.alt = "";
    img.addEventListener("click", () => window.open(msg.imageUrl, "_blank"));
    bubble.appendChild(img);
  } else if (msg.voiceUrl) {
    const audio = document.createElement("audio");
    audio.className = "msg-audio";
    audio.controls = true;
    audio.src = msg.voiceUrl;
    bubble.appendChild(audio);
  } else if (msg.fileUrl) {
    const fileType = msg.fileType || "";
    if (fileType.startsWith("video/")) {
      const video = document.createElement("video");
      video.className = "msg-video";
      video.controls = true;
      video.src = msg.fileUrl;
      bubble.appendChild(video);
    } else if (fileType.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.className = "msg-audio";
      audio.controls = true;
      audio.src = msg.fileUrl;
      bubble.appendChild(audio);
    } else {
      const link = document.createElement("a");
      link.className = "msg-file-card";
      link.href = msg.fileUrl;
      link.download = msg.fileName || "file";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = `
        <div class="msg-file-icon">📎</div>
        <div class="msg-file-meta">
          <div class="msg-file-name"></div>
          <div class="msg-file-size"></div>
        </div>
      `;
      link.querySelector(".msg-file-name").textContent = msg.fileName || "Файл";
      link.querySelector(".msg-file-size").textContent = fmtFileSize(msg.fileSize || 0);
      bubble.appendChild(link);
    }
  }

  const hasAttachment = !!(msg.imageUrl || msg.voiceUrl || msg.fileUrl);
  const isPlaceholderCaption = DEFAULT_CAPTIONS.includes(msg.text) || msg.text === `📎 ${msg.fileName}`;
  if (msg.text && !(hasAttachment && isPlaceholderCaption)) {
    const p = document.createElement("div");
    p.className = "bubble-text";
    p.textContent = msg.text;
    bubble.appendChild(p);
  }
}

function buildReactionsBar(msg, reactFn) {
  const bar = document.createElement("div");
  bar.className = "msg-reactions";
  const reactions = msg.reactions || {};
  Object.entries(reactions).forEach(([emoji, uids]) => {
    if (!uids || uids.length === 0) return;
    const mine = uids.includes(currentUser.uid);
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "reaction-pill" + (mine ? " mine" : "");
    pill.textContent = `${emoji} ${uids.length}`;
    pill.addEventListener("click", () => reactFn(msg.id, emoji, !mine));
    bar.appendChild(pill);
  });
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "react-add-btn";
  addBtn.textContent = "🙂+";
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleReactionPicker(addBtn, msg, reactFn);
  });
  bar.appendChild(addBtn);
  return bar;
}

function toggleReactionPicker(anchorBtn, msg, reactFn) {
  const existing = document.querySelector(".react-picker");
  if (existing) existing.remove();
  if (existing?.dataset.msgId === msg.id) return;

  const picker = document.createElement("div");
  picker.className = "react-picker";
  picker.dataset.msgId = msg.id;
  REACTION_EMOJIS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      const mine = (msg.reactions?.[emoji] || []).includes(currentUser.uid);
      reactFn(msg.id, emoji, !mine);
      picker.remove();
    });
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  const rect = anchorBtn.getBoundingClientRect();
  picker.style.left = Math.max(4, rect.left) + "px";
  picker.style.top = Math.max(4, rect.top - 42) + "px";
  setTimeout(() => {
    document.addEventListener("click", function closePicker(ev) {
      if (!picker.contains(ev.target)) {
        picker.remove();
        document.removeEventListener("click", closePicker);
      }
    });
  }, 0);
}

function startEditingMessage(row, msg, editFn) {
  const group = row.querySelector(".msg-group");
  const original = group.innerHTML;
  group.innerHTML = `
    <div class="msg-edit-box">
      <textarea rows="2"></textarea>
      <div class="msg-edit-actions">
        <button type="button" class="small-btn secondary" data-act="cancel">Отмена</button>
        <button type="button" class="small-btn" data-act="save">Сохранить</button>
      </div>
    </div>
  `;
  const textarea = group.querySelector("textarea");
  textarea.value = msg.text;
  textarea.focus();
  group.querySelector('[data-act="cancel"]').addEventListener("click", () => {
    group.innerHTML = original;
  });
  group.querySelector('[data-act="save"]').addEventListener("click", async () => {
    try {
      await editFn(msg.id, textarea.value);
    } catch (err) {
      console.error(err);
      alert(err.message || "Не удалось сохранить");
    }
  });
}

function renderMessage(msg, isMine, senderName) {
  const ops = messageOps();
  const canEdit = isMine && !!ops.edit;
  const canDelete = isMine && !!ops.del;
  const canReact = !!ops.react;
  const canReply = currentChatType !== "notifications" && !composer.classList.contains("hidden");

  const row = document.createElement("div");
  row.className = "msg-row" + (isMine ? " me" : "");
  row.dataset.msgId = msg.id;

  const actionsHTML =
    canReply || canEdit || canDelete
      ? `<div class="msg-actions">
          ${canReply ? '<button type="button" class="msg-reply-btn" title="Ответить">↩</button>' : ""}
          ${canEdit ? '<button type="button" class="msg-edit-btn" title="Редактировать">✎</button>' : ""}
          ${canDelete ? '<button type="button" class="msg-delete-btn" title="Удалить">🗑</button>' : ""}
        </div>`
      : "";

  row.innerHTML = `
    ${actionsHTML}
    <div class="msg-group">
      ${senderName ? '<div class="msg-sender"></div>' : ""}
      ${msg.replyTo ? '<div class="msg-reply-quote"><div class="msg-reply-sender"></div><div class="msg-reply-text"></div></div>' : ""}
      <div class="bubble"></div>
      <div class="msg-time"></div>
    </div>
  `;
  if (senderName) row.querySelector(".msg-sender").textContent = senderName;

  if (msg.replyTo) {
    const quote = row.querySelector(".msg-reply-quote");
    quote.querySelector(".msg-reply-sender").textContent = msg.replyTo.senderName || "…";
    quote.querySelector(".msg-reply-text").textContent = msg.replyTo.text || "";
    quote.addEventListener("click", () => scrollToMessage(msg.replyTo.id));
  }

  renderBubbleContent(row.querySelector(".bubble"), msg);

  const timeEl = row.querySelector(".msg-time");
  timeEl.textContent = fmtTime(msg.createdAt);
  if (msg.edited) {
    const tag = document.createElement("span");
    tag.className = "msg-edited-tag";
    tag.textContent = "(ред.)";
    timeEl.appendChild(tag);
  }

  if (canReact) {
    row.querySelector(".msg-group").appendChild(buildReactionsBar(msg, ops.react));
  }
  if (canReply) {
    row.querySelector(".msg-reply-btn").addEventListener("click", () => startReply(msg));
  }
  if (canEdit) {
    row.querySelector(".msg-edit-btn").addEventListener("click", () => startEditingMessage(row, msg, ops.edit));
  }
  if (canDelete) {
    row.querySelector(".msg-delete-btn").addEventListener("click", async () => {
      if (!confirm("Удалить сообщение?")) return;
      try {
        await ops.del(msg.id);
      } catch (err) {
        console.error(err);
        alert(err.message || "Не удалось удалить");
      }
    });
  }

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

function updateComposerButtons() {
  const hasText = msgInput.value.trim().length > 0;
  voiceBtn.classList.toggle("hidden", hasText);
  sendBtn.classList.toggle("hidden", !hasText);
}

msgInput.addEventListener("input", () => {
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
  updateComposerButtons();

  if (currentChatType === "contact") {
    setTyping(currentChatId, currentUser.uid, true);
    clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => setTyping(currentChatId, currentUser.uid, false), 3000);
  }
});

async function doSendMessage(attachment) {
  const text = msgInput.value.trim();
  if (!text && !attachment) return;
  if (!currentChatId) return;
  const replyPayload = replyToMessage
    ? { id: replyToMessage.id, senderName: replySenderLabel(replyToMessage), text: replyPreviewText(replyToMessage).slice(0, 120) }
    : null;
  msgInput.value = "";
  msgInput.style.height = "auto";
  updateComposerButtons();
  sendBtn.disabled = true;
  clearTimeout(typingClearTimer);
  closeEmojiPicker();
  cancelReply();
  try {
    if (currentChatType === "saved") {
      await addSavedMessage(currentUser.uid, text, replyPayload);
    } else if (currentChatType === "notifications") {
      await addBroadcast(currentUser.uid, text);
    } else if (currentChatType === "group" || currentChatType === "channel") {
      await sendGroupMessage(currentChatId, currentUser.uid, text, attachment, replyPayload);
    } else {
      await sendMessage(currentChatId, currentUser.uid, text, attachment, replyPayload);
    }
  } catch (err) {
    console.error(err);
    alert("Не удалось отправить сообщение: " + err.message);
  } finally {
    sendBtn.disabled = false;
  }
}

// ---------- Emoji picker ----------

function openEmojiPicker() {
  emojiPicker.innerHTML = "";
  EMOJI_PICKER_SET.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-option";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      msgInput.value += emoji;
      msgInput.dispatchEvent(new Event("input"));
      msgInput.focus();
    });
    emojiPicker.appendChild(btn);
  });
  emojiPicker.classList.remove("hidden");
}

function closeEmojiPicker() {
  emojiPicker.classList.add("hidden");
}

emojiBtn.addEventListener("click", () => {
  if (emojiPicker.classList.contains("hidden")) openEmojiPicker();
  else closeEmojiPicker();
});

// ---------- File / photo / video attachments ----------

async function buildFileAttachment(file) {
  if (file.type.startsWith("image/")) {
    const { url } = await uploadToCloudinary(file, "image");
    const label = file.type === "image/gif" ? "📷 GIF" : "📷 Фото";
    return { fields: { imageUrl: url }, previewText: label, defaultCaption: "📷" };
  }
  if (file.type.startsWith("video/")) {
    const { url } = await uploadToCloudinary(file, "video");
    return {
      fields: { fileUrl: url, fileName: file.name, fileType: file.type, fileSize: file.size },
      previewText: "🎬 Видео",
      defaultCaption: "🎬",
    };
  }
  if (file.type.startsWith("audio/")) {
    const { url } = await uploadToCloudinary(file, "video"); // Cloudinary files audio under "video"
    return {
      fields: { fileUrl: url, fileName: file.name, fileType: file.type, fileSize: file.size },
      previewText: `📎 ${file.name}`,
      defaultCaption: `📎 ${file.name}`,
    };
  }
  const { url } = await uploadToCloudinary(file, "raw");
  return {
    fields: {
      fileUrl: url,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
    },
    previewText: `📎 ${file.name}`,
    defaultCaption: `📎 ${file.name}`,
  };
}

attachBtn.addEventListener("click", () => attachInput.click());

attachInput.addEventListener("change", async () => {
  const file = attachInput.files?.[0];
  attachInput.value = "";
  if (!file) return;
  attachErrorEl.textContent = "";
  attachBtn.disabled = true;
  try {
    const attachment = await buildFileAttachment(file);
    await doSendMessage(attachment);
  } catch (err) {
    console.error(err);
    attachErrorEl.textContent = err.message || "Не удалось прикрепить файл";
  } finally {
    attachBtn.disabled = false;
  }
});

// ---------- Voice messages ----------

let activeMicStream = null;
let voiceDiscard = false;

async function startVoiceRecording() {
  attachErrorEl.textContent = "";
  try {
    activeMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error(err);
    attachErrorEl.textContent = "Нет доступа к микрофону";
    return;
  }
  recordedChunks = [];
  voiceDiscard = false;
  mediaRecorder = new MediaRecorder(activeMicStream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    activeMicStream?.getTracks().forEach((t) => t.stop());
    activeMicStream = null;
    voiceBtn.classList.remove("recording");
    if (voiceDiscard || recordedChunks.length === 0) return;
    try {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      const voiceFile = new File([blob], "voice.webm", { type: blob.type });
      const { url } = await uploadToCloudinary(voiceFile, "video"); // Cloudinary files audio under "video"
      await doSendMessage({ fields: { voiceUrl: url }, previewText: "🎤 Голосовое сообщение", defaultCaption: "🎤" });
    } catch (err) {
      console.error(err);
      attachErrorEl.textContent = err.message || "Не удалось отправить голосовое сообщение";
    }
  };
  mediaRecorder.start();
  voiceBtn.classList.add("recording");
}

function stopVoiceRecording(discard) {
  voiceDiscard = discard;
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

voiceBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    stopVoiceRecording(false);
  } else {
    startVoiceRecording();
  }
});

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

// ---------- Chat menu: clear history / delete chat (per-user, non-destructive) ----------

chatMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  chatMenuDropdown.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!chatMenuDropdown.classList.contains("hidden") && !chatMenuDropdown.contains(e.target) && e.target !== chatMenuBtn) {
    chatMenuDropdown.classList.add("hidden");
  }
});

chatMenuClearBtn.addEventListener("click", async () => {
  chatMenuDropdown.classList.add("hidden");
  if (!confirm("Очистить историю сообщений? Это уберёт их только из вашей ленты.")) return;
  if (currentChatType === "contact") await clearChatForMe(currentChatId, currentUser.uid);
  else if (currentChatType === "group" || currentChatType === "channel") await clearGroupForMe(currentChatId, currentUser.uid);
  currentClearedAt = Date.now();
  rerenderMessages();
});

chatMenuDeleteBtn.addEventListener("click", async () => {
  chatMenuDropdown.classList.add("hidden");
  if (!confirm("Удалить чат из списка? Он вернётся, если придёт новое сообщение.")) return;
  if (currentChatType === "contact") await hideChatForMe(currentChatId, currentUser.uid);
  else if (currentChatType === "group" || currentChatType === "channel") await hideGroupForMe(currentChatId, currentUser.uid);
  closeCurrentChatView();
});

function closeCurrentChatView() {
  if (unsubMessages) unsubMessages();
  if (unsubChatDoc) unsubChatDoc();
  unsubMessages = unsubChatDoc = null;
  currentChatId = null;
  currentChatType = null;
  currentOtherUid = null;
  currentOtherProfile = null;
  chatHeader.classList.add("hidden");
  messagesEl.classList.add("hidden");
  composer.classList.add("hidden");
  emptyState.classList.remove("hidden");
  renderChats();
}

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
  settingsBirthday.value = myProfile.birthday || "";

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
      birthday: settingsBirthday.value || null,
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
