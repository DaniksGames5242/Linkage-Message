// Voice & video calls: WebRTC peer connection + call screen.
// Signalling goes through Firestore (calls.js); media flows peer-to-peer.

import { newCallId, createCall, updateCall, listenCall, listenIncomingCalls, addCandidate, listenCandidates } from "./calls.js";
import { animate, toast, reducedMotion, pauseBackdrop } from "./ui.js";

const RING_TIMEOUT_MS = 45 * 1000;
const STALE_INCOMING_MS = 60 * 1000;

const ICONS = {
  phone: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  hangup: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.41-.02L.29 13.08a1 1 0 0 1 0-1.41C3.34 8.77 7.46 7 12 7s8.66 1.77 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.47a1 1 0 0 1-1.41.02 11.3 11.3 0 0 0-2.67-1.85 1 1 0 0 1-.56-.9v-3.1A15 15 0 0 0 12 9z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.34 2.18M12 19v4"/></svg>',
  cam: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  camOff: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  flip: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-3l-2-3H9L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2"/><polyline points="14.5 9.5 14.5 11.2 12.8 11.2"/><polyline points="9.5 16.5 9.5 14.8 11.2 14.8"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  speakerOff: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
};

let ctx = null; // injected app context
let el = {}; // DOM refs
let call = null; // active call state
const handledIncoming = new Set();

// ---------- Public API ----------

export function initCalls(context) {
  ctx = context;
  buildDOM();
  listenIncomingCalls(ctx.me, onIncomingList, (err) => {
    if (err?.code === "permission-denied") {
      console.warn("Calls are disabled until the updated firestore.rules are published.");
    }
  });
  window.addEventListener("beforeunload", () => {
    if (call) hangUp();
  });
}

export function isInCall() {
  return !!call;
}

export async function startCall({ chatId, otherUid, profile, kind }) {
  if (call) {
    toast("Вы уже в звонке", { icon: "📞" });
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
    toast("Этот браузер не поддерживает звонки", { tone: "error" });
    return;
  }
  call = newCallState({ role: "caller", kind, otherUid, profile, chatId });
  showScreen("outgoing");
  setStatus("Подключаем микрофон");

  try {
    call.localStream = await getMedia(kind);
  } catch (err) {
    console.error(err);
    toast(mediaErrorText(err, kind), { tone: "error", duration: 4000 });
    teardown(false);
    return;
  }
  if (!call) return; // hung up while the permission prompt was open
  attachLocal();

  const pc = createPeer();
  call.localStream.getTracks().forEach((t) => pc.addTrack(t, call.localStream));
  // Always negotiate a video slot, so the camera can be switched on later in
  // an audio call without renegotiating.
  if (!videoSender()) pc.addTransceiver("video", { direction: "sendrecv" });
  call.id = newCallId();
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await createCall(call.id, {
      callerId: ctx.me,
      calleeId: otherUid,
      chatId,
      kind,
      status: "ringing",
      offer: { type: offer.type, sdp: offer.sdp },
      media: { [ctx.me]: { cam: kind === "video" } },
    });
  } catch (err) {
    console.error(err);
    toast(
      err?.code === "permission-denied" ? "Звонок недоступен: пользователь ограничил контакт или не обновлены правила Firestore" : "Не удалось начать звонок",
      { tone: "error", duration: 4500 }
    );
    teardown(false);
    return;
  }
  call.docReady = true;
  call.pendingLocal.splice(0).forEach((c) => addCandidate(call.id, ctx.me, c).catch(() => {}));

  setStatus("Вызов");
  tones.ringback();
  call.unsubs.push(listenCall(call.id, onCallDoc));
  call.unsubs.push(listenCandidates(call.id, otherUid, addRemoteCandidate));
  call.ringTimer = setTimeout(() => {
    if (call && call.lastStatus === "ringing") finish("missed", true);
  }, RING_TIMEOUT_MS);
}

// ---------- Incoming ----------

