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
import { e2eSupported, initDevice, forgetDevice, hasDevice, deviceId, devicePublicKey, sealFor, openFrom, NotForThisDevice, fingerprint } from "./e2e.js";
import { publishDevice } from "./e2e-store.js";
import { recordCircle, buildVideoNote, circlesSupported } from "./circle.js";
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
  markChatRead,
  setChatPinnedMessage,
  publishScheduled,
  cancelScheduled,
  editEncryptedMessage,
  votePoll,
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
  markGroupRead,
  setGroupPinnedMessage,
  addGroupMembers,
  leaveGroup,
  publishScheduledGroup,
  cancelScheduledGroup,
  voteGroupPoll,
} from "./groups.js";
import { addStory, deleteStory, listenRecentStories, STORY_LIFETIME_MS } from "./stories.js";
import { updateProfileFields, changeUsername, updatePrivacy, updateNotifications, toggleUserListValue } from "./settings.js";
import { initCalls, startCall, fmtDuration } from "./call-ui.js";
import { emojiOnly, animatedEmoji, emojiEffect } from "./emoji-anim.js";
import { EFFECTS, playEffect } from "./effects.js";
import { GAMES, gameForText, rollGame, renderGame, isWin } from "./games.js";
import { appendRich, stripRich, wrapSelection } from "./richtext.js";
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
  describeDevice,
  fmtFileSize,
  attachPasswordToggle,
  EMOJI_PICKER_SET,
  REACTION_EMOJIS,
} from "./utils.js";
import { uploadToCloudinary, prepareImageForUpload, uploadsConfigured } from "./upload.js";
import {
  SPRINGS,
  animate,
  stagger,
  showOverlay,
  hideOverlay,
  topOverlay,
  showPopover,
  hidePopover,
  reveal,
  conceal,
  swapPanels,
  morphText,
  scrambleText,
  captureRects,
  playFlip,
  liquidLens,
  segmentize,
  syncSegmented,
  burst,
  successPulse,
  watchMessages,
  magnetize,
  tilt,
  accentWave,
  accentColors,
  brandMarkSVG,
  centerOf,
  reducedMotion,
  toast,
  progressToast,
  probeFps,
} from "./ui.js";

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
const chatListIndicator = document.getElementById("chat-list-indicator");
const splashEl = document.getElementById("splash");

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
const chatSection = document.getElementById("chat");
const chatTitleStatus = document.getElementById("chat-title-status");
const chatDock = document.getElementById("chat-dock");
const callAudioBtn = document.getElementById("call-audio-btn");
const callVideoBtn = document.getElementById("call-video-btn");
const chatSearchBtn = document.getElementById("chat-search-btn");
const chatSearchBar = document.getElementById("chat-search-bar");
const chatSearchInput = document.getElementById("chat-search-input");
const chatSearchCount = document.getElementById("chat-search-count");
const pinnedBar = document.getElementById("pinned-bar");
const pinnedBarText = document.getElementById("pinned-bar-text");
const pinnedBarUnpin = document.getElementById("pinned-bar-unpin");
const scrollBottomBtn = document.getElementById("scroll-bottom-btn");
const scrollBottomBadge = document.getElementById("scroll-bottom-badge");
const blockedBar = document.getElementById("blocked-bar");
const blockedBarUnblock = document.getElementById("blocked-bar-unblock");
const chatMenuMuteBtn = document.getElementById("chat-menu-mute-btn");
const chatMenuPinBtn = document.getElementById("chat-menu-pin-btn");
const chatMenuBlockBtn = document.getElementById("chat-menu-block-btn");
const chatMenuLeaveBtn = document.getElementById("chat-menu-leave-btn");
const lightboxEl = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxDownload = document.getElementById("lightbox-download");
const forwardOverlay = document.getElementById("forward-overlay");
const forwardSearch = document.getElementById("forward-search");
const forwardList = document.getElementById("forward-list");
const profileViewActions = document.getElementById("profile-view-actions");
const profileMembers = document.getElementById("profile-members");
const profileMembersTitle = document.getElementById("profile-members-title");
const profileMembersAdd = document.getElementById("profile-members-add");
const profileMembersInput = document.getElementById("profile-members-input");
const profileMembersResult = document.getElementById("profile-members-result");
const profileMembersList = document.getElementById("profile-members-list");
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
const storyViewerVideo = document.getElementById("story-viewer-video");
const storyDeleteBtn = document.getElementById("story-delete-btn");
const storyCloseBtn = document.getElementById("story-close-btn");
const storyPrevBtn = document.getElementById("story-prev-btn");
const storyNextBtn = document.getElementById("story-next-btn");

const aliasOverlay = document.getElementById("alias-overlay");
const aliasFirstname = document.getElementById("alias-firstname");
const aliasLastname = document.getElementById("alias-lastname");
const aliasCancelBtn = document.getElementById("alias-cancel-btn");
const aliasSaveBtn = document.getElementById("alias-save-btn");

const chatHeaderInfoBtn = document.getElementById("chat-header-info");
const profileViewOverlay = document.getElementById("profile-view-overlay");
const profileViewCloseBtn = document.getElementById("profile-view-close-btn");
const profileViewAvatar = document.getElementById("profile-view-avatar");
const profileViewName = document.getElementById("profile-view-name");
const profileViewUsername = document.getElementById("profile-view-username");
const profileViewRows = [1, 2, 3].map((i) => ({
  row: document.getElementById(`profile-view-row-${i}`),
  label: document.getElementById(`profile-view-row-${i}-label`),
  value: document.getElementById(`profile-view-row-${i}-value`),
}));

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
const settingsMenuItems = document.querySelectorAll("#settings-menu .settings-menu-item");
const settingsPanelEl = settingsOverlay.querySelector(".settings-panel");
const settingsBodyEl = settingsOverlay.querySelector(".settings-body");
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
const settingsBirthdayClearBtn = document.getElementById("settings-birthday-clear-btn");
const settingsDisplaynameCounter = document.getElementById("settings-displayname-counter");
const settingsBioCounter = document.getElementById("settings-bio-counter");
const settingsCreatedAt = document.getElementById("settings-created-at");
const settingsProfileSave = document.getElementById("settings-profile-save");
const settingsProfileError = document.getElementById("settings-profile-error");

const privacyLastseen = document.getElementById("privacy-lastseen");
const privacyAvatar = document.getElementById("privacy-avatar");
const privacyBio = document.getElementById("privacy-bio");
const privacyBirthday = document.getElementById("privacy-birthday");
const privacyTyping = document.getElementById("privacy-typing");
const settingsPrivacySave = document.getElementById("settings-privacy-save");
const settingsPrivacyError = document.getElementById("settings-privacy-error");

const notifMuteAll = document.getElementById("notif-mute-all");
const notifSound = document.getElementById("notif-sound");
const notifDesktop = document.getElementById("notif-desktop");
const notifPreview = document.getElementById("notif-preview");
const notifGroups = document.getElementById("notif-groups");
const settingsNotifSave = document.getElementById("settings-notif-save");
const settingsNotifError = document.getElementById("settings-notif-error");

const chatsSendOnEnter = document.getElementById("chats-send-on-enter");
const chatsFontSize = document.getElementById("chats-font-size");
const chatsCompact = document.getElementById("chats-compact");
const chatsAccentSwatches = document.querySelectorAll(".accent-swatch");
const chatsPreview = document.getElementById("chats-preview");
const settingsChatsSave = document.getElementById("settings-chats-save");
const settingsChatsError = document.getElementById("settings-chats-error");

const settingsLanguage = document.getElementById("settings-language");
const settingsLanguageSave = document.getElementById("settings-language-save");
const settingsLanguageError = document.getElementById("settings-language-error");

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
let groupsInitialized = false;
let presenceInterval = null;
let typingClearTimer = null;
let sessionsUnsub = null;

let pendingGroupType = "group";
let pendingGroupAvatarImage = null;
let pendingGroupMembers = new Map(); // uid -> profile

let currentClearedAt = 0; // ms threshold - messages at/before this are hidden from my view
let currentChatRawMessages = [];
let currentChatRawSource = []; // as stored (encrypted), for re-decrypting after unlock
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

// ---------- Profile links (/?u=username) ----------

const linkedUsername = new URLSearchParams(location.search).get("u");
if (linkedUsername) {
  try {
    sessionStorage.setItem("lm-open-u", linkedUsername);
  } catch (_) {}
  history.replaceState(null, "", location.pathname + location.hash);
}

async function openLinkedProfile() {
  let username = null;
  try {
    username = sessionStorage.getItem("lm-open-u");
    sessionStorage.removeItem("lm-open-u");
  } catch (_) {}
  if (!username) return;
  try {
    const result = await searchUser(username, currentUser.uid);
    if (!result) {
      toast(`Пользователь @${username} не найден`, { tone: "error" });
      return;
    }
    if (result.self) {
      toast("Это ссылка на ваш профиль 🙂", { icon: "🔗" });
      return;
    }
    await addContact(currentUser.uid, result.uid, contactsMap.has(result.uid));
    const chatId = await ensureChat(currentUser.uid, result.uid);
    openContactChat(chatId, result.uid, result.profile);
  } catch (err) {
    console.error(err);
    toast("Не удалось открыть профиль по ссылке", { tone: "error" });
  }
}

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
  groupsInitialized = false;
}

// ---------- Main app ----------

function enterApp() {
  appEl.classList.remove("hidden");
  renderMe();
  applyLanguage(myProfile.language || "ru");
  applyChatPrefs(myProfile.chatPrefs || {});
  playAppIntro();
  setupCalls();
  initE2E().catch((err) => console.warn("E2E init failed:", err));
  listenContactsList();
  listenChatsList();
  listenGroupsList();
  listenStoriesList();
  touchPresence(currentUser.uid);
  presenceInterval = setInterval(() => touchPresence(currentUser.uid), 45000);
  document.addEventListener("visibilitychange", onVisibilityChange);
  setTimeout(openLinkedProfile, 700);
}

const isMobileLayout = () => window.matchMedia("(max-width: 720px)").matches;

// The splash's logo swells and dissolves while the app condenses out of the
// backdrop: sidebar from the left, chat pane from the right, list cascading.
let introPlayed = false;
function playAppIntro() {
  if (introPlayed) return;
  introPlayed = true;
  if (splashEl) {
    const mark = splashEl.querySelector(".brand-mark");
    if (mark) {
      mark.animate(
        [
          { transform: "none", filter: "blur(0px)" },
          { transform: "scale(3)", filter: "blur(22px)" },
        ],
        { duration: reducedMotion ? 60 : 700, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" }
      );
    }
    splashEl
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 60 : 520, delay: 120, easing: "ease-in", fill: "forwards" })
      .finished.then(() => splashEl.remove(), () => splashEl.remove());
  }
  animate(
    sidebar,
    [
      { opacity: 0, transform: "translateX(-48px) scale(.95)", filter: "blur(14px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { spring: "smooth", delay: 180 }
  );
  if (!isMobileLayout()) {
    animate(
      chatSection,
      [
        { opacity: 0, transform: "translateX(48px) scale(.97)", filter: "blur(14px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      { spring: "smooth", delay: 280 }
    );
  }
  stagger([document.getElementById("sidebar-header"), document.getElementById("search-box")], { y: 14, step: 90, delay: 320 });
  animate(fabNewChat, [{ transform: "scale(0) rotate(-140deg)" }, { transform: "none" }], { spring: "jelly", delay: 750 });
  storiesStripEl.classList.add("strip-intro");
  setTimeout(() => storiesStripEl.classList.remove("strip-intro"), 2200);
  // Once the intro has settled, check the device keeps up; if not (in
  // "auto" mode) switch to economy effects.
  setTimeout(() => probeFps(() => toast("Включён экономный режим эффектов — так будет плавнее", { icon: "⚡" })), 3500);
}

function onVisibilityChange() {
  if (!document.hidden && currentUser) {
    touchPresence(currentUser.uid);
    maybeMarkRead();
    renderChats();
  }
}

function renderMe() {
  menuTriggerBtn.innerHTML = avatarHTML(myProfile, currentUser.uid);
  meName.textContent = myProfile.displayName;
  const badge = statusBadge(myProfile.emojiStatus);
  if (badge) meName.append(" ", badge);
}

// ---------- Emoji status (shown next to the name) ----------

const EMOJI_STATUSES = ["⭐", "🔥", "❤️", "😎", "🚀", "🎮", "🎧", "💼", "🌙", "☕", "🏖️", "🎉", "👑", "💎", "🌸", "⚡", "🍀", "🐱", "🤖", "📚", "🏋️", "✈️", "🎨", "💤"];

function validStatus(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 16 ? value : null;
}

// Static in lists; `size` gives an animated one (header, profile card).
function statusBadge(value, size = 0) {
  const emoji = validStatus(value);
  if (!emoji) return null;
  if (size) {
    const el = animatedEmoji(emoji, size, { loop: false });
    el.classList.add("emoji-status");
    el.title = "Эмодзи-статус";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      el.replay();
    });
    return el;
  }
  const el = document.createElement("span");
  el.className = "emoji-status";
  el.textContent = emoji;
  return el;
}

// ---------- Privacy-aware profile field visibility ----------

// visibility is "everyone" | "contacts" | "nobody"; owners always see their own fields.
function canSeeProfileField(profile, uid, field) {
  if (!uid || uid === currentUser?.uid) return true;
  const visibility = profile?.privacy?.[field] || "everyone";
  if (visibility === "everyone") return true;
  if (visibility === "nobody") return false;
  return contactsMap.has(uid);
}

// Same as avatarHTML(), but returns the colour/initials fallback instead of
// the real photo when the viewer isn't allowed to see this profile's avatar.
function visibleAvatarHTML(profile, uid) {
  if (canSeeProfileField(profile, uid, "avatarVisibility")) return avatarHTML(profile, uid);
  return avatarHTML({ ...profile, avatarImage: null, avatarEmoji: null }, uid);
}

// ---------- Contact / group profile viewer ----------

function setProfileViewRow(index, label, value) {
  const { row, label: labelEl, value: valueEl } = profileViewRows[index];
  if (!value) {
    row.classList.add("hidden");
    return;
  }
  labelEl.textContent = label;
  valueEl.textContent = value;
  row.classList.remove("hidden");
}

function openContactProfile(uid, profile) {
  if (!profile) return;
  profileViewAvatar.innerHTML = visibleAvatarHTML(profile, uid);

  const contact = contactsMap.get(uid);
  profileViewName.textContent = contact ? contactDisplayName(contact.alias, profile) : profile.displayName;
  const statusEl = statusBadge(profile.emojiStatus, 26);
  if (statusEl) profileViewName.append(statusEl);
  profileViewUsername.textContent = "@" + profile.username;

  const canSeeLastSeen =
    (profile.privacy?.lastSeenVisibility || "everyone") === "everyone" ||
    ((profile.privacy?.lastSeenVisibility || "everyone") === "contacts" && contactsMap.has(uid));
  setProfileViewRow(
    0,
    "Был(а) в сети",
    canSeeLastSeen ? (isRecentlyOnline(profile.lastSeenAt) ? "в сети" : profile.lastSeenAt ? fmtRelative(profile.lastSeenAt) : "") : ""
  );
  setProfileViewRow(1, "О себе", canSeeProfileField(profile, uid, "bioVisibility") ? profile.bio : "");
  setProfileViewRow(
    2,
    "Дата рождения",
    canSeeProfileField(profile, uid, "birthdayVisibility") && profile.birthday
      ? new Date(profile.birthday + "T00:00:00").toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" })
      : ""
  );

  renderContactProfileActions(uid);
  showOverlay(profileViewOverlay);
  staggerProfileView();
}

function staggerProfileView() {
  animate(profileViewAvatar, [{ transform: "scale(.3) rotate(-25deg)", opacity: 0 }, { transform: "none", opacity: 1 }], {
    spring: "jelly",
    delay: 90,
  });
  stagger([profileViewName, profileViewUsername, ...profileViewRows.map((r) => r.row), ...profileViewActions.children], {
    y: 14,
    step: 45,
    delay: 160,
  });
}

function openGroupInfo(group) {
  if (!group) return;
  profileViewAvatar.innerHTML = groupAvatarHTML(group);
  profileViewName.textContent = group.name;
  profileViewUsername.textContent = group.type === "channel" ? "Канал" : "Группа";
  setProfileViewRow(0, "Участники", pluralMembers((group.members || []).length));
  setProfileViewRow(1, "", "");
  setProfileViewRow(2, "", "");

  renderGroupMembers(group);
  showOverlay(profileViewOverlay);
  staggerProfileView();
}

chatHeaderInfoBtn?.addEventListener("click", () => {
  if (currentChatType === "contact") {
    openContactProfile(currentOtherUid, currentOtherProfile);
  } else if (currentChatType === "group" || currentChatType === "channel") {
    openGroupInfo(currentGroupRef);
  }
});

profileViewCloseBtn?.addEventListener("click", () => hideOverlay(profileViewOverlay));
profileViewOverlay?.addEventListener("click", (e) => {
  if (e.target === profileViewOverlay) hideOverlay(profileViewOverlay);
});

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
    ${visibleAvatarHTML(profile, uid)}
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
      addBtn.disabled = true;
      try {
        await addContact(currentUser.uid, uid, isContact);
      } catch (err) {
        console.error(err);
        alert(err.message || "Не удалось добавить контакт");
      } finally {
        addBtn.disabled = false;
      }
    });
  }
  const messageBtn = card.querySelector("#sr-message");
  messageBtn.addEventListener("click", async () => {
    messageBtn.disabled = true;
    try {
      await addContact(currentUser.uid, uid, isContact);
      const chatId = await ensureChat(currentUser.uid, uid);
      openContactChat(chatId, uid, profile);
      searchInput.value = "";
      searchResultEl.classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert(err.message || "Не удалось открыть чат");
    } finally {
      messageBtn.disabled = false;
    }
  });
}, 350);

searchInput.addEventListener("input", () => runSearch(searchInput.value));

// ---------- New chat modal (contact / group / channel) ----------

fabNewChat.addEventListener("click", () => openNewChatMenu());
newChatCloseBtn.addEventListener("click", () => hideOverlay(newChatOverlay));
newChatOverlay.addEventListener("click", (e) => {
  if (e.target === newChatOverlay) hideOverlay(newChatOverlay);
});

const newChatPanel = newChatOverlay.querySelector(".new-chat-panel");

function showNewChatStep(step, direction = 0) {
  const steps = [newChatMenu, newChatContactStep, newChatGroupStep];
  const outgoing = steps.find((el) => !el.classList.contains("hidden"));
  const mutate = () => {
    steps.forEach((el) => el.classList.add("hidden"));
    step.classList.remove("hidden");
  };
  if (!direction || outgoing === step) {
    mutate();
    return;
  }
  swapPanels({ container: newChatPanel, clip: newChatPanel, outgoing, incoming: step, direction, mutate });
}

function openNewChatMenu() {
  newChatUsernameInput.value = "";
  newChatContactResult.innerHTML = "";
  showNewChatStep(newChatMenu);
  showOverlay(newChatOverlay);
  stagger(newChatMenu.children, { y: 16, step: 45, delay: 110 });
}

