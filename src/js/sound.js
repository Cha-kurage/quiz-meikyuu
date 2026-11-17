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
  bell: "tirin1.mp3",          // チリン (右上のベル = 音量ボタンを押したとき)
  wind: "wind1.mp3",           // 風が吹く1 (約105秒。定期的に一部分だけ流す)
};

let masterVolume = 0.5; // 音量。元スライドの初期設定 50。音量ページができたら、そこから変える

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

// ---- 風: 定期的に吹く。長い音源の中から、毎回ちがう場所を少しだけ流す ----
function blowWind() {
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
    if (t >= WIND_PLAY_MS) { a.pause(); clearInterval(timer); return; }
    const fadeIn = Math.min(1, t / WIND_FADE_MS);
    const fadeOut = Math.min(1, (WIND_PLAY_MS - t) / WIND_FADE_MS);
    a.volume = peak * Math.max(0, Math.min(fadeIn, fadeOut));
  }, 50);
}

// 最初にクリック・タップされてから吹き始める (それまでは自動再生の制限で鳴らせない)
document.addEventListener("pointerdown", () => {
  setTimeout(blowWind, WIND_INTERVAL_MS / 2);
  setInterval(blowWind, WIND_INTERVAL_MS);
}, { once: true });

// ---- ボタンの音 ----
document.getElementById("menu-btn").addEventListener("click", () => playSound("click"));
document.addEventListener("volume:press", () => playSound("bell")); // 音量ページは未実装。今はベルが鳴るだけ
