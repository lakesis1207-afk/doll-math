// 놀이 진행(문제 내기, 힌트, 칭찬)과 8단계 놀이
const GOAL = 5; // 한 단계에서 맞혀야 하는 문제 수
const G = { stage: 0, score: 0, current: null, busy: false, lastAnswer: null };

const STAGES = [
  { ico: "👀", name: "반짝 몇 개?",       sub: "1~5 · 바로 알기",     color: "var(--lilac)", play: () => qSubitize() },
  { ico: "🧸", name: "인형이랑 세기",     sub: "1~10 · 하나씩 세기",  color: "var(--pink)",  play: () => qCount() },
  { ico: "🎈", name: "풍선 터뜨리기",     sub: "1~20 · 숫자 알아보기", color: "var(--sky)",   play: () => qBalloon() },
  { ico: "⚖️", name: "어느 쪽이 많아?",   sub: "1~10 · 많다/적다",    color: "var(--peach)", play: () => qCompare() },
  { ico: "🧩", name: "무늬 잇기",         sub: "반복 규칙",           color: "var(--mint)",  play: () => qPattern() },
  { ico: "🧺", name: "바구니 더하기·빼기", sub: "10 이하",             color: "var(--sun)",   play: () => qStory() },
  { ico: "📦", name: "10개씩 묶기",       sub: "11~100 · 묶음과 낱개", color: "var(--mint)",  play: () => qTens() },
  { ico: "🔍", name: "100판 숫자 찾기",   sub: "1~100 · 큰 수 찾기",  color: "var(--lilac)", play: () => qFind() },
];

// 이 단계를 처음 하는지 (처음이면 쉬운 범위 + 손가락 시범)
const firstTime = () => !settings.stars[G.stage];
const showDemo = target => { if (firstTime() && G.score === 0) setTimeout(() => demoHand(target), 400); };

// ---------- 공통 진행 ----------
function renderDots() {
  const d = $("dots");
  d.innerHTML = "";
  for (let i = 0; i < GOAL; i++) d.appendChild(el("i", i < G.score ? "done" : ""));
}
function ask(text, keys) {
  $("bubble").textContent = text;
  G.current.keys = keys;
  return say(keys).then(armIdle);
}

// 8초 동안 아무것도 안 누르면 "스피커를 누르면 다시 들을 수 있어!" (문제마다 한 번만)
let idleT = null;
function armIdle() {
  clearTimeout(idleT);
  const q = G.current;
  if (!q || q.idleDone) return;
  idleT = setTimeout(() => {
    if (G.current !== q || G.busy || !$("game").classList.contains("on")) return;
    q.idleDone = true;
    $("sayBtn").classList.add("glow");
    setTimeout(() => $("sayBtn").classList.remove("glow"), 3000);
    say(["btn_speaker"]);
  }, 8000);
}
$("game").addEventListener("pointerdown", () => { if (idleT) armIdle(); });

// 바로 앞 문제와 같은 답이 나오지 않게
function pickAnswer(fn) {
  let a;
  do { a = fn(); } while (a === G.lastAnswer);
  G.lastAnswer = a;
  return a;
}

function nextQuestion() {
  if (tired()) { goRest(); return; }
  G.busy = false;
  renderDots();
  paintDoll($("askDoll"));
  $("play").innerHTML = "";
  $("choices").innerHTML = "";
  $("choices").style.display = "";
  G.current = { misses: 0 };
  STAGES[G.stage].play();
}

// 틀렸을 때: 응원 → (2번째) 반짝 힌트 → (3번째) 같이 세기
function missed(firstKeys) {
  const q = G.current;
  q.misses++;
  sfx.wrong();
  if (q.misses >= 3 && q.together) { q.together(); return; }
  if (q.misses >= 2 && q.glow) {
    const g = q.glow();
    if (g) g.classList.add("glow");
    say([cheerKey(), "hint"]);
    return;
  }
  say(firstKeys || [cheerKey()]);
}