newChatContactBtn.addEventListener("click", () => {
  showNewChatStep(newChatContactStep, 1);
  setTimeout(() => newChatUsernameInput.focus(), 250);
});
newChatContactBackBtn.addEventListener("click", () => showNewChatStep(newChatMenu, -1));

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
    ${visibleAvatarHTML(profile, uid)}
    <div class="search-result-meta">
      <div class="search-result-name"></div>
      <div class="search-result-sub">@${escapeHTML(profile.username)}</div>
    </div>
  `;
  card.querySelector(".search-result-name").textContent = profile.displayName;
  newChatContactResult.innerHTML = "";
  newChatContactResult.appendChild(card);

  // Adding a *new* contact via the pencil icon requires naming them (first
  // name required, last name optional) - just messaging an existing contact
  // doesn't, and messaging someone without naming them falls back to their
  // username/nickname everywhere (contactDisplayName()'s existing behaviour).
  if (!isContact) {
    const nameFields = document.createElement("div");
    nameFields.className = "new-contact-name-fields";
    nameFields.innerHTML = `
      <div class="field">
        <label for="ncr-firstname">Имя</label>
        <input id="ncr-firstname" type="text" maxlength="40" placeholder="Обязательно" />
      </div>
      <div class="field">
        <label for="ncr-lastname">Фамилия</label>
        <input id="ncr-lastname" type="text" maxlength="40" placeholder="Необязательно" />
      </div>
    `;
    newChatContactResult.appendChild(nameFields);
  }

  const actions = document.createElement("div");
  actions.className = "search-result-actions";
  actions.innerHTML = `
    ${isContact ? "" : '<button class="small-btn secondary" id="ncr-add">Добавить</button>'}
    <button class="small-btn" id="ncr-message">Написать</button>
  `;
  newChatContactResult.appendChild(actions);

  const nameErrorEl = document.createElement("div");
  nameErrorEl.className = "auth-error";
  nameErrorEl.id = "ncr-name-error";
  newChatContactResult.appendChild(nameErrorEl);

  function readContactName() {
    if (isContact) return {};
    const firstName = document.getElementById("ncr-firstname").value.trim();
    const lastName = document.getElementById("ncr-lastname").value.trim();
    if (!firstName) {
      nameErrorEl.textContent = "Введите имя контакта";
      return null;
    }
    nameErrorEl.textContent = "";
    return { firstName, lastName };
  }

  const addBtn = actions.querySelector("#ncr-add");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const name = readContactName();
      if (!name) return;
      addBtn.disabled = true;
      try {
        await addContact(currentUser.uid, uid, isContact);
        await setContactAlias(currentUser.uid, uid, name);
        hideOverlay(newChatOverlay);
      } catch (err) {
        console.error(err);
        nameErrorEl.textContent = err.message || "Не удалось добавить контакт";
      } finally {
        addBtn.disabled = false;
      }
    });
  }

  const messageBtn = actions.querySelector("#ncr-message");
  messageBtn.addEventListener("click", async () => {
    const name = readContactName();
    if (!name) return;
    messageBtn.disabled = true;
    try {
      await addContact(currentUser.uid, uid, isContact);
      if (!isContact) await setContactAlias(currentUser.uid, uid, name);
      const chatId = await ensureChat(currentUser.uid, uid);
      openContactChat(chatId, uid, profile);
      hideOverlay(newChatOverlay);
    } catch (err) {
      console.error(err);
      nameErrorEl.textContent = err.message || "Не удалось открыть чат";
    } finally {
      messageBtn.disabled = false;
    }
  });
}, 350);

newChatUsernameInput.addEventListener("input", () => runNewChatContactSearch(newChatUsernameInput.value));

// ---------- New chat modal: group / channel creation ----------

function renderGroupAvatarPreview() {
  newChatGroupAvatarPreview.style.background = "linear-gradient(135deg, #ffd84a, #ffa41b 50%, #ff6a1a)";
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
  showNewChatStep(newChatGroupStep, 1);
}

newChatGroupOpenBtn.addEventListener("click", () => openNewChatGroupStep("group"));
newChatChannelOpenBtn.addEventListener("click", () => openNewChatGroupStep("channel"));
newChatGroupBackBtn.addEventListener("click", () => showNewChatStep(newChatMenu, -1));

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
    ${visibleAvatarHTML(profile, uid)}
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
    hideOverlay(newChatOverlay);
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

// Load errors are kept and rendered at the end of the list (a plain
// innerHTML write would be wiped by the next renderChats()).
let chatsLoadError = null;
function showChatsLoadError(err) {
  const isIndexError = err?.code === "failed-precondition" || /index/i.test(err?.message || "");
  const isRulesError = err?.code === "permission-denied";
  chatsLoadError = isIndexError
    ? "Firestore просит создать индекс — откройте консоль браузера (F12) и перейдите по ссылке «Create index»."
    : isRulesError
    ? "Нет доступа к чатам: опубликуйте актуальные правила из firestore.rules в Firebase Console."
    : "Не удалось загрузить список чатов: " + (err?.message || "неизвестная ошибка");
  toast(chatsLoadError, { tone: "error", duration: 7000 });
  renderChats();
}

function listenChatsList() {
  unsubChats = listenMyChats(
    currentUser.uid,
    (list, changes) => {
      chats = list;
      chatsLoadError = null;
      renderChats();
      scheduleTick();
      if (currentChatType === "contact") onCurrentChatDataChanged();
      if (chatsInitialized) {
        changes.forEach((c) => {
          if (c.type === "removed") return;
          maybeNotify({ id: c.id, ...c.data });
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
    (list, changes) => {
      groups = list;
      renderChats();
      scheduleTick();
      if (currentChatType === "group" || currentChatType === "channel") onCurrentChatDataChanged();
      if (groupsInitialized) {
        changes.forEach((c) => {
          if (c.type === "removed") return;
          maybeNotifyGroup(c.id, c.data);
        });
      }
      groupsInitialized = true;
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

  otherEntries.forEach(async ([uid, list], index) => {
    const profile = contactsMap.get(uid)?.profile || (await getProfile(uid));
    if (!profile) return;
    const bubble = document.createElement("div");
    bubble.className = "story-bubble";
    bubble.style.setProperty("--i", index + 1);
    bubble.innerHTML = `
      <div class="story-ring">${visibleAvatarHTML(profile, uid)}</div>
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
    if (file.type.startsWith("video/")) {
      const meta = await readVideoMeta(file);
      if (meta.duration > 61) throw new Error("Видео для истории — не длиннее 60 секунд");
      const progress = uploadToast("Публикуем видео в историю");
      const { url } = await uploadToCloudinary(file, "video", progress.update);
      progress.done();
      await addStory(currentUser.uid, { videoUrl: url, duration: meta.duration });
    } else {
      const dataUrl = await imageFileToDataUrl(file, 1080, 0.7);
      await addStory(currentUser.uid, dataUrl);
    }
    toast("История опубликована", { icon: "✨" });
  } catch (err) {
    console.error(err);
    toast(err.message || "Не удалось опубликовать историю", { tone: "error", duration: 5000 });
  }
});

function readVideoMeta(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({ duration: v.duration || 15 });
      URL.revokeObjectURL(v.src);
    };
    v.onerror = () => resolve({ duration: 15 });
    v.src = URL.createObjectURL(file);
  });
}


function openStoryViewer(ownerUid, profile, items) {
  activeStoryGroup = { ownerUid, profile, items: [...items] };
  activeStoryIndex = 0;
  storyViewerAvatar.innerHTML = visibleAvatarHTML(profile, ownerUid);
  storyViewerName.textContent = profile.displayName;
  storyDeleteBtn.classList.toggle("hidden", ownerUid !== currentUser.uid);
  buildStoryProgress();
  showStoryAt(0);
  showOverlay(storyViewerOverlay);
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
  const isVideo = !!story.videoUrl;
  const durationMs = isVideo ? Math.min(60, story.duration || 15) * 1000 : STORY_DURATION_MS;
  storyViewerImage.classList.toggle("hidden", isVideo);
  storyViewerVideo.classList.toggle("hidden", !isVideo);
  storyViewerVideo.pause();
  if (isVideo) {
    storyViewerVideo.src = story.videoUrl;
    storyViewerVideo.currentTime = 0;
    storyViewerVideo.play().catch(() => {
      storyViewerVideo.muted = true; // autoplay policy: retry silently
      storyViewerVideo.play().catch(() => {});
    });
    storyViewerVideo.classList.remove("kenburns");
    void storyViewerVideo.offsetWidth;
    storyViewerVideo.classList.add("kenburns");
  } else {
    storyViewerImage.src = story.image;
    storyViewerImage.classList.remove("kenburns");
    void storyViewerImage.offsetWidth; // restart the slow zoom for every story
    storyViewerImage.classList.add("kenburns");
  }
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
        fill.style.transition = `width ${durationMs}ms linear`;
        fill.style.width = "100%";
      });
    } else {
      fill.style.transition = "none";
      fill.style.width = "0%";
    }
  });

  storyAdvanceTimer = setTimeout(() => showStoryAt(index + 1), durationMs);
}

function closeStoryViewer() {
  clearTimeout(storyAdvanceTimer);
  storyViewerVideo.pause();
  storyViewerVideo.removeAttribute("src");
  hideOverlay(storyViewerOverlay);
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

// ---------- Per-user chat lists (pinned / muted chats, blocked people) ----------

function userList(field) {
  return Array.isArray(myProfile?.[field]) ? myProfile[field] : [];
}
const isChatPinned = (id) => userList("pinnedChats").includes(id);
const isChatMuted = (id) => userList("mutedChats").includes(id);
const isBlocked = (uid) => !!uid && userList("blocked").includes(uid);

async function toggleUserList(field, value, add, { success } = {}) {
  const before = userList(field);
  myProfile[field] = add ? [...new Set([...before, value])] : before.filter((v) => v !== value);
  renderChats();
  refreshChatChrome();
  try {
    await toggleUserListValue(currentUser.uid, field, value, add);
    if (success) toast(success);
  } catch (err) {
    console.error(err);
    myProfile[field] = before;
    renderChats();
    refreshChatChrome();
    toast("Не удалось сохранить", { tone: "error" });
  }
}

// ---------- Drafts (kept per chat in this browser) ----------

const draftKey = (chatId) => `lm-draft:${chatId}`;
function readDraft(chatId) {
  try {
    return localStorage.getItem(draftKey(chatId)) || "";
  } catch (_) {
    return "";
  }
}
function writeDraft(chatId, text) {
  if (!chatId) return;
  try {
    if (text.trim()) localStorage.setItem(draftKey(chatId), text);
    else localStorage.removeItem(draftKey(chatId));
  } catch (_) {
    /* storage unavailable */
  }
}

function fmtListTime(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diffDays = (now - d) / 86400000;
  if (diffDays < 6) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

const ICON_MUTED =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.9 17.9 0 0 1 18 8M6.26 6.26A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const ICON_PIN =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16 3a1 1 0 0 1 .7 1.7L15.4 6l2.6 5.2 1.3-1.3a1 1 0 1 1 1.4 1.4L17.4 14.6l3.3 3.3a1 1 0 0 1-1.4 1.4L16 16l-3.3 3.3a1 1 0 0 1-1.4-1.4l3.3-3.3-.7-.7-5.2-2.6-1.3 1.3A1 1 0 1 1 6 11.2L10.9 6.3A1 1 0 0 1 16 3z" transform="rotate(0)"/></svg>';

// Builds one chat-list row: avatar, name + flags, last line, time + unread.
function buildRoomItem({ key, chatId, avatar, name, last, lastAt, unread = 0, muted = false, pinned = false, onClick, typing = false, status = null }) {
  const item = document.createElement("div");
  item.className =
    "room-item" +
    (chatId === currentChatId ? " active" : "") +
    (unread > 0 ? " has-unread" : "") +
    (muted ? " muted" : "") +
    (pinned ? " user-pinned" : "");
  item.dataset.key = key;
  item.innerHTML = `
    ${avatar}
    <div class="room-meta">
      <div class="room-name-row"><div class="room-name"></div>${muted ? `<span class="room-flag">${ICON_MUTED}</span>` : ""}</div>
      <div class="room-last"></div>
    </div>
    <div class="room-side">
      <div class="room-time"></div>
      <div class="room-badges">${pinned && !unread ? `<span class="room-flag">${ICON_PIN}</span>` : ""}${
    unread > 0 ? `<span class="unread-badge">${unread > 99 ? "99+" : unread}</span>` : ""
  }</div>
    </div>
  `;
  item.querySelector(".room-name").textContent = name;
  const badge = statusBadge(status);
  if (badge) item.querySelector(".room-name").after(badge);
  const lastEl = item.querySelector(".room-last");
  const draft = chatId && chatId !== currentChatId ? readDraft(chatId) : "";
  if (typing) {
    lastEl.innerHTML = '<span class="typing-label">печатает…</span>';
  } else if (draft) {
    lastEl.innerHTML = '<span class="draft-label">Черновик: </span>';
    lastEl.append(draft);
  } else {
    lastEl.textContent = last;
  }
  item.querySelector(".room-time").textContent = fmtListTime(lastAt);
  item.addEventListener("click", onClick);
  return item;
}

// ---------- Context menus ----------

const MI = {
  reply: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  forward: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.9 17.9 0 0 1 18 8M6.26 6.26A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  block: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><polyline points="12 6.5 12 12 15.5 14"/></svg>',
  poll: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="19" y1="20" x2="19" y2="9"/></svg>',
  location: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
  leave: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

let activeCtx = null;

function closeContextMenu(instant = false) {
  const ctxState = activeCtx;
  activeCtx = null;
  if (!ctxState) return;
  const { menu, backdrop } = ctxState;
  if (instant || reducedMotion) {
    menu.remove();
    backdrop.remove();
    return;
  }
  backdrop.remove();
  menu
    .animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "scale(.85)" },
      ],
      { duration: 160, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
    )
    .finished.then(() => menu.remove(), () => menu.remove());
  setTimeout(() => menu.remove(), 400);
}

// A glass menu that blooms out of the pointer. `reactions` adds an emoji
// strip on top (for messages).
function openContextMenu({ x, y, reactions = null, items }) {
  closeContextMenu(true);
  const backdrop = document.createElement("div");
  backdrop.className = "ctx-backdrop";
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  menu.setAttribute("role", "menu");
  if (reactions) {
    const strip = document.createElement("div");
    strip.className = "ctx-reactions";
    reactions.emojis.forEach((emoji) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = emoji;
      if (reactions.mine.has(emoji)) b.classList.add("mine");
      b.addEventListener("click", () => {
        reactions.onPick(emoji, b);
        closeContextMenu();
      });
      strip.appendChild(b);
    });
    menu.appendChild(strip);
  }
  items.filter(Boolean).forEach((it) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ctx-item" + (it.danger ? " danger" : "");
    b.innerHTML = `${it.icon || ""}<span></span>`;
    b.querySelector("span").textContent = it.label;
    b.addEventListener("click", () => {
      closeContextMenu();
      it.onClick();
    });
    menu.appendChild(b);
  });
  backdrop.addEventListener("click", () => closeContextMenu());
  backdrop.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    closeContextMenu();
  });
  document.body.append(backdrop, menu);

  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  const left = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  let top = y;
  if (top + h > window.innerHeight - 8) top = Math.max(8, y - h);
  menu.style.left = left + "px";
  menu.style.top = top + "px";
  menu.style.transformOrigin = `${x - left}px ${y - top}px`;
  activeCtx = { menu, backdrop };
  // Transform/opacity only: animating a blur on a backdrop-filtered surface
  // is expensive on weak GPUs.
  animate(menu, [{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "none" }], { spring: "bouncy" });
  stagger(menu.querySelectorAll(".ctx-reactions button"), { y: 12, blur: 0, scale: 0.3, step: 28, delay: 40, spring: "jelly" });
  stagger(menu.querySelectorAll(".ctx-item"), { x: -10, y: 0, blur: 0, step: 26, delay: 60, spring: "smooth" });
}

// Long-press (touch) + right-click (mouse) both open a context menu.
function onContextGesture(el, handler) {
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    handler(e.clientX, e.clientY);
  });
  let timer = null;
  let start = null;
  el.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      timer = setTimeout(() => {
        timer = null;
        el._suppressClick = true;
        if (navigator.vibrate) navigator.vibrate(12);
        handler(start.x, start.y);
      }, 480);
    },
    { passive: true }
  );
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  el.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancel();
    },
    { passive: true }
  );
  el.addEventListener("touchend", cancel, { passive: true });
  el.addEventListener("touchcancel", cancel, { passive: true });
  el.addEventListener(
    "click",
    (e) => {
      if (el._suppressClick) {
        el._suppressClick = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true
  );
}

function attachRoomMenu(item, entry) {
  onContextGesture(item, (x, y) => {
    const pinned = isChatPinned(entry.id);
    const muted = isChatMuted(entry.id);
    const unread = entry.data.unread?.[currentUser.uid] || 0;
    openContextMenu({
      x,
      y,
      items: [
        { label: pinned ? "Открепить" : "Закрепить", icon: MI.pin, onClick: () => toggleUserList("pinnedChats", entry.id, !pinned) },
        {
          label: muted ? "Включить уведомления" : "Без звука",
          icon: muted ? MI.bell : MI.bellOff,
          onClick: () => toggleUserList("mutedChats", entry.id, !muted),
        },
        unread > 0 && {
          label: "Отметить прочитанным",
          icon: MI.check,
          onClick: () => (entry.kind === "group" ? markGroupRead : markChatRead)(entry.id, currentUser.uid).catch(console.error),
        },
        {
          label: "Удалить чат",
          icon: MI.trash,
          danger: true,
          onClick: async () => {
            if (!confirm("Удалить чат из списка? Он вернётся, если придёт новое сообщение.")) return;
            try {
              if (entry.kind === "group") await hideGroupForMe(entry.id, currentUser.uid);
              else await hideChatForMe(entry.id, currentUser.uid);
              if (currentChatId === entry.id) closeCurrentChatView();
            } catch (err) {
              console.error(err);
              toast("Не удалось удалить чат", { tone: "error" });
            }
          },
        },
      ],
    });
  });
}

function pinnedItemHTML(id, iconSvg, title, subtitle) {
  const item = document.createElement("div");
  item.className = "room-item pinned-item" + (id === currentChatId ? " active" : "");
  item.dataset.key = id;
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

// ---------- Profile cache ----------
// Chat docs change on every "typing…" update, so the list re-renders often.
// Profiles of non-contacts are fetched once (concurrent callers share the
// in-flight request) and refreshed in the background, so a render never has
// to wait on the network more than once per person.

const PROFILE_TTL_MS = 60 * 1000;
const profileCache = new Map(); // uid -> { profile, at, pending }

function loadProfile(uid) {
  const entry = profileCache.get(uid);
  if (entry?.pending) return entry.pending;
  const pending = getProfile(uid).then(
    (profile) => {
      profileCache.set(uid, { profile, at: Date.now(), pending: null });
      return profile;
    },
    (err) => {
      console.error("getProfile failed:", uid, err);
      const fallback = entry?.profile ?? null;
      profileCache.set(uid, { profile: fallback, at: Date.now(), pending: null });
      return fallback;
    }
  );
  profileCache.set(uid, { profile: entry?.profile, at: entry?.at || 0, pending });
  return pending;
}

// Builds the list off-screen, then swaps it in one go (so overlapping async
// renders can't interleave) and FLIP-animates rows to their new positions.
let renderChatsToken = 0;
let chatListRendered = false;

// ---------- Chat folders ----------

const FOLDERS = ["all", "personal", "groups", "unread"];
const folderTabs = document.getElementById("folder-tabs");
const folderGlider = folderTabs.querySelector(".folder-glider");
let chatFolder = "all";
try {
  if (FOLDERS.includes(localStorage.getItem("lm-folder"))) chatFolder = localStorage.getItem("lm-folder");
} catch (_) {}
let folderSwitched = false;
let folderDirection = 1;

function moveFolderGlider(animated = true) {
  const tab = folderTabs.querySelector(`[data-folder="${chatFolder}"]`);
  folderTabs.querySelectorAll(".folder-tab").forEach((t) => {
    t.classList.toggle("active", t === tab);
    t.setAttribute("aria-selected", t === tab ? "true" : "false");
  });
  if (!tab || !tab.offsetWidth) return;
  const from = folderGlider.style.transform;
  const fromW = folderGlider.style.width;
  const to = `translateX(${tab.offsetLeft}px)`;
  const toW = tab.offsetWidth + "px";
  folderGlider.style.transform = to;
  folderGlider.style.width = toW;
  if (animated && from && from !== to) {
    // Stretches like a droplet on the way, then settles.
    animate(folderGlider, [{ transform: from, width: fromW }, { transform: to, width: toW }], { spring: "bouncy" });
  }
  if (animated) tab.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function updateFolderCounts(countFor) {
  let changed = !folderGlider.style.width;
  folderTabs.querySelectorAll(".folder-tab").forEach((tab) => {
    const badge = tab.querySelector(".folder-count");
    const n = tab.dataset.folder === "all" ? 0 : countFor(tab.dataset.folder);
    const text = n ? String(n > 99 ? "99+" : n) : "";
    if (badge.textContent !== text) {
      badge.textContent = text;
      changed = true;
      if (text) animate(badge, [{ transform: "scale(.2)" }, { transform: "none" }], { spring: "jelly" });
    }
  });
  // Badges change the tab widths, so the glider has to follow.
  if (changed) moveFolderGlider(false);
}

folderTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".folder-tab");
  if (!tab || tab.dataset.folder === chatFolder) return;
  folderDirection = FOLDERS.indexOf(tab.dataset.folder) > FOLDERS.indexOf(chatFolder) ? 1 : -1;
  chatFolder = tab.dataset.folder;
  try {
    localStorage.setItem("lm-folder", chatFolder);
  } catch (_) {}
  folderSwitched = true;
  moveFolderGlider();
  renderChats();
});
requestAnimationFrame(() => moveFolderGlider(false));
window.addEventListener("resize", debounce(() => moveFolderGlider(false), 150));