async function onIncomingList(list) {
  for (const inc of list) {
    if (handledIncoming.has(inc.id)) continue;
    handledIncoming.add(inc.id);
    const created = inc.createdAt?.toMillis?.() ?? Date.now();
    if (Date.now() - created > STALE_INCOMING_MS) continue;
    if (call) {
      updateCall(inc.id, { status: "busy" }).catch(() => {});
      continue;
    }
    if (ctx.isBlocked?.(inc.callerId)) {
      updateCall(inc.id, { status: "declined" }).catch(() => {});
      continue;
    }
    const profile = (await ctx.getProfile(inc.callerId)) || { displayName: "Неизвестный" };
    if (call) continue;
    call = newCallState({ role: "callee", kind: inc.kind, otherUid: inc.callerId, profile, chatId: inc.chatId });
    call.id = inc.id;
    call.offer = inc.offer;
    call.docReady = true;
    showScreen("incoming");
    setStatus(inc.kind === "video" ? "Входящий видеозвонок" : "Входящий аудиозвонок");
    tones.ringtone();
    if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate([400, 200, 400, 200, 400]);
    ctx.notify?.(profile.displayName, inc.kind === "video" ? "Входящий видеозвонок" : "Входящий звонок");
    call.unsubs.push(listenCall(call.id, onCallDoc));
  }
}

async function acceptIncoming() {
  if (!call || call.role !== "callee" || call.accepting) return;
  call.accepting = true;
  tones.stop();
  showScreen("connecting");
  setStatus("Соединение");
  try {
    call.localStream = await getMedia(call.kind);
  } catch (err) {
    console.error(err);
    toast(mediaErrorText(err, call.kind), { tone: "error", duration: 4000 });
    finish("declined", true);
    return;
  }
  if (!call) return;
  attachLocal();
  const pc = createPeer();
  call.localStream.getTracks().forEach((t) => pc.addTrack(t, call.localStream));
  try {
    await pc.setRemoteDescription(call.offer);
    flushRemoteCandidates();
    // Keep the video slot two-way even in an audio call (camera can join later).
    pc.getTransceivers().forEach((t) => {
      if (t.receiver?.track?.kind === "video") t.direction = "sendrecv";
    });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateCall(call.id, {
      status: "accepted",
      answer: { type: answer.type, sdp: answer.sdp },
      [`media.${ctx.me}.cam`]: !!call.localStream.getVideoTracks()[0],
    });
  } catch (err) {
    console.error(err);
    toast("Не удалось принять звонок", { tone: "error" });
    finish("ended", true);
    return;
  }
  call.unsubs.push(listenCandidates(call.id, call.otherUid, addRemoteCandidate));
}

// ---------- Signalling ----------

async function onCallDoc(doc) {
  if (!call || !doc || doc.id !== call.id) return;
  call.lastStatus = doc.status;
  call.remoteCam = doc.media?.[call.otherUid]?.cam === true;
  refreshVideoMode();

  if (call.role === "caller" && doc.status === "accepted" && doc.answer && !call.answered) {
    call.answered = true;
    clearTimeout(call.ringTimer);
    tones.stop();
    showScreen("connecting");
    setStatus("Соединение");
    try {
      await call.pc.setRemoteDescription(doc.answer);
      flushRemoteCandidates();
    } catch (err) {
      console.error(err);
      finish("ended", true);
    }
    return;
  }
  if (doc.status === "declined" && call.role === "caller") return finish("declined", false);
  if (doc.status === "busy" && call.role === "caller") return finish("busy", false);
  if (doc.status === "missed") return finish("missed", false);
  if (doc.status === "cancelled") return finish("cancelled", false);
  if (doc.status === "ended") return finish("ended", false);
}

function createPeer() {
  const pc = new RTCPeerConnection({ iceServers: window.LINKAGE_ICE_SERVERS || [{ urls: "stun:stun.l.google.com:19302" }] });
  call.pc = pc;
  pc.onicecandidate = (e) => {
    if (!e.candidate || !call) return;
    const c = e.candidate.toJSON();
    if (call.docReady) addCandidate(call.id, ctx.me, c).catch(() => {});
    else call.pendingLocal.push(c);
  };
  // Collect every incoming track into one stream (a late video slot may
  // arrive without a stream id).
  pc.ontrack = (e) => {
    if (!call.remoteStream) call.remoteStream = new MediaStream();
    if (!call.remoteStream.getTracks().includes(e.track)) call.remoteStream.addTrack(e.track);
    el.remoteVideo.srcObject = null;
    el.remoteVideo.srcObject = call.remoteStream;
    el.remoteVideo.play().catch(() => {});
    applySpeaker();
    if (e.track.kind === "audio") startVoiceMeter(new MediaStream([e.track]));
  };
  pc.onconnectionstatechange = () => onConnectionState(pc.connectionState);
  pc.oniceconnectionstatechange = () => {
    // Safari reports progress only through the ICE state.
    if (pc.connectionState === undefined) onConnectionState(pc.iceConnectionState === "completed" ? "connected" : pc.iceConnectionState);
  };
  return pc;
}