// 같이 세기: 요소들을 하나씩 반짝이며 세어 주기 (start부터)
async function countTogether(items, keyFor, start = 1) {
  G.busy = true;
  await say(["together"]);
  for (let i = 0; i < items.length; i++) {
    items[i].classList.add("counted");
    const tag = items[i].querySelector(".tag");
    if (tag) tag.textContent = start + i;
    await say([keyFor(start + i)]);
  }
  G.busy = false;
}
const glowAnswer = () => { const g = G.current.glow && G.current.glow(); if (g) g.classList.add("glow"); };

// 큰 보기 버튼 (숫자나 그림)
function choiceButtons(values, emoji = false) {
  const box = $("choices");
  box.style.setProperty("--n", values.length);
  values.forEach(v => {
    const b = el("button", "choice" + (emoji ? " emoji" : ""), v);
    b.dataset.v = v;
    b.onclick = () => {
      if (G.busy || b.classList.contains("wrong")) return;
      if (v === G.current.answer) { b.classList.add("right"); correct(); }
      else { b.classList.add("wrong"); missed(); }
    };
    box.appendChild(b);
  });
  G.current.glow = G.current.glow || (() => [...box.children].find(b => b.dataset.v === String(G.current.answer)));
}

async function correct() {
  G.busy = true;
  stopSay();
  G.score++;
  renderDots();
  sfx.right();
  const pi = praiseIndex();
  $("cheerSay").textContent = PRAISE_TEXT[pi];
  $("cheerBig").textContent = G.current.show != null ? G.current.show : G.current.answer;
  paintDoll($("cheerDoll"));
  $("overlay").classList.add("on");
  confetti();
  const started = Date.now();
  await sleep(350);
  await say(["praise" + pi, G.current.answerKey]);
  await sleep(Math.max(300, 2200 - (Date.now() - started)));
  $("overlay").classList.remove("on");
  if (G.score >= GOAL) finishStage(); else nextQuestion();
}

// ---------- 1단계: 반짝 몇 개? (1~5, 세지 않고 바로 알기) ----------
function qSubitize() {
  const n = pickAnswer(() => rand(1, 5));
  Object.assign(G.current, { answer: n, answerKey: "g" + n });
  const color = pick(["var(--pink)", "var(--sky)", "var(--mint)", "var(--peach)"]);
  const dice = el("button", "dice");
  dice.setAttribute("aria-label", "다시 보기");
  const pips = [];
  for (let i = 0; i < 9; i++) {
    const on = L.DICE[n].includes(i);
    const p = el("i", on ? "on" : "");
    p.style.background = color;
    if (on) pips.push(p);
    dice.appendChild(p);
  }
  const cover = el("div", "cover", "👀");
  dice.appendChild(cover);
  let peekT = null;
  const peek = ms => { clearTimeout(peekT); cover.hidden = true; peekT = setTimeout(() => { cover.hidden = false; }, ms); };
  dice.onclick = () => { if (!G.busy && !G.current.reveal) { sfx.tap(); peek(1200); } };
  $("play").appendChild(dice);
  choiceButtons(L.nearChoices(n, range(1, 5)));
  // 가린 채 "잘 봐!" → 점 2초 → 다시 가리고 "몇 개였을까?"
  const q = G.current;
  q.replay = async () => {
    G.busy = true;
    clearTimeout(peekT);
    cover.textContent = "👀";
    cover.hidden = false;
    $("bubble").textContent = "잘 봐!";
    await say(["sub1"]);
    if (G.current !== q) return;
    cover.hidden = true;
    await sleep(2000);
    if (G.current !== q) return;
    cover.textContent = "?";
    cover.hidden = false;
    G.busy = false;
    $("bubble").textContent = "몇 개였을까?";
    say(["sub2"]).then(armIdle);
  };
  q.replay();
  q.together = async () => {
    q.reveal = true; clearTimeout(peekT); cover.hidden = true;
    await countTogether(pips, k => "c" + k);
    glowAnswer();
  };
}

