// 出題フロー: 「n/15」表示 → 問題文を1文字ずつ → 5秒カウントダウン → 答え
// 早押しボタンで一時停止、もう一度押すと続きから再開する。

const CHARS_PER_LINE = 5;
const COUNTER_SHOW_MS = 1500;
const COUNTER_FADE_MS = 400;
const CHAR_INTERVAL_MS = 180;
const AFTER_TEXT_MS = 500;
const COUNTDOWN_SECONDS = 5;

const counterEl = document.getElementById("question-counter");
const textEl = document.getElementById("question-text");
const statusEl = document.getElementById("question-status");
const buzzerBtn = document.getElementById("buzzer-btn");

// 一時停止・再開できる待機。停止時に残り時間を覚えておき、再開でその分だけ待つ
function createRun() {
  const run = { paused: false, remaining: 0, startedAt: 0, timer: null, resolve: null };

  const arm = () => {
    run.startedAt = performance.now();
    run.timer = setTimeout(() => {
      const done = run.resolve;
      run.timer = null;
      run.resolve = null;
      done();
    }, Math.max(0, run.remaining));
  };

  run.wait = (ms) => new Promise((resolve) => {
    run.resolve = resolve;
    run.remaining = ms;
    if (!run.paused) arm();
  });

  run.pause = () => {
    run.paused = true;
    if (run.timer !== null) {
      clearTimeout(run.timer);
      run.timer = null;
      run.remaining -= performance.now() - run.startedAt;
    }
  };

  run.resume = () => {
    run.paused = false;
    if (run.resolve && run.timer === null) arm();
  };

  return run;
}

let currentRun = null;
let currentRunId = 0;
let paused = false;
let currentQuestionIndex = 0;

function startQuestion(index) {
  currentQuestionIndex = index;
  prepareAnswerZone(index); // 解答ゾーンをリセットし、解答済みならその配置を復元する
  const q = QUESTIONS[index];
  const run = createRun();
  currentRun = run;
  const runId = ++currentRunId; // 質問を切り替えたら、前の進行中の待機は捨てる
  const wait = run.wait;
  const stale = () => runId !== currentRunId;

  textEl.innerHTML = "";
  statusEl.innerHTML = "";
  paused = false;
  buzzerBtn.classList.remove("is-pressed");
  buzzerBtn.setAttribute("aria-pressed", "false");

  (async () => {
    // 1. 「1/15」表示 → 消える
    counterEl.textContent = `${index + 1}/${TOTAL_QUESTIONS}`;
    counterEl.classList.add("show");
    await wait(COUNTER_SHOW_MS);
    if (stale()) return;
    counterEl.classList.remove("show");
    await wait(COUNTER_FADE_MS);
    if (stale()) return;

    // 2. 問題文を1文字ずつ (5文字ごとに改行)
    const chars = [...q.text];
    let lineEl = null;
    for (let i = 0; i < chars.length; i++) {
      if (i % CHARS_PER_LINE === 0) {
        lineEl = document.createElement("div");
        lineEl.className = "q-line";
        textEl.appendChild(lineEl);
      }
      const span = document.createElement("span");
      span.className = "q-char";
      span.textContent = chars[i];
      lineEl.appendChild(span);
      await wait(CHAR_INTERVAL_MS);
      if (stale()) return;
    }
    await wait(AFTER_TEXT_MS);
    if (stale()) return;

    // 3. 答えまでのカウントダウン
    for (let s = COUNTDOWN_SECONDS; s >= 1; s--) {
      statusEl.innerHTML = `<div class="q-countdown">${s}</div>`;
      await wait(1000);
      if (stale()) return;
    }

    // 4. 答え
    statusEl.innerHTML =
      `<div class="q-answer-label">答え</div><div class="q-answer"></div>`;
    statusEl.querySelector(".q-answer").textContent = q.answer;
  })();
}

// 戻る / 進む: 問題を切り替える (置いたパーツはそのまま残る)
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
function goToQuestion(i) {
  if (i < 0 || i >= QUESTIONS.length) return;
  startQuestion(i);
}
prevBtn.addEventListener("click", () => goToQuestion(currentQuestionIndex - 1));
nextBtn.addEventListener("click", () => goToQuestion(currentQuestionIndex + 1));

// 早押しボタン: 押すたびに出題を一時停止・再開する (石板・解答ゾーンは常に表示のまま)
function toggleBuzzer() {
  paused = !paused;
  if (currentRun) (paused ? currentRun.pause() : currentRun.resume());
  buzzerBtn.classList.toggle("is-pressed", paused);
  buzzerBtn.setAttribute("aria-pressed", String(paused));
}

// マウス/タッチは押した瞬間に反応。キーボード操作の click は detail === 0
// (マウス操作の click は pointerdown で処理済みなので無視して二重切り替えを防ぐ)
buzzerBtn.addEventListener("pointerdown", toggleBuzzer);
buzzerBtn.addEventListener("click", (e) => { if (e.detail === 0) toggleBuzzer(); });

startQuestion(0);
