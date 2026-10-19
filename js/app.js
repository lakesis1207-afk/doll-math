// 화면 이동: 설명 → 인형 등록 → 처음 화면 → 놀이 → 단계 끝 / 스티커 / 쉬기
function show(id) {
  if (id !== "game") pauseClock();
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  window.scrollTo(0, 0);
}
function goHome(withVoice) {
  stopSay();
  renderHome();
  show("home");
  if (withVoice) say(["btn_home"]);
}

// ---------- 1. 설명 화면 ----------
STAGES.forEach((s, i) => {
  const lv = $("introStages");
  lv.appendChild(el("b", "", i + 1)).style.background = s.color;
  lv.appendChild(el("span", "", `${s.ico} ${s.name} <small>${s.sub}</small>`));
});
$("introNext").onclick = () => {
  if (settings.setup) goHome(false);
  else { renderSlots(); show("photos"); }
};
$("helpBtn").onclick = () => { $("introNext").textContent = "닫기"; show("intro"); };

// ---------- 2. 사진 찍기 ----------
let slotTarget = 0;
function photoSlot(i) {
  const p = photos[i];
  const s = el("button", "slot" + (p ? " filled" : ""));
  if (!p) {
    s.innerHTML = `<span><span class="plus">＋</span>사진 ${i + 1}</span>`;
  } else {
    s.style.backgroundImage = `url("${p.url}")`;
    s.setAttribute("aria-label", `사진 ${i + 1} 바꾸기`);
    const d = el("span", "del", "✕");
    d.setAttribute("role", "button");
    d.setAttribute("aria-label", `사진 ${i + 1} 지우기`);
    d.onclick = async e => {
      e.stopPropagation();
      URL.revokeObjectURL(p.url);
      photos[i] = null;
      await store.del("photo" + i);
      renderSlots();
    };
    s.appendChild(d);
  }
  s.onclick = () => { slotTarget = i; $("photoInput").click(); };
  return s;
}
function renderSlots() {
  const box = $("slots");
  box.innerHTML = "";
  for (let i = 0; i < MAX_PHOTOS; i++) box.appendChild(photoSlot(i));
  $("photosNext").disabled = !photoUrls().length;
}
$("photoInput").onchange = async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file) return;
  $("slots").children[slotTarget].classList.add("busy");
  try {
    const blob = await shrinkPhoto(file);
    if (photos[slotTarget]) URL.revokeObjectURL(photos[slotTarget].url);
    photos[slotTarget] = { blob, url: URL.createObjectURL(blob) };
    await store.set("photo" + slotTarget, blob);
    $("photoNotice").textContent = "";
  } catch (err) {
    $("photoNotice").textContent = "사진을 불러오지 못했어요. 다른 사진으로 다시 해 주세요.";
  }
  renderSlots();
};
$("photosNext").onclick = () => goNaming();
$("photosSkip").onclick = () => goNaming();

// ---------- 3. 이름 정하기 ----------
function goNaming() {
  paintDoll($("namePhoto"), 0);
  $("nameInput").value = settings.name || "";
  updateNamePreview();
  show("naming");
}
function updateNamePreview() {
  const n = $("nameInput").value.trim();
  $("nameSay").textContent = n ? `${josa(n, "이랑", "랑")} 수학 놀이!` : "";
  $("nameNext").disabled = !n;
}
$("nameInput").addEventListener("input", updateNamePreview);
$("nameInput").addEventListener("keydown", e => { if (e.key === "Enter" && !$("nameNext").disabled) $("nameNext").click(); });
$("nameNext").onclick = () => {
  settings.name = $("nameInput").value.trim();
  settings.setup = true;
  saveSettings();
  $("nameInput").blur();
  goHome(true);
};

// ---------- 4. 처음 화면 ----------
let parentMode = false;
function stageTile(s, i) {
  const open = parentMode || i < settings.unlocked;
  const b = el("button", "tile" + (open ? "" : " locked"));
  const stars = settings.stars[i] || 0;
  b.innerHTML = `
    <span class="no" style="background:${s.color}">${open ? i + 1 : "🔒"}</span>
    <span class="stars">${stars ? "⭐".repeat(Math.min(stars, 3)) : ""}</span>
    <span class="ico">${s.ico}</span>
    <b>${s.name}</b><small>${s.sub}</small>`;
  b.onclick = () => {
    if (!open) { sfx.wrong(); say(["locked"]); return; }
    sfx.tap();
    startStage(i);
  };
  return b;
}
function renderHome() {
  $("introNext").textContent = "인형 등록하기 ▶";
  paintDoll($("heroPhoto"));
  $("homeTitle").textContent = `${josa(dollName(), "이랑", "랑")} 수학 놀이`;
  $("restToggle").textContent = `10분 쉬기: ${settings.restOn ? "켜짐" : "꺼짐"}`;
  const box = $("stages");
  box.innerHTML = "";
  STAGES.forEach((s, i) => box.appendChild(stageTile(s, i)));
  // 아직 한 번도 안 했으면 1단계를 손가락으로 가리켜요
  if (settings.stars.every(n => !n)) setTimeout(() => { if ($("home").classList.contains("on")) demoHand(box.firstChild); }, 700);
}
$("heroPhoto").onclick = () => {
  sfx.tap();
  paintDoll($("heroPhoto"));
  say(["hello_math", "btn_home"]);
};