// ---------- 2단계: 인형이랑 세기 (1~10) ----------
function countDoll(i, onCount) {
  const k = el("button", "kk", `<span class="tag"></span>`);
  k.setAttribute("aria-label", dollName());
  paintDoll(k, i);
  k.onclick = () => {
    if (G.busy || k.classList.contains("counted")) return;
    k.classList.add("counted");
    k.querySelector(".tag").textContent = onCount();
    sfx.tap();
  };
  return k;
}
function qCount() {
  const n = pickAnswer(() => rand(1, 10));
  Object.assign(G.current, { answer: n, answerKey: "m" + n });
  const flock = el("div", "flock " + (n <= 3 ? "big" : n <= 6 ? "mid" : "sm"));
  let counted = 0;
  const items = range(0, n - 1).map(i => countDoll(i, () => { counted++; say(["c" + counted]); return counted; }));
  flock.append(...items);
  $("play").appendChild(flock);
  ask(`${josa(dollName(), "이", "가")} 몇 마리일까?`, ["q1"]);
  choiceButtons(L.nearChoices(n, range(1, 10)));
  showDemo(items[0]);
  G.current.together = async () => {
    items.forEach(k => k.classList.remove("counted"));
    await countTogether(items, k => "c" + k);
    glowAnswer();
  };
}

// ---------- 3단계: 풍선 터뜨리기 (처음 1~10, 한 번 끝내면 1~20) ----------
function qBalloon() {
  const maxN = firstTime() ? 10 : 20;
  const n = pickAnswer(() => rand(1, maxN));
  Object.assign(G.current, { answer: n, answerKey: "n" + n });
  $("choices").style.display = "none";
  const sky = el("div", "sky");
  const nums = shuffle([n, ...shuffle(L.nearChoices(n, range(1, maxN), 5).filter(x => x !== n)).slice(0, 3)]);
  const colors = shuffle(["#ff8fb1", "#5aa9f5", "#4fc9a4", "#ff9f6b", "#a685f5"]);
  const heights = shuffle(range(0, nums.length - 1)); // 풍선 높이를 섞어서 시작
  let target = null;
  nums.forEach((v, i) => {
    const b = el("button", "balloon", v);
    const color = colors[i % colors.length];
    // 하늘 너비 안에 고르게 (풍선 너비 92px가 오른쪽 밖으로 나가지 않게)
    b.style.left = `calc((100% - 100px) * ${i / (nums.length - 1)} + ${rand(2, 6)}px)`;
    b.style.background = color;
    const dur = rand(13, 16);
    b.style.animationDuration = dur + "s";
    b.style.animationDelay = `-${((heights[i] + 0.5) * dur / nums.length * 0.8).toFixed(1)}s`;
    b.onclick = () => {
      if (G.busy) return;
      if (v !== n) { b.classList.add("wrong"); setTimeout(() => b.classList.remove("wrong"), 600); missed(); return; }
      G.busy = true;
      sfx.pop();
      burst(sky, b, color);
      b.classList.add("pop");
      setTimeout(correct, 500);
    };
    if (v === n) target = b;
    sky.appendChild(b);
  });
  $("play").appendChild(sky);
  ask(`${n} 풍선을 찾아서 터뜨려!`, ["n" + n, "balloon"]);
  // 힌트: 정답 풍선이 가운데로 와서 멈춘 채 반짝반짝
  const hintTarget = () => { target.classList.remove("wrong"); target.classList.add("glow", "hinted"); };
  G.current.glow = () => { hintTarget(); return null; };
  G.current.together = () => { hintTarget(); say(["hint", "n" + n]); };
}

