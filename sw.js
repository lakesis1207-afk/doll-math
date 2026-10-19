// 인터넷 없이도 앱이 열리도록 파일을 휴대폰에 저장해 두는 일꾼(서비스 워커)
// 앱 파일을 고치면 VERSION 숫자를 올려 주세요. 그래야 새 파일로 바뀌어요.
const VERSION = "v4";
const CACHE = "kkokkori-math-" + VERSION;

const sounds = [];
for (let n = 0; n <= 100; n++) sounds.push(`sounds/n${n}.mp3`);
for (let n = 1; n <= 20; n++) sounds.push(`sounds/c${n}.mp3`, `sounds/m${n}.mp3`);
for (let n = 1; n <= 10; n++) sounds.push(`sounds/g${n}.mp3`);
["hello", "sub1", "sub2", "q1", "q3", "q4", "more", "less", "balloon", "row", "hint", "together",
 "locked", "clear", "sticker", "opened", "sleepy", "praise0", "praise1", "praise2",
 "cheer0", "cheer1", "cheer2", "btn_home", "btn_speaker",
 // 수학 놀이용 추가 녹음 (클로바더빙 7번 묶음)
 "hello_math", "btn_next", "btn_last", "pattern", "pat_hint",
 "add_q", "sub_q", "split_q"].forEach(k => sounds.push(`sounds/${k}.mp3`));
// 바구니 이야기: 숫자까지 들어간 문장째 녹음 (클로바더빙 11번 묶음)
for (const f of ["apple", "strawberry", "tangerine", "carrot", "cookie"])
  for (let n = 1; n <= 6; n++) sounds.push(`sounds/add_${f}${n}.mp3`);
for (let n = 1; n <= 4; n++) sounds.push(`sounds/add_more${n}.mp3`, `sounds/sub_jump${n}.mp3`);
for (let n = 3; n <= 10; n++) sounds.push(`sounds/sub_start${n}.mp3`);
for (let n = 3; n <= 6; n++) sounds.push(`sounds/split_all${n}.mp3`);
for (let n = 1; n <= 5; n++) sounds.push(`sounds/split_here${n}.mp3`);

const FILES = [
  "./", "index.html", "style.css", "js/logic.js", "js/core.js", "js/stages.js", "js/app.js",
  "manifest.webmanifest", "icon-192.png", "icon-512.png", ...sounds,
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  // 앱 화면은 새 버전을 먼저 받아 보고, 인터넷이 없으면 저장된 것 쓰기
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./", copy));
        return res;
      }).catch(() => caches.match("./"))
    );
    return;
  }

  // 나머지(소리, 그림, 글꼴)는 저장된 것이 있으면 그걸 쓰고, 없으면 받아서 저장
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