function onConnectionState(state) {
  if (!call) return;
  if (state === "connected") {
    clearTimeout(call.dropTimer);
    if (!call.connectedAt) {
      call.connectedAt = Date.now();
      showScreen("active");
      startTimer();
    } else {
      el.overlay.classList.remove("reconnecting");
    }
  } else if (state === "disconnected") {
    el.overlay.classList.add("reconnecting");
    setStatus("Переподключение…");
    clearTimeout(call.dropTimer);
    call.dropTimer = setTimeout(() => call && finish("ended", true, "Соединение потеряно"), 12000);
  } else if (state === "failed") {
    finish("ended", true, call.connectedAt ? "Соединение потеряно" : "Не удалось соединиться. Возможно, нужен TURN-сервер (см. ice-config.js)");
  }
}

function addRemoteCandidate(candidate) {
  if (!call) return;
  if (call.pc?.remoteDescription) call.pc.addIceCandidate(candidate).catch((e) => console.warn("ICE", e));
  else call.pendingRemote.push(candidate);
}

function flushRemoteCandidates() {
  if (!call?.pc) return;
  call.pendingRemote.splice(0).forEach((c) => call.pc.addIceCandidate(c).catch((e) => console.warn("ICE", e)));
}

// ---------- Ending ----------

function hangUp() {
  if (!call) return;
  if (call.role === "caller" && !call.answered) finish("cancelled", true);
  else if (call.role === "callee" && !call.accepting) finish("declined", true);
  else finish("ended", true);
}

// `local` = this side decided to end, so it writes the status for the peer.
function finish(status, local, message) {
  if (!call || call.finishing) return;
  call.finishing = true;
  const c = call;
  if (local && c.id && c.docReady) updateCall(c.id, { status }).catch(() => {});
  const duration = c.connectedAt ? Math.round((Date.now() - c.connectedAt) / 1000) : 0;

  // The caller keeps the chat history: one log message per call.
  if (c.role === "caller" && c.docReady) {
    const result = duration > 0 ? "completed" : status === "ended" ? "cancelled" : status;
    ctx.onCallLog?.({ chatId: c.chatId, kind: c.kind, result, duration }).catch?.(() => {});
  } else if (c.role === "callee" && !c.connectedAt && (status === "cancelled" || status === "missed")) {
    ctx.onMissedCall?.(c.profile);
  }

  const labels = {
    declined: c.role === "caller" ? "Звонок отклонён" : "Отклонено",
    busy: "Абонент занят",
    missed: c.role === "caller" ? "Нет ответа" : "Пропущенный звонок",
    cancelled: c.role === "callee" ? "Пропущенный звонок" : "Звонок отменён",
    ended: duration ? `Звонок завершён · ${fmtDuration(duration)}` : "Звонок завершён",
  };
  if (message) toast(message, { tone: "error", duration: 4500 });
  setStatus(labels[status] || "Звонок завершён");
  showScreen("ended");
  if (status === "busy") tones.busy();
  else tones.hangup();
  teardown(true);
}

function teardown(animated) {
  const c = call;
  call = null;
  if (!c) return;
  clearTimeout(c.ringTimer);
  clearTimeout(c.dropTimer);
  clearInterval(c.timerInterval);
  c.unsubs.forEach((u) => {
    try {
      u();
    } catch (_) {
      /* ignore */
    }
  });
  c.localStream?.getTracks().forEach((t) => t.stop());
  try {
    c.pc?.close();
  } catch (_) {
    /* ignore */
  }
  stopVoiceMeter();
  if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate(0);
  const close = () => {
    if (call) return; // a new call started meanwhile
    hideOverlay();
    el.remoteVideo.srcObject = null;
    el.localVideo.srcObject = null;
    tones.stop();
  };
  if (animated) setTimeout(close, 1400);
  else close();
}