// ---------- 4단계: 어느 쪽이 많아? ----------
function qCompare() {
  let a, b;
  do { a = rand(1, 10); b = rand(1, 10); } while (a === b || Math.abs(a - b) > 5);
  const askMore = Math.random() < 0.7;
  const win = askMore ? (a > b ? 0 : 1) : (a < b ? 0 : 1);
  Object.assign(G.current, { answer: win, show: askMore ? "많아요!" : "적어요!", answerKey: null });
  $("choices").style.display = "none";
  const thing = pick(["🍓", "🐟", "🍪", "🌸", "⭐", "🍬"]);
  const box = el("div", "compare");
  // 두 접시의 그림 크기는 항상 같게 (많은 쪽 개수에 맞춤), 줄 맞춰 놓기
  const most = Math.max(a, b);
  const sz = most <= 3 ? 58 : most <= 6 ? 48 : 40;
  const cols = most <= 3 ? 2 : 3;
  const sides = [a, b].map((cnt, i) => {
    const s = el("button", "side", `<span>${thing}</span>`.repeat(cnt));
    s.style.setProperty("--sz", sz + "px");
    s.style.gridTemplateColumns = `repeat(${Math.min(cols, cnt)}, ${sz}px)`;
    s.setAttribute("aria-label", `${i === 0 ? "왼쪽" : "오른쪽"} 접시`);
    s.onclick = () => {
      if (G.busy || s.classList.contains("wrong")) return;
      if (i === win) { s.classList.add("right"); correct(); return; }
      s.classList.add("wrong");
      setTimeout(() => s.classList.remove("wrong"), 600);
      missed();
    };
    box.appendChild(s);
    return s;
  });
  $("play").appendChild(box);
  ask(askMore ? "어느 쪽이 더 많을까?" : "어느 쪽이 더 적을까?", [askMore ? "more" : "less"]);
  G.current.glow = () => sides[win];
  G.current.together = async () => {
    G.busy = true;
    await say(["together", "g" + a]);
    await say(["g" + b]);
    sides[win].classList.add("glow");
    G.busy = false;
  };
}

// ---------- 5단계: 무늬 잇기 (뒤의 문제는 3가지 무늬) ----------
function qPattern() {
  const p = pickAnswer(() => L.makePattern(G.score >= 3));
  Object.assign(G.current, { answer: p.answer, answerKey: null });
  const row = el("div", "pattern");
  const cells = p.seq.map(s => el("span", "", s));
  const blank = el("span", "blank", "?");
  row.append(...cells, blank);
  $("play").appendChild(row);
  ask("다음에는 무엇이 올까?", ["pattern"]);
  choiceButtons(p.options, true);
  // 같이 보기: 반복되는 묶음마다 색을 칠해서 보여 주기
  G.current.together = async () => {
    G.busy = true;
    cells.forEach((c, i) => c.classList.add(Math.floor(i / p.unitLen) % 2 ? "unit-b" : "unit-a"));
    await say(["pat_hint"]);
    G.busy = false;
    glowAnswer();
  };
}

