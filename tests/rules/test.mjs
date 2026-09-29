import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp, arrayUnion, arrayRemove, increment, deleteField, Timestamp, writeBatch,
} from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "linkage-massege",
  firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8088 },
});
const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const seed = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));

let pass = 0, fail = 0;
async function t(name, p, expect) {
  try {
    await (expect ? assertSucceeds(p) : assertFails(p));
    pass++;
  } catch (e) {
    fail++;
    console.log(`✗ ${name} (expected ${expect ? "ALLOW" : "DENY"}) — ${String(e.message || e).split("\n")[0].slice(0, 160)}`);
  }
}
const ALLOW = true, DENY = false;

await env.clearFirestore();
await seed(async (d) => {
  await setDoc(doc(d, "users/alice"), { username: "alice", privacy: { calls: "everyone" } });
  await setDoc(doc(d, "users/bob"), { username: "bob", blocked: [] });
  await setDoc(doc(d, "users/eve"), { username: "eve" });
  await setDoc(doc(d, "users/carl"), { username: "carl", blocked: ["eve"], privacy: { calls: "contacts" } });
  await setDoc(doc(d, "users/carl/contacts/alice"), { alias: "" });
  await setDoc(doc(d, "chats/alice_bob"), { participants: ["alice", "bob"] });
  await setDoc(doc(d, "chats/alice_bob/messages/m1"), { senderId: "alice", text: "hi", votes: {}, checks: {}, enc: { v: 2, from: "d1", iv: "x", ct: "y", keys: { d1: { iv: "a", ct: "b" } } } });
  await setDoc(doc(d, "chats/carl_eve"), { participants: ["carl", "eve"] });
  await setDoc(doc(d, "groups/g1"), { type: "group", name: "G", ownerId: "alice", admins: ["alice"], members: ["alice", "bob"], settings: { whoCanAdd: "all", whoCanPost: "all", inviteCode: "SECRET" } });
  await setDoc(doc(d, "groups/g1/messages/gm1"), { senderId: "bob", text: "yo" });
  await setDoc(doc(d, "groups/priv"), { type: "group", name: "Priv", ownerId: "alice", admins: ["alice"], members: ["alice", "bob"], settings: { inviteCode: "SECRET" } });
  await setDoc(doc(d, "groups/pub"), { type: "group", name: "P", ownerId: "alice", admins: ["alice"], members: ["alice"], settings: { isPublic: true } });
  await setDoc(doc(d, "groups/ch"), { type: "channel", name: "C", ownerId: "alice", admins: ["alice"], members: ["alice", "bob"] });
  await setDoc(doc(d, "groups/locked"), { type: "group", name: "L", ownerId: "alice", admins: ["alice"], members: ["alice", "bob"], settings: { whoCanPost: "admins", whoCanAdd: "admins" } });
  await setDoc(doc(d, "groups/perm"), { type: "group", name: "Pm", ownerId: "alice", admins: ["alice"], members: ["alice", "bob"], perms: { bob: { media: false, add: false } } });
  await setDoc(doc(d, "stories/s1"), { ownerId: "alice", audience: ["alice", "bob"], image: "data:x", createdAt: Timestamp.now() });
});

// ---- users
await t("read other profile", getDoc(doc(db("bob"), "users/alice")), ALLOW);
await t("anon read profile", getDoc(doc(db(null), "users/alice")), DENY);
await t("edit own profile (folders)", updateDoc(doc(db("bob"), "users/bob"), { folders: [{ id: "f", name: "W", chats: [] }] }), ALLOW);
await t("edit someone else's profile", updateDoc(doc(db("bob"), "users/alice"), { username: "pwn" }), DENY);