// ---------- Media ----------

function getMedia(kind) {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: kind === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
}

function mediaErrorText(err, kind) {
  if (err?.name === "NotAllowedError") return kind === "video" ? "Нет доступа к камере или микрофону" : "Нет доступа к микрофону";
  if (err?.name === "NotFoundError") return kind === "video" ? "Камера или микрофон не найдены" : "Микрофон не найден";
  return "Не удалось получить доступ к устройствам";
}

function attachLocal() {
  el.localVideo.srcObject = call.localStream;
  el.localVideo.play().catch(() => {});
  updateToggles();
}

function toggleMic() {
  const track = call?.localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  updateToggles();
}

function videoSender() {
  const t = call?.pc?.getTransceivers().find((x) => x.sender?.track?.kind === "video" || x.receiver?.track?.kind === "video");
  return t?.sender || null;
}

// Camera on/off at any point of the call: turns an audio call into a video
// call and back by swapping the track in the pre-negotiated video slot.
async function toggleCam() {
  if (!call || call.camBusy) return;
  call.camBusy = true;
  const current = call.localStream?.getVideoTracks()[0];
  try {
    if (current) {
      await videoSender()?.replaceTrack(null);
      current.stop();
      call.localStream.removeTrack(current);
    } else {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: call.facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const track = fresh.getVideoTracks()[0];
      call.localStream.addTrack(track);
      await videoSender()?.replaceTrack(track);
      el.localVideo.srcObject = call.localStream;
      el.localVideo.play().catch(() => {});
      if (!call.speakerTouched && !call.speaker) {
        call.speaker = true; // video calls default to loudspeaker
        applySpeaker();
      }
    }
  } catch (err) {
    console.error(err);
    toast(mediaErrorText(err, "video"), { tone: "error" });
  } finally {
    if (call) call.camBusy = false;
  }
  if (!call) return;
  updateToggles();
  refreshVideoMode();
  const camOn = !!call.localStream?.getVideoTracks()[0];
  if (call.id && call.docReady) updateCall(call.id, { [`media.${ctx.me}.cam`]: camOn }).catch(() => {});
}

// ---------- Loudspeaker ----------
// Browsers only let a page pick the output device (setSinkId, mostly
// desktop Chrome/Edge). Where a "speaker"/"earpiece" device is exposed we
// route to it; otherwise "off" means a quiet, hold-to-ear volume.
async function applySpeaker() {
  if (!call) return;
  const v = el.remoteVideo;
  let routed = false;
  if (typeof v.setSinkId === "function" && navigator.mediaDevices?.enumerateDevices) {
    try {
      const outs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audiooutput");
      const pick = call.speaker
        ? outs.find((d) => /speaker|динамик|громк/i.test(d.label))
        : outs.find((d) => /earpiece|receiver|handset|headset|headphone|наушник|телефон/i.test(d.label));
      if (pick) {
        await v.setSinkId(pick.deviceId);
        routed = true;
      } else if (call.speaker && v.sinkId) {
        await v.setSinkId("");
      }
    } catch (_) {
      /* output selection not permitted */
    }
  }
  v.volume = call.speaker || routed ? 1 : 0.3;
}

function toggleSpeaker() {
  if (!call) return;
  call.speaker = !call.speaker;
  call.speakerTouched = true;
  applySpeaker();
  updateToggles();
  toast(call.speaker ? "Громкая связь включена" : "Громкая связь выключена", { icon: call.speaker ? "🔊" : "🔈" });
}

function refreshVideoMode() {
  if (!call) return;
  const localCam = !!call.localStream?.getVideoTracks()[0];
  const video = localCam || !!call.remoteCam;
  el.overlay.classList.toggle("is-video", video);
  el.overlay.classList.toggle("remote-cam-off", !call.remoteCam);
  el.overlay.classList.toggle("local-cam-off", !localCam);
  el.kind.textContent = video ? "Видеозвонок" : "Аудиозвонок";
}

