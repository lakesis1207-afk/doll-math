// 실행: node --test tests/logic.test.js
const test = require("node:test");
const assert = require("node:assert");
const L = require("../js/logic.js");

const REPEAT = 300; // 무작위 문제라서 여러 번 만들어 보고 확인

test("shuffle은 원래 배열을 바꾸지 않고 같은 값들을 돌려준다", () => {
  const src = [1, 2, 3, 4, 5];
  const out = L.shuffle(src);
  assert.deepStrictEqual(src, [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(out.slice().sort(), [1, 2, 3, 4, 5]);
});

test("range는 처음과 끝을 포함한다", () => {
  assert.deepStrictEqual(L.range(3, 6), [3, 4, 5, 6]);
  assert.deepStrictEqual(L.range(5, 4), []);
});

test("받침에 맞는 조사를 붙인다", () => {
  assert.strictEqual(L.josa("토토", "이", "가"), "토토가");
  assert.strictEqual(L.josa("곰돌", "이", "가"), "곰돌이");
  assert.strictEqual(L.josa("Teddy", "이", "가"), "Teddy가");
  assert.strictEqual(L.numJosa(3, "을", "를"), "3을");
  assert.strictEqual(L.numJosa(2, "을", "를"), "2를");
  assert.strictEqual(L.numJosa(100, "을", "를"), "100을");
  assert.strictEqual(L.sinoWord(57), "오십칠");
});

test("nearChoices는 정답을 포함한 서로 다른 보기 3개를 준다", () => {
  for (let i = 0; i < REPEAT; i++) {
    const ans = L.rand(1, 10);
    const ch = L.nearChoices(ans, L.range(1, 10));
    assert.strictEqual(ch.length, 3);
    assert.ok(ch.includes(ans));
    assert.strictEqual(new Set(ch).size, 3);
    ch.forEach(v => assert.ok(v >= 1 && v <= 10));
  }
});

test("tensChoices는 11~100 안에서 정답과 10차이·1차이 보기를 준다", () => {
  for (let n = 11; n <= 100; n++) {
    const ch = L.tensChoices(n);
    assert.strictEqual(ch.length, 3, `n=${n}`);
    assert.ok(ch.includes(n));
    assert.strictEqual(new Set(ch).size, 3);
    ch.forEach(v => assert.ok(v >= 11 && v <= 100 && [0, 1, 10].includes(Math.abs(v - n))));
  }
});

test("makePattern은 규칙을 2번 이상 보여 주고 맞는 다음 것을 정답으로 한다", () => {
  for (let i = 0; i < REPEAT; i++) {
    const p = L.makePattern(i % 2 === 0);
    assert.ok(p.seq.length >= p.unitLen * 2);
    assert.strictEqual(p.answer, p.seq[p.seq.length - p.unitLen]);
    assert.ok(p.options.includes(p.answer));
    assert.strictEqual(p.options.length, 3);
  }
});

test("makeStory는 10 이하의 맞는 답을 만든다", () => {
  for (let i = 0; i < REPEAT; i++) {
    const add = L.makeStory("add");
    assert.strictEqual(add.answer, add.a + add.b);
    assert.ok(add.answer <= 10 && add.b >= 1);
    const sub = L.makeStory("sub");
    assert.strictEqual(sub.answer, sub.a - sub.b);
    assert.ok(sub.answer >= 1 && sub.a <= 10);
    const sp = L.makeStory("split");
    assert.strictEqual(sp.a + sp.answer, sp.total);
    assert.ok(sp.a >= 1 && sp.answer >= 1 && sp.total <= 6);
  }
});

test("rowOf는 1~100을 0~9 줄로 나눈다", () => {
  assert.strictEqual(L.rowOf(1), 0);
  assert.strictEqual(L.rowOf(10), 0);
  assert.strictEqual(L.rowOf(11), 1);
  assert.strictEqual(L.rowOf(100), 9);
});