// ---- 1:1 chat messages
const bm = (uid) => doc(db(uid), "chats/alice_bob/messages/m1");
await t("participant sends", addDoc(collection(db("bob"), "chats/alice_bob/messages"), { senderId: "bob", text: "hey" }), ALLOW);
await t("outsider sends", addDoc(collection(db("eve"), "chats/alice_bob/messages"), { senderId: "eve", text: "hey" }), DENY);
await t("send as someone else", addDoc(collection(db("bob"), "chats/alice_bob/messages"), { senderId: "alice", text: "hey" }), DENY);
await t("blocked user sends", addDoc(collection(db("eve"), "chats/carl_eve/messages"), { senderId: "eve", text: "hey" }), DENY);
await t("outsider reads", getDoc(bm("eve")), DENY);
await t("sender edits text", updateDoc(bm("alice"), { text: "edited", edited: true }), ALLOW);
await t("other edits text", updateDoc(bm("bob"), { text: "haha" }), DENY);
await t("react", updateDoc(bm("bob"), { reactions: { "❤️": ["bob"] } }), ALLOW);
await t("vote own", updateDoc(bm("bob"), { "votes.bob": [0] }), ALLOW);
await t("vote as other", updateDoc(bm("bob"), { "votes.alice": [1] }), DENY);
await t("hide for me", updateDoc(bm("bob"), { hiddenFor: arrayUnion("bob") }), ALLOW);
await t("hide for someone else", updateDoc(bm("bob"), { hiddenFor: arrayUnion("alice") }), DENY);
await t("checklist tick", updateDoc(bm("bob"), { "checks.0": "bob" }), ALLOW);
await t("checklist + text at once", updateDoc(bm("bob"), { "checks.1": "bob", text: "x" }), DENY);
await t("key share adds a key", updateDoc(bm("bob"), { "enc.keys.d2": { iv: "c", ct: "d", by: "d1" } }), ALLOW);
await t("key share replaces a key", updateDoc(bm("bob"), { "enc.keys.d1": { iv: "z", ct: "z" } }), DENY);
await t("key share changes ciphertext", updateDoc(bm("bob"), { "enc.ct": "evil" }), DENY);
await t("delete own message", deleteDoc(doc(db("bob"), "chats/alice_bob/messages/m1")), DENY);
await t("auto-delete setting (participant)", updateDoc(doc(db("bob"), "chats/alice_bob"), { autoDelete: 86400 }), ALLOW);
await t("change participants", updateDoc(doc(db("bob"), "chats/alice_bob"), { participants: ["bob", "eve"] }), DENY);

// ---- groups
const g = (uid, id = "g1") => doc(db(uid), "groups/" + id);
await t("member reads group", getDoc(g("bob")), ALLOW);
await t("outsider reads private group", getDoc(g("eve")), DENY);
await t("outsider reads public group", getDoc(g("eve", "pub")), ALLOW);
await t("member updates unread", updateDoc(g("bob"), { "unread.alice": increment(1), lastMessage: "x" }), ALLOW);
await t("member changes settings", updateDoc(g("bob"), { "settings.whoCanPost": "admins" }), DENY);
await t("member makes self admin", updateDoc(g("bob"), { admins: arrayUnion("bob") }), DENY);
await t("member sets auto-delete", updateDoc(g("bob"), { autoDelete: 60 }), DENY);
await t("member edits perms", updateDoc(g("bob", "perm"), { "perms.bob": deleteField() }), DENY);
await t("member adds member (allowed)", updateDoc(g("bob"), { members: arrayUnion("carl") }), ALLOW);
await t("member adds when admins-only", updateDoc(g("bob", "locked"), { members: arrayUnion("carl") }), DENY);
await t("member without add perm adds", updateDoc(g("bob", "perm"), { members: arrayUnion("carl") }), DENY);
await t("member leaves", updateDoc(g("bob", "locked"), { members: arrayRemove("bob") }), ALLOW);
await t("member kicks someone", updateDoc(g("bob", "perm"), { members: arrayRemove("alice") }), DENY);
await t("admin changes settings", updateDoc(g("alice"), { "settings.isPublic": true, autoDelete: 86400 }), ALLOW);
await t("admin sets perms", updateDoc(g("alice", "perm"), { "perms.carl": { post: false } }), ALLOW);
await t("join adding a friend too", updateDoc(g("eve", "pub"), { members: arrayUnion("eve", "carl") }), DENY);
await t("join public", updateDoc(g("eve", "pub"), { members: arrayUnion("eve") }), ALLOW);
await t("join private without code", updateDoc(g("dan", "priv"), { members: arrayUnion("dan") }), DENY);
await t("join private wrong code", updateDoc(g("dan", "priv"), { members: arrayUnion("dan"), "joins.dan": "nope" }), DENY);
await t("join private with code", updateDoc(g("dan", "priv"), { members: arrayUnion("dan"), "joins.dan": "SECRET" }), ALLOW);
await t("join after someone else joined, no code", updateDoc(g("fay", "priv"), { members: arrayUnion("fay") }), DENY);
await t("join using someone else's code entry", updateDoc(g("fay", "priv"), { members: arrayUnion("fay"), "joins.dan": "SECRET" }), DENY);
await t("rejoin after leaving (own code still valid)", (async () => { await updateDoc(g("dan", "priv"), { members: arrayRemove("dan") }); await updateDoc(g("dan", "priv"), { members: arrayUnion("dan") }); })(), ALLOW);
await seed((d) => updateDoc(doc(d, "groups/priv"), { "settings.inviteCode": "NEW" }));
await t("rejoin after link reset with old code", (async () => { await updateDoc(g("dan", "priv"), { members: arrayRemove("dan") }); await updateDoc(g("dan", "priv"), { members: arrayUnion("dan") }); })(), DENY);
await t("member tampers with joins", updateDoc(g("bob", "priv"), { "joins.bob": "SECRET" }), DENY);