async function flipCamera() {
  if (!call?.localStream) return;
  const current = call.localStream.getVideoTracks()[0];
  if (!current) return;
  call.facing = call.facing === "user" ? "environment" : "user";
  try {
    const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: call.facing } });
    const track = fresh.getVideoTracks()[0];
    track.enabled = current.enabled;
    await videoSender()?.replaceTrack(track);
    call.localStream.removeTrack(current);
    current.stop();
    call.localStream.addTrack(track);
    el.localVideo.srcObject = call.localStream;
    el.overlay.classList.toggle("facing-back", call.facing === "environment");
    animate(el.local, [{ transform: "rotateY(90deg)" }, { transform: "none" }], { spring: "bouncy" });
  } catch (err) {
    console.error(err);
    toast("Не удалось переключить камеру", { tone: "error" });
  }
}

function updateToggles() {
  if (!call) return;
  const mic = call.localStream?.getAudioTracks()[0];
  const cam = call.localStream?.getVideoTracks()[0];
  const micOn = !mic || mic.enabled;
  const camOn = !!cam && cam.enabled;
  el.micBtn.innerHTML = micOn ? ICONS.mic : ICONS.micOff;
  el.micBtn.classList.toggle("off", !micOn);
  el.camBtn.innerHTML = camOn ? ICONS.cam : ICONS.camOff;
  el.camBtn.classList.toggle("active", camOn);
  el.speakerBtn.innerHTML = call.speaker ? ICONS.speaker : ICONS.speakerOff;
  el.speakerBtn.classList.toggle("active", !!call.speaker);
  el.overlay.classList.toggle("local-cam-off", !camOn);
}

// ---------- Voice meter (avatar rings follow the other person's voice) ----------

let meter = null;
function startVoiceMeter(stream) {
  stopVoiceMeter();
  if (reducedMotion || !stream.getAudioTracks().length) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let level = 0;
    const tick = () => {
      if (!meter) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 2; i < 40; i++) sum += data[i];
      const target = Math.min(1, sum / (38 * 150));
      level += (target - level) * 0.25;
      el.overlay.style.setProperty("--voice", level.toFixed(3));
      meter.raf = requestAnimationFrame(tick);
    };
    meter = { ac, raf: requestAnimationFrame(tick) };
  } catch (_) {
    meter = null;
  }
}

function stopVoiceMeter() {
  if (!meter) return;
  cancelAnimationFrame(meter.raf);
  meter.ac.close().catch(() => {});
  meter = null;
  el.overlay?.style.setProperty("--voice", "0");
}

// ---------- Tones (synthesised, no audio files) ----------

const tones = (() => {
  let ac = null;
  let loop = null;
  const ensure = () => {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  };
  const beep = (freq, start, dur, gain = 0.06, type = "sine") => {
    const a = ensure();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.02);
    g.gain.setValueAtTime(gain, a.currentTime + start + dur - 0.04);
    g.gain.linearRampToValueAtTime(0, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start);
    o.stop(a.currentTime + start + dur + 0.05);
  };
  const repeat = (fn, every) => {
    stop();
    try {
      fn();
    } catch (_) {
      return;
    }
    loop = setInterval(() => {
      try {
        fn();
      } catch (_) {
        /* audio unavailable */
      }
    }, every);
  };
  function stop() {
    clearInterval(loop);
    loop = null;
  }
  return {
    stop,
    ringback: () => repeat(() => beep(425, 0, 1.0, 0.05), 4000),
    ringtone: () =>
      repeat(() => {
        [659, 784, 988, 784].forEach((f, i) => beep(f, i * 0.16, 0.15, 0.07, "triangle"));
        [659, 784, 988, 784].forEach((f, i) => beep(f, 0.9 + i * 0.16, 0.15, 0.07, "triangle"));
      }, 3000),
    busy: () => {
      stop();
      try {
        [0, 0.7, 1.4].forEach((t) => beep(425, t, 0.35, 0.05));
      } catch (_) {
        /* ignore */
      }
    },
    hangup: () => {
      stop();
      try {
        beep(620, 0, 0.12, 0.05);
        beep(460, 0.14, 0.18, 0.05);
      } catch (_) {
        /* ignore */
      }
    },
  };
})();

// ---------- UI ----------

