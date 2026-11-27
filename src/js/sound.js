// 効果音。素材は効果音ラボ (assets/CREDITS.md)。規約で直リンクは禁止なので、assets/sounds/ に置いたものを鳴らす。
//
// ブラウザは、ページを開いてから一度もクリック・タップしていないうちは音を鳴らさない (自動再生の制限)。
// そのため、ページを開いた直後の1問目の出題音は鳴らないことがある (鳴らせなかった音は黙って捨てる)。
// BGM は、使ってよいかの確認待ちのため、まだ入れていない。

const SOUND_DIR = "assets/sounds/";
const SOUND_FILES = {
  question: "question1.mp3",   // 出題1 (デデン)
  correct: "correct1.mp3",     // クイズ正解1
  incorrect: "incorrect1.mp3", // クイズ不正解1
  click: "decision31.mp3",     // 決定ボタンを押す31 (戻る/進む/メニューなどのボタン)
  buzzer: "quiz-button2.mp3",  // クイズ早押しボタン2
  bell: "tirin1.mp3",          // チリン (音量を変えたとき / 音量の画面のベルを押したとき)
  wind: "wind1.mp3",           // 風が吹く1 (約105秒。定期的に一部分だけ流す)
};

let masterVolume = 0.07; // 音量 (0〜1)。最初は 7 (2026-11-27 ユーザー指示。元スライドは 50)。menu.js の音量調節 (天狗の鼻) で変える

const QUESTION_ECHO_MS = 160; // 出題音の「2重」: 1回目からこれだけ遅らせて、もう1回重ねて鳴らす

const WIND_INTERVAL_MS = 25000; // 風が吹く間隔
const WIND_PLAY_MS = 6000;      // 1回に吹く長さ
const WIND_FADE_MS = 1500;      // 吹き始め・吹き終わりのフェード
const WIND_VOLUME = 0.6;        // 風の音の大きさ (masterVolume に掛ける)

// 読み込みは最初に1回だけ。鳴らすたびに複製するので、同じ音を重ねて鳴らせる
const soundBank = {};
Object.entries(SOUND_FILES).forEach(([name, file]) => {
  const a = new Audio(SOUND_DIR + file);
  a.preload = "auto";
  soundBank[name] = a;
});

function playSound(name, volume = 1) {
  const base = soundBank[name];
  if (!base) return null;
  const a = base.cloneNode();
  a.volume = Math.min(1, Math.max(0, masterVolume * volume));
  a.play().catch(() => {}); // 自動再生の制限で鳴らせないときは何もしない
  return a;
}

// 出題音は2重 (元スライド: 1問目から2重にして「2つの問題が流れている」ことを示す。1重は例題だけ)
function playQuestionSound() {
  playSound("question");
  setTimeout(() => playSound("question"), QUESTION_ECHO_MS);
}

// 1問目だけは「デデン！デデン！」と2回続けて鳴らす (2026-11-20 ユーザー指示)。
// 「デデン」は音源の最初の約0.55秒なので、鳴り終わるころに2回目を鳴らす
const QUESTION_REPEAT_MS = 650;
function playQuestionSoundTwice() {
  playSound("question");
  setTimeout(() => playSound("question"), QUESTION_REPEAT_MS);
}

// ---- 迷宮の門の音 (gate.js)。音の素材は使わず、その場で作る (Web Audio) ----
// 開くとき: 低いゴゴゴ (低い音だけ残したノイズ) と、木がきしむような低い音。
let gateAudioCtx = null;
function gateCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!gateAudioCtx) gateAudioCtx = new AC();
  if (gateAudioCtx.state === "suspended") gateAudioCtx.resume().catch(() => {});
  return gateAudioCtx;
}
function gateNoise(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { // ブラウンノイズ (低い音が多いザー)
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}
function playGateSound(seconds = 4.5) { // seconds: 揺れ始めから開ききるまで (gate.js)
  const ctx = gateCtx();
  if (!ctx || masterVolume <= 0) return;
  const t = ctx.currentTime;
  const dur = seconds;
  // ゴゴゴ
  const rumble = gateNoise(ctx, dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 140;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1.6 * masterVolume, t + 0.35);
  g.gain.setValueAtTime(1.6 * masterVolume, t + dur - 1.1);
  g.gain.linearRampToValueAtTime(0, t + dur);
  rumble.connect(lp).connect(g).connect(ctx.destination);
  rumble.start(t);
  rumble.stop(t + dur);
  // ギィー (ゆっくり音程が上下する低い音)
  const creak = ctx.createOscillator();
  creak.type = "sawtooth";
  creak.frequency.setValueAtTime(70, t + 0.9);
  creak.frequency.linearRampToValueAtTime(95, t + 0.9 + dur * 0.25);
  creak.frequency.linearRampToValueAtTime(62, t + dur - 0.8);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 420;
  bp.Q.value = 3;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0, t + 0.9);
  cg.gain.linearRampToValueAtTime(0.35 * masterVolume, t + 1.4);
  cg.gain.linearRampToValueAtTime(0, t + dur - 0.6);
  creak.connect(bp).connect(cg).connect(ctx.destination);
  creak.start(t + 0.9);
  creak.stop(t + dur - 0.5);
}
// ---- 風: 定期的に吹く。長い音源の中から、毎回ちがう場所を少しだけ流す ----
// 風 (飾りの風のパーツ) を答えに使った後 (4問目 湘南乃風に正解した後) は、もう吹かない (2026-11-20 ユーザー指示)
const windUsed = () => consumedBy["decor_wind"] !== undefined; // answers.js
let windGust = null; // いま鳴っている風 { audio, timer }

function stopWind() {
  if (!windGust) return;
  windGust.audio.pause();
  clearInterval(windGust.timer);
  windGust = null;
}

function blowWind() {
  if (windUsed()) return;
  const a = playSound("wind", 0);
  if (!a) return;
  const peak = Math.min(1, masterVolume * WIND_VOLUME);
  const start = () => {
    const room = Math.max(0, a.duration - WIND_PLAY_MS / 1000);
    a.currentTime = Math.random() * room;
  };
  if (a.readyState >= 1) start(); else a.addEventListener("loadedmetadata", start, { once: true });

  // 音量の上げ下げはタイマーで行う (requestAnimationFrame だと、タブが裏にある間止まって鳴りっぱなしになる)
  const t0 = performance.now();
  const timer = setInterval(() => {
    const t = performance.now() - t0;
    if (t >= WIND_PLAY_MS) { a.pause(); clearInterval(timer); if (windGust && windGust.audio === a) windGust = null; return; }
    const fadeIn = Math.min(1, t / WIND_FADE_MS);
    const fadeOut = Math.min(1, (WIND_PLAY_MS - t) / WIND_FADE_MS);
    a.volume = peak * Math.max(0, Math.min(fadeIn, fadeOut));
  }, 50);
  stopWind(); // 前の風が残っていたら止める
  windGust = { audio: a, timer };
}

// 風を使って正解したら、吹いている途中の風も止める
document.addEventListener("question:solved", () => { if (windUsed()) stopWind(); });

// 最初にクリック・タップされてから吹き始める (それまでは自動再生の制限で鳴らせない)
document.addEventListener("pointerdown", () => {
  setTimeout(blowWind, WIND_INTERVAL_MS / 2);
  setInterval(blowWind, WIND_INTERVAL_MS);
}, { once: true });

// ---- ボタンの音 ----
document.getElementById("menu-btn").addEventListener("click", () => playSound("click"));