holdButton($("parentHold"), () => {
  parentMode = true;
  $("parentPanel").classList.add("on");
  $("parentHold").style.display = "none";
  renderHome();
});
function closeParent() {
  parentMode = false;
  $("parentPanel").classList.remove("on");
  $("parentHold").style.display = "";
  renderHome();
}
$("editDoll").onclick = () => { closeParent(); renderSlots(); show("photos"); };
$("restToggle").onclick = () => { settings.restOn = !settings.restOn; saveSettings(); renderHome(); };
$("openAll").onclick = () => { settings.unlocked = STAGES.length; saveSettings(); closeParent(); };
$("resetAll").onclick = () => {
  const b = $("resetAll");
  if (!b.dataset.sure) {
    b.dataset.sure = "1";
    b.textContent = "정말요? 한 번 더 누르기";
    setTimeout(() => { delete b.dataset.sure; b.textContent = "처음부터 다시"; }, 3000);
    return;
  }
  delete b.dataset.sure;
  b.textContent = "처음부터 다시";
  Object.assign(settings, { unlocked: 1, stars: new Array(STAGES.length).fill(0), stickers: [] });
  saveSettings();
  closeParent();
};
$("closeParent").onclick = closeParent;

// ---------- 스티커 모음책 ----------
$("bookBtn").onclick = () => {
  const book = $("book");
  book.innerHTML = "";
  STICKERS.forEach(s => {
    const have = settings.stickers.includes(s);
    book.appendChild(el("div", have ? "" : "empty", have ? s : "?"));
  });
  $("bookCount").textContent = `${settings.stickers.length} / ${STICKERS.length}장 모았어요`;
  show("stickers");
};
$("bookBack").onclick = () => goHome(true);

// ---------- 쉬는 시간 ----------
function goRest() {
  show("rest");
  paintDoll($("restDoll"));
  $("restTitle").textContent = `${josa(dollName(), "이", "가")} 졸려요`;
  say(["sleepy"]);
}
holdButton($("restHold"), () => {
  settings.playedMs = 0;
  saveSettings();
  goHome(false);
});

// ---------- 놀이 시작 / 끝 ----------
function startStage(i) {
  Object.assign(G, { stage: i, score: 0, lastAnswer: null });
  if (settings.playDate !== today()) { settings.playDate = today(); settings.playedMs = 0; }
  if (tired()) { goRest(); return; }
  show("game");
  startClock();
  nextQuestion();
}

function finishStage() {
  const stage = G.stage;
  const isLast = stage === STAGES.length - 1;
  const opened = !isLast && settings.unlocked < stage + 2;
  // 아직 없는 스티커 하나 받기
  const left = STICKERS.filter(s => !settings.stickers.includes(s));
  const got = left.length ? pick(left) : null;
  Object.assign(settings, {
    stars: settings.stars.map((n, i) => i === stage ? (n || 0) + 1 : n),
    unlocked: opened ? stage + 2 : settings.unlocked,
    stickers: got ? [...settings.stickers, got] : settings.stickers,
  });
  saveSettings();
  show("clear");
  const st = $("newSticker");
  st.textContent = got || "⭐";
  st.style.animation = "none"; void st.offsetWidth; st.style.animation = "";
  $("clearTitle").textContent = `${STAGES[stage].name} 다 했다!`;
  $("clearSub").textContent = (got ? "새 스티커를 받았어요! " : "스티커를 모두 모았어요! ") + (opened ? `${stage + 2}단계가 열렸어요 🎉` : "");
  // 마지막 단계면 파란 버튼은 숨기되 자리는 그대로 (주황은 항상 왼쪽)
  $("nextBtn").style.visibility = isLast ? "hidden" : "";
  say(["clear", got ? "sticker" : null, opened ? "opened" : null, isLast ? "btn_last" : "btn_next"]);
  confetti();
}

// ---------- 버튼 ----------
$("sayBtn").onclick = () => {
  const q = G.current;
  if (!q || G.busy) return;
  if (q.replay) q.replay();
  else if (q.keys) say(q.keys);
};
$("backBtn").onclick = () => goHome(true);
$("homeBtn").onclick = () => goHome(true);
$("againBtn").onclick = () => { sfx.tap(); startStage(G.stage); };
$("nextBtn").onclick = () => { sfx.tap(); startStage(Math.min(G.stage + 1, STAGES.length - 1)); };
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { pauseClock(); stopSay(); }
  else if ($("game").classList.contains("on")) startClock();
});

// ---------- 시작 ----------
(async () => {
  for (let i = 0; i < MAX_PHOTOS; i++) {
    const b = await store.get("photo" + i);
    if (b) photos[i] = { blob: b, url: URL.createObjectURL(b) };
  }
  if (settings.setup) goHome(false);
  else show("intro");
})();

// 홈 화면 앱(PWA): 인터넷 없이도 열리게 파일을 저장해 둠
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* 저장 못 해도 인터넷으로는 열려요 */ });
}
