import { configLooksEmpty } from "./firebase.js";
import {
  registerWithEmail,
  loginWithEmail,
  fetchMyProfile,
  usernameAvailable,
  completeProfile,
  watchAuthState,
} from "./auth.js";
import { colorForUid, debounce, normalizeUsername, isValidUsername } from "./utils.js";

const AVATAR_EMOJIS = ["😀", "😎", "🐱", "🐶", "🦊", "🐼", "🌟", "🔥", "🌈", "🎮", "🎧", "⚽", "🍕", "🚀", "🌸", "👑"];

const screenEmail = document.getElementById("screen-email");
const screenProfile = document.getElementById("screen-profile");

const emailModeTabs = document.querySelectorAll("#email-mode-tabs .tab-btn");
const emailSub = document.getElementById("email-sub");
const emailForm = document.getElementById("email-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const emailSubmit = document.getElementById("email-submit");
const emailError = document.getElementById("email-error");

const profileForm = document.getElementById("profile-form");
const displaynameInput = document.getElementById("displayname-input");
const usernameInput = document.getElementById("username-input");
const usernameHint = document.getElementById("username-hint");
const profileSubmit = document.getElementById("profile-submit");
const profileError = document.getElementById("profile-error");
const avatarPicker = document.getElementById("avatar-picker");

if (configLooksEmpty) {
  emailError.textContent = "Firebase не настроен: заполните public/firebase-config.js своими ключами проекта.";
  emailSubmit.disabled = true;
}

let currentUser = null;
let mode = "login";
let selectedSetupEmoji = null;

function showScreen(el) {
  [screenEmail, screenProfile].forEach((s) => s.classList.add("hidden"));
  el.classList.remove("hidden");
}

function buildAvatarPicker(container, currentColor, currentEmoji, onSelect) {
  container.innerHTML = "";
  const noneOpt = document.createElement("div");
  noneOpt.className = "avatar-option" + (currentEmoji ? "" : " selected");
  noneOpt.style.background = currentColor;
  noneOpt.textContent = "—";
  noneOpt.addEventListener("click", () => {
    onSelect(null);
    [...container.children].forEach((c) => c.classList.remove("selected"));
    noneOpt.classList.add("selected");
  });
  container.appendChild(noneOpt);

  AVATAR_EMOJIS.forEach((emoji) => {
    const opt = document.createElement("div");
    opt.className = "avatar-option" + (currentEmoji === emoji ? " selected" : "");
    opt.style.background = currentColor;
    opt.textContent = emoji;
    opt.addEventListener("click", () => {
      onSelect(emoji);
      [...container.children].forEach((c) => c.classList.remove("selected"));
      opt.classList.add("selected");
    });
    container.appendChild(opt);
  });
}

// ---------- 1. Email + password ----------

emailModeTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    emailModeTabs.forEach((b) => b.classList.toggle("active", b === btn));
    emailSubmit.textContent = mode === "register" ? "Зарегистрироваться" : "Войти";
    emailSub.textContent =
      mode === "register" ? "Создайте аккаунт по email" : "Войдите в свой аккаунт";
    emailError.textContent = "";
  });
});

emailForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (configLooksEmpty) return;
  emailError.textContent = "";
  emailSubmit.disabled = true;
  try {
    if (mode === "register") {
      await registerWithEmail(emailInput.value, passwordInput.value);
    } else {
      await loginWithEmail(emailInput.value, passwordInput.value);
    }
    // onAuthStateChanged takes over from here
  } catch (err) {
    console.error(err);
    emailError.textContent = err.message || "Не удалось войти";
  } finally {
    emailSubmit.disabled = false;
  }
});

// ---------- 2. Profile setup ----------

const checkUsernameDebounced = debounce(async (raw) => {
  const uname = normalizeUsername(raw);
  if (!isValidUsername(uname)) {
    usernameHint.textContent = "3-20 символов: латиница, цифры, _";
    usernameHint.className = "field-hint";
    return;
  }
  const available = await usernameAvailable(uname);
  usernameHint.textContent = available ? "Юзернейм свободен" : "Уже занят";
  usernameHint.className = "field-hint " + (available ? "ok" : "bad");
}, 400);

usernameInput.addEventListener("input", () => checkUsernameDebounced(usernameInput.value));

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  profileError.textContent = "";
  profileSubmit.disabled = true;
  try {
    await completeProfile({
      uid: currentUser.uid,
      email: currentUser.email,
      username: usernameInput.value,
      displayName: displaynameInput.value,
      avatarEmoji: selectedSetupEmoji,
    });
    goToApp();
  } catch (err) {
    console.error(err);
    profileError.textContent = err.message || "Не удалось сохранить профиль";
  } finally {
    profileSubmit.disabled = false;
  }
});

// ---------- Auth state ----------

function goToApp() {
  window.location.href = "/";
}

if (!configLooksEmpty) {
  watchAuthState(async (user) => {
    if (!user) {
      currentUser = null;
      showScreen(screenEmail);
      return;
    }
    currentUser = user;
    const profile = await fetchMyProfile(user.uid);
    if (!profile) {
      const color = colorForUid(user.uid);
      selectedSetupEmoji = null;
      buildAvatarPicker(avatarPicker, color, null, (emoji) => (selectedSetupEmoji = emoji));
      showScreen(screenProfile);
      return;
    }
    // Already signed in with a complete profile - nothing to do here.
    goToApp();
  });
}
