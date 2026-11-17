// 出題フロー: (早押しボタンを押すまで待つ) → 「n/15」表示 → 問題文を1文字ずつ → 5秒カウントダウン → 答え
// 出題ゾーンの上には、いまの問題番号を小さく常に出しておく。
// 読み上げの進み具合は問題ごとに覚えておき、戻る/進むで戻ってきたら、そこまでを表示する。
// 問題を開いた直後は読み始めず、早押しボタンの上に「ボタンを押して出題」の吹き出しを出して待つ。
// 押すと読み始め、そのあとは押すたびに一時停止 / 続きから再開する。

const CHARS_PER_LINE = 5;
const COUNTER_SHOW_MS = 1500;
const COUNTER_FADE_MS = 400;
const CHAR_INTERVAL_MS = 180;
const AFTER_TEXT_MS = 500;
const COUNTDOWN_SECONDS = 5;
const BUZZER_TO_READ_MS = 300; // 早押しボタンの音と出題音が重ならないよう、押してから少し待って読み始める

const counterEl = document.getElementById("question-counter");
const textEl = document.getElementById("question-text");
const statusEl = document.getElementById("question-status");
const buzzerBtn = document.getElementById("buzzer-btn");
const hintEl = document.getElementById("buzzer-hint");
const numberEl = document.getElementById("question-number");

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
let pendingRead = null; // ボタン待ちの間だけ入っている「読み始める (続きを読む)」処理

// 早押しボタンの上の吹き出し。read を渡すと出して待ち、null で消す
function setWaitingForBuzzer(read, label = "ボタンを押して出題") {
  pendingRead = read;
  hintEl.textContent = label;
  hintEl.hidden = !read;
}

// ---- 問題ごとの読み上げの進み具合 ----
// 戻る/進むで離れても覚えておき、戻ってきたときはそこまでを表示する (未解答なら、ボタンで続きから読む)。
//   started  : 読み始めたか (大きい「n/15」と出題音は最初の1回だけ)
//   chars    : 表示し終えた問題文の文字数
//   textDone : 問題文のあとの間 (AFTER_TEXT_MS) まで終えたか
//   countdown: 表示中のカウントダウンの数字 (カウントダウン中でなければ null)
//   answered : 答えまで表示したか
const readProgress = {};
function progressOf(index) {
  if (!readProgress[index]) {
    readProgress[index] = { started: false, chars: 0, textDone: false, countdown: null, answered: false };
  }
  return readProgress[index];
}

// 問題文の i 文字目 (0 始まり) を追加する。5文字ごとに改行
function appendChar(ch, i) {
  let lineEl = textEl.lastElementChild;
  if (i % CHARS_PER_LINE === 0 || !lineEl) {
    lineEl = document.createElement("div");
    lineEl.className = "q-line";
    textEl.appendChild(lineEl);
  }
  const span = document.createElement("span");
  span.className = "q-char";
  span.textContent = ch;
  lineEl.appendChild(span);
}

function showCountdown(n) {
  statusEl.innerHTML = `<div class="q-countdown">${n}</div>`;
}

function showAnswer(q) {
  statusEl.innerHTML = `<div class="q-answer-label">答え</div><div class="q-answer"></div>`;
  statusEl.querySelector(".q-answer").textContent = q.answer;
}

// 覚えている進み具合のところまでを、一度に表示する
function renderProgress(q, pr) {
  textEl.innerHTML = "";
  statusEl.innerHTML = "";
  [...q.text].slice(0, pr.chars).forEach((ch, i) => appendChar(ch, i));
  if (pr.answered) showAnswer(q);
  else if (pr.countdown !== null) showCountdown(pr.countdown);
}

// 進み具合の続きから読む (最初からなら「n/15」と出題音から)
async function readFrom(q, index, pr, wait, stale) {
  await wait(BUZZER_TO_READ_MS);
  if (stale()) return;

  // 1. 大きい「1/15」表示 → 消える (読み始めの1回だけ。その間は上の小さい番号を隠す)
  if (!pr.started) {
    pr.started = true;
    numberEl.classList.remove("show");
    counterEl.textContent = `${index + 1}/${TOTAL_QUESTIONS}`;
    counterEl.classList.add("show");
    playQuestionSound(); // 出題音 (2重)
    await wait(COUNTER_SHOW_MS);
    if (stale()) return;
    counterEl.classList.remove("show");
    await wait(COUNTER_FADE_MS);
    if (stale()) return;
    numberEl.classList.add("show");
  }

  // 2. 問題文を1文字ずつ (5文字ごとに改行)
  const chars = [...q.text];
  while (pr.chars < chars.length) {
    appendChar(chars[pr.chars], pr.chars);
    pr.chars++;
    await wait(CHAR_INTERVAL_MS);
    if (stale()) return;
  }
  if (!pr.textDone) {
    await wait(AFTER_TEXT_MS);
    if (stale()) return;
    pr.textDone = true;
  }

  // 3. 答えまでのカウントダウン (途中で離れていたら、その数字から)
  for (let n = pr.countdown ?? COUNTDOWN_SECONDS; n >= 1; n--) {
    pr.countdown = n;
    showCountdown(n);
    await wait(1000);
    if (stale()) return;
  }

  // 4. 答え
  pr.countdown = null;
  pr.answered = true;
  showAnswer(q);
}

function startQuestion(index) {
  currentQuestionIndex = index;
  prepareAnswerZone(index); // 解答ゾーンをリセットし、解答済みならその配置を復元する
  const q = QUESTIONS[index];
  const run = createRun();
  currentRun = run;
  const runId = ++currentRunId; // 質問を切り替えたら、前の進行中の待機は捨てる
  const stale = () => runId !== currentRunId;

  paused = false;
  buzzerBtn.classList.remove("is-pressed");
  buzzerBtn.setAttribute("aria-pressed", "false");
  counterEl.classList.remove("show");
  numberEl.textContent = `${index + 1}/${TOTAL_QUESTIONS}`; // 上の小さい問題番号は常に出しておく
  numberEl.classList.add("show");

  // 前に見たところまでを表示する
  const pr = progressOf(index);
  renderProgress(q, pr);

  // 正解済みの問題・答えまで出し終えた問題は、もう読まない (見たところまでを出しておくだけ)
  if (isQuestionSolved(index) || pr.answered) {
    setWaitingForBuzzer(null);
    return;
  }

  // 早押しボタンが押されるまで待ってから読む (途中まで読んだ問題は続きから)
  setWaitingForBuzzer(
    () => readFrom(q, index, pr, run.wait, stale),
    pr.started ? "ボタンを押して続きから" : "ボタンを押して出題",
  );
}

// 戻る / 進む: 問題を切り替える (置いたパーツはそのまま残る)
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
function goToQuestion(i) {
  if (i < 0 || i >= QUESTIONS.length) return;
  startQuestion(i);
}
prevBtn.addEventListener("click", () => { playSound("click"); goToQuestion(currentQuestionIndex - 1); });
nextBtn.addEventListener("click", () => { playSound("click"); goToQuestion(currentQuestionIndex + 1); });

// 早押しボタン: 最初の1回で読み始め、そのあとは押すたびに出題を一時停止・再開する (石板・解答ゾーンは常に表示のまま)
function toggleBuzzer() {
  playSound("buzzer");
  if (pendingRead) {
    const read = pendingRead;
    setWaitingForBuzzer(null);
    read();
    return;
  }
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