function newCallState(fields) {
  return {
    ...fields,
    id: null,
    pc: null,
    localStream: null,
    docReady: false,
    pendingLocal: [],
    pendingRemote: [],
    unsubs: [],
    facing: "user",
    lastStatus: "ringing",
    remoteCam: false,
    remoteStream: null,
    // Phones hold audio calls to the ear; video calls and desktops use the speaker.
    speaker: fields.kind === "video" || !window.matchMedia("(hover: none)").matches,
  };
}

function buildDOM() {
  const root = document.createElement("div");
  root.id = "call-overlay";
  root.className = "hidden";
  root.innerHTML = `
    <div class="call-stage">
      <div class="call-bg"></div>
      <video class="call-remote" playsinline autoplay></video>
      <div class="call-top">
        <button type="button" class="call-round call-minimize" title="Свернуть">${ICONS.minimize}</button>
        <div class="call-kind"></div>
      </div>
      <div class="call-hero">
        <div class="call-avatar-wrap">
          <span class="call-ring r1"></span><span class="call-ring r2"></span><span class="call-ring r3"></span>
          <div class="call-avatar"></div>
        </div>
        <div class="call-name"></div>
        <div class="call-status"></div>
      </div>
      <div class="call-local"><video playsinline autoplay muted></video><div class="call-local-off">${ICONS.camOff}</div></div>
      <div class="call-controls call-controls-incoming">
        <div class="call-ctl"><button type="button" class="call-round call-decline" title="Отклонить">${ICONS.hangup}</button><span>Отклонить</span></div>
        <div class="call-ctl"><button type="button" class="call-round call-accept" title="Принять">${ICONS.phone}</button><span>Принять</span></div>
      </div>
      <div class="call-controls call-controls-active">
        <div class="call-ctl"><button type="button" class="call-round call-mic" title="Микрофон"></button><span>Микрофон</span></div>
        <div class="call-ctl"><button type="button" class="call-round call-speaker" title="Громкая связь"></button><span>Динамик</span></div>
        <div class="call-ctl"><button type="button" class="call-round call-cam" title="Камера"></button><span>Камера</span></div>
        <div class="call-ctl call-flip-ctl"><button type="button" class="call-round call-flip" title="Сменить камеру">${ICONS.flip}</button><span>Повернуть</span></div>
        <div class="call-ctl"><button type="button" class="call-round call-end" title="Завершить">${ICONS.hangup}</button><span>Завершить</span></div>
      </div>
    </div>
    <button type="button" class="call-pill glass">
      <span class="call-pill-avatar"></span>
      <span class="call-pill-text"><b class="call-pill-name"></b><span class="call-pill-status"></span></span>
      <span class="call-pill-end">${ICONS.hangup}</span>
    </button>`;
  document.body.appendChild(root);

  el = {
    overlay: root,
    stage: root.querySelector(".call-stage"),
    remoteVideo: root.querySelector(".call-remote"),
    local: root.querySelector(".call-local"),
    localVideo: root.querySelector(".call-local video"),
    avatar: root.querySelector(".call-avatar"),
    bg: root.querySelector(".call-bg"),
    name: root.querySelector(".call-name"),
    status: root.querySelector(".call-status"),
    kind: root.querySelector(".call-kind"),
    micBtn: root.querySelector(".call-mic"),
    camBtn: root.querySelector(".call-cam"),
    speakerBtn: root.querySelector(".call-speaker"),
    pill: root.querySelector(".call-pill"),
    pillAvatar: root.querySelector(".call-pill-avatar"),
    pillName: root.querySelector(".call-pill-name"),
    pillStatus: root.querySelector(".call-pill-status"),
  };

  root.querySelector(".call-accept").addEventListener("click", acceptIncoming);
  root.querySelector(".call-decline").addEventListener("click", hangUp);
  root.querySelector(".call-end").addEventListener("click", hangUp);
  root.querySelector(".call-flip").addEventListener("click", flipCamera);
  root.querySelector(".call-minimize").addEventListener("click", () => setMinimized(true));
  el.micBtn.addEventListener("click", toggleMic);
  el.camBtn.addEventListener("click", toggleCam);
  el.speakerBtn.addEventListener("click", toggleSpeaker);
  el.pill.addEventListener("click", (e) => {
    if (e.target.closest(".call-pill-end")) hangUp();
    else setMinimized(false);
  });
  // Tap the small self-view to swap it with the big picture.
  el.local.addEventListener("click", () => root.classList.toggle("swap-views"));
}

