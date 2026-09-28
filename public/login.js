import { configLooksEmpty } from "./firebase.js";
import { registerAccount, loginAccount, fetchMyProfile, usernameAvailable, watchAuthState } from "./auth.js";
import { addPersonalNotice } from "./notify.js";
import {
  colorForUid,
  debounce,
  normalizeUsername,
  isValidUsername,
  resizeImageToDataUrl,
  attachPasswordToggle,
  describeDevice,
} from "./utils.js";
import { animate, stagger, tilt, shake, successPulse, watchMessages, reducedMotion } from "./ui.js";
import { setupKeys } from "./e2e.js";

const authCard = document.getElementById("auth-card");
const authSub = document.getElementById("auth-sub");
const authForm = document.getElementById("auth-form");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const switchModeBtn = document.getElementById("switch-mode-btn");

const registerAvatarField = document.getElementById("register-avatar-field");
const nicknameField = document.getElementById("nickname-field");
const nicknameInput = document.getElementById("nickname-input");
const usernameInput = document.getElementById("username-input");
const usernameHint = document.getElementById("username-hint");
const passwordInput = document.getElementById("password-input");
const confirmPasswordField = document.getElementById("confirm-password-field");
const confirmPasswordInput = document.getElementById("confirm-password-input");

const avatarPreview = document.getElementById("setup-avatar-preview");
const avatarPickBtn = document.getElementById("setup-avatar-pick-btn");
const avatarInput = document.getElementById("setup-avatar-input");
const avatarRemoveBtn = document.getElementById("setup-avatar-remove-btn");

attachPasswordToggle(passwordInput, document.getElementById("password-toggle"));
attachPasswordToggle(confirmPasswordInput, document.getElementById("confirm-password-toggle"));

if (configLooksEmpty) {
  authError.textContent = "Firebase не настроен: заполните public/firebase-config.js своими ключами проекта.";
  authSubmit.disabled = true;
}

let mode = "login";
let selectedAvatarImage = null;

function applyMode() {
  const isRegister = mode === "register";
  registerAvatarField.classList.toggle("hidden", !isRegister);
  nicknameField.classList.toggle("hidden", !isRegister);
  confirmPasswordField.classList.toggle("hidden", !isRegister);
  nicknameInput.required = isRegister;
  confirmPasswordInput.required = isRegister;

  authSubmit.textContent = isRegister ? "Зарегистрироваться" : "Войти";
  authSub.textContent = isRegister ? "Создайте аккаунт" : "Войдите в свой аккаунт";
  switchModeBtn.textContent = isRegister ? "Уже есть аккаунт? Войдите" : "Ещё нет аккаунта? Зарегистрируйтесь";
  authError.textContent = "";
  usernameHint.classList.add("hidden");
}

// Switching modes morphs the card's height on a spring while the extra
// register fields condense into place one by one.
switchModeBtn.addEventListener("click", () => {
  const before = authCard.getBoundingClientRect().height;
  mode = mode === "login" ? "register" : "login";
  applyMode();
  const after = authCard.getBoundingClientRect().height;
  if (!reducedMotion) {
    authCard.style.overflow = "hidden";
    animate(authCard, [{ height: before + "px" }, { height: after + "px" }], { spring: "smooth" }).finished.then(
      () => (authCard.style.overflow = ""),
      () => (authCard.style.overflow = "")
    );
  }
  const blurIn = [
    { opacity: 0, filter: "blur(8px)", transform: "translateY(6px)" },
    { opacity: 1, filter: "blur(0px)", transform: "none" },
  ];
  [authSub, authSubmit, switchModeBtn].forEach((el, i) => animate(el, blurIn, { spring: "smooth", delay: i * 40 }));
  if (mode === "register") {
    stagger([registerAvatarField, nicknameField, confirmPasswordField], { y: 18, blur: 10, step: 70, delay: 60 });
  }
});

const checkUsernameDebounced = debounce(async (raw) => {
  if (mode !== "register") return;
  const uname = normalizeUsername(raw);
  if (!isValidUsername(uname)) {
    usernameHint.textContent = "3-20 символов: латиница, цифры, _";
    usernameHint.className = "field-hint";
    usernameHint.classList.remove("hidden");
    return;
  }
  const available = await usernameAvailable(uname);
  usernameHint.textContent = available ? "Свободно" : "Уже занято";
  usernameHint.className = "field-hint " + (available ? "ok" : "bad");
  usernameHint.classList.remove("hidden");
}, 400);

usernameInput.addEventListener("input", () => checkUsernameDebounced(usernameInput.value));

// ---------- Avatar (register only) ----------

function renderAvatarPreview() {
  const color = colorForUid(normalizeUsername(usernameInput.value) || "?");
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
    authError.textContent = "Выберите файл изображения";
    return;
  }
  try {
    selectedAvatarImage = await resizeImageToDataUrl(file);
    authError.textContent = "";
    renderAvatarPreview();
  } catch (err) {
    console.error(err);
    authError.textContent = "Не удалось загрузить фото";
  }
});

avatarRemoveBtn.addEventListener("click", () => {
  selectedAvatarImage = null;
  renderAvatarPreview();
});

// ---------- Submit ----------

function goToApp() {
  window.location.href = "/";
}

tilt(authCard, 5);
watchMessages([authError]);

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (configLooksEmpty) return;
  authError.textContent = "";
  authSubmit.disabled = true;
  let succeeded = false;
  try {
    if (mode === "register") {
      const user = await registerAccount({
        username: usernameInput.value,
        password: passwordInput.value,
        confirmPassword: confirmPasswordInput.value,
        nickname: nicknameInput.value,
        avatarImage: selectedAvatarImage,
      });
      await addPersonalNotice(user.uid, "Добро пожаловать в Linkage Message! Ваш аккаунт создан.");
      await setupKeys(user.uid, passwordInput.value).catch((err) => console.warn("E2E setup failed:", err));
    } else {
      const user = await loginAccount({
        username: usernameInput.value,
        password: passwordInput.value,
      });
      await addPersonalNotice(user.uid, `Выполнен вход в аккаунт: ${describeDevice()}.`);
      // Unlock (or create) the end-to-end encryption keys while we have the password.
      await setupKeys(user.uid, passwordInput.value).catch((err) => console.warn("E2E setup failed:", err));
    }
    succeeded = true;
    await successPulse(authSubmit);
    goToApp();
  } catch (err) {
    console.error(err);
    authError.textContent = err.message || "Не удалось войти";
    shake(authCard);
  } finally {
    if (!succeeded) authSubmit.disabled = false;
  }
});

// ---------- Auth state ----------
// If already signed in with a complete profile, skip straight to the app.

if (!configLooksEmpty) {
  applyMode();
  renderAvatarPreview();
  watchAuthState(async (user) => {
    if (!user) return;
    const profile = await fetchMyProfile(user.uid);
    if (profile) goToApp();
  });
}
