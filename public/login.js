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
let step = 0;

const usernameField = usernameInput.closest(".field");
const passwordField = passwordInput.closest(".field");

// Login and registration are shown one step at a time.
const STEPS = {
  login: [
    { fields: [usernameField], sub: "Введите имя пользователя", focus: usernameInput },
    { fields: [passwordField], sub: "Введите пароль", focus: passwordInput },
  ],
  register: [
    { fields: [usernameField], sub: "Придумайте имя пользователя", focus: usernameInput },
    { fields: [registerAvatarField, nicknameField], sub: "Как вас будут видеть другие", focus: nicknameInput },
    { fields: [passwordField, confirmPasswordField], sub: "Придумайте пароль", focus: passwordInput },
  ],
};
const ALL_FIELDS = [registerAvatarField, nicknameField, usernameField, passwordField, confirmPasswordField];

const stepBar = document.createElement("div");
stepBar.className = "auth-steps";
authForm.prepend(stepBar);
const backBtn = document.createElement("button");
backBtn.type = "button";
backBtn.className = "auth-back-btn";
backBtn.setAttribute("aria-label", "Назад");
backBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
const subRow = document.createElement("div");
subRow.className = "auth-sub-row";
authSub.before(subRow);
subRow.append(backBtn, authSub);

const isLastStep = () => step === STEPS[mode].length - 1;

function renderStep(dir = 0) {
  const cfg = STEPS[mode][step];
  ALL_FIELDS.forEach((f) => f.classList.toggle("hidden", !cfg.fields.includes(f)));
  nicknameInput.required = mode === "register" && step === 1;
  confirmPasswordInput.required = mode === "register" && isLastStep();
  passwordInput.required = isLastStep();
  usernameInput.required = step === 0;
  passwordInput.autocomplete = mode === "register" ? "new-password" : "current-password";
  authSub.textContent = cfg.sub;
  authSubmit.textContent = isLastStep() ? (mode === "register" ? "Зарегистрироваться" : "Войти") : "Далее";
  backBtn.classList.toggle("shown", step > 0);
  stepBar.innerHTML = STEPS[mode].map((_, i) => `<span class="${i < step ? "done" : i === step ? "on" : ""}"></span>`).join("");
  if (dir && !reducedMotion) {
    const from = dir > 0 ? 36 : -36;
    cfg.fields.forEach((f, i) =>
      animate(f, [{ opacity: 0, transform: `translateX(${from}px)`, filter: "blur(8px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { spring: "smooth", delay: i * 60 })
    );
  }
  setTimeout(() => cfg.focus?.focus({ preventScroll: true }), dir ? 180 : 0);
}

function morphHeight(change) {
  const before = authCard.getBoundingClientRect().height;
  change();
  const after = authCard.getBoundingClientRect().height;
  if (!reducedMotion && Math.abs(before - after) > 1) {
    authCard.style.overflow = "hidden";
    animate(authCard, [{ height: before + "px" }, { height: after + "px" }], { spring: "smooth" }).finished.then(
      () => (authCard.style.overflow = ""),
      () => (authCard.style.overflow = "")
    );
  }
}

function goStep(next) {
  const dir = next > step ? 1 : -1;
  authError.textContent = "";
  morphHeight(() => {
    step = next;
    renderStep(dir);
  });
}

backBtn.addEventListener("click", () => step > 0 && goStep(step - 1));

// Validates the current step; resolves true when it's fine to move on.
async function validateStep() {
  const uname = normalizeUsername(usernameInput.value);
  if (step === 0) {
    if (!isValidUsername(uname)) throw new Error("3-20 символов: латиница, цифры, _");
    const free = await usernameAvailable(uname);
    if (mode === "register" && !free) throw new Error("Это имя уже занято");
    if (mode === "login" && free) throw new Error("Пользователь не найден");
  }
  if (mode === "register" && step === 1 && !nicknameInput.value.trim()) {
    nicknameInput.focus();
    throw new Error("Введите ник");
  }
}

function applyMode() {
  step = 0;
  switchModeBtn.textContent = mode === "register" ? "Уже есть аккаунт? Войдите" : "Ещё нет аккаунта? Зарегистрируйтесь";
  authError.textContent = "";
  usernameHint.classList.add("hidden");
  renderStep();
}

switchModeBtn.addEventListener("click", () => {
  mode = mode === "login" ? "register" : "login";
  morphHeight(applyMode);
  const blurIn = [
    { opacity: 0, filter: "blur(8px)", transform: "translateY(6px)" },
    { opacity: 1, filter: "blur(0px)", transform: "none" },
  ];
  [authSub, authSubmit, switchModeBtn].forEach((el, i) => animate(el, blurIn, { spring: "smooth", delay: i * 40 }));
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
  if (!isLastStep()) {
    try {
      await validateStep();
      goStep(step + 1);
    } catch (err) {
      authError.textContent = err.message;
      shake(authCard);
    } finally {
      authSubmit.disabled = false;
    }
    return;
  }
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
    } else {
      const user = await loginAccount({
        username: usernameInput.value,
        password: passwordInput.value,
      });
      await addPersonalNotice(user.uid, `Выполнен вход в аккаунт: ${describeDevice()}.`);
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