function showScreen(state) {
  if (!call && state !== "ended") return;
  const wasHidden = el.overlay.classList.contains("hidden");
  el.overlay.dataset.state = state;
  if (call) {
    const avatar = ctx.avatarHTML(call.profile, call.otherUid);
    el.avatar.innerHTML = avatar;
    el.pillAvatar.innerHTML = avatar;
    el.name.textContent = call.profile.displayName || "—";
    el.pillName.textContent = call.profile.displayName || "—";
    if (state === "incoming") {
      el.kind.textContent = call.kind === "video" ? "Видеозвонок" : "Аудиозвонок";
      el.overlay.classList.toggle("is-video", call.kind === "video");
    } else {
      refreshVideoMode();
    }
    const img = call.profile.avatarImage;
    el.bg.style.backgroundImage = img ? `url("${img}")` : "";
    el.bg.style.backgroundColor = call.profile.avatarColor || "";
  }
  if (state === "incoming" || state === "outgoing") {
    el.overlay.classList.remove("remote-cam-off", "local-cam-off", "reconnecting", "swap-views", "facing-back");
    setMinimized(false, true);
  }
  if (wasHidden) {
    el.overlay.classList.remove("hidden");
    if (!el.overlay._bgPaused) {
      el.overlay._bgPaused = true;
      pauseBackdrop(true);
    }
    animate(el.overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: "ease-out" });
    animate(
      el.stage,
      [
        { transform: "scale(1.12)", filter: "blur(24px)", opacity: 0 },
        { transform: "none", filter: "blur(0px)", opacity: 1 },
      ],
      { spring: "smooth" }
    );
    animate(el.overlay.querySelector(".call-avatar-wrap"), [{ transform: "scale(.3)" }, { transform: "none" }], { spring: "jelly", delay: 80 });
  }
  const controls = el.overlay.querySelectorAll(`.call-controls-${state === "incoming" ? "incoming" : "active"} .call-ctl`);
  if (state === "incoming" || state === "outgoing" || state === "connecting") {
    controls.forEach((c, i) =>
      animate(c, [{ transform: "translateY(40px) scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], {
        spring: "bouncy",
        delay: 120 + i * 60,
      })
    );
  }
}

function setMinimized(min, instant = false) {
  el.overlay.classList.toggle("minimized", min);
  if (instant) return;
  const target = min ? el.pill : el.stage;
  animate(
    target,
    [
      { transform: min ? "translateY(-30px) scale(.6)" : "scale(.9)", opacity: 0, filter: "blur(10px)" },
      { transform: "none", opacity: 1, filter: "blur(0px)" },
    ],
    { spring: "bouncy" }
  );
}

function hideOverlay() {
  // Background tabs may never finish the fade, so hide on a timer too.
  const hide = () => {
    if (call) return;
    if (el.overlay._bgPaused) {
      el.overlay._bgPaused = false;
      pauseBackdrop(false);
    }
    el.overlay.classList.add("hidden");
    el.overlay.getAnimations().forEach((a) => a.cancel());
  };
  setTimeout(hide, reducedMotion ? 100 : 450);
  el.overlay
    .animate(
      [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0, filter: "blur(16px)" },
      ],
      { duration: reducedMotion ? 60 : 380, easing: "ease-in", fill: "forwards" }
    )
    .finished.then(
      () => {
        if (call) return;
        el.overlay.classList.add("hidden");
        el.overlay.getAnimations().forEach((a) => a.cancel());
      },
      () => {}
    );
}

function setStatus(text) {
  el.status.textContent = text;
  el.pillStatus.textContent = text;
}

function startTimer() {
  const tick = () => {
    if (!call?.connectedAt) return;
    const text = fmtDuration(Math.round((Date.now() - call.connectedAt) / 1000));
    if (!el.overlay.classList.contains("reconnecting")) setStatus(text);
  };
  tick();
  call.timerInterval = setInterval(tick, 1000);
}

export function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return (h ? `${h}:` : "") + `${mm}:${String(s).padStart(2, "0")}`;
}