async function renderChats() {

  const token = ++renderChatsToken;
  const frag = document.createDocumentFragment();

  const savedItem = pinnedItemHTML(SAVED_ID, SAVED_ICON, "Избранное", "Ваши заметки");
  savedItem.querySelector(".pinned-avatar").classList.add("pa-saved");
  savedItem.addEventListener("click", openSavedChat);
  frag.appendChild(savedItem);

  const notifItem = pinnedItemHTML(NOTIFICATIONS_ID, BELL_ICON, "Linkage Notifications", "Обновления и уведомления о входе");
  notifItem.querySelector(".pinned-avatar").classList.add("pa-notif");
  notifItem.addEventListener("click", openNotificationsChat);
  frag.appendChild(notifItem);

  const combined = [
    ...chats.filter((c) => !(c.hiddenFor || []).includes(currentUser.uid)).map((data) => ({ kind: "contact", data })),
    ...groups.filter((g) => !(g.hiddenFor || []).includes(currentUser.uid)).map((data) => ({ kind: "group", data })),
  ].sort((a, b) => {
    const pa = isChatPinned(a.data.id) ? 1 : 0;
    const pb = isChatPinned(b.data.id) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    const ta = a.data.lastMessageAt?.toMillis ? a.data.lastMessageAt.toMillis() : Date.now();
    const tb = b.data.lastMessageAt?.toMillis ? b.data.lastMessageAt.toMillis() : Date.now();
    return tb - ta;
  });
  const me = currentUser.uid;
  const unreadFor = (data) => (data.id === currentChatId && !document.hidden ? 0 : Math.max(0, data.unread?.[me] || 0));
  const inFolder = (e, folder) =>
    folder === "all" ||
    (folder === "personal" && e.kind === "contact") ||
    (folder === "groups" && e.kind === "group") ||
    (folder === "unread" && (unreadFor(e.data) > 0 || e.data.id === currentChatId));
  const visible = combined.filter((e) => inFolder(e, chatFolder));
  updateFolderCounts((folder) => combined.filter((e) => inFolder(e, folder) && unreadFor(e.data) > 0 && !isChatMuted(e.data.id)).length);
  if (chatFolder !== "all") {
    savedItem.remove();
    notifItem.remove();
  }

  const neededUids = [
    ...new Set(
      combined
        .filter((e) => e.kind === "contact")
        .map((e) => e.data.participants.find((p) => p !== currentUser.uid))
        .filter((uid) => uid && !contactsMap.has(uid))
    ),
  ];
  const missing = neededUids.filter((uid) => profileCache.get(uid)?.profile === undefined);
  if (missing.length) await Promise.all(missing.map(loadProfile));
  const stale = neededUids.filter((uid) => {
    const e = profileCache.get(uid);
    return e && !e.pending && Date.now() - e.at > PROFILE_TTL_MS;
  });
  if (stale.length) Promise.all(stale.map(loadProfile)).then(() => renderChats());
  // Decrypt end-to-end encrypted previews.
  const previews = new Map();
  await Promise.all(
    combined
      .filter((e) => e.kind === "contact" && e.data.lastEnc)
      .map(async (e) => {
        const p = await openPreview(e.data.id, e.data.lastEnc, e.data.lastMessageSenderId);
        if (p) previews.set(e.data.id, p);
      })
  );
  if (token !== renderChatsToken) return; // a newer render superseded this one

  for (const entry of visible) {
    if (entry.kind === "group") {
      const group = entry.data;
      const lastPrefix = group.lastMessageSenderId === me ? "Вы: " : "";
      const item = buildRoomItem({
        key: "g:" + group.id,
        chatId: group.id,
        avatar: groupAvatarHTML(group),
        name: group.name,
        last: group.lastMessage ? lastPrefix + stripRich(group.lastMessage) : group.type === "channel" ? "Канал" : "Группа",
        lastAt: group.lastMessageAt,
        unread: unreadFor(group),
        muted: isChatMuted(group.id),
        pinned: isChatPinned(group.id),
        onClick: () => openGroupChat(group),
      });
      attachRoomMenu(item, { id: group.id, kind: "group", data: group });
      frag.appendChild(item);
      continue;
    }

    const chat = entry.data;
    const otherUid = chat.participants.find((p) => p !== currentUser.uid);
    const contact = contactsMap.get(otherUid);
    const profile = contact?.profile || profileCache.get(otherUid)?.profile;
    if (!profile) continue;

    const name = contact ? contactDisplayName(contact.alias, profile) : profile.displayName;

    const lastPrefix = chat.lastMessageSenderId === me ? "Вы: " : "";
    const typingAt = chat.typing?.[otherUid]?.toDate?.()?.getTime?.() || 0;
    const item = buildRoomItem({
      key: "c:" + chat.id,
      chatId: chat.id,
      avatar: visibleAvatarHTML(profile, otherUid),
      name,
      last: chat.lastMessage ? lastPrefix + stripRich(previews.get(chat.id) || chat.lastMessage) : "Нет сообщений",
      lastAt: chat.lastMessageAt,
      unread: unreadFor(chat),
      muted: isChatMuted(chat.id),
      pinned: isChatPinned(chat.id),
      typing: Date.now() - typingAt < 6000 && !isBlocked(otherUid),
      status: profile.emojiStatus,
      onClick: () => openContactChat(chat.id, otherUid, profile),
    });
    attachRoomMenu(item, { id: chat.id, kind: "contact", data: chat, otherUid });
    frag.appendChild(item);
  }

  if (token !== renderChatsToken) return; // a newer render superseded this one
  if (chatsLoadError) {
    const note = document.createElement("div");
    note.className = "empty-list";
    note.textContent = chatsLoadError;
    frag.appendChild(note);
  } else if (!visible.length && chatFolder !== "all") {
    const note = document.createElement("div");
    note.className = "empty-list folder-empty";
    note.textContent = chatFolder === "unread" ? "Всё прочитано ✨" : "В этой папке пока пусто";
    frag.appendChild(note);
  }
  const prevRects = captureRects(chatListEl);
  chatListEl.replaceChildren(frag);
  if (!chatListRendered) {
    chatListRendered = true;
    stagger(chatListEl.children, { x: -28, y: 0, blur: 8, step: 38, delay: 420 });
  } else if (folderSwitched) {
    folderSwitched = false;
    stagger(chatListEl.children, { x: folderDirection * 36, y: 0, blur: 6, step: 22, delay: 0 });
  } else {
    playFlip(chatListEl, prevRects);
  }
  moveChatIndicator();

  const totalUnread = combined
    .filter((e) => !isChatMuted(e.data.id))
    .reduce((sum, e) => sum + unreadFor(e.data), 0);
  document.title = totalUnread > 0 ? `(${totalUnread}) Linkage Message` : "Linkage Message";
}

// Glides the selection pill to the active chat, stretching like a droplet
// on the way.
let indicatorY = null;
function moveChatIndicator() {
  const active = chatListEl.querySelector(".room-item.active");
  if (!active) {
    chatListIndicator.classList.remove("visible");
    indicatorY = null;
    return;
  }
  const y = chatListEl.offsetTop + active.offsetTop;
  chatListIndicator.style.height = active.offsetHeight + "px";
  chatListIndicator.style.transform = `translateY(${y}px)`;
  if (indicatorY === null) {
    animate(chatListIndicator, [{ scale: "0.85", opacity: 0 }, { scale: "1", opacity: 1 }], { spring: "bouncy" });
  } else if (Math.abs(indicatorY - y) > 1 && !reducedMotion) {
    const stretch = Math.min(1 + Math.abs(y - indicatorY) / 380, 1.7);
    chatListIndicator.animate(
      [
        { transform: `translateY(${indicatorY}px)`, scale: "1 1" },
        { scale: `0.93 ${stretch}`, offset: 0.3 },
        { transform: `translateY(${y}px)`, scale: "1 1" },
      ],
      SPRINGS.bouncy
    );
  }
  indicatorY = y;
  chatListIndicator.classList.add("visible");
}

// ---------- Shared chat-view plumbing ----------

function resetChatView() {
  if (currentChatId) writeDraft(currentChatId, msgInput.value);
  closeChatSearch(true);
  scrollBottomBtn.classList.add("hidden");
  unreadWhileAway = 0;
  if (unsubMessages) unsubMessages();
  if (unsubChatDoc) unsubChatDoc();
  unsubMessages = unsubChatDoc = null;
  clearTimeout(typingClearTimer);
  stopVoiceRecording(true);

  const comingFromEmpty = !emptyState.classList.contains("hidden");
  emptyState.classList.add("hidden");
  chatHeader.classList.remove("hidden");
  messagesEl.classList.remove("hidden");
  composer.classList.remove("hidden");
  sidebar.classList.add("chat-open");
  msgAnim.chatId = null; // next snapshot is this chat's first render
  playChatEnter(comingFromEmpty);
  chatSub.textContent = "";
  chatSub.classList.remove("typing");
  chatTitleStatus.replaceChildren();
  chatSection.removeAttribute("data-wall");
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
  blockedBar.classList.add("hidden");
  pinnedBar.classList.add("hidden");
  chatSection.classList.remove("has-pinned");
  [callAudioBtn, callVideoBtn].forEach((b) => b.classList.add("hidden"));
  chatSearchBtn.classList.remove("hidden");
}

function restoreDraft() {
  const draft = readDraft(currentChatId);
  if (!draft) return;
  msgInput.value = draft;
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
  updateComposerButtons();
}

function currentChatData() {
  if (currentChatType === "contact") return chats.find((c) => c.id === currentChatId) || null;
  if (currentChatType === "group" || currentChatType === "channel") return groups.find((g) => g.id === currentChatId) || currentGroupRef;
  return null;
}

// Header buttons, chat menu labels, the blocked bar and the pinned banner
// all depend on the open chat + my per-user lists.
// ---------- Chat wallpapers (per device) ----------

const WALLPAPERS = [
  ["none", "Без обоев"],
  ["aurora", "Аврора"],
  ["sunset", "Закат"],
  ["ocean", "Океан"],
  ["forest", "Лес"],
  ["grape", "Виноград"],
  ["candy", "Карамель"],
  ["mesh", "Сетка"],
  ["stars", "Звёзды"],
  ["hearts", "Сердечки"],
];
const wallOverlay = document.getElementById("wall-overlay");
const wallGrid = document.getElementById("wall-grid");
const wallAll = document.getElementById("wall-all");

function readStore(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function wallpaperFor(chatId) {
  return readStore("lm-wall:" + chatId) || readStore("lm-wall:*") || "none";
}

function applyWallpaper() {
  if (!currentChatId) return;
  const wall = wallpaperFor(currentChatId);
  if (wall === "none") chatSection.removeAttribute("data-wall");
  else if (chatSection.dataset.wall !== wall) chatSection.dataset.wall = wall;
}

function setWallpaper(wall) {
  try {
    if (wallAll.checked) {
      localStorage.setItem("lm-wall:*", wall);
      localStorage.removeItem("lm-wall:" + currentChatId);
    } else {
      localStorage.setItem("lm-wall:" + currentChatId, wall);
    }
  } catch (_) {}
  applyWallpaper();
}

function openWallpaperPicker() {
  wallAll.checked = !readStore("lm-wall:" + currentChatId) && !!readStore("lm-wall:*");
  const current = wallpaperFor(currentChatId);
  wallGrid.innerHTML = "";
  WALLPAPERS.forEach(([key, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wall-swatch" + (key === current ? " selected" : "");
    b.dataset.wallPreview = key;
    b.innerHTML = '<span class="wall-swatch-art"></span><span class="wall-swatch-label"></span>';
    b.querySelector(".wall-swatch-label").textContent = label;
    b.addEventListener("click", () => {
      wallGrid.querySelectorAll(".wall-swatch").forEach((w) => w.classList.toggle("selected", w === b));
      animate(b, [{ transform: "scale(.9)" }, { transform: "none" }], { spring: "jelly" });
      setWallpaper(key);
    });
    wallGrid.appendChild(b);
  });
  showOverlay(wallOverlay);
  stagger(wallGrid.children, { y: 14, scale: 0.8, step: 28, delay: 80 });
}

wallAll.addEventListener("change", () => setWallpaper(wallpaperFor(currentChatId)));
document.getElementById("chat-menu-wall-btn").addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  openWallpaperPicker();
});
document.getElementById("wall-close").addEventListener("click", () => hideOverlay(wallOverlay));
wallOverlay.addEventListener("click", (e) => {
  if (e.target === wallOverlay) hideOverlay(wallOverlay);
});

function refreshChatChrome() {
  if (!currentChatId) return;
  applyWallpaper();
  const isContact = currentChatType === "contact";
  const isGroupish = currentChatType === "group" || currentChatType === "channel";
  const blocked = isContact && isBlocked(currentOtherUid);
  chatSection.classList.toggle("e2e-on", isContact && isE2EChat(currentChatId));
  callAudioBtn.classList.toggle("hidden", !isContact || blocked);
  callVideoBtn.classList.toggle("hidden", !isContact || blocked);

  const muted = isChatMuted(currentChatId);
  const pinned = isChatPinned(currentChatId);
  chatMenuMuteBtn.classList.toggle("hidden", !(isContact || isGroupish));
  chatMenuMuteBtn.textContent = muted ? "Включить уведомления" : "Выключить уведомления";
  chatMenuPinBtn.classList.toggle("hidden", !(isContact || isGroupish));
  chatMenuPinBtn.textContent = pinned ? "Открепить чат" : "Закрепить чат";
  chatMenuBlockBtn.classList.toggle("hidden", !isContact);
  chatMenuBlockBtn.textContent = blocked ? "Разблокировать" : "Заблокировать";
  chatMenuLeaveBtn.classList.toggle("hidden", !isGroupish);
  document.getElementById("chat-menu-rename-btn").classList.toggle("hidden", !isContact);
  chatMenuLeaveBtn.textContent = currentChatType === "channel" ? "Покинуть канал" : "Покинуть группу";

  if (isContact) {
    composer.classList.toggle("hidden", blocked);
    if (blocked) reveal(blockedBar);
    else if (!blockedBar.classList.contains("hidden")) conceal(blockedBar);
  }
  renderPinnedBar();
}

function canPinInCurrentChat() {
  if (currentChatType === "contact" || currentChatType === "group") return true;
  if (currentChatType === "channel") return (currentGroupRef?.admins || []).includes(currentUser.uid);
  return false;
}

function renderPinnedBar() {
  const pinned = currentChatData()?.pinned;
  if (pinned?.id) {
    pinnedBarText.textContent = pinned.text || "Сообщение";
    if (pinned.enc && currentChatType === "contact" && hasDevice()) {
      const chatId = currentChatId;
      openBoxFrom(chatId, pinned.enc, pinned.by)
        .then((c) => currentChatId === chatId && (pinnedBarText.textContent = c.text))
        .catch(() => {});
    }
    pinnedBar.dataset.id = pinned.id;
    pinnedBarUnpin.classList.toggle("hidden", !canPinInCurrentChat());
    if (pinnedBar.classList.contains("hidden") || pinnedBar.classList.contains("is-closing")) reveal(pinnedBar);
    chatSection.classList.add("has-pinned");
  } else {
    if (!pinnedBar.classList.contains("hidden")) conceal(pinnedBar);
    chatSection.classList.remove("has-pinned");
  }
}

pinnedBar.addEventListener("click", (e) => {
  if (e.target.closest("#pinned-bar-unpin")) return;
  if (pinnedBar.dataset.id) scrollToMessage(pinnedBar.dataset.id);
});
pinnedBarUnpin.addEventListener("click", () => setPinnedMessage(null));

async function setPinnedMessage(msg) {
  let payload = msg ? { id: msg.id, text: replyPreviewText(msg).slice(0, 120), senderName: replySenderLabel(msg) } : null;
  if (payload && currentChatType === "contact" && isE2EChat(currentChatId)) {
    payload = { id: payload.id, text: "🔒 Сообщение", senderName: "", by: currentUser.uid, enc: await sealForChat(currentChatId, { text: payload.text }) };
  }
  try {
    if (currentChatType === "contact") await setChatPinnedMessage(currentChatId, payload);
    else await setGroupPinnedMessage(currentChatId, payload);
    toast(msg ? "Сообщение закреплено" : "Сообщение откреплено", { icon: "📌" });
  } catch (err) {
    console.error(err);
    toast("Не удалось закрепить", { tone: "error" });
  }
}

// ---------- Read state ----------

const markedReadAt = new Map(); // chatId -> lastMessageAt ms already marked
let markingRead = false;

function maybeMarkRead() {
  if (document.hidden || !currentChatId || markingRead) return;
  const isContact = currentChatType === "contact";
  const isGroupish = currentChatType === "group" || currentChatType === "channel";
  if (!isContact && !isGroupish) return;
  const data = currentChatData();
  if (!data) return;
  const me = currentUser.uid;
  const unread = data.unread?.[me] || 0;
  const lastMsgMs = data.lastMessageAt?.toMillis?.() || 0;
  const fromOther = data.lastMessageSenderId && data.lastMessageSenderId !== me;
  const lastReadMs = data.lastRead?.[me]?.toMillis?.() || 0;
  const needsReceipt = fromOther && lastMsgMs > lastReadMs && (markedReadAt.get(currentChatId) || 0) < lastMsgMs;
  if (unread <= 0 && !needsReceipt) return;
  markingRead = true;
  markedReadAt.set(currentChatId, lastMsgMs);
  (isContact ? markChatRead : markGroupRead)(currentChatId, me)
    .catch((err) => console.warn("markRead failed:", err))
    .finally(() => {
      markingRead = false;
    });
}

const TICK_ONE =
  '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8.5 6.5 12 13 4.5"/></svg>';
const TICK_TWO =
  '<svg viewBox="0 0 20 16" width="18" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="1.5 8.5 5 12 11.5 4.5"/><polyline points="8 11 9 12 15.5 4.5"/></svg>';
const TICK_CLOCK =
  '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><polyline points="8 5 8 8 10 9.5"/></svg>';

// ✓ sent · ✓✓ read (accent) · clock while the write is pending.
function refreshReceipts() {
  const data = currentChatData();
  const me = currentUser.uid;
  let readUpTo = 0;
  if (data?.lastRead) {
    Object.entries(data.lastRead).forEach(([uid, ts]) => {
      if (uid !== me) readUpTo = Math.max(readUpTo, ts?.toMillis?.() || 0);
    });
  }
  messagesEl.querySelectorAll(".msg-row.me .msg-tick").forEach((tick) => {
    const ts = Number(tick.closest(".msg-row").dataset.ts || 0);
    const state = !ts ? "pending" : ts <= readUpTo ? "read" : "sent";
    if (tick.dataset.state === state) return;
    tick.dataset.state = state;
    tick.classList.toggle("read", state === "read");
    tick.innerHTML = state === "pending" ? TICK_CLOCK : state === "read" ? TICK_TWO : TICK_ONE;
  });
}

function onCurrentChatDataChanged() {
  if (!currentChatId) return;
  if (currentChatType === "group" || currentChatType === "channel") {
    const fresh = groups.find((g) => g.id === currentChatId);
    if (fresh) {
      currentGroupRef = fresh;
      chatSub.textContent = pluralMembers((fresh.members || []).length);
    }
  }
  renderPinnedBar();
  refreshReceipts();
  maybeMarkRead();
}

// ---------- Scroll-to-bottom button ----------

let unreadWhileAway = 0;
function updateScrollBottomBtn() {
  const away = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight > 380;
  if (!away) unreadWhileAway = 0;
  scrollBottomBtn.classList.toggle("hidden", !away || messagesEl.classList.contains("hidden"));
  scrollBottomBadge.textContent = unreadWhileAway > 99 ? "99+" : String(unreadWhileAway);
  scrollBottomBadge.classList.toggle("hidden", unreadWhileAway === 0);
}
messagesEl.addEventListener("scroll", () => {
  updateScrollBottomBtn();
  if (activeCtx) closeContextMenu();
}, { passive: true });
scrollBottomBtn.addEventListener("click", () => {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
});