// ---------- 6단계: 바구니 더하기·빼기 (그림을 보며 세어서 풀기) ----------
// 이야기는 녹음 조각을 이어서 들려줘요: "바구니에 딸기가 있어요." + "네 개!" + "더 넣어요!" ...
const FRUITS = [
  ["🍎", "사과", "add_apple"], ["🍓", "딸기", "add_strawberry"], ["🍊", "귤", "add_tangerine"],
  ["🥕", "당근", "add_carrot"], ["🍪", "쿠키", "add_cookie"],
];
function tokenRow(cls, emoji, count) {
  return range(1, count).map(() => {
    const s = el("span", cls, emoji);
    s.setAttribute("aria-hidden", "true");
    return s;
  });
}
// 그림을 누르면 하나씩 세어 줘요
function makeCountable(items) {
  let counted = 0;
  items.forEach(s => s.addEventListener("click", () => {
    if (G.busy || s.classList.contains("counted") || s.classList.contains("gone")) return;
    s.classList.add("counted");
    counted++;
    sfx.tap();
    say(["c" + Math.min(counted, 20)]);
  }));
}
function qStory() {
  const kinds = G.score < 2 ? ["add", "sub"] : ["add", "sub", "split"];
  let s;
  do { s = L.makeStory(pick(kinds)); } while (s.answer === G.lastAnswer);
  G.lastAnswer = s.answer;
  Object.assign(G.current, { answer: s.answer, answerKey: (s.kind === "sub" ? "m" : "g") + s.answer });
  choiceButtons(L.nearChoices(s.answer, range(1, 10)));
  if (s.kind === "add") storyAdd(s);
  else if (s.kind === "sub") storySub(s);
  else storySplit(s);
}
// 이야기를 다 들려준 뒤에는 질문만 말하고, 🔊을 누르면 이야기 전체를 다시 들려줘요
function askAfterStory(text, questionKey, storyKeys) {
  $("bubble").textContent = text;
  G.current.keys = [...storyKeys, questionKey];
  say([questionKey]).then(armIdle);
}
// 그림을 하나씩 바구니에 넣거나(drop) 연못에서 뛰어가게(hop) 하기
async function animateEach(items, q, step, gap) {
  for (const t of items) {
    if (G.current !== q) return;
    step(t);
    await sleep(gap);
  }
}
async function storyAdd(s) {
  const [emoji, word, key] = pick(FRUITS);
  const basket = el("div", "basket");
  const first = tokenRow("", emoji, s.a);
  basket.append(...first);
  $("play").appendChild(basket);
  const q = G.current;
  G.busy = true;
  $("bubble").textContent = `바구니에 ${josa(word, "이", "가")} ${s.a}개 있어요. ${s.b}개 더 넣어요!`;
  await say([key, "g" + s.a]);
  if (G.current !== q) return;
  const more = tokenRow("drop", emoji, s.b);
  const drop = t => { basket.appendChild(t); sfx.drop(); };
  await Promise.all([say(["add_more", "g" + s.b]), animateEach(more, q, drop, 380)]);
  if (G.current !== q) return;
  G.busy = false;
  const all = [...first, ...more];
  makeCountable(all);
  askAfterStory("모두 몇 개일까?", "add_q", [key, "g" + s.a, "add_more", "g" + s.b]);
  q.together = async () => {
    all.forEach(t => t.classList.remove("counted"));
    await countTogether(all, k => "c" + k);
    glowAnswer();
  };
}
async function storySub(s) {
  const pond = el("div", "basket");
  pond.style.borderBottomColor = "#7fd8be";
  const frogs = tokenRow("", "🐸", s.a);
  pond.append(...frogs);
  $("play").appendChild(pond);
  const q = G.current;
  G.busy = true;
  $("bubble").textContent = `연못에 개구리가 ${s.a}마리 있어요. 퐁당! ${s.b}마리가 뛰어갔어요.`;
  await say(["sub_start", "m" + s.a]);
  if (G.current !== q) return;
  const hop = f => { f.classList.add("gone"); sfx.hop(); };
  await Promise.all([say(["sub_jump", "m" + s.b]), animateEach(frogs.slice(-s.b), q, hop, 420)]);
  if (G.current !== q) return;
  G.busy = false;
  const left = frogs.slice(0, s.a - s.b);
  makeCountable(left);
  askAfterStory("몇 마리 남았을까?", "sub_q", ["sub_start", "m" + s.a, "sub_jump", "m" + s.b]);
  q.together = async () => {
    left.forEach(t => t.classList.remove("counted"));
    await countTogether(left, k => "c" + k);
    glowAnswer();
  };
}
function storySplit(s) {
  const [emoji] = pick(FRUITS);
  const total = el("div", "total-row");
  total.append(...tokenRow("", emoji, s.total));
  const two = el("div", "baskets2");
  const left = el("div", "basket");
  left.append(...tokenRow("", emoji, s.a));
  const right = el("div", "basket");
  const hidden = tokenRow("", emoji, s.answer);
  right.append(...hidden);
  const cover = el("div", "cover", "?");
  right.appendChild(cover);
  two.append(left, right);
  $("play").append(total, two);
  ask(`모두 합하면 ${s.total}개! 이쪽 접시에는 ${s.a}개! 저쪽 접시에는 몇 개 있을까?`,
    ["split_all", "g" + s.total, "split_here", "g" + s.a, "split_q"]);
  G.current.together = async () => {
    cover.hidden = true;
    await countTogether(hidden, k => "c" + k);
    glowAnswer();
  };
}

