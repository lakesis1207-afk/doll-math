// 공통 기능: 저장, 인형 사진, 소리(녹음 파일 + 읽어 주기), 효과
const L = window.Logic;
const { rand, pick, shuffle, range, josa, numJosa } = L;

const MAX_PHOTOS = 5;
const REST_MIN = 10; // 하루 놀이 시간(분)
const PRAISE_TEXT = ["끝까지 잘했어!", "열심히 했구나!", "포기 안 했네, 최고야!"];
const STICKERS = ["🐶", "🍎", "🐰", "🍌", "🐻", "🍓", "🐼", "🍇", "🦁", "🍉", "🐯", "🍑", "🐸", "🍒", "🐧", "🍍"];

// ---------- 도우미 ----------
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// ---------- 저장 (이 휴대폰에만) ----------
const KEY = "kkokkori-math-v1";
const STAGE_COUNT = 8;
const settings = {
  setup: false, name: "", unlocked: 1, stars: new Array(STAGE_COUNT).fill(0),
  stickers: [], restOn: true, playDate: "", playedMs: 0,
  progress: null, // 이어 하기: { stage, score, date } (오늘 하던 단계와 맞힌 개수)
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 저장된 기록이 없거나 깨졌으면 새로 시작 */ }
if (!Array.isArray(settings.stars) || settings.stars.length !== STAGE_COUNT) {
  settings.stars = new Array(STAGE_COUNT).fill(0);
  settings.unlocked = 1;
}
// 예전 버전 사용자는 이름을 꼭 정해야 했으니 이미 등록한 것으로 봐요
if (typeof settings.registered !== "boolean") settings.registered = !!settings.setup;
function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* 저장 공간이 막힌 브라우저: 이번 놀이만 기억 */ }
}

// 사진은 크기가 커서 IndexedDB(브라우저 안의 작은 저장소)에 보관
const store = (() => {
  let dbp = null;
  function open() {
    return dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("kkokkori-math", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("blobs");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction("blobs", mode);
      const req = fn(t.objectStore("blobs"));
      t.oncomplete = () => res(req.result);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    get: k => run("readonly", s => s.get(k)).catch(() => null),
    set: (k, v) => run("readwrite", s => s.put(v, k)).catch(() => null),
    del: k => run("readwrite", s => s.delete(k)).catch(() => null),
  };
})();

// ---------- 인형 사진 ----------
const photos = new Array(MAX_PHOTOS).fill(null); // { blob, url }
const photoUrls = () => photos.filter(Boolean).map(p => p.url);
const dollName = () => settings.name || "인형";
// 요소에 인형 얼굴 입히기 (i번째 사진, 없으면 곰 인형)
function paintDoll(node, i) {
  const urls = photoUrls();
  node.classList.add("doll");
  if (!urls.length) { node.classList.add("noimg"); node.style.backgroundImage = ""; return; }
  node.classList.remove("noimg");
  node.style.backgroundImage = `url("${i == null ? pick(urls) : urls[i % urls.length]}")`;
}
// 사진을 작게 줄여서(긴 쪽 600px) 저장
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- 소리 ----------
// 녹음 파일은 Web Audio(브라우저의 소리 재생 장치)로 틀어요. 카카오톡 안에서도 나와요.
let actx = null;
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}

const bufCache = new Map();
function loadBuf(key) {
  if (bufCache.has(key)) return bufCache.get(key);
  const p = (async () => {
    const ctx = audio();
    if (!ctx) return null;
    const r = await fetch(`sounds/${key}.mp3`);
    if (!r.ok) return null;
    const data = await r.arrayBuffer();
    return await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
  })().catch(() => null);
  bufCache.set(key, p);
  return p;
}

// 처음 화면을 누를 때 소리 장치 깨우기 (휴대폰은 눌러야 소리가 나요)
document.addEventListener("pointerdown", () => audio(), { capture: true });