// The header and dock float in; when switching between chats only the
// header's contents slide, so the glass itself feels continuous.
function playChatEnter(fromEmpty) {
  if (fromEmpty) {
    animate(
      chatHeader,
      [
        { opacity: 0, transform: "translateY(-22px) scale(.96)", filter: "blur(10px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      { spring: "smooth" }
    );
    animate(
      chatDock,
      [
        { opacity: 0, transform: "translateY(30px) scale(.96)" },
        { opacity: 1, transform: "none" },
      ],
      { spring: "smooth", delay: 70 }
    );
  } else {
    animate(
      chatHeaderInfoBtn,
      [
        { opacity: 0, transform: "translateX(-16px)", filter: "blur(8px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      { spring: "smooth" }
    );
  }
  animate(chatHeaderAvatar, [{ transform: "scale(.4) rotate(-25deg)" }, { transform: "none" }], { spring: "jelly", delay: 60 });
}

// ---------- Message list animation bookkeeping ----------
// Snapshots re-render the whole list, so we remember which message ids were
// already on screen: the first render of a chat cascades in, afterwards only
// genuinely new messages (and changed reactions) animate.

const msgAnim = { chatId: null, seen: new Set(), reactions: new Map() };

function snapshotScroll() {
  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 160;
  return { top: messagesEl.scrollTop, nearBottom };
}

function finishMessagesRender(snap) {
  applyWallpaper();
  const rows = Array.from(messagesEl.querySelectorAll(".msg-row"));
  refreshReceipts();
  maybeMarkRead();
  if (chatSearchQuery) applyChatSearch(false);

  if (msgAnim.chatId !== currentChatId) {
    msgAnim.chatId = currentChatId;
    msgAnim.seen = new Set(rows.map((r) => r.dataset.msgId));
    msgAnim.reactions = new Map(rows.map((r) => [r.dataset.msgId, r.dataset.rx]));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    rows
      .slice(-14)
      .reverse()
      .forEach((row, i) => {
        animate(
          row.querySelector(".msg-group"),
          [
            { opacity: 0, transform: "translateY(34px) scale(.9)", filter: "blur(8px)" },
            { opacity: 1, transform: "none", filter: "blur(0px)" },
          ],
          { spring: "bouncy", delay: 40 + i * 32 }
        );
      });
    return;
  }

  const fresh = rows.filter((r) => !msgAnim.seen.has(r.dataset.msgId));
  fresh.forEach((r) => msgAnim.seen.add(r.dataset.msgId));
  fresh
    .filter((r) => r.dataset.effect && !r.classList.contains("scheduled"))
    .slice(-1)
    .forEach((r) => setTimeout(() => playEffect(r.dataset.effect, centerOfPoint(r.querySelector(".bubble"))), 280));
  if (!snap.nearBottom) {
    unreadWhileAway += fresh.filter((r) => !r.classList.contains("me")).length;
  }
  requestAnimationFrame(updateScrollBottomBtn);

  rows.forEach((row) => {
    const prev = msgAnim.reactions.get(row.dataset.msgId);
    if (prev !== undefined && prev !== row.dataset.rx) popChangedReactions(row, prev);
    msgAnim.reactions.set(row.dataset.msgId, row.dataset.rx);
  });

  messagesEl.scrollTop = snap.top;
  if (snap.nearBottom || fresh.some((r) => r.classList.contains("me"))) {
    messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }

  const [glow] = accentColors(0.55);
  fresh.forEach((row, i) => {
    const group = row.querySelector(".msg-group");
    if (row.classList.contains("me")) {
      // Launches up out of the composer.
      animate(
        group,
        [
          { opacity: 0, transform: "translateY(70px) scale(.6)", filter: "blur(10px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { spring: "bouncy", delay: i * 45 }
      );
    } else {
      // Inflates out of its tail corner with a ripple of light.
      animate(
        group,
        [
          { opacity: 0, transform: "scale(.35) rotate(-8deg)", filter: "blur(12px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" },
        ],
        { spring: "jelly", delay: i * 45 }
      );
      const bubble = row.querySelector(".bubble");
      bubble?.animate([{ boxShadow: `0 0 0 0 ${glow}` }, { boxShadow: "0 0 0 16px rgba(0,0,0,0)" }], {
        duration: 1000,
        delay: 120 + i * 45,
        easing: "cubic-bezier(.2,.7,.2,1)",
      });
    }
  });
}

function popChangedReactions(row, prevJson) {
  let prev = {};
  let now = {};
  try {
    prev = JSON.parse(prevJson || "{}");
    now = JSON.parse(row.dataset.rx || "{}");
  } catch (_) {
    return;
  }
  row.querySelectorAll(".reaction-pill").forEach((pill) => {
    const e = pill.dataset.emoji;
    if ((prev[e] || []).length !== (now[e] || []).length) pill.classList.add("pop");
  });
}

function renderPlainMessages(msgs, isMineFn) {
  const snap = snapshotScroll();
  messagesEl.innerHTML = "";
  if (msgs.length === 0) {
    messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>';
    msgAnim.chatId = currentChatId;
    msgAnim.seen = new Set();
    return;
  }
  renderMessageList(msgs, (msg) => renderMessage(msg, isMineFn(msg)));
  finishMessagesRender(snap);
}

// ---------- Избранное (Saved) ----------

function openSavedChat() {
  resetChatView();
  currentChatId = SAVED_ID;
  currentChatType = "saved";
  currentOtherUid = null;
  currentOtherProfile = null;

  chatHeaderAvatar.innerHTML = `<div class="avatar pinned-avatar pa-saved">${SAVED_ICON}</div>`;
  chatTitle.textContent = "Избранное";
  chatSub.textContent = "Заметки, которые видите только вы";

  renderChats();
  restoreDraft();
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

  chatHeaderAvatar.innerHTML = `<div class="avatar pinned-avatar pa-notif">${BELL_ICON}</div>`;
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
  chatHeaderAvatar.innerHTML = visibleAvatarHTML(profile, otherUid);
  chatTitle.textContent = contact ? contactDisplayName(contact.alias, profile) : profile.displayName;
  const statusEl = statusBadge(profile.emojiStatus, 22);
  if (statusEl) chatTitleStatus.appendChild(statusEl);
  chatSub.textContent = "@" + profile.username;
  editContactBtn.classList.remove("hidden");
  chatMenuBtn.classList.remove("hidden");
  refreshChatChrome();
  restoreDraft();

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  rememberDevices(otherUid, profile);
  refreshDevices(otherUid).then(() => currentChatId === chatId && refreshChatChrome());
  unsubMessages = listenMessages(chatId, (msgs) => {
    if (currentChatId !== chatId) return;
    currentChatRawSource = msgs;
    openMessages(chatId, msgs).then((list) => {
      if (currentChatId !== chatId) return;
      currentChatRawMessages = list;
      rerenderMessages();
    });
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
  refreshChatChrome();
  if (canPost) restoreDraft();

  renderChats();
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  unsubMessages = listenGroupMessages(group.id, (msgs) => {
    if (currentChatId !== group.id) return;
    currentChatRawMessages = msgs;
    rerenderMessages();
  });
}

let groupRenderToken = 0;

async function renderGroupMessagesList(msgs) {
  const token = ++groupRenderToken;
  const chatId = currentChatId;
  // Resolve sender names first so the DOM swap below is synchronous.
  const missingSenders = [...new Set(msgs.map((m) => m.senderId))].filter(
    (uid) => uid !== currentUser.uid && !groupSenderCache.has(uid)
  );
  await Promise.all(
    missingSenders.map(async (uid) => {
      groupSenderCache.set(uid, contactsMap.get(uid)?.profile || (await loadProfile(uid)));
    })
  );
  if (token !== groupRenderToken || chatId !== currentChatId) return;

  const snap = snapshotScroll();
  messagesEl.innerHTML = "";
  if (msgs.length === 0) {
    messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет</div>';
    msgAnim.chatId = currentChatId;
    msgAnim.seen = new Set();
    return;
  }
  renderMessageList(msgs, (msg) => {
    const isMine = msg.senderId === currentUser.uid;
    const senderName = isMine ? null : groupSenderCache.get(msg.senderId)?.displayName || "—";
    renderMessage(msg, isMine, senderName);
  });
  finishMessagesRender(snap);
}

function rerenderMessages() {
  const now = Date.now();
  const me = currentUser.uid;
  const ms = (m) => m.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
  // Scheduled messages: hidden from others until their time, shown to the
  // sender (dimmed, at the end) until then; afterwards they sit at their
  // scheduled time.
  const visible = currentChatRawMessages
    .map((m) => {
      const at = m.scheduledAt?.toMillis?.();
      if (!at) return m;
      if (at > now && m.senderId !== me) return null;
      return { ...m, createdAt: m.scheduledAt, _scheduled: at > now };
    })
    .filter(Boolean)
    .filter((m) => !currentClearedAt || !m.createdAt?.toMillis || m.createdAt.toMillis() > currentClearedAt)
    .sort((a, b) => (a._scheduled ? 1 : 0) - (b._scheduled ? 1 : 0) || ms(a) - ms(b));
  if (currentChatType === "contact") {
    renderPlainMessages(visible, (msg) => msg.senderId === me);
  } else if (currentChatType === "group" || currentChatType === "channel") {
    renderGroupMessagesList(visible);
  }
  scheduleTick();
}

// ---------- Scheduled ("send later") delivery ----------

function fmtScheduleTime(msOrTs) {
  const d = new Date(typeof msOrTs === "number" ? msOrTs : msOrTs?.toMillis?.() || 0);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  if (d.toDateString() === today.toDateString()) return `сегодня в ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `завтра в ${time}`;
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} в ${time}`;
}

let scheduleTimer = null;
const publishAttempts = new Map(); // "chat/msg" -> ms of last attempt

// Any participant's open client publishes due scheduled messages (preview +
// unread + notification) and re-renders when the next one comes due.
function scheduleTick() {
  clearTimeout(scheduleTimer);
  if (!currentUser) return;
  const now = Date.now();
  let next = Infinity;
  const consider = (isGroup, data) => {
    Object.entries(data.scheduled || {}).forEach(([msgId, entry]) => {
      const at = entry?.at?.toMillis?.() || 0;
      if (at > now) {
        next = Math.min(next, at);
        return;
      }
      const k = `${data.id}/${msgId}`;
      if ((publishAttempts.get(k) || 0) > now - 15000) return;
      publishAttempts.set(k, now);
      (isGroup ? publishScheduledGroup : publishScheduled)(data.id, msgId).catch((err) => console.warn("publish scheduled failed:", err));
    });
  };
  chats.forEach((c) => consider(false, c));
  groups.forEach((g) => consider(true, g));
  currentChatRawMessages.forEach((m) => {
    const at = m.scheduledAt?.toMillis?.();
    if (at && at > now) next = Math.min(next, at);
  });
  if (next < Infinity) {
    scheduleTimer = setTimeout(() => {
      if (currentChatType === "contact" || currentChatType === "group" || currentChatType === "channel") rerenderMessages();
      else scheduleTick();
    }, Math.min(next - now + 400, 2147483000));
  }
}

async function cancelScheduledMessage(msg) {
  if (currentChatType === "contact") await cancelScheduled(currentChatId, msg.id);
  else await cancelScheduledGroup(currentChatId, msg.id);
}

function attachmentOf(msg) {
  const fields = {};
  ["imageUrl", "voiceUrl", "fileUrl", "fileName", "fileType", "fileSize", "videoNoteUrl", "duration"].forEach((k) => {
    if (msg[k] !== undefined && msg[k] !== null) fields[k] = msg[k];
  });
  return Object.keys(fields).length ? { fields, previewText: replyPreviewText(msg), defaultCaption: msg.text } : null;
}

async function sendScheduledNow(msg) {
  try {
    await cancelScheduledMessage(msg);
    await deliver({ type: currentChatType, id: currentChatId, text: msg.text, attachment: attachmentOf(msg), replyTo: msg.replyTo || null });
  } catch (err) {
    console.error(err);
    toast("Не удалось отправить", { tone: "error" });
  }
}

// Picker: quick presets + exact date/time.
const scheduleOverlay = document.getElementById("schedule-overlay");
const scheduleInput = document.getElementById("schedule-input");
const scheduleQuick = document.getElementById("schedule-quick");

function toLocalInput(ms) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function openSchedulePicker() {
  if (!msgInput.value.trim()) {
    toast("Сначала напишите сообщение", { icon: "📅" });
    return;
  }
  if (!["contact", "group", "channel"].includes(currentChatType)) {
    toast("В этом чате нельзя запланировать сообщение", { tone: "error" });
    return;
  }
  const now = new Date();
  const at = (h, m, dayOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const presets = [
    ["Через 30 минут", Date.now() + 30 * 60000],
    ["Через 2 часа", Date.now() + 2 * 3600000],
    now.getHours() < 19 ? ["Сегодня в 20:00", at(20, 0)] : ["Завтра в 20:00", at(20, 0, 1)],
    ["Завтра в 9:00", at(9, 0, 1)],
  ];
  scheduleQuick.innerHTML = "";
  presets.forEach(([label, time]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "schedule-chip";
    b.textContent = label;
    b.addEventListener("click", () => confirmSchedule(time));
    scheduleQuick.appendChild(b);
  });
  scheduleInput.min = toLocalInput(Date.now() + 60000);
  scheduleInput.value = toLocalInput(Date.now() + 3600000);
  showOverlay(scheduleOverlay);
  stagger(scheduleQuick.children, { y: 10, step: 40, delay: 80 });
}

function confirmSchedule(time) {
  if (!time || time < Date.now() + 30000) {
    toast("Выберите время в будущем", { tone: "error" });
    return;
  }
  hideOverlay(scheduleOverlay);
  doSendMessage(null, { scheduleAt: time });
}

document.getElementById("schedule-confirm").addEventListener("click", () => confirmSchedule(new Date(scheduleInput.value).getTime()));
document.getElementById("schedule-cancel").addEventListener("click", () => hideOverlay(scheduleOverlay));
scheduleOverlay.addEventListener("click", (e) => {
  if (e.target === scheduleOverlay) hideOverlay(scheduleOverlay);
});
// Long-press (touch) or right-click on the send button: effects, silent, later.
onContextGesture(sendBtn, (x, y) => openSendOptions(x, y));

function openSendOptions(x, y) {
  if (!msgInput.value.trim()) return;
  const canNotify = ["contact", "group", "channel"].includes(currentChatType);
  const r = sendBtn.getBoundingClientRect();
  openContextMenu({
    x: Math.min(x, r.right) - 200,
    y: r.top - 8,
    reactions: {
      emojis: Object.values(EFFECTS).map((e) => e.emoji),
      mine: new Set(),
      onPick: (emoji) => {
        const kind = Object.keys(EFFECTS).find((k) => EFFECTS[k].emoji === emoji);
        doSendMessage(null, { effect: kind });
      },
    },
    items: [
      canNotify && { label: "Отправить без звука", icon: MI.bellOff, onClick: () => doSendMessage(null, { silent: true }) },
      canNotify && { label: "Отправить позже", icon: MI.clock, onClick: () => openSchedulePicker() },
    ],
  });
  document.querySelector(".ctx-menu")?.classList.add("send-options");
}

// ---------- Round video messages ----------

const circleBtn = document.getElementById("circle-btn");
circleBtn.classList.toggle("unsupported", !circlesSupported);
circleBtn.addEventListener("click", async () => {
  if (!currentChatId || composer.classList.contains("hidden")) return;
  if (!uploadsConfigured) {
    toast("Отправка видео ещё не настроена (Cloudinary, см. README)", { tone: "error", duration: 5000 });
    return;
  }
  const chatType = currentChatType;
  const chatId = currentChatId;
  const result = await recordCircle();
  if (!result) return;
  const ext = result.mime.includes("mp4") ? "mp4" : "webm";
  const file = new File([result.blob], `circle.${ext}`, { type: result.mime.split(";")[0] });
  const progress = uploadToast("Отправка видеосообщения");
  try {
    const { url } = await uploadToCloudinary(file, "video", progress.update, progress.signal);
    progress.done();
    // Cloudinary serves a square H.264 MP4 of it, which every browser plays.
    const playable = url.replace("/upload/", "/upload/c_fill,g_center,w_480,h_480,q_auto/").replace(/\.(webm|mov|mkv)$/i, ".mp4");
    await deliver({
      type: chatType,
      id: chatId,
      attachment: {
        fields: { videoNoteUrl: playable, duration: result.duration },
        previewText: "⭕ Видеосообщение",
        defaultCaption: "⭕",
      },
    });
  } catch (err) {
    progress.fail();
    if (err?.name === "AbortError") return;
    console.error(err);
    toast(err.message || "Не удалось отправить видеосообщение", { tone: "error" });
  }
});

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
  hidePopover(chatMenuDropdown);
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
      vote: (id, choices) => voteGroupPoll(currentChatId, id, currentUser.uid, choices),
    };
  }
  if (currentChatType === "contact") {
    return {
      edit: async (id, text) => {
        const msg = currentChatRawMessages.find((m) => m.id === id);
        if (msg?._e2e) {
          return editEncryptedMessage(currentChatId, id, await sealForChat(currentChatId, { ...msg._content, text: text.trim() }));
        }
        return editMessage(currentChatId, id, text);
      },
      del: (id) => deleteMessage(currentChatId, id),
      react: (id, emoji, add) => toggleReaction(currentChatId, id, emoji, currentUser.uid, add),
      vote: (id, choices) => votePoll(currentChatId, id, currentUser.uid, choices),
    };
  }
  return { edit: null, del: null, react: null };
}

const DEFAULT_CAPTIONS = ["📷", "🎬", "🎤", "⭕"];

// ---------- Reply-to-message ----------

function replySenderLabel(msg) {
  if (msg.senderId === currentUser.uid) return "Вы";
  if (currentChatType === "group" || currentChatType === "channel") {
    return groupSenderCache.get(msg.senderId)?.displayName || "…";
  }
  return chatTitle.textContent || "…";
}

function replyPreviewText(msg) {
  if (msg.poll) return "📊 " + msg.poll.q;
  if (msg.location) return "📍 Геопозиция";
  if (msg.videoNoteUrl) return "⭕ Видеосообщение";
  if (msg.imageUrl) return "📷 Фото";
  if (msg.voiceUrl) return "🎤 Голосовое сообщение";
  if (msg.fileUrl) {
    if ((msg.fileType || "").startsWith("video/")) return "🎬 Видео";
    return `📎 ${msg.fileName || "Файл"}`;
  }
  return stripRich(msg.text || "");
}

function startReply(msg) {
  replyToMessage = msg;
  replyPreviewSenderEl.textContent = replySenderLabel(msg);
  replyPreviewTextEl.textContent = replyPreviewText(msg).slice(0, 120);
  if (replyPreviewEl.classList.contains("hidden") || replyPreviewEl.classList.contains("is-closing")) {
    reveal(replyPreviewEl);
  } else {
    animate(
      replyPreviewEl.querySelector(".reply-preview-body"),
      [
        { opacity: 0, transform: "translateY(8px)", filter: "blur(6px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      { spring: "smooth" }
    );
  }
  msgInput.focus();
}

function cancelReply() {
  replyToMessage = null;
  conceal(replyPreviewEl);
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
  if (msg.call) {
    renderCallBubble(bubble, msg);
    return;
  }
  if (msg.game) {
    bubble.classList.add("game-bubble");
    bubble.appendChild(gameNode(msg));
    return;
  }
  if (msg.poll && Array.isArray(msg.poll.options)) {
    bubble.classList.add("poll-bubble");
    bubble.appendChild(renderPoll(msg));
    return;
  }
  if (msg.location) {
    const card = renderLocation(msg.location);
    if (card) {
      bubble.classList.add("location-bubble");
      bubble.appendChild(card);
      return;
    }
  }
  if (msg.videoNoteUrl) {
    bubble.classList.add("circle-bubble");
    bubble.appendChild(buildVideoNote(msg.videoNoteUrl, msg.duration, fmtDuration));
    return;
  }
  const hasMedia = !!(msg.imageUrl || msg.voiceUrl || msg.fileUrl);
  const bigEmoji = !hasMedia && emojiOnly(msg.text);
  if (bigEmoji) {
    // Emoji-only messages: large animated emoji without a bubble; tap to replay.
    bubble.classList.add("emoji-bubble");
    const size = [0, 132, 100, 84][bigEmoji.length];
    bigEmoji.forEach((emoji) => {
      const el = animatedEmoji(emoji, size);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        el.replay();
        const r = el.getBoundingClientRect();
        emojiEffect(emoji, r.left + r.width / 2, r.top + r.height / 2, size * 1.1);
      });
      bubble.appendChild(el);
    });
    return;
  }
  if (msg.imageUrl) {
    const img = document.createElement("img");
    img.className = "msg-image";
    img.src = msg.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("click", () => openLightbox(img));
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
    appendRich(p, msg.text, appendLinkified);
    bubble.appendChild(p);
  }
}

// ---------- Mini games ----------
// The element is kept per message so a roll that is still playing survives
// the list re-rendering on every snapshot.
const gameNodes = new Map();

function gameNode(msg) {
  const key = currentChatId + ":" + msg.id;
  if (gameNodes.has(key)) return gameNodes.get(key);
  if (gameNodes.size > 300) gameNodes.clear();
  const fresh = msgAnim.chatId === currentChatId && !msgAnim.seen.has(msg.id) && !msg._scheduled;
  const made = renderGame(msg.game, fresh);
  if (!made) {
    const el = document.createElement("div");
    el.className = "bubble-text";
    el.textContent = msg.text || "";
    return el;
  }
  const holder = document.createElement("div");
  holder.className = "game-holder";
  holder.title = "Нажмите, чтобы повторить";
  holder.appendChild(made.el);
  const celebrate = (delay) => {
    if (isWin(msg.game)) setTimeout(() => playEffect("confetti"), delay);
  };
  if (fresh) celebrate(made.duration);
  holder.addEventListener("click", (e) => {
    e.stopPropagation();
    const again = renderGame(msg.game, true);
    holder.replaceChildren(again.el);
    celebrate(again.duration);
  });
  gameNodes.set(key, holder);
  return holder;
}

// ---------- Polls ----------

const pollShown = new Map(); // msgId -> percentages last drawn (bars grow from there)
const pollPending = new Map(); // msgId -> Set of ticked options (multiple choice, not sent yet)

function pluralVotes(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} голос`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} голоса`;
  return `${n} голосов`;
}

function profileForUid(uid) {
  if (uid === currentUser.uid) return myProfile;
  return contactsMap.get(uid)?.profile || groupSenderCache.get(uid) || profileCache.get(uid)?.profile || null;
}

function renderPoll(msg) {
  const poll = msg.poll;
  const ops = messageOps();
  const me = currentUser.uid;
  const options = poll.options.slice(0, 10).map(String);
  const votes = msg.votes || {};
  const counts = options.map(() => 0);
  const voters = options.map(() => []);
  let total = 0;
  Object.entries(votes).forEach(([uid, choices]) => {
    if (!Array.isArray(choices) || !choices.length) return;
    total++;
    choices.forEach((i) => {
      if (counts[i] === undefined) return;
      counts[i]++;
      voters[i].push(uid);
    });
  });
  const mine = Array.isArray(votes[me]) ? votes[me] : [];
  const voted = mine.length > 0;
  const canVote = !!ops.vote && !msg._scheduled;
  const showResults = voted || !canVote;
  const pct = counts.map((c) => (total ? Math.round((c / total) * 100) : 0));
  const leader = Math.max(0, ...counts);
  const prev = pollShown.get(msg.id);
  pollShown.set(msg.id, showResults ? pct : null);
  const pending = pollPending.get(msg.id) || new Set();
  pollPending.set(msg.id, pending);

  const box = document.createElement("div");
  box.className = "poll" + (showResults ? " show-results" : "") + (poll.multi ? " multi" : "");
  box.innerHTML = `<div class="poll-q"></div><div class="poll-kind"></div><div class="poll-opts"></div>
    <div class="poll-foot"><span class="poll-total"></span><button type="button" class="poll-action hidden"></button></div>`;
  box.querySelector(".poll-q").textContent = poll.q || "Опрос";
  box.querySelector(".poll-kind").textContent = [poll.anon === false ? "Публичный опрос" : "Анонимный опрос", poll.multi ? "несколько ответов" : ""]
    .filter(Boolean)
    .join(" · ");
  box.querySelector(".poll-total").textContent = total ? pluralVotes(total) : "Пока никто не голосовал";
  const action = box.querySelector(".poll-action");
  const list = box.querySelector(".poll-opts");

  const cast = (choices, fromEl) => {
    pending.clear();
    if (choices.length && fromEl) burst(...centerOf(fromEl), { count: 10, spread: 46, colors: [...accentColors(), "#fff3c4"] });
    ops.vote(msg.id, choices).catch((err) => {
      console.error(err);
      toast("Не удалось проголосовать", { tone: "error" });
    });
  };

  options.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className =
      "poll-opt" +
      (mine.includes(i) ? " chosen" : "") +
      (pending.has(i) ? " pending" : "") +
      (showResults && leader > 0 && counts[i] === leader ? " leader" : "");
    b.innerHTML = '<span class="poll-bar"></span><span class="poll-check"></span><span class="poll-label"></span><span class="poll-voters"></span><span class="poll-pct"></span>';
    b.querySelector(".poll-label").textContent = label;
    if (showResults) {
      b.querySelector(".poll-pct").textContent = pct[i] + "%";
      const bar = b.querySelector(".poll-bar");
      const to = total ? counts[i] / total : 0;
      const from = prev ? prev[i] / 100 : 0;
      bar.style.transform = `scaleX(${to})`;
      if (Math.abs(from - to) > 0.004) animate(bar, [{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }], { spring: "smooth", delay: 40 * i });
      if (poll.anon === false) {
        const faces = b.querySelector(".poll-voters");
        voters[i].slice(0, 3).forEach((uid) => {
          const p = profileForUid(uid);
          faces.insertAdjacentHTML("beforeend", p ? visibleAvatarHTML(p, uid) : avatarHTML({ displayName: "?" }, uid));
        });
      }
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!canVote || voted) return;
      if (poll.multi) {
        if (pending.has(i)) pending.delete(i);
        else pending.add(i);
        b.classList.toggle("pending", pending.has(i));
        action.disabled = !pending.size;
        return;
      }
      cast([i], b);
    });
    list.appendChild(b);
  });

  if (canVote && voted) {
    action.textContent = "Отменить голос";
    action.classList.remove("hidden");
    action.addEventListener("click", (e) => {
      e.stopPropagation();
      cast([]);
    });
  } else if (canVote && poll.multi) {
    action.textContent = "Голосовать";
    action.classList.remove("hidden");
    action.disabled = !pending.size;
    action.addEventListener("click", (e) => {
      e.stopPropagation();
      if (pending.size) cast([...pending].sort((a, b) => a - b), action);
    });
  }
  return box;
}

// ---------- Location ----------
// A small static map stitched from OpenStreetMap tiles, pin in the middle.

function renderLocation(loc) {
  const lat = Number(loc?.lat);
  const lng = Number(loc?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) return null;
  const W = 260;
  const H = 150;
  const Z = 15;
  const T = 256;
  const n = 2 ** Z;
  const rad = (lat * Math.PI) / 180;
  const px = ((lng + 180) / 360) * n * T;
  const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * T;
  const left = px - W / 2;
  const top = py - H / 2;

  const card = document.createElement("a");
  card.className = "loc-card";
  card.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  const map = document.createElement("div");
  map.className = "loc-map";
  for (let tx = Math.floor(left / T); tx <= Math.floor((left + W) / T); tx++) {
    for (let ty = Math.floor(top / T); ty <= Math.floor((top + H) / T); ty++) {
      const img = document.createElement("img");
      img.src = `https://tile.openstreetmap.org/${Z}/${((tx % n) + n) % n}/${ty}.png`;
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      img.style.left = Math.round(tx * T - left) + "px";
      img.style.top = Math.round(ty * T - top) + "px";
      map.appendChild(img);
    }
  }
  map.insertAdjacentHTML("beforeend", '<span class="loc-pulse"></span><span class="loc-pin"></span><span class="loc-attr">© OpenStreetMap</span>');
  const cap = document.createElement("div");
  cap.className = "loc-caption";
  cap.innerHTML = `<b>Геопозиция</b><span>${lat.toFixed(5)}, ${lng.toFixed(5)}</span>`;
  card.append(map, cap);
  return card;
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
    pill.dataset.emoji = emoji;
    pill.textContent = `${emoji} ${uids.length}`;
    pill.addEventListener("click", (e) => {
      if (!mine) emojiEffect(emoji, e.clientX, e.clientY, 90);
      reactFn(msg.id, emoji, !mine);
    });
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
  const existing = document.querySelector(".react-picker:not([data-closing])");
  if (existing) closeReactionPicker(existing);
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
      if (!mine) emojiEffect(emoji, ...centerOf(btn), 110);
      reactFn(msg.id, emoji, !mine);
      closeReactionPicker(picker);
    });
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  const rect = anchorBtn.getBoundingClientRect();
  const maxLeft = window.innerWidth - picker.offsetWidth - 8;
  picker.style.left = Math.max(8, Math.min(rect.left, maxLeft)) + "px";
  picker.style.top = Math.max(8, rect.top - picker.offsetHeight - 8) + "px";
  picker.style.transformOrigin = `${rect.left + rect.width / 2 - parseFloat(picker.style.left)}px 100%`;
  animate(
    picker,
    [
      { opacity: 0, transform: "translateY(12px) scale(.4)", filter: "blur(8px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { spring: "bouncy" }
  );
  stagger(picker.children, { y: 14, blur: 0, scale: 0.2, step: 30, delay: 40, spring: "jelly" });
  setTimeout(() => {
    document.addEventListener("click", function closePicker(ev) {
      if (!picker.isConnected) {
        document.removeEventListener("click", closePicker);
      } else if (!picker.contains(ev.target)) {
        closeReactionPicker(picker);
        document.removeEventListener("click", closePicker);
      }
    });
  }, 0);
}

function closeReactionPicker(picker) {
  if (!picker.isConnected || picker.dataset.closing) return;
  picker.dataset.closing = "1";
  picker
    .animate(
      [
        { opacity: 1, transform: "none", filter: "blur(0px)" },
        { opacity: 0, transform: "translateY(8px) scale(.6)", filter: "blur(6px)" },
      ],
      { duration: reducedMotion ? 60 : 180, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
    )
    .finished.then(() => picker.remove(), () => picker.remove());
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

const touchOnly = window.matchMedia("(hover: none)").matches;

function renderMessage(msg, isMine, senderName) {
  const ops = messageOps();
  const canEdit = isMine && !!ops.edit;
  const canDelete = isMine && !!ops.del;
  const canReact = !!ops.react;
  const canReply = currentChatType !== "notifications" && !composer.classList.contains("hidden");

  const row = document.createElement("div");
  row.className = "msg-row" + (isMine ? " me" : "");
  row.dataset.msgId = msg.id;
  row.dataset.rx = JSON.stringify(msg.reactions || {});
  row.dataset.ts = String(msg.createdAt?.toMillis?.() || 0);

  const actionsHTML = `<div class="msg-actions">
      ${canReply ? '<button type="button" class="msg-reply-btn" title="Ответить">↩</button>' : ""}
      <button type="button" class="msg-more-btn" title="Ещё">⋯</button>
    </div>`;

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
  if (msg.forwardedFrom?.name) {
    const fwd = document.createElement("div");
    fwd.className = "msg-forwarded";
    fwd.textContent = `↪ Переслано от ${msg.forwardedFrom.name}`;
    row.querySelector(".bubble").before(fwd);
  }

  if (msg.replyTo) {
    const quote = row.querySelector(".msg-reply-quote");
    quote.querySelector(".msg-reply-sender").textContent = msg.replyTo.senderName || "…";
    quote.querySelector(".msg-reply-text").textContent = msg.replyTo.text || "";
    quote.addEventListener("click", () => scrollToMessage(msg.replyTo.id));
  }

  renderBubbleContent(row.querySelector(".bubble"), msg);

  const timeEl = row.querySelector(".msg-time");
  timeEl.textContent = msg._scheduled ? `📅 ${fmtScheduleTime(msg.createdAt)}` : fmtTime(msg.createdAt);
  if (msg._scheduled) row.classList.add("scheduled");
  if (msg.edited) {
    const tag = document.createElement("span");
    tag.className = "msg-edited-tag";
    tag.textContent = "(ред.)";
    timeEl.appendChild(tag);
  }
  if (currentChatData()?.pinned?.id === msg.id) {
    const pin = document.createElement("span");
    pin.className = "msg-pin-tag";
    pin.textContent = "📌";
    timeEl.prepend(pin);
  }
  if (isMine && !msg._scheduled && ["contact", "group", "channel"].includes(currentChatType)) {
    const tick = document.createElement("span");
    tick.className = "msg-tick";
    timeEl.appendChild(tick);
  }

  if (msg.effect && EFFECTS[msg.effect]) {
    row.dataset.effect = msg.effect;
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "msg-effect-tag";
    tag.title = "Повторить эффект: " + EFFECTS[msg.effect].label;
    tag.textContent = EFFECTS[msg.effect].emoji;
    tag.addEventListener("click", (e) => {
      e.stopPropagation();
      playEffect(msg.effect, { x: e.clientX, y: e.clientY });
    });
    timeEl.prepend(tag);
  }

  if (canReact) {
    row.querySelector(".msg-group").appendChild(buildReactionsBar(msg, ops.react));
  }
  const menuCtx = { row, msg, isMine, ops, canEdit, canDelete, canReact, canReply };
  if (canReply) {
    row.querySelector(".msg-reply-btn").addEventListener("click", () => startReply(msg));
  }
  row.querySelector(".msg-more-btn").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    openMessageMenu(menuCtx, r.left, r.bottom + 6);
  });
  const bubbleArea = row.querySelector(".msg-group");
  onContextGesture(bubbleArea, (x, y) => openMessageMenu(menuCtx, x, y));
  // Double tap / double click = ❤️, like in Telegram and Instagram.
  const quickReact = (x, y) => {
    if (!canReact || msg._scheduled) return;
    const mine = (msg.reactions?.["❤️"] || []).includes(currentUser.uid);
    if (!mine) emojiEffect("❤️", x, y, 120);
    ops.react(msg.id, "❤️", !mine);
  };
  const interactive = (t) => t.closest("button, a, img, audio, video, textarea, input, .msg-reply-quote, .anim-emoji, .vnote, .poll, .game-holder");
  if (touchOnly) {
    // Tap a bubble to get its actions (links, media and buttons keep working);
    // the menu waits a moment so a second tap can turn into a reaction.
    // Double taps are detected on touchend: browsers may swallow the second click.
    let tapTimer = null;
    let tapStart = null;
    let lastTap = null;
    bubbleArea.addEventListener(
      "touchstart",
      (e) => {
        tapStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      },
      { passive: true }
    );
    bubbleArea.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches[0];
        if (!tapStart || e.touches.length || interactive(e.target) || Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y) > 10) {
          lastTap = null;
          return;
        }
        const now = performance.now();
        if (lastTap && now - lastTap.at < 320 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
          e.preventDefault(); // no second click, no zoom
          lastTap = null;
          clearTimeout(tapTimer);
          tapTimer = null;
          quickReact(t.clientX, t.clientY);
          return;
        }
        lastTap = { at: now, x: t.clientX, y: t.clientY };
      },
      { passive: false }
    );
    bubbleArea.addEventListener("click", (e) => {
      if (interactive(e.target)) return;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(
        () => {
          tapTimer = null;
          const r = row.querySelector(".bubble").getBoundingClientRect();
          openMessageMenu(menuCtx, isMine ? r.right - 220 : r.left, r.bottom + 6);
        },
        canReact && !msg._scheduled ? 300 : 0
      );
    });
    if (canReply && !msg._scheduled) attachSwipeReply(row, msg);
  } else {
    bubbleArea.addEventListener("dblclick", (e) => {
      if (interactive(e.target)) return;
      window.getSelection()?.removeAllRanges();
      quickReact(e.clientX, e.clientY);
    });
  }

  messagesEl.appendChild(row);
}