// ---------- 7단계: 10개씩 묶기 (처음 11~30, 한 번 끝내면 11~100) ----------
function bundle(color, onCount) {
  const b = el("button", "bundle");
  b.setAttribute("aria-label", "10개 묶음");
  for (let i = 0; i < 10; i++) { const d = el("i"); d.style.background = color; b.appendChild(d); }
  const tag = el("span", "ten", "10");
  b.appendChild(tag);
  b.onclick = () => {
    if (G.busy || b.classList.contains("counted")) return;
    b.classList.add("counted");
    sfx.tap();
    tag.textContent = onCount();
  };
  return b;
}
function qTens() {
  const maxN = firstTime() ? 30 : 100;
  const n = pickAnswer(() => rand(11, maxN));
  const tens = Math.floor(n / 10), ones = n % 10;
  Object.assign(G.current, { answer: n, answerKey: "n" + n });
  const color = pick(["#ff8fb1", "#5aa9f5", "#4fc9a4", "#ff9f6b", "#a685f5"]);
  let counted = 0;
  const count = step => { counted = Math.min(100, counted + step); say(["n" + counted]); return counted; };
  const bundles = range(1, tens).map(() => bundle(color, () => count(10)));
  const loose = range(0, ones - 1).map(i => countDoll(i, () => count(1)));
  const area = el("div", "bundle-area");
  const grid = el("div", "bundles");
  grid.append(...bundles);
  area.appendChild(grid);
  if (loose.length) { const box = el("div", "loose"); box.append(...loose); area.appendChild(box); }
  $("play").appendChild(area);
  ask("10개 묶음부터 세어 볼까? 모두 몇일까?", ["q3"]);
  choiceButtons(L.tensChoices(n));
  showDemo(bundles[0]);
  G.current.together = async () => {
    G.busy = true;
    await say(["together"]);
    for (let i = 0; i < bundles.length; i++) {
      bundles[i].classList.add("counted");
      bundles[i].querySelector(".ten").textContent = (i + 1) * 10;
      await say(["n" + (i + 1) * 10]);
    }
    for (let i = 0; i < loose.length; i++) {
      loose[i].classList.add("counted");
      loose[i].querySelector(".tag").textContent = tens * 10 + i + 1;
      await say(["n" + (tens * 10 + i + 1)]);
    }
    G.busy = false;
    glowAnswer();
  };
}

// ---------- 8단계: 100판 숫자 찾기 (처음 1~50, 한 번 끝내면 1~100) ----------
function qFind() {
  const maxN = firstTime() ? 50 : 100;
  const n = pickAnswer(() => rand(1, maxN));
  const rowNo = L.rowOf(n);
  Object.assign(G.current, { answer: n, answerKey: "n" + n });
  $("choices").style.display = "none";
  const card = el("div", "target-card", n);
  const area = el("div", "rows");
  $("play").append(card, area);
  ask(`${numJosa(n, "을", "를")} 찾아봐! 어느 줄에 있을까?`, ["n" + n, "row"]);

  const wrongTap = b => { b.classList.add("wrong"); setTimeout(() => b.classList.remove("wrong"), 600); missed(); };
  const rowBtns = range(0, maxN / 10 - 1).map(r => {
    const b = el("button", "", `${r * 10 + 1} ~ ${r * 10 + 10}`);
    b.onclick = () => {
      if (G.busy) return;
      if (r === rowNo) { sfx.tap(); stepTwo(); } else wrongTap(b);
    };
    area.appendChild(b);
    return b;
  });
  G.current.glow = () => rowBtns[rowNo];
  G.current.together = () => { rowBtns[rowNo].classList.add("glow"); say(["hint"]); };

  function stepTwo() {
    G.current.misses = 0;
    $("bubble").textContent = `${numJosa(n, "을", "를")} 찾아봐!`;
    area.className = "nums";
    area.innerHTML = "";
    const btns = range(rowNo * 10 + 1, rowNo * 10 + 10).map(v => {
      const b = el("button", "", v);
      b.onclick = () => {
        if (G.busy) return;
        if (v === n) { b.classList.add("right"); correct(); } else wrongTap(b);
      };
      area.appendChild(b);
      return b;
    });
    const target = btns[(n - 1) % 10];
    G.current.glow = () => target;
    G.current.together = () => { target.classList.add("glow"); say(["hint", "n" + n]); };
    G.current.keys = ["n" + n, "q4"];
    say(G.current.keys);
  }
}