// admin (non-owner) can't demote owner
await seed((d) => updateDoc(doc(d, "groups/g1"), { admins: arrayUnion("bob") }));
await t("admin demotes owner", updateDoc(g("bob"), { admins: arrayRemove("alice") }), DENY);
await t("admin kicks owner", updateDoc(g("bob"), { members: arrayRemove("alice"), admins: arrayRemove("alice") }), DENY);
await seed((d) => updateDoc(doc(d, "groups/g1"), { admins: arrayRemove("bob") }));

// group messages
const gmsg = (uid, id, extra = {}) => addDoc(collection(db(uid), `groups/${id}/messages`), { senderId: uid, text: "hi", ...extra });
await t("member posts in group", gmsg("bob", "g1"), ALLOW);
await t("outsider posts", gmsg("eve", "g1"), DENY);
await t("subscriber posts in channel", gmsg("bob", "ch"), DENY);
await t("admin posts in channel", gmsg("alice", "ch"), ALLOW);
await t("member posts when admins-only", gmsg("bob", "locked"), DENY);
await t("member without media sends photo", gmsg("bob", "perm", { imageUrl: "https://x/y.jpg" }), DENY);
await t("member without media sends text", gmsg("bob", "perm"), ALLOW);
await t("group reaction", updateDoc(doc(db("alice"), "groups/g1/messages/gm1"), { reactions: { "👍": ["alice"] } }), ALLOW);
await t("group edit by non-sender", updateDoc(doc(db("alice"), "groups/g1/messages/gm1"), { text: "x" }), DENY);

// ---- slow mode (settings.slowMode seconds; post must stamp slow.<uid> in the same batch)
await seed((d) => setDoc(doc(d, "groups/slow"), { type: "group", name: "S", ownerId: "alice", admins: ["alice"], members: ["alice", "bob"], settings: { slowMode: 60 } }));
const slowPost = (uid, stamp = true) => {
  const d = db(uid);
  const b = writeBatch(d);
  b.set(doc(collection(d, "groups/slow/messages")), { senderId: uid, text: "hi" });
  if (stamp) b.set(doc(d, "groups/slow"), { slow: { [uid]: serverTimestamp() } }, { merge: true });
  return b.commit();
};
await t("slow mode: post without stamp", slowPost("bob", false), DENY);
await t("slow mode: first post", slowPost("bob"), ALLOW);
await t("slow mode: second post too soon", slowPost("bob"), DENY);
await t("slow mode: rewind own stamp", updateDoc(doc(db("bob"), "groups/slow"), { "slow.bob": Timestamp.fromMillis(0) }), DENY);
await t("slow mode: stamp someone else", updateDoc(doc(db("bob"), "groups/slow"), { "slow.alice": serverTimestamp() }), DENY);
await t("slow mode: admin is exempt", (async () => { await slowPost("alice"); await slowPost("alice"); })(), ALLOW);
await seed((d) => updateDoc(doc(d, "groups/slow"), { "slow.bob": Timestamp.fromMillis(Date.now() - 120000) }));
await t("slow mode: after the interval", slowPost("bob"), ALLOW);
await t("member can't change slow mode", updateDoc(doc(db("bob"), "groups/slow"), { "settings.slowMode": 0 }), DENY);
await t("no slow mode: plain post", gmsg("bob", "g1"), ALLOW);