// Swipe a bubble to the left to reply to it.
function attachSwipeReply(row, msg) {
  const group = row.querySelector(".msg-group");
  let sx = 0;
  let sy = 0;
  let dx = 0;
  let state = 0; // 0 idle · 1 undecided · 2 swiping · -1 vertical scroll
  row.addEventListener(
    "touchstart",
    (e) => {
      state = e.touches.length === 1 ? 1 : 0;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      dx = 0;
    },
    { passive: true }
  );
  row.addEventListener(
    "touchmove",
    (e) => {
      if (state <= 0) return;
      const mx = e.touches[0].clientX - sx;
      const my = e.touches[0].clientY - sy;
      if (state === 1) {
        if (Math.abs(my) > 10) {
          state = -1;
          return;
        }
        if (mx > -12) return;
        state = 2;
        row.classList.add("swiping");
      }
      dx = Math.max(-96, Math.min(0, mx + 12));
      group.style.transform = `translateX(${dx}px)`;
      row.style.setProperty("--swipe", Math.min(1, -dx / 64).toFixed(3));
      const armed = dx <= -64;
      if (armed !== row.classList.contains("swipe-armed")) {
        row.classList.toggle("swipe-armed", armed);
        if (armed && navigator.vibrate) navigator.vibrate(8);
      }
    },
    { passive: true }
  );
  const end = () => {
    if (state === 2) {
      if (dx <= -64) startReply(msg);
      const from = dx;
      group.style.transform = "";
      row.classList.remove("swiping", "swipe-armed");
      row.style.removeProperty("--swipe");
      animate(group, [{ transform: `translateX(${from}px)` }, { transform: "none" }], { spring: "bouncy" });
    }
    state = 0;
  };
  row.addEventListener("touchend", end, { passive: true });
  row.addEventListener("touchcancel", end, { passive: true });
}

function openMessageMenu({ row, msg, isMine, ops, canEdit, canDelete, canReact, canReply }, x, y) {
  if (msg._scheduled) {
    openContextMenu({
      x,
      y,
      items: [
        { label: "Отправить сейчас", icon: MI.forward, onClick: () => sendScheduledNow(msg) },
        {
          label: "Отменить отправку",
          icon: MI.trash,
          danger: true,
          onClick: () => cancelScheduledMessage(msg).catch(() => toast("Не удалось отменить", { tone: "error" })),
        },
      ],
    });
    return;
  }
  const hasText = !!msg.text && !msg.call && !msg.poll && !msg.game && !msg.location && !DEFAULT_CAPTIONS.includes(msg.text);
  const pinnedId = currentChatData()?.pinned?.id;
  const reactions = canReact
    ? {
        emojis: REACTION_EMOJIS,
        mine: new Set(Object.entries(msg.reactions || {}).filter(([, u]) => (u || []).includes(currentUser.uid)).map(([e]) => e)),
        onPick: (emoji, btn) => {
          const mine = (msg.reactions?.[emoji] || []).includes(currentUser.uid);
          if (!mine) emojiEffect(emoji, ...centerOf(btn), 110);
          ops.react(msg.id, emoji, !mine);
        },
      }
    : null;
  openContextMenu({
    x,
    y,
    reactions,
    items: [
      canReply && { label: "Ответить", icon: MI.reply, onClick: () => startReply(msg) },
      msg.effect && EFFECTS[msg.effect] && {
        label: "Повторить эффект",
        icon: MI.sparkle,
        onClick: () => playEffect(msg.effect, centerOfPoint(row.querySelector(".bubble"))),
      },
      hasText && {
        label: "Копировать",
        icon: MI.copy,
        onClick: () =>
          navigator.clipboard
            ?.writeText(msg.text)
            .then(() => toast("Текст скопирован", { icon: "📋" }))
            .catch(() => toast("Не удалось скопировать", { tone: "error" })),
      },
      !msg.call && { label: "Переслать", icon: MI.forward, onClick: () => openForward(msg) },
      canPinInCurrentChat() && {
        label: pinnedId === msg.id ? "Открепить" : "Закрепить",
        icon: MI.pin,
        onClick: () => setPinnedMessage(pinnedId === msg.id ? null : msg),
      },
      canEdit && hasText && { label: "Изменить", icon: MI.edit, onClick: () => startEditingMessage(row, msg, ops.edit) },
      canDelete && { label: "Удалить", icon: MI.trash, danger: true, onClick: () => deleteMessageRow(row, msg, ops) },
    ],
  });
}

async function deleteMessageRow(row, msg, ops) {
  if (!confirm("Удалить сообщение?")) return;
  await dissolveRow(row);
  try {
    await ops.del(msg.id);
    if (currentChatData()?.pinned?.id === msg.id) setPinnedMessage(null);
  } catch (err) {
    console.error(err);
    row.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    row.style.overflow = "";
    toast(err.message || "Не удалось удалить", { tone: "error" });
  }
}

// ---------- Forwarding ----------

let forwardingMsg = null;

function forwardTargets() {
  const me = currentUser.uid;
  const list = [
    {
      key: SAVED_ID,
      name: "Избранное",
      sub: "Заметки",
      avatar: `<div class="avatar pinned-avatar pa-saved">${SAVED_ICON}</div>`,
      send: (text, attachment, extra) => addSavedMessage(me, text, null, { ...extra, ...(attachment?.fields || {}) }),
    },
  ];
  chats
    .filter((c) => !(c.hiddenFor || []).includes(me))
    .forEach((c) => {
      const otherUid = c.participants.find((p) => p !== me);
      if (isBlocked(otherUid)) return;
      const contact = contactsMap.get(otherUid);
      const profile = contact?.profile || profileCache.get(otherUid)?.profile;
      if (!profile) return;
      list.push({
        key: c.id,
        name: contact ? contactDisplayName(contact.alias, profile) : profile.displayName,
        sub: "@" + profile.username,
        avatar: visibleAvatarHTML(profile, otherUid),
        send: (text, attachment, extra) => deliver({ type: "contact", id: c.id, text, attachment, extra }),
      });
    });
  groups
    .filter((g) => g.type === "group" || (g.admins || []).includes(me))
    .forEach((g) => {
      list.push({
        key: g.id,
        name: g.name,
        sub: g.type === "channel" ? "Канал" : pluralMembers((g.members || []).length),
        avatar: groupAvatarHTML(g),
        send: (text, attachment, extra) => deliver({ type: g.type, id: g.id, text, attachment, extra }),
      });
    });
  return list;
}

function renderForwardList() {
  const q = forwardSearch.value.trim().toLowerCase();
  forwardList.innerHTML = "";
  forwardTargets()
    .filter((t) => !q || t.name.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q))
    .forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pick-item";
      b.innerHTML = `${t.avatar}<div class="pick-item-meta"><div class="pick-item-name"></div><div class="pick-item-sub"></div></div>`;
      b.querySelector(".pick-item-name").textContent = t.name;
      b.querySelector(".pick-item-sub").textContent = t.sub;
      b.addEventListener("click", async () => {
        const msg = forwardingMsg;
        if (!msg) return;
        b.disabled = true;
        const fields = {};
        ["imageUrl", "voiceUrl", "fileUrl", "fileName", "fileType", "fileSize", "videoNoteUrl", "duration"].forEach((k) => {
          if (msg[k] !== undefined && msg[k] !== null) fields[k] = msg[k];
        });
        const attachment = Object.keys(fields).length ? { fields, previewText: replyPreviewText(msg), defaultCaption: msg.text } : null;
        const extra = { forwardedFrom: { name: msg.forwardedFrom?.name || replySenderLabel(msg) } };
        try {
          await t.send(msg.text || replyPreviewText(msg), attachment, extra);
          b.classList.add("sent");
          burst(...centerOf(b), { count: 10, spread: 50, colors: ["#7ff0b4", "#2fcf7f", ...accentColors()] });
        } catch (err) {
          console.error(err);
          b.disabled = false;
          toast("Не удалось переслать", { tone: "error" });
        }
      });
      forwardList.appendChild(b);
    });
}

function openForward(msg) {
  forwardingMsg = msg;
  forwardSearch.value = "";
  renderForwardList();
  showOverlay(forwardOverlay);
  stagger(forwardList.children, { y: 14, step: 30, delay: 100 });
}

forwardSearch.addEventListener("input", renderForwardList);
document.getElementById("forward-close-btn").addEventListener("click", () => hideOverlay(forwardOverlay));
forwardOverlay.addEventListener("click", (e) => {
  if (e.target === forwardOverlay) hideOverlay(forwardOverlay);
});

// ---------- Photo viewer ----------

let lightboxSource = null;
function openLightbox(img) {
  lightboxSource = img;
  lightboxImg.src = img.src;
  lightboxDownload.href = img.src;
  lightboxEl.classList.remove("hidden");
  const from = img.getBoundingClientRect();
  const to = lightboxImg.getBoundingClientRect();
  animate(lightboxEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
  if (to.width && from.width) {
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    animate(lightboxImg, [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width})` }, { transform: "none" }], {
      spring: "smooth",
    });
  }
}

function closeLightbox() {
  if (lightboxEl.classList.contains("hidden")) return;
  const done = () => {
    lightboxEl.classList.add("hidden");
    lightboxEl.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  };
  const from = lightboxImg.getBoundingClientRect();
  const to = lightboxSource?.isConnected ? lightboxSource.getBoundingClientRect() : null;
  if (to && to.width && !reducedMotion) {
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    lightboxImg.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})` }], {
      duration: 300,
      easing: "cubic-bezier(.4,0,.2,1)",
      fill: "forwards",
    });
  }
  lightboxEl
    .animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 60 : 300, easing: "ease-in", fill: "forwards" })
    .finished.then(done, done);
}

lightboxEl.addEventListener("click", (e) => {
  if (!e.target.closest(".lightbox-bar")) closeLightbox();
});
document.getElementById("lightbox-close").addEventListener("click", closeLightbox);

function centerOfPoint(el) {
  if (!el?.isConnected) return null;
  const [x, y] = centerOf(el);
  return { x, y };
}

// ---------- Links ----------

