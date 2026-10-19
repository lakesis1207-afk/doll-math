// 화면과 상관없는 계산 도우미 (문제 만들기, 보기 고르기, 받침 확인)
// 브라우저에서는 window.Logic 으로, 테스트(node)에서는 require 로 써요.
(function (root) {
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[rand(0, arr.length - 1)];
  // 원래 배열은 그대로 두고 섞은 새 배열을 돌려줘요
  const shuffle = arr => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = rand(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

  // 받침이 있으면 true (영어 이름 등은 받침 없음으로 봄)
  function hasBatchim(word) {
    const w = String(word || "");
    const c = w.charCodeAt(w.length - 1) - 0xac00;
    return c >= 0 && c <= 11171 && c % 28 !== 0;
  }
  const josa = (word, withB, withoutB) => word + (hasBatchim(word) ? withB : withoutB);
  // 숫자를 읽는 말: 57 → 오십칠 (받침 확인용)
  const SINO = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const sinoWord = n => n === 0 ? "영" : n === 100 ? "백"
    : (n >= 10 ? (n >= 20 ? SINO[Math.floor(n / 10)] : "") + "십" : "") + SINO[n % 10];
  const numJosa = (n, withB, withoutB) => n + (hasBatchim(sinoWord(n)) ? withB : withoutB);

  // 정답 + 가까운 수 2개 (모두 3개, 순서 섞음)
  function nearChoices(answer, pool, count = 3) {
    const near = pool.filter(n => n !== answer)
      .sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
    return shuffle([answer, ...shuffle(near.slice(0, 4)).slice(0, count - 1)]);
  }

  // 10묶음 문제용 보기: 10 차이(묶음 실수)와 1 차이(낱개 실수)를 섞어요
  function tensChoices(n, min = 11, max = 100) {
    const cands = [n - 10, n + 10, n - 1, n + 1].filter(v => v >= min && v <= max && v !== n);
    const tens = shuffle(cands.filter(v => Math.abs(v - n) === 10));
    const ones = shuffle(cands.filter(v => Math.abs(v - n) === 1));
    const picked = [tens[0], ones[0], tens[1], ones[1]].filter(v => v != null).slice(0, 2);
    return shuffle([n, ...picked]);
  }

  // 무늬 잇기: 반복 규칙을 2번 이상 보여 주고 다음 것을 물어요
  const PATTERN_SETS = [
    ["🍎", "🍌", "🍇"], ["🔴", "🔵", "🟡"], ["🐶", "🐱", "🐰"],
    ["⭐", "🌙", "☁️"], ["🚗", "🚲", "🚌"], ["🌸", "🍀", "🍄"],
  ];
  const UNITS_EASY = [[0, 1], [0, 0, 1], [0, 1, 1]];
  const UNITS_HARD = [[0, 1, 2], [0, 1], [0, 0, 1]];
  function makePattern(hard = false) {
    const set = pick(PATTERN_SETS);
    const unit = pick(hard ? UNITS_HARD : UNITS_EASY).map(i => set[i]);
    const shownLen = unit.length * 2 + rand(0, unit.length - 1);
    const seq = range(0, shownLen - 1).map(i => unit[i % unit.length]);
    const answer = unit[shownLen % unit.length];
    return { seq, answer, unitLen: unit.length, options: shuffle(set) };
  }

  // 바구니 이야기 문제 (10 이하): 더하기, 빼기, 가르기
  function makeStory(kind) {
    if (kind === "add") {
      const a = rand(1, 6), b = rand(1, Math.min(4, 10 - a));
      return { kind, a, b, answer: a + b };
    }
    if (kind === "sub") {
      const a = rand(3, 10), b = rand(1, Math.min(4, a - 1));
      return { kind, a, b, answer: a - b };
    }
    const total = rand(3, 6), a = rand(1, total - 1);
    return { kind: "split", a, b: total - a, total, answer: total - a };
  }

  // 1~100 판에서 몇 번째 줄인지 (0~9)
  const rowOf = n => Math.floor((n - 1) / 10);

  // 주사위 점 자리 (3×3 칸 번호)
  const DICE = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8] };

  // ---------- 인형 이름 (등록을 건너뛰면 하나 골라 줌) ----------
  const DOLL_NAMES = ["토토", "몽이", "콩이", "보리", "뽀미", "꼬미", "단추", "호두"];
  const randomDollName = (rnd = Math.random) => DOLL_NAMES[Math.floor(rnd() * DOLL_NAMES.length) % DOLL_NAMES.length];

  // ---------- 휴대폰 뒤로가기: 지금 화면에서 어디로 갈지 ----------
  // "home" | "intro" | "photos" | "exit"(한 번 더 누르면 나가기) | "stay"(아무것도 안 함)
  function backTarget(screen, { setup, overlay }) {
    if (overlay) return "stay";
    if (screen === "game" || screen === "clear" || screen === "stickers") return "home";
    if (screen === "intro") return setup ? "home" : "exit";
    if (screen === "photos") return setup ? "home" : "intro";
    if (screen === "naming") return "photos";
    return "exit"; // 처음 화면, 쉬는 시간
  }

  // ---------- 이어 하기: 오늘 저장한 진도만 이어서 ----------
  function resumeScore(progress, stage, today) {
    if (!progress || progress.stage !== stage || progress.date !== today) return 0;
    return progress.score > 0 ? progress.score : 0;
  }

  const Logic = {
    rand, pick, shuffle, range, hasBatchim, josa, sinoWord, numJosa,
    nearChoices, tensChoices, makePattern, makeStory, rowOf, DICE, PATTERN_SETS,
    DOLL_NAMES, randomDollName, backTarget, resumeScore,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
  else root.Logic = Logic;
})(this);
