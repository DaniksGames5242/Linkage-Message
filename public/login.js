import { configLooksEmpty } from "./firebase.js";
import {
  requestOtp,
  confirmOtp,
  resetOtpState,
  fetchMyProfile,
  usernameAvailable,
  completeProfile,
  watchAuthState,
} from "./auth.js";
import { colorForUid, debounce, normalizeUsername, isValidUsername } from "./utils.js";

const AVATAR_EMOJIS = ["😀", "😎", "🐱", "🐶", "🦊", "🐼", "🌟", "🔥", "🌈", "🎮", "🎧", "⚽", "🍕", "🚀", "🌸", "👑"];

const screenPhone = document.getElementById("screen-phone");
const screenOtp = document.getElementById("screen-otp");
const screenProfile = document.getElementById("screen-profile");

const phoneForm = document.getElementById("phone-form");
const phoneInput = document.getElementById("phone-input");
const phoneSubmit = document.getElementById("phone-submit");
const phoneError = document.getElementById("phone-error");

const otpForm = document.getElementById("otp-form");
const otpInput = document.getElementById("otp-input");
const otpSubmit = document.getElementById("otp-submit");
const otpError = document.getElementById("otp-error");
const otpSub = document.getElementById("otp-sub");
const otpBack = document.getElementById("otp-back");
const otpResend = document.getElementById("otp-resend");

const profileForm = document.getElementById("profile-form");
const displaynameInput = document.getElementById("displayname-input");
const usernameInput = document.getElementById("username-input");
const usernameHint = document.getElementById("username-hint");
const profileSubmit = document.getElementById("profile-submit");
const profileError = document.getElementById("profile-error");
const avatarPicker = document.getElementById("avatar-picker");

if (configLooksEmpty) {
  phoneError.textContent = "Firebase не настроен: заполните public/firebase-config.js своими ключами проекта.";
  phoneSubmit.disabled = true;
}

let currentUser = null;
let pendingPhone = null;
let selectedSetupEmoji = null;

function showScreen(el) {
  [screenPhone, screenOtp, screenProfile].forEach((s) => s.classList.add("hidden"));
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

// ---------- 1. Phone entry ----------

phoneForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (configLooksEmpty) return;
  phoneError.textContent = "";
  phoneSubmit.disabled = true;
  try {
    pendingPhone = await requestOtp(phoneInput.value);
    otpSub.textContent = `Код отправлен на ${pendingPhone}`;
    otpInput.value = "";
    showScreen(screenOtp);
    startResendCooldown();
  } catch (err) {
    console.error(err);
    phoneError.textContent = "Не удалось отправить код: " + (err.message || err);
  } finally {
    phoneSubmit.disabled = false;
  }
});

// ---------- 2. OTP ----------

otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  otpError.textContent = "";
  otpSubmit.disabled = true;
  try {
    await confirmOtp(otpInput.value.trim());
    // onAuthStateChanged takes over from here
  } catch (err) {
    console.error(err);
    otpError.textContent = "Неверный код. Попробуйте снова.";
  } finally {
    otpSubmit.disabled = false;
  }
});

otpBack.addEventListener("click", () => {
  resetOtpState();
  pendingPhone = null;
  showScreen(screenPhone);
});

let resendTimer = null;
function startResendCooldown() {
  let seconds = 60;
  otpResend.disabled = true;
  otpResend.textContent = `Отправить код повторно (${seconds}с)`;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(resendTimer);
      otpResend.disabled = false;
      otpResend.textContent = "Отправить код повторно";
    } else {
      otpResend.textContent = `Отправить код повторно (${seconds}с)`;
    }
  }, 1000);
}

otpResend.addEventListener("click", async () => {
  if (!phoneInput.value) return;
  otpError.textContent = "";
  try {
    pendingPhone = await requestOtp(phoneInput.value);
    startResendCooldown();
  } catch (err) {
    otpError.textContent = "Не удалось отправить код: " + (err.message || err);
  }
});

// ---------- 3. Profile setup ----------

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
      phoneNumber: currentUser.phoneNumber,
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
      showScreen(screenPhone);
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