const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]|www\.[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;
function appendLinkified(parent, text) {
  let last = 0;
  text.replace(URL_RE, (match, _g, offset) => {
    if (offset > last) parent.append(text.slice(last, offset));
    const a = document.createElement("a");
    a.href = match.startsWith("http") ? match : "https://" + match;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = match;
    parent.append(a);
    last = offset + match.length;
    return match;
  });
  if (last < text.length) parent.append(text.slice(last));
}

// ---------- Date separators ----------

function dayLabel(ms) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  const opts = { day: "numeric", month: "long" };
  if (d.getFullYear() !== today.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("ru-RU", opts);
}

function renderMessageList(msgs, render) {
  let prevDay = "";
  msgs.forEach((msg) => {
    const ms = msg.createdAt?.toMillis?.() || Date.now();
    const day = new Date(ms).toDateString();
    if (day !== prevDay) {
      prevDay = day;
      const sep = document.createElement("div");
      sep.className = "date-sep";
      sep.textContent = dayLabel(ms);
      messagesEl.appendChild(sep);
    }
    render(msg);
  });
}

// ---------- Call log bubbles ----------

function renderCallBubble(bubble, msg) {
  const call = msg.call;
  const mine = msg.senderId === currentUser.uid;
  const video = call.kind === "video";
  const bad = !mine && call.result !== "completed";
  const titles = {
    completed: mine ? "Исходящий" : "Входящий",
    missed: mine ? "Без ответа" : "Пропущенный",
    declined: mine ? "Отклонённый" : "Отклонённый",
    busy: mine ? "Абонент занят" : "Пропущенный",
    cancelled: mine ? "Отменённый" : "Пропущенный",
  };
  bubble.classList.add("call-bubble");
  bubble.innerHTML = `
    <div class="call-bubble-icon${bad || (mine && call.result !== "completed") ? " bad" : ""}">${video ? MI.video : MI.phone}</div>
    <div class="call-bubble-meta">
      <div class="call-bubble-title"></div>
      <div class="call-bubble-sub"></div>
    </div>
    <button type="button" class="call-bubble-again" title="Перезвонить">${video ? MI.video : MI.phone}</button>`;
  bubble.querySelector(".call-bubble-title").textContent = `${titles[call.result] || "Звонок"} ${video ? "видеозвонок" : "звонок"}`;
  bubble.querySelector(".call-bubble-sub").textContent =
    call.result === "completed" && call.duration ? fmtDuration(call.duration) : fmtTime(msg.createdAt);
  const again = bubble.querySelector(".call-bubble-again");
  if (currentChatType !== "contact" || isBlocked(currentOtherUid)) again.remove();
  else again.addEventListener("click", () => callCurrentContact(call.kind));
}

// The bubble shatters into sparks and the gap it leaves closes up.
function dissolveRow(row) {
  if (reducedMotion) return Promise.resolve();
  const group = row.querySelector(".msg-group");
  const [x, y] = centerOf(group);
  burst(x, y, { count: 14, spread: 80, colors: [...accentColors(), "#fff3c4"] });
  group.animate(
    [
      { opacity: 1, transform: "none", filter: "blur(0px)" },
      { opacity: 0, transform: "scale(.55) translateY(-12px)", filter: "blur(16px)" },
    ],
    { duration: 380, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
  );
  row.style.overflow = "hidden";
  const collapse = row.animate(
    [
      { height: row.offsetHeight + "px", marginBottom: getComputedStyle(row).marginBottom },
      { height: "0px", marginBottom: "0px" },
    ],
    { duration: 300, delay: 220, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }
  );
  return collapse.finished.catch(() => {});
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  await doSendMessage();
});

// Keyed by physical key so the shortcuts also work in the Russian layout.
const FORMAT_KEYS = { KeyB: "**", KeyI: "__", "shift+KeyX": "~~", "shift+KeyP": "||", "shift+KeyM": "`" };
msgInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const marker = FORMAT_KEYS[(e.shiftKey ? "shift+" : "") + e.code];
    if (marker) {
      e.preventDefault();
      wrapSelection(msgInput, marker);
      return;
    }
  }
  if (e.key !== "Enter" || e.shiftKey) return;
  const sendOnEnter = myProfile?.chatPrefs?.sendOnEnter !== false;
  if (sendOnEnter || e.ctrlKey || e.metaKey) {
    e.preventDefault();
    doSendMessage();
  }
});

function updateComposerButtons() {
  const hasText = msgInput.value.trim().length > 0;
  voiceBtn.classList.toggle("hidden", hasText);
  document.getElementById("circle-btn")?.classList.toggle("hidden", hasText || currentChatType === "notifications");
  sendBtn.classList.toggle("hidden", !hasText);
}

msgInput.addEventListener("input", () => {
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
  updateComposerButtons();

  saveDraftSoon();
  if (currentChatType === "contact" && myProfile?.privacy?.typingVisibility !== false) {
    // One write per ~2.5 s is enough for "печатает…" on the other side.
    if (Date.now() - lastTypingPing > 2500) {
      lastTypingPing = Date.now();
      setTyping(currentChatId, currentUser.uid, true);
    }
    clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => {
      lastTypingPing = 0;
      setTyping(currentChatId, currentUser.uid, false);
    }, 3500);
  }
});

let lastTypingPing = 0;
const saveDraftSoon = debounce(() => writeDraft(currentChatId, msgInput.value), 400);

async function doSendMessage(attachment, { scheduleAt = null, effect = null, silent = false } = {}) {
  const text = msgInput.value.trim();
  if (!text && !attachment) return;
  if (!currentChatId) return;
  const replyPayload = replyToMessage
    ? { id: replyToMessage.id, senderName: replySenderLabel(replyToMessage), text: replyPreviewText(replyToMessage).slice(0, 120) }
    : null;
  msgInput.value = "";
  msgInput.style.height = "auto";
  writeDraft(currentChatId, "");
  lastTypingPing = 0;
  if (text && !attachment && !reducedMotion && !sendBtn.classList.contains("hidden")) {
    // Let the arrow fly off before the send button morphs back into the mic.
    sendBtn.classList.remove("launch");
    void sendBtn.offsetWidth;
    sendBtn.classList.add("launch");
    burst(...centerOf(sendBtn), { count: 8, spread: 42, colors: [...accentColors(), "#fff3c4"] });
    setTimeout(() => {
      sendBtn.classList.remove("launch");
      updateComposerButtons();
    }, 420);
  } else {
    updateComposerButtons();
  }
  sendBtn.disabled = true;
  clearTimeout(typingClearTimer);
  closeEmojiPicker();
  cancelReply();
  try {
    const extra = {};
    // 🎲 🎯 🏀 🎰 on their own become a mini game with a result rolled here.
    if (!attachment && gameForText(text) && currentChatType !== "notifications") extra.game = rollGame(text);
    if (effect) extra.effect = effect;
    await deliver({
      type: currentChatType,
      id: currentChatId,
      text,
      attachment,
      replyTo: replyPayload,
      scheduleAt,
      silent,
      extra: Object.keys(extra).length ? extra : null,
    });
    if (scheduleAt) toast(`Сообщение будет отправлено ${fmtScheduleTime(scheduleAt)}`, { icon: "📅" });
    else if (silent) toast("Отправлено без звука", { icon: "🔕" });
  } catch (err) {
    console.error(err);
    if (err?.silent) {
      toast(err.message, { tone: "error" });
    } else if (err?.code === "permission-denied" && currentChatType === "contact") {
      toast("Сообщение не доставлено: пользователь ограничил вам отправку сообщений", { tone: "error", duration: 4500 });
    } else {
      toast("Не удалось отправить сообщение: " + (err.message || ""), { tone: "error", duration: 4500 });
    }
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
    if (!touchOnly) {
      // Hovered emoji come alive, like Telegram's panel.
      btn.addEventListener("pointerenter", () => {
        if (btn._anim) return;
        btn._anim = animatedEmoji(emoji, 30, { play: "now", loop: true });
        btn.textContent = "";
        btn.appendChild(btn._anim);
      });
      btn.addEventListener("pointerleave", () => {
        btn._anim?.destroy();
        btn._anim = null;
        btn.textContent = emoji;
      });
    }
    btn.addEventListener("click", () => {
      msgInput.value += emoji;
      msgInput.dispatchEvent(new Event("input"));
      msgInput.focus();
      animate(btn, [{ transform: "scale(1.6) rotate(-12deg)" }, { transform: "none" }], { spring: "jelly" });
    });
    emojiPicker.appendChild(btn);
  });
  reveal(emojiPicker);
  // Emojis ripple in diagonally from the corner nearest the button.
  const cols = getComputedStyle(emojiPicker).gridTemplateColumns.split(" ").length || 8;
  Array.from(emojiPicker.children).forEach((btn, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    animate(btn, [{ opacity: 0, transform: "scale(.2) translateY(14px)" }, { opacity: 1, transform: "none" }], {
      spring: "jelly",
      delay: 40 + (col + row) * 16,
    });
  });
}

function closeEmojiPicker() {
  conceal(emojiPicker);
}

emojiBtn.addEventListener("click", () => {
  if (emojiPicker.classList.contains("hidden") || emojiPicker.classList.contains("is-closing")) openEmojiPicker();
  else closeEmojiPicker();
});

// ---------- File / photo / video attachments ----------

// Uploads one file to Cloudinary (with a progress toast that can cancel
// it) and describes it as a message attachment.
function uploadToast(label) {
  const ctrl = new AbortController();
  const t = progressToast(label, { onCancel: () => ctrl.abort() });
  return { update: t.update, done: t.done, fail: t.fail, signal: ctrl.signal };
}

const FILE_LABELS = { image: "фото", video: "видео", audio: "аудио", file: "файл" };

async function buildFileAttachment(original) {
  const kind = original.type.startsWith("image/")
    ? "image"
    : original.type.startsWith("video/")
    ? "video"
    : original.type.startsWith("audio/")
    ? "audio"
    : "file";
  const file = kind === "image" ? await prepareImageForUpload(original) : original;
  const progress = uploadToast(`Отправка ${FILE_LABELS[kind]}: ${original.name || "файл"}`);
  let url;
  try {
    const resourceType = kind === "image" ? "image" : kind === "file" ? "raw" : "video"; // Cloudinary files audio under "video"
    ({ url } = await uploadToCloudinary(file, resourceType, progress.update, progress.signal));
    progress.done();
  } catch (err) {
    progress.fail();
    throw err;
  }
  if (kind === "image") {
    const label = file.type === "image/gif" ? "📷 GIF" : "📷 Фото";
    return { fields: { imageUrl: url }, previewText: label, defaultCaption: "📷" };
  }
  const fields = { fileUrl: url, fileName: original.name, fileType: original.type || "application/octet-stream", fileSize: file.size };
  if (kind === "video") return { fields, previewText: "🎬 Видео", defaultCaption: "🎬" };
  return { fields, previewText: `📎 ${original.name}`, defaultCaption: `📎 ${original.name}` };
}

// Sends several files one after another (picker, drag & drop, paste).
async function sendFiles(files) {
  const list = Array.from(files || []).slice(0, 10);
  if (!list.length || !currentChatId) return;
  if (composer.classList.contains("hidden") || currentChatType === "notifications") {
    toast("В этот чат нельзя отправлять файлы", { tone: "error" });
    return;
  }
  if (!uploadsConfigured) {
    toast("Отправка файлов ещё не настроена (Cloudinary, см. README)", { tone: "error", duration: 5000 });
    return;
  }
  attachErrorEl.textContent = "";
  attachBtn.disabled = true;
  try {
    for (const file of list) {
      try {
        const attachment = await buildFileAttachment(file);
        await doSendMessage(attachment);
      } catch (err) {
        if (err?.name === "AbortError") continue;
        console.error(err);
        toast(`${file.name}: ${err.message || "не удалось отправить"}`, { tone: "error", duration: 5000 });
      }
    }
  } finally {
    attachBtn.disabled = false;
  }
}

attachBtn.addEventListener("click", openAttachMenu);

function openAttachMenu() {
  const r = attachBtn.getBoundingClientRect();
  const social = ["contact", "group", "channel"].includes(currentChatType);
  const canPlay = currentChatType !== "notifications";
  openContextMenu({
    x: r.left,
    y: r.top - 8,
    reactions: canPlay ? { emojis: Object.keys(GAMES), mine: new Set(), onPick: (emoji) => sendGame(emoji) } : null,
    items: [
      { label: "Фото, видео или файл", icon: MI.image, onClick: () => attachInput.click() },
      social && { label: "Опрос", icon: MI.poll, onClick: openPollCreator },
      canPlay && { label: "Геопозиция", icon: MI.location, onClick: sendLocation },
    ],
  });
  document.querySelector(".ctx-menu")?.classList.add("attach-menu");
}

async function sendGame(emoji) {
  if (!currentChatId) return;
  try {
    await deliver({ type: currentChatType, id: currentChatId, text: emoji, extra: { game: rollGame(emoji) } });
  } catch (err) {
    console.error(err);
    toast("Не удалось отправить", { tone: "error" });
  }
}

function sendLocation() {
  if (!navigator.geolocation) {
    toast("Геолокация недоступна в этом браузере", { tone: "error" });
    return;
  }
  const target = { type: currentChatType, id: currentChatId };
  toast("Определяем местоположение…", { icon: "📍" });
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const location = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) };
      try {
        await deliver({ ...target, text: "📍 Геопозиция", extra: { location } });
      } catch (err) {
        console.error(err);
        toast("Не удалось отправить геопозицию", { tone: "error" });
      }
    },
    (err) => {
      const reason = err.code === 1 ? "нет доступа к геолокации" : "не удалось определить местоположение";
      toast("Геопозиция: " + reason, { tone: "error", duration: 4000 });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

// ---------- Poll creator ----------

const pollOverlay = document.getElementById("poll-overlay");
const pollQuestion = document.getElementById("poll-question");
const pollOptionsEl = document.getElementById("poll-options");
const pollAddBtn = document.getElementById("poll-add-option");
const pollAnon = document.getElementById("poll-anon");
const pollMulti = document.getElementById("poll-multi");
let pollTarget = null;

function syncPollAddBtn() {
  pollAddBtn.classList.toggle("hidden", pollOptionsEl.children.length >= 10);
}

function addPollOption(focus = false) {
  if (pollOptionsEl.children.length >= 10) return null;
  const row = document.createElement("div");
  row.className = "poll-edit-row";
  row.innerHTML = '<span class="poll-edit-dot"></span><input type="text" maxlength="100" placeholder="Вариант ответа" /><button type="button" class="icon-btn" title="Убрать">✕</button>';
  const input = row.querySelector("input");
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = row.nextElementSibling?.querySelector("input") || addPollOption()?.querySelector("input");
    next?.focus();
  });
  row.querySelector("button").addEventListener("click", () => {
    if (pollOptionsEl.children.length <= 2) {
      input.value = "";
      return;
    }
    row.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-20px) scale(.9)" }], { duration: 180, easing: "ease-in" }).finished.then(() => {
      row.remove();
      syncPollAddBtn();
    });
  });
  pollOptionsEl.appendChild(row);
  animate(row, [{ opacity: 0, transform: "translateY(-8px) scale(.94)" }, { opacity: 1, transform: "none" }], { spring: "bouncy" });
  syncPollAddBtn();
  if (focus) input.focus();
  return row;
}

function openPollCreator() {
  if (!currentChatId) return;
  pollTarget = { type: currentChatType, id: currentChatId };
  pollQuestion.value = "";
  pollOptionsEl.innerHTML = "";
  pollAnon.checked = true;
  pollMulti.checked = false;
  addPollOption();
  addPollOption();
  showOverlay(pollOverlay);
  setTimeout(() => pollQuestion.focus(), 80);
}

pollAddBtn.addEventListener("click", () => addPollOption(true));
pollQuestion.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    pollOptionsEl.querySelector("input")?.focus();
  }
});
document.getElementById("poll-cancel").addEventListener("click", () => hideOverlay(pollOverlay));
pollOverlay.addEventListener("click", (e) => {
  if (e.target === pollOverlay) hideOverlay(pollOverlay);
});
document.getElementById("poll-create").addEventListener("click", async () => {
  const q = pollQuestion.value.trim().slice(0, 200);
  const options = [...new Set([...pollOptionsEl.querySelectorAll("input")].map((i) => i.value.trim().slice(0, 100)).filter(Boolean))];
  if (!q) {
    toast("Введите вопрос", { tone: "error" });
    pollQuestion.focus();
    return;
  }
  if (options.length < 2) {
    toast("Нужно хотя бы два разных варианта", { tone: "error" });
    return;
  }
  hideOverlay(pollOverlay);
  try {
    await deliver({
      ...pollTarget,
      text: "📊 " + q,
      extra: { poll: { q, options, multi: pollMulti.checked, anon: pollAnon.checked } },
      plain: { votes: {} },
    });
  } catch (err) {
    console.error(err);
    toast("Не удалось создать опрос", { tone: "error" });
  }
});

attachInput.addEventListener("change", () => {
  const files = Array.from(attachInput.files || []);
  attachInput.value = "";
  sendFiles(files);
});

// Paste screenshots/files straight into the composer.
msgInput.addEventListener("paste", (e) => {
  const files = Array.from(e.clipboardData?.files || []);
  if (!files.length) return;
  e.preventDefault();
  sendFiles(files);
});

// Drag files onto the open chat.
let dropZone = null;
let dragDepth = 0;
chatSection.addEventListener("dragenter", (e) => {
  if (!currentChatId || !e.dataTransfer?.types?.includes("Files")) return;
  e.preventDefault();
  dragDepth++;
  if (dropZone) return;
  dropZone = document.createElement("div");
  dropZone.id = "drop-zone";
  dropZone.innerHTML =
    '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>Отпустите, чтобы отправить</span>';
  chatSection.appendChild(dropZone);
  animate(dropZone, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { spring: "bouncy" });
});
chatSection.addEventListener("dragover", (e) => {
  if (dropZone) e.preventDefault();
});
const clearDropZone = () => {
  dragDepth = 0;
  dropZone?.remove();
  dropZone = null;
};
chatSection.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) clearDropZone();
});
chatSection.addEventListener("drop", (e) => {
  if (!dropZone) return;
  e.preventDefault();
  clearDropZone();
  sendFiles(e.dataTransfer.files);
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
      const progress = uploadToast("Отправка голосового сообщения");
      let url;
      try {
        ({ url } = await uploadToCloudinary(voiceFile, "video", progress.update, progress.signal)); // Cloudinary files audio under "video"
        progress.done();
      } catch (e) {
        progress.fail();
        throw e;
      }
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
  showOverlay(aliasOverlay);
});

aliasCancelBtn.addEventListener("click", () => hideOverlay(aliasOverlay));
aliasOverlay.addEventListener("click", (e) => {
  if (e.target === aliasOverlay) hideOverlay(aliasOverlay);
});

aliasSaveBtn.addEventListener("click", async () => {
  if (!currentOtherUid) return;
  await setContactAlias(currentUser.uid, currentOtherUid, {
    firstName: aliasFirstname.value,
    lastName: aliasLastname.value,
  });
  hideOverlay(aliasOverlay);
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
  if (chatMenuDropdown.classList.contains("hidden") || chatMenuDropdown.classList.contains("is-closing")) {
    showPopover(chatMenuDropdown, { originX: "right" });
  } else {
    hidePopover(chatMenuDropdown);
  }
});

document.addEventListener("click", (e) => {
  if (!chatMenuDropdown.classList.contains("hidden") && !chatMenuDropdown.contains(e.target) && !chatMenuBtn.contains(e.target)) {
    hidePopover(chatMenuDropdown);
  }
});

