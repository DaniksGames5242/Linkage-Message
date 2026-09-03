import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG;
const configLooksEmpty = !cfg || cfg.apiKey === "YOUR_API_KEY";

const authScreen = document.getElementById("auth-screen");
const authForm = document.getElementById("auth-form");
const nicknameInput = document.getElementById("nickname");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");

const appEl = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const meAvatar = document.getElementById("me-avatar");
const meName = document.getElementById("me-name");
const logoutBtn = document.getElementById("logout-btn");

const newRoomForm = document.getElementById("new-room-form");
const newRoomInput = document.getElementById("new-room-input");
const roomListEl = document.getElementById("room-list");

const emptyState = document.getElementById("empty-state");
const chatHeader = document.getElementById("chat-header");
const chatRoomHash = document.getElementById("chat-room-hash");
const chatTitle = document.getElementById("chat-title");
const chatSub = document.getElementById("chat-sub");
const messagesEl = document.getElementById("messages");
const composer = document.getElementById("composer");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");

if (configLooksEmpty) {
  authError.textContent =
    "Firebase не настроен: заполните public/firebase-config.js своими ключами проекта.";
  authSubmit.disabled = true;
}

let app, auth, db;
if (!configLooksEmpty) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
}

let currentUser = null;
let currentRoomId = null;
let unsubMessages = null;
let unsubRooms = null;
let rooms = [];

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function fmtTime(ts) {
  if (!ts || !ts.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------- Auth ----------

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (configLooksEmpty) return;
  const nick = nicknameInput.value.trim();
  if (!nick) return;

  authSubmit.disabled = true;
  authError.textContent = "";
  try {
    const cred = await signInAnonymously(auth);
    await updateProfile(cred.user, { displayName: nick });
    localStorage.setItem("lm_nickname", nick);
    // onAuthStateChanged picks it up from here
  } catch (err) {
    console.error(err);
    authError.textContent = "Не удалось войти: " + (err.message || err);
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  if (unsubMessages) unsubMessages();
  if (unsubRooms) unsubRooms();
  auth.signOut();
  location.reload();
});

if (!configLooksEmpty) {
  const savedNick = localStorage.getItem("lm_nickname");
  if (savedNick) nicknameInput.value = savedNick;

  onAuthStateChanged(auth, (user) => {
    if (user && user.displayName) {
      currentUser = user;
      showApp(user);
    } else if (!user) {
      currentUser = null;
      authScreen.classList.remove("hidden");
      appEl.classList.add("hidden");
    }
  });
}

function showApp(user) {
  authScreen.classList.add("hidden");
  appEl.classList.remove("hidden");
  meName.textContent = user.displayName;
  meAvatar.textContent = initials(user.displayName);
  listenRooms();
}

// ---------- Rooms ----------

newRoomForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newRoomInput.value.trim();
  if (!name) return;
  newRoomInput.value = "";
  try {
    const ref = await addDoc(collection(db, "rooms"), {
      name,
      createdBy: currentUser.displayName,
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
    });
    selectRoom(ref.id, name);
  } catch (err) {
    console.error(err);
    alert("Не удалось создать комнату: " + err.message);
  }
});

function listenRooms() {
  const q = query(collection(db, "rooms"), orderBy("lastMessageAt", "desc"), limit(50));
  unsubRooms = onSnapshot(q, (snap) => {
    rooms = [];
    snap.forEach((d) => rooms.push({ id: d.id, ...d.data() }));
    renderRooms();
  });
}

function renderRooms() {
  if (rooms.length === 0) {
    roomListEl.innerHTML = '<div class="empty-rooms">Комнат пока нет.<br />Создайте первую выше ↑</div>';
    return;
  }
  roomListEl.innerHTML = "";
  rooms.forEach((room) => {
    const item = document.createElement("div");
    item.className = "room-item" + (room.id === currentRoomId ? " active" : "");
    item.innerHTML = `
      <div class="room-hash">#</div>
      <div class="room-meta">
        <div class="room-name"></div>
        <div class="room-last"></div>
      </div>
    `;
    item.querySelector(".room-name").textContent = room.name;
    item.querySelector(".room-last").textContent = room.lastMessage || "Нет сообщений";
    item.addEventListener("click", () => {
      selectRoom(room.id, room.name);
      sidebar.classList.remove("open");
      sidebarBackdrop.classList.add("hidden");
    });
    roomListEl.appendChild(item);
  });
}

function selectRoom(roomId, roomName) {
  if (unsubMessages) unsubMessages();
  currentRoomId = roomId;

  emptyState.classList.add("hidden");
  chatHeader.classList.remove("hidden");
  messagesEl.classList.remove("hidden");
  composer.classList.remove("hidden");

  chatRoomHash.textContent = "#";
  chatTitle.textContent = roomName;
  chatSub.textContent = "Обновляется в реальном времени";

  renderRooms();
  listenMessages(roomId);
}

// ---------- Messages ----------

function listenMessages(roomId) {
  messagesEl.innerHTML = '<div class="system-msg">Загрузка сообщений…</div>';
  const q = query(
    collection(db, "rooms", roomId, "messages"),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  unsubMessages = onSnapshot(q, (snap) => {
    messagesEl.innerHTML = "";
    if (snap.empty) {
      messagesEl.innerHTML = '<div class="system-msg">Сообщений пока нет. Начните переписку!</div>';
      return;
    }
    snap.forEach((d) => renderMessage(d.data()));
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function renderMessage(msg) {
  const isMe = msg.uid === currentUser.uid;
  const row = document.createElement("div");
  row.className = "msg-row" + (isMe ? " me" : "");
  row.innerHTML = `
    <div class="msg-group">
      <div class="msg-author"></div>
      <div class="bubble"></div>
      <div class="msg-time"></div>
    </div>
  `;
  row.querySelector(".msg-author").textContent = isMe ? "Вы" : msg.author;
  row.querySelector(".bubble").textContent = msg.text;
  row.querySelector(".msg-time").textContent = fmtTime(msg.createdAt);
  messagesEl.appendChild(row);
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  await sendMessage();
});

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

msgInput.addEventListener("input", () => {
  msgInput.style.height = "auto";
  msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + "px";
});

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentRoomId) return;
  msgInput.value = "";
  msgInput.style.height = "auto";
  sendBtn.disabled = true;
  try {
    await addDoc(collection(db, "rooms", currentRoomId, "messages"), {
      text,
      uid: currentUser.uid,
      author: currentUser.displayName,
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, "rooms", currentRoomId),
      { lastMessage: text, lastMessageAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error(err);
    alert("Не удалось отправить сообщение: " + err.message);
  } finally {
    sendBtn.disabled = false;
  }
}

// ---------- Mobile sidebar toggle ----------

sidebarBackdrop.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.add("hidden");
});
