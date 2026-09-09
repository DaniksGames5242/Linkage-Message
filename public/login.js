import { configLooksEmpty } from "./firebase.js";
import {
  registerWithEmail,
  loginWithEmail,
  fetchMyProfile,
  usernameAvailable,
  completeProfile,
  watchAuthState,
} from "./auth.js";
import { colorForUid, debounce, normalizeUsername, isValidUsername, resizeImageToDataUrl } from "./utils.js";

const screenEmail = document.getElementById("screen-email");
const screenProfile = document.getElementById("screen-profile");
const emailCard = document.getElementById("email-card");

const emailSub = document.getElementById("email-sub");
const emailForm = document.getElementById("email-form");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const emailSubmit = document.getElementById("email-submit");
const emailError = document.getElementById("email-error");
const switchModeBtn = document.getElementById("switch-mode-btn");

const profileForm = document.getElementById("profile-form");
const displaynameInput = document.getElementById("displayname-input");
const usernameInput = document.getElementById("username-input");
const usernameHint = document.getElementById("username-hint");
const profileSubmit = document.getElementById("profile-submit");
const profileError = document.getElementById("profile-error");

const avatarPreview = document.getElementById("setup-avatar-preview");
const avatarPickBtn = document.getElementById("setup-avatar-pick-btn");
const avatarInput = document.getElementById("setup-avatar-input");
const avatarRemoveBtn = document.getElementById("setup-avatar-remove-btn");

if (configLooksEmpty) {
  emailError.textContent = "Firebase не настроен: заполните public/firebase-config.js своими ключами проекта.";
  emailSubmit.disabled = true;
}

let currentUser = null;
let mode = "login";
let selectedAvatarImage = null;

function showScreen(el) {
  [screenEmail, screenProfile].forEach((s) => s.classList.add("hidden"));
  el.classList.remove("hidden");
}

// ---------- 1. Email + password ----------

function applyMode() {
  emailSubmit.textContent = mode === "register" ? "Зарегистрироваться" : "Войти";
  emailSub.textContent = mode === "register" ? "Создайте аккаунт по email" : "Войдите в свой аккаунт";
  switchModeBtn.textContent =
    mode === "register" ? "Уже есть аккаунт? Войдите" : "Ещё нет аккаунта? Зарегистрируйтесь";
  emailError.textContent = "";
}

switchModeBtn.addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";
  emailCard.classList.add("card-flip");
  setTimeout(() => emailCard.classList.remove("card-flip"), 260);
  applyMode();
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

function renderAvatarPreview(color) {
  avatarPreview.style.background = color;
  if (selectedAvatarImage) {
    avatarPreview.innerHTML = `<img src="${selectedAvatarImage}" alt="" />`;
    avatarRemoveBtn.hidden = false;
  } else {
    avatarPreview.textContent = "?";
    avatarRemoveBtn.hidden = true;
  }
}

avatarPickBtn.addEventListener("click", () => avatarInput.click());

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files?.[0];
  avatarInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    profileError.textContent = "Выберите файл изображения";
    return;
  }
  try {
    selectedAvatarImage = await resizeImageToDataUrl(file);
    profileError.textContent = "";
    renderAvatarPreview(currentUser ? colorForUid(currentUser.uid) : "#5b8cff");
  } catch (err) {
    console.error(err);
    profileError.textContent = "Не удалось загрузить фото";
  }
});

avatarRemoveBtn.addEventListener("click", () => {
  selectedAvatarImage = null;
  renderAvatarPreview(currentUser ? colorForUid(currentUser.uid) : "#5b8cff");
});

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
      avatarImage: selectedAvatarImage,
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
  applyMode();
  watchAuthState(async (user) => {
    if (!user) {
      currentUser = null;
      showScreen(screenEmail);
      return;
    }
    currentUser = user;
    const profile = await fetchMyProfile(user.uid);
    if (!profile) {
      selectedAvatarImage = null;
      renderAvatarPreview(colorForUid(user.uid));
      showScreen(screenProfile);
      return;
    }
    // Already signed in with a complete profile - nothing to do here.
    goToApp();
  });
}