chatMenuClearBtn.addEventListener("click", async () => {
  hidePopover(chatMenuDropdown);
  if (!confirm("Очистить историю сообщений? Это уберёт их только из вашей ленты.")) return;
  if (currentChatType === "contact") await clearChatForMe(currentChatId, currentUser.uid);
  else if (currentChatType === "group" || currentChatType === "channel") await clearGroupForMe(currentChatId, currentUser.uid);
  // Sweep the visible bubbles away before the list empties.
  const rows = Array.from(messagesEl.querySelectorAll(".msg-row")).slice(-20).reverse();
  rows.forEach((row, i) => {
    row.querySelector(".msg-group")?.animate(
      [
        { opacity: 1, transform: "none", filter: "blur(0px)" },
        { opacity: 0, transform: "translateY(-30px) scale(.8)", filter: "blur(10px)" },
      ],
      { duration: 320, delay: i * 18, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" }
    );
  });
  await new Promise((r) => setTimeout(r, reducedMotion ? 0 : 320 + rows.length * 18));
  currentClearedAt = Date.now();
  rerenderMessages();
});

chatMenuDeleteBtn.addEventListener("click", async () => {
  hidePopover(chatMenuDropdown);
  if (!confirm("Удалить чат из списка? Он вернётся, если придёт новое сообщение.")) return;
  if (currentChatType === "contact") await hideChatForMe(currentChatId, currentUser.uid);
  else if (currentChatType === "group" || currentChatType === "channel") await hideGroupForMe(currentChatId, currentUser.uid);
  closeCurrentChatView();
});

function closeCurrentChatView() {
  if (currentChatId) writeDraft(currentChatId, msgInput.value);
  closeChatSearch(true);
  scrollBottomBtn.classList.add("hidden");
  pinnedBar.classList.add("hidden");
  blockedBar.classList.add("hidden");
  chatSection.classList.remove("has-pinned");
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
  sidebar.classList.remove("chat-open");
  animate(
    emptyState,
    [
      { opacity: 0, transform: "scale(.9)", filter: "blur(12px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { spring: "smooth" }
  );
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

// Chat docs also change for typing indicators, read receipts, pins… — only
// notify once per new last message.
const notifiedAt = new Map();
function isNewLastMessage(id, data) {
  const at = data.lastMessageAt?.toMillis?.();
  if (!at) return false;
  if ((notifiedAt.get(id) || 0) >= at) return false;
  notifiedAt.set(id, at);
  return true;
}

async function maybeNotify(chatData) {
  if (!chatData.lastMessageSenderId || chatData.lastMessageSenderId === currentUser.uid) return;
  if (!isNewLastMessage(chatData.id, chatData)) return;
  if (isChatMuted(chatData.id) || isBlocked(chatData.lastMessageSenderId)) return;
  const isViewingThisChat =
    currentChatId &&
    chatData.participants &&
    chatData.participants.includes(currentUser.uid) &&
    !document.hidden &&
    [...chatData.participants].sort().join("_") === currentChatId;
  if (isViewingThisChat) return;

  const notifPrefs = myProfile?.notifications || {};
  if (notifPrefs.muteAll) return;
  const silent = !!chatData.lastSilent;
  if (notifPrefs.sound !== false && !silent) beep();

  if (notifPrefs.desktop && "Notification" in window && Notification.permission === "granted") {
    const senderUid = chatData.lastMessageSenderId;
    const senderProfile = contactsMap.get(senderUid)?.profile || (await getProfile(senderUid));
    const title = senderProfile?.displayName || "Новое сообщение";
    const opened = chatData.lastEnc ? await openPreview(chatData.id, chatData.lastEnc, chatData.lastMessageSenderId) : null;
    const body = notifPrefs.preview !== false ? stripRich(opened || chatData.lastMessage) : "Новое сообщение";
    new Notification(title, { body, silent });
  }
}

async function maybeNotifyGroup(groupId, groupData) {
  if (!groupData.lastMessageSenderId || groupData.lastMessageSenderId === currentUser.uid) return;
  if (!isNewLastMessage(groupId, groupData)) return;
  if (isChatMuted(groupId)) return;
  const isViewingThisGroup = currentChatId === groupId && !document.hidden;
  if (isViewingThisGroup) return;

  const notifPrefs = myProfile?.notifications || {};
  if (notifPrefs.muteAll || notifPrefs.groups === false) return;
  const silent = !!groupData.lastSilent;
  if (notifPrefs.sound !== false && !silent) beep();

  if (notifPrefs.desktop && "Notification" in window && Notification.permission === "granted") {
    const body = notifPrefs.preview !== false ? stripRich(groupData.lastMessage) : "Новое сообщение";
    new Notification(groupData.name || "Новое сообщение", { body, silent });
  }
}

// ---------- Language (i18n) ----------

const TRANSLATIONS = {
  ru: {
    settings_title: "Настройки",
    menu_profile: "Профиль",
    menu_privacy: "Приватность",
    menu_notifications: "Уведомления",
    menu_chats: "Чаты",
    menu_language: "Язык",
    menu_sessions: "Сессии",
    save: "Сохранить",
    logout: "Выйти из аккаунта",
    change_password: "Сменить пароль",
    delete_account: "Удалить аккаунт",
    search_placeholder: "Найти по юзернейму…",
    composer_placeholder: "Написать сообщение…",
    empty_state: "Выберите чат слева<br />или найдите контакт по юзернейму",
  },
  en: {
    settings_title: "Settings",
    menu_profile: "Profile",
    menu_privacy: "Privacy",
    menu_notifications: "Notifications",
    menu_chats: "Chats",
    menu_language: "Language",
    menu_sessions: "Sessions",
    save: "Save",
    logout: "Log out",
    change_password: "Change password",
    delete_account: "Delete account",
    search_placeholder: "Find by username…",
    composer_placeholder: "Write a message…",
    empty_state: "Select a chat on the left<br />or find a contact by username",
  },
};

let currentLanguage = "ru";

function t(key) {
  return TRANSLATIONS[currentLanguage]?.[key] ?? TRANSLATIONS.ru[key] ?? key;
}

function applyLanguage(lang, animated = false) {
  currentLanguage = TRANSLATIONS[lang] ? lang : "ru";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (animated) scrambleText(el, t(el.dataset.i18n));
    else el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.documentElement.lang = currentLanguage;
}

// ---------- Chat display preferences ----------

// [accent, accent-2, text colour on the accent]
const DEFAULT_ACCENT = "amber";
const ACCENT_PRESETS = {
  amber: ["#ffa41b", "#ff6a1a", "#1f1100"],
  blue: ["#5b8cff", "#3f6de0", "#ffffff"],
  purple: ["#8b5cf6", "#6d28d9", "#ffffff"],
  pink: ["#ff6b9d", "#e94e85", "#ffffff"],
  red: ["#e5484d", "#c53a3f", "#ffffff"],
  orange: ["#f5a623", "#d98c0f", "#1f1100"],
  green: ["#22c55e", "#16a34a", "#04210f"],
  teal: ["#00b8d9", "#0891a8", "#00191f"],
};

function applyChatPrefs(prefs) {
  const fontSize = prefs.fontSize || "medium";
  messagesEl.classList.remove("font-small", "font-large");
  if (fontSize === "small") messagesEl.classList.add("font-small");
  if (fontSize === "large") messagesEl.classList.add("font-large");
  messagesEl.classList.toggle("compact", !!prefs.compact);

  const accentKey = ACCENT_PRESETS[prefs.accentColor] ? prefs.accentColor : DEFAULT_ACCENT;
  const [accent, accent2, onAccent] = ACCENT_PRESETS[accentKey];
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-2", accent2);
  document.documentElement.style.setProperty("--on-accent", onAccent);

  chatsAccentSwatches.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.color === accentKey);
  });
}

// Mirrors the (unsaved) choices in the Chats tab onto the live preview.
function updateChatsPreview() {
  if (!chatsPreview) return;
  chatsPreview.classList.toggle("font-small", chatsFontSize.value === "small");
  chatsPreview.classList.toggle("font-large", chatsFontSize.value === "large");
  chatsPreview.classList.toggle("compact", chatsCompact.checked);
  const key = selectedChatsAccent || myProfile?.chatPrefs?.accentColor || DEFAULT_ACCENT;
  const [a, b, on] = ACCENT_PRESETS[key] || ACCENT_PRESETS[DEFAULT_ACCENT];
  chatsPreview.style.setProperty("--pv-accent", a);
  chatsPreview.style.setProperty("--pv-accent-2", b);
  chatsPreview.style.setProperty("--pv-on-accent", on);
}

chatsFontSize.addEventListener("change", updateChatsPreview);
chatsCompact.addEventListener("change", updateChatsPreview);

// ---------- Settings overlay ----------

settingsCloseBtn.addEventListener("click", () => hideOverlay(settingsOverlay));
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) hideOverlay(settingsOverlay);
});

function SETTINGS_SECTION_TITLES(section) {
  return {
    profile: t("menu_profile"),
    privacy: t("menu_privacy"),
    notifications: t("menu_notifications"),
    chats: t("menu_chats"),
    language: t("menu_language"),
    sessions: t("menu_sessions"),
  }[section];
}

function visibleSettingsView() {
  if (!settingsMenu.classList.contains("hidden")) return settingsMenu;
  return Array.from(document.querySelectorAll(".settings-tab-panel")).find((p) => !p.classList.contains("hidden")) || null;
}

// Sections slide sideways like pages of glass while the panel's height
// morphs to fit, and the title decodes into the new name.
function showSettingsMenu(animated = false) {
  const outgoing = visibleSettingsView();
  const mutate = () => {
    settingsMenu.classList.remove("hidden");
    document.querySelectorAll(".settings-tab-panel").forEach((p) => p.classList.add("hidden"));
    settingsBackBtn.classList.add("hidden");
    settingsBodyEl.scrollTop = 0;
  };
  if (!animated || outgoing === settingsMenu) {
    mutate();
    settingsHeaderTitle.textContent = t("settings_title");
    return;
  }
  swapPanels({ container: settingsPanelEl, clip: settingsBodyEl, outgoing, incoming: settingsMenu, direction: -1, mutate });
  morphText(settingsHeaderTitle, t("settings_title"), -1);
}

function showSettingsSection(section) {
  const outgoing = visibleSettingsView();
  const panel = document.querySelector(`.settings-tab-panel[data-spanel="${section}"]`);
  const mutate = () => {
    settingsMenu.classList.add("hidden");
    document.querySelectorAll(".settings-tab-panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.spanel !== section);
    });
    settingsBackBtn.classList.remove("hidden");
    settingsBodyEl.scrollTop = 0;
    if (panel) syncSegmented(panel);
    if (section === "chats") updateChatsPreview();
  };
  swapPanels({ container: settingsPanelEl, clip: settingsBodyEl, outgoing, incoming: panel, direction: 1, mutate });
  morphText(settingsHeaderTitle, SETTINGS_SECTION_TITLES(section) || t("settings_title"), 1);
  animate(settingsBackBtn, [{ transform: "scale(0) rotate(90deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { spring: "jelly" });
  if (section === "sessions") loadSessions();
}

settingsMenuItems.forEach((btn) => {
  btn.addEventListener("click", () => showSettingsSection(btn.dataset.section));
});

settingsBackBtn.addEventListener("click", () => showSettingsMenu(true));

function updateProfileCounters() {
  settingsDisplaynameCounter.textContent = `${settingsDisplayname.value.length}/40`;
  settingsBioCounter.textContent = `${settingsBio.value.length}/140`;
}

settingsDisplayname.addEventListener("input", updateProfileCounters);
settingsBio.addEventListener("input", updateProfileCounters);
const emojiStatusPicker = document.getElementById("settings-emoji-status");
const settingsProfileLink = document.getElementById("settings-profile-link");
let selectedEmojiStatus = null;

function renderEmojiStatusPicker() {
  emojiStatusPicker.innerHTML = "";
  [null, ...EMOJI_STATUSES].forEach((emoji) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "status-chip" + (emoji === selectedEmojiStatus ? " selected" : "") + (emoji ? "" : " none");
    b.textContent = emoji || "✕";
    b.title = emoji ? "Поставить статус" : "Без статуса";
    b.addEventListener("click", () => {
      selectedEmojiStatus = emoji;
      emojiStatusPicker.querySelectorAll(".status-chip").forEach((c) => c.classList.toggle("selected", c === b));
      animate(b, [{ transform: "scale(.6) rotate(-20deg)" }, { transform: "none" }], { spring: "jelly" });
      if (emoji) emojiEffect(emoji, ...centerOf(b), 70);
    });
    emojiStatusPicker.appendChild(b);
  });
}

function profileLink() {
  return `${location.origin}/?u=${encodeURIComponent(myProfile.username)}`;
}

document.getElementById("settings-profile-link-copy").addEventListener("click", async (e) => {
  const url = profileLink();
  if (touchOnly && navigator.share) {
    navigator.share({ title: "Linkage Message", text: `Напишите мне в Linkage Message: @${myProfile.username}`, url }).catch(() => {});
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Ссылка скопирована", { icon: "🔗" });
    successPulse(e.currentTarget);
  } catch (_) {
    toast("Не удалось скопировать", { tone: "error" });
  }
});

settingsBirthdayClearBtn?.addEventListener("click", () => {
  settingsBirthday.value = "";
});

function openSettings() {
  settingsProfileError.textContent = "";
  settingsPrivacyError.textContent = "";
  settingsNotifError.textContent = "";
  settingsChatsError.textContent = "";
  settingsLanguageError.textContent = "";
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
  selectedEmojiStatus = validStatus(myProfile.emojiStatus);
  renderEmojiStatusPicker();
  settingsProfileLink.textContent = profileLink();
  updateProfileCounters();
  settingsCreatedAt.textContent = myProfile.createdAt?.toDate
    ? myProfile.createdAt.toDate().toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  privacyLastseen.value = myProfile.privacy?.lastSeenVisibility || "everyone";
  privacyAvatar.value = myProfile.privacy?.avatarVisibility || "everyone";
  privacyBio.value = myProfile.privacy?.bioVisibility || "everyone";
  privacyBirthday.value = myProfile.privacy?.birthdayVisibility || "everyone";
  privacyTyping.checked = myProfile.privacy?.typingVisibility !== false;

  notifMuteAll.checked = !!myProfile.notifications?.muteAll;
  notifSound.checked = myProfile.notifications?.sound !== false;
  notifDesktop.checked = !!myProfile.notifications?.desktop;
  notifPreview.checked = myProfile.notifications?.preview !== false;
  notifGroups.checked = myProfile.notifications?.groups !== false;

  const chatPrefs = myProfile.chatPrefs || {};
  chatsSendOnEnter.checked = chatPrefs.sendOnEnter !== false;
  chatsFontSize.value = chatPrefs.fontSize || "medium";
  chatsCompact.checked = !!chatPrefs.compact;
  selectedChatsAccent = null;
  const accentKey = ACCENT_PRESETS[chatPrefs.accentColor] ? chatPrefs.accentColor : DEFAULT_ACCENT;
  chatsAccentSwatches.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.color === accentKey);
  });

  settingsLanguage.value = myProfile.language || "ru";

  showSettingsMenu();
  showOverlay(settingsOverlay);
  stagger(settingsMenu.children, { y: 18, step: 38, delay: 110 });
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
      emojiStatus: selectedEmojiStatus || null,
    });
    myProfile = await fetchMyProfile(currentUser.uid);
    renderMe();
    renderChats();
    await successPulse(settingsProfileSave);
    hideOverlay(settingsOverlay);
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
      lastSeenVisibility: privacyLastseen.value,
      avatarVisibility: privacyAvatar.value,
      bioVisibility: privacyBio.value,
      birthdayVisibility: privacyBirthday.value,
      typingVisibility: privacyTyping.checked,
    };
    await updatePrivacy(currentUser.uid, privacy);
    myProfile.privacy = privacy;
    renderChats();
    await successPulse(settingsPrivacySave);
    hideOverlay(settingsOverlay);
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
      muteAll: notifMuteAll.checked,
      sound: notifSound.checked,
      desktop: desktopEnabled,
      preview: notifPreview.checked,
      groups: notifGroups.checked,
    };
    await updateNotifications(currentUser.uid, notifications);
    myProfile.notifications = notifications;
    notifDesktop.checked = desktopEnabled;
    await successPulse(settingsNotifSave);
    hideOverlay(settingsOverlay);
  } catch (err) {
    console.error(err);
    settingsNotifError.textContent = err.message || "Не удалось сохранить";
  } finally {
    settingsNotifSave.disabled = false;
  }
});

let selectedChatsAccent = null;
chatsAccentSwatches.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedChatsAccent = btn.dataset.color;
    chatsAccentSwatches.forEach((b) => b.classList.toggle("selected", b === btn));
    const [a, b] = ACCENT_PRESETS[btn.dataset.color] || ACCENT_PRESETS[DEFAULT_ACCENT];
    burst(...centerOf(btn), { count: 10, spread: 44, colors: [a, b, "#fff3c4"] });
    updateChatsPreview();
  });
});

settingsChatsSave.addEventListener("click", async () => {
  settingsChatsError.textContent = "";
  settingsChatsSave.disabled = true;
  try {
    const prevAccent = myProfile.chatPrefs?.accentColor || DEFAULT_ACCENT;
    const chatPrefs = {
      sendOnEnter: chatsSendOnEnter.checked,
      fontSize: chatsFontSize.value,
      compact: chatsCompact.checked,
      accentColor: selectedChatsAccent || myProfile.chatPrefs?.accentColor || DEFAULT_ACCENT,
    };
    await updateProfileFields(currentUser.uid, { chatPrefs });
    myProfile.chatPrefs = chatPrefs;
    await successPulse(settingsChatsSave);
    if (chatPrefs.accentColor !== prevAccent) {
      // The new colour washes across the whole app from the chosen swatch.
      const swatch = Array.from(chatsAccentSwatches).find((b) => b.dataset.color === chatPrefs.accentColor);
      const [x, y] = swatch ? centerOf(swatch) : centerOf(settingsChatsSave);
      accentWave(() => applyChatPrefs(chatPrefs), { x, y });
      setTimeout(() => hideOverlay(settingsOverlay), reducedMotion ? 0 : 650);
    } else {
      applyChatPrefs(chatPrefs);
      hideOverlay(settingsOverlay);
    }
  } catch (err) {
    console.error(err);
    settingsChatsError.textContent = err.message || "Не удалось сохранить";
  } finally {
    settingsChatsSave.disabled = false;
  }
});

settingsLanguageSave.addEventListener("click", async () => {
  settingsLanguageError.textContent = "";
  settingsLanguageSave.disabled = true;
  try {
    const language = settingsLanguage.value;
    await updateProfileFields(currentUser.uid, { language });
    myProfile.language = language;
    await successPulse(settingsLanguageSave);
    hideOverlay(settingsOverlay);
    applyLanguage(language, true);
  } catch (err) {
    console.error(err);
    settingsLanguageError.textContent = err.message || "Не удалось сохранить";
  } finally {
    settingsLanguageSave.disabled = false;
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
  reveal(deleteAccountConfirm);
  setTimeout(() => deleteAccountConfirm.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
});

deleteAccountCancelBtn.addEventListener("click", () => {
  conceal(deleteAccountConfirm);
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
    await forgetDevice(currentUser.uid);
    await deleteAccount(currentUser, deleteAccountPassword.value, myProfile.username);
    window.location.href = "/login";
  } catch (err) {
    console.error(err);
    deleteAccountError.textContent = err.message || "Не удалось удалить аккаунт";
    deleteAccountConfirmBtn.disabled = false;
  }
});

// ---------- End-to-end encryption (1:1 chats) ----------
// Automatic: every device gets its own key on first launch (see e2e.js).

const deviceLists = new Map(); // uid -> { devices: {id: {pub}}, at }

function rememberDevices(uid, profile) {
  if (uid && profile?.e2eDevices) deviceLists.set(uid, { devices: profile.e2eDevices, at: Date.now() });
}

async function refreshDevices(uid) {
  try {
    const p = uid === currentUser.uid ? await fetchMyProfile(uid) : await getProfile(uid);
    if (p?.e2eDevices) deviceLists.set(uid, { devices: p.e2eDevices, at: Date.now() });
  } catch (_) {
    /* offline — keep what we have */
  }
  return devicesOf(uid);
}

function devicesOf(uid) {
  const known =
    deviceLists.get(uid)?.devices ||
    (uid === currentUser?.uid ? myProfile?.e2eDevices : null) ||
    contactsMap.get(uid)?.profile?.e2eDevices ||
    profileCache.get(uid)?.profile?.e2eDevices ||
    {};
  return Object.entries(known)
    .filter(([, d]) => d?.pub?.x)
    .map(([id, d]) => ({ id, pub: d.pub }));
}

const otherUidOf = (chatId) => chatId.split("_").find((u) => u && u !== currentUser.uid);
const isE2EChat = (chatId) => hasDevice() && devicesOf(otherUidOf(chatId)).length > 0;

// Recipients = every device of the other person and all of mine.
async function recipientsFor(chatId) {
  const otherUid = otherUidOf(chatId);
  const stale = (uid) => Date.now() - (deviceLists.get(uid)?.at || 0) > 30000;
  await Promise.all([otherUid, currentUser.uid].filter(stale).map(refreshDevices));
  const mine = devicesOf(currentUser.uid);
  if (!mine.some((d) => d.id === deviceId())) mine.push({ id: deviceId(), pub: devicePublicKey() });
  return [...devicesOf(otherUid), ...mine];
}

async function sealForChat(chatId, content) {
  return sealFor(chatId, await recipientsFor(chatId), content);
}

async function senderDevicePub(uid, devId) {
  let dev = devicesOf(uid).find((d) => d.id === devId);
  if (!dev) dev = (await refreshDevices(uid)).find((d) => d.id === devId);
  if (!dev && uid === currentUser.uid && devId === deviceId()) return devicePublicKey();
  return dev?.pub || null;
}

async function openBoxFrom(chatId, box, senderUid) {
  if (box?.v !== 2) throw new Error("unsupported");
  const pub = await senderDevicePub(senderUid, box.from);
  if (!pub) throw new Error("unknown sender device");
  return openFrom(chatId, box, pub);
}

// Decrypts a snapshot of 1:1 messages (results cached per ciphertext).
const openedCache = new Map(); // ct -> content | "fail" | "notmine"
async function openMessages(chatId, msgs) {
  return Promise.all(
    msgs.map(async (m) => {
      if (!m.enc) return m;
      let content = openedCache.get(m.enc.ct);
      if (content === undefined && hasDevice()) {
        try {
          content = await openBoxFrom(chatId, m.enc, m.senderId);
        } catch (err) {
          content = err instanceof NotForThisDevice ? "notmine" : "fail";
        }
        openedCache.set(m.enc.ct, content);
      }
      if (content === "notmine") return { ...m, text: "🔒 Отправлено до подключения этого устройства — прочитать можно на другом вашем устройстве", _locked: true };
      if (!content || content === "fail") return { ...m, text: "🔒 Не удалось расшифровать сообщение", _locked: true };
      return { ...m, ...content, _content: content, _e2e: true };
    })
  );
}

const previewCache = new Map(); // ct -> text
async function openPreview(chatId, box, senderUid) {
  if (!box?.ct || !hasDevice()) return null;
  if (previewCache.has(box.ct)) return previewCache.get(box.ct);
  try {
    const { p } = await openBoxFrom(chatId, box, senderUid);
    previewCache.set(box.ct, p);
    return p;
  } catch (_) {
    return null;
  }
}

function onKeysChanged() {
  openedCache.clear();
  previewCache.clear();
  renderChats();
  refreshChatChrome();
  if (currentChatType === "contact" && currentChatId) {
    const chatId = currentChatId;
    openMessages(chatId, currentChatRawSource).then((list) => {
      if (currentChatId !== chatId) return;
      currentChatRawMessages = list;
      rerenderMessages();
    });
  }
}

// First launch on a device: create its key and list it on the profile.
async function initE2E() {
  if (!e2eSupported) return;
  const dev = await initDevice(currentUser.uid);
  if (!dev) return;
  const listed = myProfile.e2eDevices?.[dev.id];
  if (!listed || listed.pub?.x !== dev.pub.x) {
    await publishDevice(currentUser.uid, dev.id, dev.pub, describeDevice());
    myProfile.e2eDevices = { ...(myProfile.e2eDevices || {}), [dev.id]: { pub: dev.pub, name: describeDevice() } };
  }
  deviceLists.set(currentUser.uid, { devices: myProfile.e2eDevices, at: Date.now() });
  onKeysChanged();
}

// ---------- One way to put a message into any chat ----------
// Handles encryption for 1:1 chats and scheduling everywhere.
async function deliver({ type, id, text = "", attachment = null, replyTo = null, extra = null, scheduleAt = null, silent = false, plain = null }) {
  const me = currentUser.uid;
  if (type === "saved") {
    return addSavedMessage(me, text || attachment?.defaultCaption || "", replyTo, { ...(attachment?.fields || {}), ...(extra || {}) });
  }
  if (type === "notifications") return addBroadcast(me, text);
  if (type === "group" || type === "channel") {
    const members = (groups.find((g) => g.id === id) || currentGroupRef)?.members || [];
    return sendGroupMessage(id, me, text, attachment, replyTo, extra, members, { scheduleAt, silent, plain });
  }
  // 1:1 chat — encrypted whenever the other person's app has a device key.
  const otherUid = otherUidOf(id);
  if (hasDevice() && !devicesOf(otherUid).length) await refreshDevices(otherUid);
  if (hasDevice() && devicesOf(otherUid).length) {
    const content = { text: text || attachment?.defaultCaption || "", ...(attachment?.fields || {}), ...(extra || {}) };
    if (replyTo) content.replyTo = replyTo;
    const preview = attachment?.previewText || text || content.text;
    const recipients = await recipientsFor(id);
    return sendMessage(id, me, "🔒", null, null, { enc: await sealFor(id, recipients, content) }, {
      scheduleAt,
      silent,
      plain,
      preview: "🔒 Сообщение",
      previewEnc: await sealFor(id, recipients, { p: preview }),
    });
  }
  return sendMessage(id, me, text, attachment, replyTo, extra, { scheduleAt, silent, plain });
}

// ---------- Search inside the open chat ----------

let chatSearchQuery = "";
let chatSearchHits = [];
let chatSearchIndex = -1;

function openChatSearch() {
  chatSearchBar.classList.remove("hidden");
  chatSection.classList.add("has-search");
  animate(
    chatSearchBar,
    [
      { opacity: 0, transform: "translateY(-16px) scale(.9)", filter: "blur(8px)" },
      { opacity: 1, transform: "none", filter: "blur(0px)" },
    ],
    { spring: "bouncy" }
  );
  chatSearchInput.value = "";
  chatSearchCount.textContent = "";
  setTimeout(() => chatSearchInput.focus(), 60);
}

function closeChatSearch(silent = false) {
  if (chatSearchBar.classList.contains("hidden")) return;
  chatSearchBar.classList.add("hidden");
  chatSection.classList.remove("has-search");
  const had = !!chatSearchQuery;
  chatSearchQuery = "";
  chatSearchHits = [];
  chatSearchIndex = -1;
  if (had && !silent) rerenderMessages();
}

function clearSearchMarks() {
  messagesEl.querySelectorAll("mark.search-mark").forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
  messagesEl.querySelectorAll(".bubble-text").forEach((t) => t.normalize());
  messagesEl.querySelectorAll(".search-hit, .search-current").forEach((r) => r.classList.remove("search-hit", "search-current"));
}

function markTextMatches(root, q) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const text = node.textContent;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    if (idx < 0) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    while (idx >= 0) {
      frag.append(text.slice(last, idx));
      const mark = document.createElement("mark");
      mark.className = "search-mark";
      mark.textContent = text.slice(idx, idx + q.length);
      frag.append(mark);
      last = idx + q.length;
      idx = lower.indexOf(q, last);
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  });
}