let sayToken = 0, playing = null;
function stopSay() {
  sayToken++;
  if (playing) { try { playing.stop(); } catch (e) { /* 이미 끝난 소리 */ } playing = null; }
}
function playBuf(ctx, buf) {
  return new Promise(res => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = res;
    // 소리 장치가 멈춰 있어도 놀이가 멈추지 않게, 길이만큼 지나면 다음으로
    setTimeout(res, buf.duration * 1000 + 400);
    playing = src;
    src.start();
  });
}
// 클로바더빙 녹음 조각들을 차례로 틀기 (예: ["add_apple3", "add_more2", "add_q"])
async function say(keys) {
  stopSay();
  const my = sayToken;
  const ctx = audio();
  if (!ctx) return;
  for (const k of keys.filter(Boolean)) {
    const buf = await loadBuf(k);
    if (my !== sayToken) return;
    if (buf) await playBuf(ctx, buf);
    if (my !== sayToken) return;
    await sleep(90);
  }
  playing = null;
}
const praiseIndex = () => rand(0, 2);
const cheerKey = () => "cheer" + rand(0, 2);

// 효과음
function beep(freqs, dur = 0.12, type = "sine") {
  const ctx = audio();
  if (!ctx) return;
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    const t = ctx.currentTime + i * dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  });
}
// 풍선 "뻥" 소리: 짧은 잡음을 빠르게 줄여서 만들어요
function noiseBurst() {
  const ctx = audio();
  if (!ctx) return;
  const len = Math.round(ctx.sampleRate * 0.18);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf;
  lp.type = "lowpass"; lp.frequency.value = 2200;
  g.gain.value = 0.9;
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start();
}
const sfx = {
  tap:   () => beep([660], 0.08),
  pop:   () => noiseBurst(),
  drop:  () => beep([880, 1175], 0.07),
  hop:   () => beep([400, 700], 0.08, "triangle"),
  right: () => beep([523, 659, 784, 1047], 0.1),
  wrong: () => beep([300, 240], 0.14, "triangle"),
};

// ---------- 화면 효과 ----------
// 2초 꾹 누르는 버튼 (부모님용)
function holdButton(btn, onDone) {
  let t = null;
  btn.addEventListener("pointerdown", e => {
    e.preventDefault();
    btn.classList.add("holding");
    t = setTimeout(() => { btn.classList.remove("holding"); onDone(); }, 2000);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
    btn.addEventListener(ev, () => { clearTimeout(t); btn.classList.remove("holding"); }));
  btn.addEventListener("contextmenu", e => e.preventDefault());
}

// 손가락 시범: 처음 하는 아이에게 어디를 누르는지 보여 줘요
function demoHand(target) {
  if (!target || !target.isConnected) return;
  const r = target.getBoundingClientRect();
  const h = el("div", "hand", "👆");
  h.setAttribute("aria-hidden", "true");
  h.style.left = `${r.left + r.width / 2}px`;
  h.style.top = `${r.top + r.height / 2}px`;
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 2500);
}

function confetti() {
  const marks = ["⭐", "🌟", "💖", "🎈", "✨"];
  for (let i = 0; i < 16; i++) {
    const c = el("div", "confetti", marks[i % marks.length]);
    c.style.left = rand(0, 95) + "vw";
    c.style.animationDuration = (1.4 + Math.random() * 1.2) + "s";
    c.style.animationDelay = (Math.random() * 0.3) + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

// 풍선 자리에 "펑!" 글자와 조각 8개를 튀게 하기
function burst(sky, b, color) {
  const sr = sky.getBoundingClientRect(), br = b.getBoundingClientRect();
  const x = br.left - sr.left + br.width / 2, y = br.top - sr.top + br.height / 2;
  const word = el("span", "boom", "펑!");
  word.style.left = x + "px"; word.style.top = y + "px";
  sky.appendChild(word);
  for (let k = 0; k < 8; k++) {
    const s = el("span", "shard");
    const ang = k / 8 * Math.PI * 2, dist = rand(50, 80);
    s.style.left = x - 7 + "px"; s.style.top = y - 7 + "px";
    s.style.background = color;
    s.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    s.style.setProperty("--dy", Math.sin(ang) * dist + "px");
    sky.appendChild(s);
  }
}

// ---------- 하루 10분 ----------
let clockStart = 0;
const today = () => new Date().toDateString();
function startClock() {
  if (settings.playDate !== today()) { settings.playDate = today(); settings.playedMs = 0; }
  clockStart = Date.now();
}
function pauseClock() {
  if (!clockStart) return;
  settings.playedMs += Date.now() - clockStart;
  clockStart = 0;
  saveSettings();
}
function tired() {
  if (!settings.restOn) return false;
  const now = clockStart ? Date.now() - clockStart : 0;
  return settings.playDate === today() && settings.playedMs + now >= REST_MIN * 60000;
}
