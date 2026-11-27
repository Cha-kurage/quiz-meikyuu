// メニュー (左上の三本線) と、音量の調節。
// - メニュー: 「音量の調節」「説明をもう一度見る」「閉じる」
// - 音量の調節: 天狗の鼻 (2026-11-27 ユーザーが描き直した絵。回さずに表示) の上のつまみを左右に動かす。左が小さく、右が大きい (0〜100)。
//   鼻の色は、小さいほど青、大きいほど赤 (間は紫)。開けるのはメニューからだけ。
//   16問目だけは、鼻が真っ赤 (音量 100) のときに鼻 (つまみ以外の所) をドラッグすると、鼻をパーツとして取り出せる (drag.js)。
//   鼻の左のベルは、ドラッグすると答えのパーツとして取り出せる (drag.js)。
// - 音量はこのブラウザに覚えておく (次に開いたときも同じ音量)。保存できない環境では毎回 7 から (最初の音量は 7。2026-11-27)。
// 開閉は "volume:opened" / "volume:closed"、音量の変更は "volume:changed" で知らせる (tutorial.js が使う)。

(() => {
  const menuBtn = document.getElementById("menu-btn");
  const menuPanel = document.getElementById("menu-panel");
  const volumePanel = document.getElementById("volume-panel");
  const track = document.getElementById("volume-track");
  const nose = document.getElementById("volume-nose");
  const knob = document.getElementById("volume-knob");
  const valueEl = document.getElementById("volume-value");

  // 覚えておく音量のキー。2026-11-27 に初期値を 7 に変えたので、前に覚えた音量 (旧キー quiz-meikyu.volume) は使わない
  const VOLUME_KEY = "quiz-meikyu.volume2";
  const DEFAULT_VOLUME = 7; // 最初の音量。つまみは鼻の細い付け根のあたり (2026-11-27 ユーザー指示)
  const KNOB_MIN = 0.07; // つまみが動ける範囲 (鼻の幅に対する割合)。鼻の両端は細いので少し内側まで
  const KNOB_MAX = 0.93;
  const BLUE_HUE_DEG = -120; // 赤 (0度) から色相を -120度 回すと青。間は紫を通る

  let volume = DEFAULT_VOLUME; // 0〜100
  const NOSE_TAKE_VOLUME = 100; // 16問目: 鼻が真っ赤 (音量 100) のときだけ、鼻を取り出せる (2026-11-20 ユーザー指示)

  // 鼻を取り出せるときは、鼻の上のカーソルを「掴める」にする
  function refreshNoseTakeable() {
    const replay = !!window.isTutorialReplay && isTutorialReplay(); // もう一度見ているチュートリアルの間も (tutorial.js)
    track.classList.toggle("nose-takeable", (replay || (!inTutorial() && currentQuestionIndex === FINAL_INDEX)) &&
      !isQuestionSolved(FINAL_INDEX) && volume >= NOSE_TAKE_VOLUME);
  }

  // ---- 音量 ----
  function applyVolume(v, { save = true } = {}) {
    volume = Math.round(Math.min(100, Math.max(0, v)));
    masterVolume = volume / 100; // sound.js
    const frac = volume / 100;
    knob.style.left = `${(KNOB_MIN + (KNOB_MAX - KNOB_MIN) * frac) * 100}%`;
    knob.setAttribute("aria-valuenow", String(volume));
    valueEl.textContent = String(volume);
    // 小さいほど青、大きいほど赤 (鼻はもともと赤いので、色相を回して青に寄せる)
    nose.style.filter = `hue-rotate(${BLUE_HUE_DEG * (1 - frac)}deg) saturate(${1 + 0.4 * (1 - frac)})`;
    refreshNoseTakeable();
    if (save) {
      try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch (_) { /* 保存できなくても動く */ }
    }
  }

  let saved = null;
  try { saved = localStorage.getItem(VOLUME_KEY); } catch (_) { saved = null; }
  applyVolume(saved !== null && saved !== "" && !Number.isNaN(Number(saved)) ? Number(saved) : DEFAULT_VOLUME, { save: false });

  // つまみ: 鼻の上を左右にドラッグ。鼻のどこかを押すと、そこへつまみが飛ぶ
  let dragging = null; // pointerId
  function volumeFromPointer(e) {
    const r = track.getBoundingClientRect();
    const frac = ((e.clientX - r.left) / r.width - KNOB_MIN) / (KNOB_MAX - KNOB_MIN);
    return Math.min(1, Math.max(0, frac)) * 100;
  }
  track.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = e.pointerId;
    try { track.setPointerCapture(e.pointerId); } catch (_) { /* 無くても動く */ }
    knob.classList.add("dragging");
    applyVolume(volumeFromPointer(e));
    document.dispatchEvent(new CustomEvent("volume:changed"));
  });
  track.addEventListener("pointermove", (e) => {
    if (dragging !== e.pointerId) return;
    applyVolume(volumeFromPointer(e));
    document.dispatchEvent(new CustomEvent("volume:changed"));
  });
  function endKnobDrag(e) {
    if (dragging !== e.pointerId) return;
    dragging = null;
    knob.classList.remove("dragging");
    playSound("bell"); // 今の音量で鳴らして聞かせる
  }
  track.addEventListener("pointerup", endKnobDrag);
  track.addEventListener("pointercancel", endKnobDrag);

  // キーボード: ← → で 5 ずつ
  knob.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    applyVolume(volume + step);
    playSound("bell");
    document.dispatchEvent(new CustomEvent("volume:changed"));
  });

  // ---- 開け閉め ----
  function openMenu() {
    menuPanel.hidden = false;
  }
  function closeMenu() { menuPanel.hidden = true; }

  function openVolume() {
    closeMenu();
    refreshVolumeBell(); // main.js
    refreshVolumeNose(); // main.js
    // チュートリアル中・16問目は、ベルを取り出せない。16問目は鼻を取り出せる (drag.js)
    document.getElementById("volume-bell").classList.toggle("locked", isTutorialLocked());
    refreshNoseTakeable();
    volumePanel.hidden = false;
    knob.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("volume:opened"));
  }
  function closeVolume() {
    if (volumePanel.hidden) return;
    volumePanel.hidden = true;
    document.dispatchEvent(new CustomEvent("volume:closed"));
  }
  window.isVolumeOpen = () => !volumePanel.hidden;
  window.getVolume = () => volume; // drag.js (鼻は音量 100 のときだけ取り出せる)
  window.closeVolume = closeVolume; // ベルを取り出したときに閉じる (drag.js)
  const isTutorialLocked = () => inTutorial() || currentQuestionIndex === FINAL_INDEX;

  menuBtn.addEventListener("click", openMenu); // ボタンの音は sound.js

  menuPanel.addEventListener("click", (e) => {
    const item = e.target.closest("[data-menu]");
    if (!item) { if (e.target === menuPanel) closeMenu(); return; } // 外側を押したら閉じる
    playSound("click");
    if (item.dataset.menu === "volume") openVolume();
    else if (item.dataset.menu === "tutorial") { closeMenu(); askTutorial(); } // 天狗が「もう一度見るか？」と聞く (tutorial.js)
    else closeMenu();
  });

  document.getElementById("volume-close").addEventListener("click", () => { playSound("click"); closeVolume(); });
  // 外側を押す / Esc でも閉じる。ただしチュートリアル中は「閉じる」ボタンでだけ閉じる
  // (「閉じる」を押してから次のセリフへ進むようにする: 2026-11-24 ユーザー指示)
  volumePanel.addEventListener("click", (e) => { if (e.target === volumePanel && !inTutorial()) closeVolume(); });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!volumePanel.hidden) { if (!inTutorial()) closeVolume(); }
    else if (!menuPanel.hidden) closeMenu();
  });
})();