function applyChatSearch(jump) {
  clearSearchMarks();
  const q = chatSearchQuery.toLowerCase();
  if (!q) {
    chatSearchCount.textContent = "";
    chatSearchHits = [];
    return;
  }
  chatSearchHits = Array.from(messagesEl.querySelectorAll(".msg-row")).filter((row) => {
    const text = row.querySelector(".bubble-text");
    if (!text || !text.textContent.toLowerCase().includes(q)) return false;
    markTextMatches(text, q);
    row.classList.add("search-hit");
    return true;
  });
  if (!chatSearchHits.length) {
    chatSearchIndex = -1;
    chatSearchCount.textContent = "Нет совпадений";
    return;
  }
  if (jump || chatSearchIndex < 0 || chatSearchIndex >= chatSearchHits.length) chatSearchIndex = chatSearchHits.length - 1;
  focusSearchHit(jump);
}

function focusSearchHit(scroll = true) {
  const row = chatSearchHits[chatSearchIndex];
  if (!row) return;
  chatSearchHits.forEach((r) => r.classList.toggle("search-current", r === row));
  chatSearchCount.textContent = `${chatSearchIndex + 1} из ${chatSearchHits.length}`;
  if (scroll) {
    row.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    animate(row.querySelector(".bubble"), [{ transform: "scale(1.06)" }, { transform: "none" }], { spring: "jelly" });
  }
}

const runChatSearch = debounce(() => {
  chatSearchQuery = chatSearchInput.value.trim();
  applyChatSearch(true);
}, 180);

chatSearchBtn.addEventListener("click", () => {
  if (chatSearchBar.classList.contains("hidden")) openChatSearch();
  else closeChatSearch();
});
chatSearchInput.addEventListener("input", runChatSearch);
chatSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById(e.shiftKey ? "chat-search-next" : "chat-search-prev").click();
  } else if (e.key === "Escape") {
    e.stopPropagation();
    closeChatSearch();
  }
});
document.getElementById("chat-search-prev").addEventListener("click", () => {
  if (!chatSearchHits.length) return;
  chatSearchIndex = (chatSearchIndex - 1 + chatSearchHits.length) % chatSearchHits.length;
  focusSearchHit();
});
document.getElementById("chat-search-next").addEventListener("click", () => {
  if (!chatSearchHits.length) return;
  chatSearchIndex = (chatSearchIndex + 1) % chatSearchHits.length;
  focusSearchHit();
});
document.getElementById("chat-search-close").addEventListener("click", () => closeChatSearch());

// ---------- Calls ----------

function callCurrentContact(kind) {
  if (currentChatType !== "contact" || !currentOtherUid) return;
  if (isBlocked(currentOtherUid)) {
    toast("Сначала разблокируйте пользователя", { tone: "error" });
    return;
  }
  startCall({ chatId: currentChatId, otherUid: currentOtherUid, profile: currentOtherProfile, kind });
}

callAudioBtn.addEventListener("click", () => callCurrentContact("audio"));
callVideoBtn.addEventListener("click", () => callCurrentContact("video"));

const CALL_LOG_TEXT = {
  completed: (k, d) => `${k === "video" ? "🎥 Видеозвонок" : "📞 Звонок"} · ${fmtDuration(d)}`,
  missed: (k) => (k === "video" ? "🎥 Пропущенный видеозвонок" : "📞 Пропущенный звонок"),
  declined: (k) => (k === "video" ? "🎥 Отклонённый видеозвонок" : "📞 Отклонённый звонок"),
  busy: (k) => (k === "video" ? "🎥 Пропущенный видеозвонок" : "📞 Пропущенный звонок"),
  cancelled: (k) => (k === "video" ? "🎥 Отменённый видеозвонок" : "📞 Отменённый звонок"),
};

let callsReady = false;
function setupCalls() {
  if (callsReady) return;
  callsReady = true;
  initCalls({
    me: currentUser.uid,
    getProfile: async (uid) => contactsMap.get(uid)?.profile || (await loadProfile(uid)),
    avatarHTML: (profile, uid) => visibleAvatarHTML(profile, uid),
    isBlocked,
    onCallLog: ({ chatId, kind, result, duration }) => {
      const text = (CALL_LOG_TEXT[result] || CALL_LOG_TEXT.cancelled)(kind, duration);
      return deliver({ type: "contact", id: chatId, text, extra: { call: { kind, result, duration } } });
    },
    onMissedCall: (profile) => toast(`Пропущенный звонок от ${profile?.displayName || "контакта"}`, { icon: "📞", duration: 4500 }),
    notify: (title, body) => {
      const prefs = myProfile?.notifications || {};
      if (prefs.muteAll || !document.hidden) return;
      if (prefs.desktop && "Notification" in window && Notification.permission === "granted") new Notification(title, { body });
    },
  });
}

// ---------- Chat menu: mute / pin / block / leave ----------

const chatMenuSearchBtn = document.getElementById("chat-menu-search-btn");
const chatMenuRenameBtn = document.getElementById("chat-menu-rename-btn");
chatMenuSearchBtn.addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  openChatSearch();
});
chatMenuRenameBtn.addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  editContactBtn.click();
});

chatMenuMuteBtn.addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  const muted = isChatMuted(currentChatId);
  toggleUserList("mutedChats", currentChatId, !muted, { success: muted ? "Уведомления включены" : "Уведомления выключены" });
});
chatMenuPinBtn.addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  const pinned = isChatPinned(currentChatId);
  toggleUserList("pinnedChats", currentChatId, !pinned, { success: pinned ? "Чат откреплён" : "Чат закреплён" });
});
chatMenuBlockBtn.addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  setBlocked(currentOtherUid, !isBlocked(currentOtherUid));
});
chatMenuLeaveBtn.addEventListener("click", () => {
  hidePopover(chatMenuDropdown);
  leaveCurrentGroup();
});
blockedBarUnblock.addEventListener("click", () => setBlocked(currentOtherUid, false));

function setBlocked(uid, block) {
  if (!uid) return;
  if (block && !confirm("Заблокировать пользователя? Он не сможет писать вам и звонить.")) return;
  toggleUserList("blocked", uid, block, { success: block ? "Пользователь заблокирован" : "Пользователь разблокирован" });
}

async function leaveCurrentGroup() {
  const group = currentGroupRef;
  if (!group) return;
  const what = group.type === "channel" ? "канал" : "группу";
  if (!confirm(`Покинуть ${what} «${group.name}»?`)) return;
  try {
    await leaveGroup(group.id, currentUser.uid);
    hideOverlay(profileViewOverlay);
    closeCurrentChatView();
    toast(group.type === "channel" ? "Вы покинули канал" : "Вы покинули группу");
  } catch (err) {
    console.error(err);
    toast("Не удалось выйти", { tone: "error" });
  }
}

// ---------- Profile card actions + group members ----------

function pvAction(label, icon, onClick, danger = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pv-action" + (danger ? " danger" : "");
  b.innerHTML = `${icon}<span></span>`;
  b.querySelector("span").textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

// Shows the shared key "picture": identical on both sides unless keys were swapped.
async function renderE2ERow(uid) {
  const row = document.getElementById("profile-view-e2e");
  const value = document.getElementById("profile-view-e2e-value");
  row.classList.add("hidden");
  if (!uid || uid === currentUser.uid) return;
  const theirs = devicesOf(uid).length ? devicesOf(uid) : await refreshDevices(uid);
  const mine = devicesOf(currentUser.uid);
  row.classList.remove("hidden");
  if (theirs.length && mine.length && hasDevice()) {
    value.textContent = await fingerprint([...theirs, ...mine].map((d) => d.pub));
    value.className = "e2e-fingerprint";
    value.title = "Сравните с экраном собеседника: если совпадает — переписку никто не подменил";
  } else {
    value.className = "";
    value.textContent = hasDevice() ? "Включится, когда собеседник обновит приложение" : "Недоступно в этом браузере";
  }
}

function renderContactProfileActions(uid) {
  renderE2ERow(uid);
  profileViewActions.innerHTML = "";
  profileMembers.classList.add("hidden");
  if (!uid || uid === currentUser.uid) return;
  const chatId = currentChatType === "contact" && currentOtherUid === uid ? currentChatId : null;
  const blocked = isBlocked(uid);
  if (chatId && !blocked) {
    profileViewActions.append(
      pvAction("Звонок", MI.phone, () => {
        hideOverlay(profileViewOverlay);
        callCurrentContact("audio");
      }),
      pvAction("Видео", MI.video, () => {
        hideOverlay(profileViewOverlay);
        callCurrentContact("video");
      })
    );
  }
  if (chatId) {
    const muted = isChatMuted(chatId);
    profileViewActions.append(
      pvAction(muted ? "Со звуком" : "Без звука", muted ? MI.bell : MI.bellOff, () => {
        toggleUserList("mutedChats", chatId, !muted);
        renderContactProfileActions(uid);
      })
    );
  }
  profileViewActions.append(
    pvAction(
      blocked ? "Разблок." : "Блок",
      MI.block,
      () => {
        setBlocked(uid, !blocked);
        setTimeout(() => renderContactProfileActions(uid), 50);
      },
      !blocked
    )
  );
}

async function renderGroupMembers(group) {
  document.getElementById("profile-view-e2e").classList.add("hidden");
  const me = currentUser.uid;
  const isAdmin = (group.admins || []).includes(me);
  const canAdd = group.type === "group" || isAdmin;
  profileMembers.classList.remove("hidden");
  profileMembersTitle.textContent = pluralMembers((group.members || []).length);
  profileMembersAdd.classList.toggle("hidden", !canAdd);
  profileMembersInput.value = "";
  profileMembersResult.innerHTML = "";
  profileMembersList.innerHTML = "";

  profileViewActions.innerHTML = "";
  const muted = isChatMuted(group.id);
  profileViewActions.append(
    pvAction(muted ? "Со звуком" : "Без звука", muted ? MI.bell : MI.bellOff, () => {
      toggleUserList("mutedChats", group.id, !muted);
      renderGroupMembers(currentGroupRef || group);
    }),
    pvAction("Выйти", MI.leave, leaveCurrentGroup, true)
  );

  const members = group.members || [];
  const profiles = await Promise.all(members.map((uid) => (uid === me ? myProfile : contactsMap.get(uid)?.profile || loadProfile(uid))));
  profileMembersList.innerHTML = "";
  members
    .map((uid, i) => ({ uid, profile: profiles[i] }))
    .filter((m) => m.profile)
    .sort((a, b) => ((group.admins || []).includes(b.uid) ? 1 : 0) - ((group.admins || []).includes(a.uid) ? 1 : 0))
    .forEach(({ uid, profile }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pick-item";
      b.innerHTML = `${visibleAvatarHTML(profile, uid)}<div class="pick-item-meta"><div class="pick-item-name"></div><div class="pick-item-sub"></div></div>`;
      b.querySelector(".pick-item-name").textContent = uid === me ? `${profile.displayName} (вы)` : profile.displayName;
      b.querySelector(".pick-item-sub").textContent = isRecentlyOnline(profile.lastSeenAt) ? "в сети" : "@" + profile.username;
      if ((group.admins || []).includes(uid)) {
        const badge = document.createElement("span");
        badge.className = "pick-item-badge";
        badge.textContent = uid === group.ownerId ? "владелец" : "админ";
        b.appendChild(badge);
      }
      if (uid !== me) b.addEventListener("click", () => openContactProfile(uid, profile));
      profileMembersList.appendChild(b);
    });
  stagger(profileMembersList.children, { y: 10, step: 25, delay: 60 });
}

const runMemberAddSearch = debounce(async (raw) => {
  const q = raw.trim();
  const group = currentGroupRef;
  if (!q || !group) {
    profileMembersResult.innerHTML = "";
    return;
  }
  const result = await searchUser(q, currentUser.uid);
  profileMembersResult.innerHTML = "";
  if (!result || result.self) {
    profileMembersResult.innerHTML = `<div class="search-empty">${result?.self ? "Это вы 🙂" : "Пользователь не найден"}</div>`;
    return;
  }
  if ((group.members || []).includes(result.uid)) {
    profileMembersResult.innerHTML = '<div class="search-empty">Уже в группе</div>';
    return;
  }
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pick-item";
  b.innerHTML = `${visibleAvatarHTML(result.profile, result.uid)}<div class="pick-item-meta"><div class="pick-item-name"></div><div class="pick-item-sub"></div></div><span class="pick-item-badge">Добавить</span>`;
  b.querySelector(".pick-item-name").textContent = result.profile.displayName;
  b.querySelector(".pick-item-sub").textContent = "@" + result.profile.username;
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await addGroupMembers(group.id, [result.uid]);
      b.classList.add("sent");
      group.members = [...new Set([...(group.members || []), result.uid])];
      toast(`${result.profile.displayName} добавлен(а)`);
      setTimeout(() => renderGroupMembers(group), 600);
    } catch (err) {
      console.error(err);
      b.disabled = false;
      toast("Не удалось добавить", { tone: "error" });
    }
  });
  profileMembersResult.appendChild(b);
}, 350);
profileMembersInput.addEventListener("input", () => runMemberAddSearch(profileMembersInput.value));

// ---------- Motion & material wiring ----------

document.getElementById("sidebar-brand-slot").innerHTML = brandMarkSVG("sidebar-brand breathe");
document.getElementById("empty-orb-mark").innerHTML = brandMarkSVG();
tilt(document.getElementById("empty-orb"), 22);

// Real edge refraction on the floating glass (Chromium only; elsewhere the
// frosted fallback from the stylesheet stays in place).
[
  [chatHeader, { bezel: 14, strength: 34 }],
  [composer, { bezel: 16, strength: 36 }],
  [replyPreviewEl, { bezel: 12, strength: 28 }],
  [emojiPicker, { bezel: 18, strength: 34 }],
].forEach(([el, opts]) => {
  el.dataset.lens = "";
  liquidLens(el, opts);
});

magnetize(fabNewChat, 0.3);
magnetize(sendBtn, 0.22);
magnetize(voiceBtn, 0.18);

const fxQuality = document.getElementById("fx-quality");
fxQuality.value = window.LinkageFX?.pref?.() || "auto";
fxQuality.addEventListener("change", () => {
  window.LinkageFX?.set(fxQuality.value);
  toast(
    { auto: "Эффекты: авто", max: "Эффекты: максимум", lite: "Эффекты: экономный режим" }[fxQuality.value] || "Готово",
    { icon: "✨" }
  );
});

[privacyLastseen, privacyAvatar, privacyBio, privacyBirthday, chatsFontSize, settingsLanguage, fxQuality].forEach(segmentize);

watchMessages(document.querySelectorAll(".auth-error, .attach-error"));

// Messages scroll underneath the floating dock; keep its height in sync so
// the last bubble always clears it.
new ResizeObserver(() => {
  const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 160;
  chatSection.style.setProperty("--dock-h", chatDock.offsetHeight + "px");
  if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}).observe(chatDock);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (activeCtx) {
    closeContextMenu();
    return;
  }
  if (!lightboxEl.classList.contains("hidden")) {
    closeLightbox();
    return;
  }
  if (!chatSearchBar.classList.contains("hidden")) {
    closeChatSearch();
    return;
  }
  if (!storyViewerOverlay.classList.contains("hidden")) {
    closeStoryViewer();
    return;
  }
  const top = topOverlay();
  if (top) {
    hideOverlay(top);
    return;
  }
  if (!chatMenuDropdown.classList.contains("hidden")) hidePopover(chatMenuDropdown);
  else if (!emojiPicker.classList.contains("hidden")) closeEmojiPicker();
});

// Mobile: swipe from the left edge to drag the chat away and reveal the list.
(function enableSwipeBack() {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let tracking = false;
  let dragging = false;

  chatSection.addEventListener(
    "touchstart",
    (e) => {
      if (!isMobileLayout() || !sidebar.classList.contains("chat-open") || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > 32) return;
      startX = t.clientX;
      startY = t.clientY;
      dx = 0;
      tracking = true;
      dragging = false;
    },
    { passive: true }
  );

  chatSection.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking) return;
      const t = e.touches[0];
      dx = Math.max(0, t.clientX - startX);
      if (!dragging) {
        if (Math.abs(t.clientY - startY) > 10 && Math.abs(t.clientY - startY) > dx) {
          tracking = false;
          return;
        }
        if (dx < 8) return;
        dragging = true;
        chatSection.classList.add("dragging");
        sidebar.classList.add("peek");
      }
      const progress = Math.min(dx / window.innerWidth, 1);
      chatSection.style.transform = `translateX(${dx}px)`;
      sidebar.style.setProperty("--peek", progress.toFixed(3));
    },
    { passive: true }
  );

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const goBack = dx > window.innerWidth * 0.3;
    chatSection.classList.remove("dragging");
    sidebar.classList.remove("peek");
    chatSection.style.transform = "";
    sidebar.style.removeProperty("--peek");
    if (goBack) {
      sidebar.classList.remove("chat-open");
      hidePopover(chatMenuDropdown);
    }
  };
  chatSection.addEventListener("touchend", end, { passive: true });
  chatSection.addEventListener("touchcancel", end, { passive: true });
})();