// ---- stickers & private tools
await t("sticker in chat", addDoc(collection(db("alice"), "chats/alice_bob/messages"), { senderId: "alice", text: "🖼", sticker: "https://x/s.webp" }), ALLOW);
await t("oversized sticker field", addDoc(collection(db("alice"), "chats/alice_bob/messages"), { senderId: "alice", text: "🖼", sticker: "x".repeat(600) }), DENY);
await t("sticker without media right", gmsg("bob", "perm", { sticker: "https://x/s.webp" }), DENY);
await t("own private tools write", setDoc(doc(db("bob"), "users/bob/private/tools"), { notes: { a: "x" } }), ALLOW);
await t("own private tools read", getDoc(doc(db("bob"), "users/bob/private/tools")), ALLOW);
await t("someone's private tools read", getDoc(doc(db("eve"), "users/bob/private/tools")), DENY);
await t("someone's private tools write", setDoc(doc(db("eve"), "users/bob/private/tools"), { notes: {} }), DENY);

await t("publish own sticker pack", setDoc(doc(db("bob"), "stickerPacks/bob"), { ownerId: "bob", name: "B", stickers: ["https://x/1.webp"] }), ALLOW);
await t("read someone's sticker pack", getDoc(doc(db("eve"), "stickerPacks/bob")), ALLOW);
await t("overwrite someone's sticker pack", setDoc(doc(db("eve"), "stickerPacks/bob"), { ownerId: "eve", name: "E", stickers: [] }), DENY);
await t("publish pack under another id", setDoc(doc(db("eve"), "stickerPacks/bob2"), { ownerId: "eve", name: "E", stickers: [] }), DENY);
await t("oversized sticker pack", setDoc(doc(db("bob"), "stickerPacks/bob"), { ownerId: "bob", name: "B", stickers: Array(121).fill("u") }), DENY);

await t("member can't edit topics", updateDoc(doc(db("bob"), "groups/g1"), { topics: [{ id: "t", name: "x" }] }), DENY);
await t("admin edits topics", updateDoc(doc(db("alice"), "groups/g1"), { topics: [{ id: "t", name: "x" }] }), ALLOW);
await t("message with a topic", gmsg("bob", "g1", { topic: "t" }), ALLOW);
await t("oversized topic id", gmsg("bob", "g1", { topic: "x".repeat(41) }), DENY);
await t("voice transcript", addDoc(collection(db("alice"), "chats/alice_bob/messages"), { senderId: "alice", text: "🎤", voiceUrl: "https://x/v.mp3", transcript: "привет" }), ALLOW);

// ---- stories
await t("audience reads story", getDoc(doc(db("bob"), "stories/s1")), ALLOW);
await t("outsider reads story", getDoc(doc(db("eve"), "stories/s1")), DENY);
await t("audience query", getDocs(query(collection(db("bob"), "stories"), where("audience", "array-contains", "bob"))), ALLOW);
await t("unfiltered story query", getDocs(collection(db("bob"), "stories")), DENY);
await t("create story with audience", addDoc(collection(db("bob"), "stories"), { ownerId: "bob", audience: ["bob", "alice"], image: "data:x", createdAt: serverTimestamp() }), ALLOW);
await t("create story without audience", addDoc(collection(db("bob"), "stories"), { ownerId: "bob", image: "data:x", createdAt: serverTimestamp() }), DENY);
await t("comment as audience", addDoc(collection(db("bob"), "stories/s1/comments"), { uid: "bob", text: "wow" }), ALLOW);
await t("comment as outsider", addDoc(collection(db("eve"), "stories/s1/comments"), { uid: "eve", text: "wow" }), DENY);
await seed((d) => setDoc(doc(d, "stories/s1/comments/c1"), { uid: "bob", text: "x" }));
await t("owner deletes a comment", deleteDoc(doc(db("alice"), "stories/s1/comments/c1")), ALLOW);
await t("outsider reads comments", getDocs(collection(db("eve"), "stories/s1/comments")), DENY);

// ---- calls
const call = (from, to) => setDoc(doc(db(from), "calls/" + from + to), { callerId: from, calleeId: to, kind: "audio", status: "ringing" });
await t("call someone (everyone)", call("bob", "alice"), ALLOW);
await t("call contacts-only as non-contact", call("bob", "carl"), DENY);
await t("call contacts-only as contact", call("alice", "carl"), ALLOW);
await t("blocked user calls", call("eve", "carl"), DENY);

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
