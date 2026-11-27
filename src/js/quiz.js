// 出題フロー: (早押しボタンを押すまで待つ) → 少し待って出題音 → 少し待って、タイマー開始と同時に問題文を1文字ずつ
//   → 5秒カウントダウン → 答え。答えは出題ゾーンに文字では出さず、偽天狗が早押しボタンの横に来て言う
//   (本編は #answer-tengu。例題は tutorial.js が天狗を動かして言う)。
// 1〜15問目に正解すると、読んでいる途中でも止めて、問題文を全部出す。天狗 (と答え) は出さない。
// 天狗がもう答えを言っていたときも、正解したら天狗は消える (2026-11-24 ユーザー指示)。
// 正解済みの問題でボタンを押すと、問題文だけを最初から読み直す (カウントダウンは無し: 2026-11-20)。
// 15問目に正解すると16問目 (最終問題) へ。16問目は白紙で、早押しボタンは押しても反応しない。
// 出題ゾーンの上には、いまの問題番号を小さく常に出しておく。
// 読み上げの進み具合は問題ごとに覚えておき、戻る/進むで戻ってきたら、そこまでを表示する。
// 問題ごとのタイマー: 問題文が出始めたときから動き、早押しボタンで止まる / もう一度押すと再開。
// 正解したら、そのときのタイマーの値を記録する (solveTimes)。ほかの問題へ移っている間は止まる。
// 問題を開いた直後は読み始めず、早押しボタンの上に「ボタンを押して出題」の吹き出しを出して待つ。
// 押すと読み始め、そのあとは押すたびに一時停止 / 続きから再開する。

const CHARS_PER_LINE = 5;
const CHAR_INTERVAL_MS = 180;
const AFTER_TEXT_MS = 500;
const COUNTDOWN_SECONDS = 5;
// ボタンを押す → 少し待つ → 出題音 → 少し待つ → タイマー開始と同時に問題文 (2026-11-20 ユーザー指示)
const BUZZER_TO_SOUND_MS = 700;  // 早押しボタンの音 (約1.1秒) と出題音が重なりすぎないように
const SOUND_TO_TEXT_MS = 1500;   // 出題音 (約1.7秒) がほぼ鳴り終わってから問題文を出す

const textEl = document.getElementById("question-text");
const statusEl = document.getElementById("question-status");
const buzzerBtn = document.getElementById("buzzer-btn");
const hintEl = document.getElementById("buzzer-hint");
const numberEl = document.getElementById("question-number");
const timerEl = document.getElementById("question-timer");

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
// 上の小さい問題番号「n/15」。10問目だけは「10」を黒字にして、ドラッグで取り出せるようにする (drag.js)。
// 取り出した後は、ほかの問題と同じ灰色の「10」に戻る (もう取れない)。drag.js からも呼ぶ
function refreshQuestionNumber() {
  const i = currentQuestionIndex;
  if (i === TUTORIAL_INDEX) {
    numberEl.textContent = "例題";
    return;
  }
  if (i !== TEN_QUESTION_INDEX) {
    numberEl.textContent = `${i + 1}/${TOTAL_QUESTIONS}`;
    return;
  }
  const part = document.querySelector(".part.num-part");
  const taken = !!part && !part.classList.contains("in-number");
  numberEl.innerHTML = `<span class="num-take${taken ? " taken" : ""}">${i + 1}</span>/${TOTAL_QUESTIONS}`;
}

// ---- 問題ごとのタイマー ----
const questionTimers = {}; // 問題番号 -> { elapsed: 止めている間までに進んだ ms, since: 動き出した時刻 (止まっていれば null) }
const solveTimes = {};     // 問題番号 -> 正解したときのタイマーの値 (ms)。これが「記録」

function timerOf(index) {
  if (!questionTimers[index]) questionTimers[index] = { elapsed: 0, since: null };
  return questionTimers[index];
}
function timerRun(index) {
  const t = timerOf(index);
  if (t.since === null && !(index in solveTimes)) t.since = performance.now();
}
function timerStop(index) {
  const t = timerOf(index);
  if (t.since !== null) {
    t.elapsed += performance.now() - t.since;
    t.since = null;
  }
}
function timerValue(index) {
  const t = timerOf(index);
  return t.elapsed + (t.since === null ? 0 : performance.now() - t.since);
}

// 12.3秒 / 1分05.3秒
function formatTime(ms) {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}秒`;
  const m = Math.floor(sec / 60);
  return `${m}分${(sec - m * 60).toFixed(1).padStart(4, "0")}秒`;
}

// 出題ゾーン左上のタイマー表示。正解済みの問題では記録を出す
function renderTimer() {
  const i = currentQuestionIndex;
  const recorded = i in solveTimes;
  timerEl.textContent = recorded ? `記録 ${formatTime(solveTimes[i])}` : formatTime(timerValue(i));
  timerEl.classList.toggle("recorded", recorded);
}
setInterval(renderTimer, 100);

// 1〜15問目を、どの段階で正解したか (早押しクイズ力の評価に使う: gate.js の quizRank)
//   early: 問題文を読み終わる前 (早押しボタンで止めて答えた) / read: 読み終わってから、天狗が答えを言う前 / told: 天狗が答えを言った後
const solveStage = {};

// 正解したら (answers.js から通知)、タイマーを止めてその値を記録する
document.addEventListener("question:solved", (e) => {
  const i = e.detail.index;
  timerStop(i);
  solveTimes[i] = timerValue(i);
  // 1〜15問目: 問題文を全部出したことにする (読んでいる途中でも止める)。天狗 (と答え) は消す。
  // 表示中の問題なら開き直して出し直す (ボタンを押すと問題文を読み直す、も startQuestion が用意する)
  if (i >= 0 && i <= LAST_QUESTION_INDEX) {
    const pr = progressOf(i);
    // 早押しクイズ力 (gate.js) のために、どの段階で正解したかを覚えておく
    if (!(i in solveStage)) {
      solveStage[i] = pr.answered ? "told" : pr.chars < [...QUESTIONS[i].text].length ? "early" : "read";
    }
    Object.assign(pr, { started: true, chars: [...QUESTIONS[i].text].length, textDone: true, countdown: null });
    if (i === currentQuestionIndex) startQuestion(i);
  } else if (i === currentQuestionIndex && !(currentRun && currentRun.busy)) {
    armReread(i, currentRun, currentRunId);
  }
  renderTimer();
});

// ---- 16問目 (最終問題) ----
// 15問目に正解して少したったら、16問目へ進む。16問目は白紙: 問題番号・タイマー・問題文は出さず、
// 早押しボタンは見えるが押しても反応しない。石板・解答ゾーンも空 (16問目用のパーツ = 偽天狗と鼻だけが出る)。
// 「これで回答」・戻る/進む は使える。16問目へは、15問目に正解した後なら「進む」でも行ける。
const LAST_QUESTION_INDEX = QUESTIONS.length - 1; // 15問目
const FINAL_DELAY_MS = 1500; // 正解の音と⭕ (出る場合) を見せてから切り替える
const onFinalPage = () => currentQuestionIndex === FINAL_INDEX;
const finalUnlocked = () => isQuestionSolved(LAST_QUESTION_INDEX);

document.addEventListener("question:solved", (e) => {
  if (e.detail.index !== LAST_QUESTION_INDEX) return;
  setTimeout(() => { if (currentQuestionIndex === LAST_QUESTION_INDEX && !inTutorial()) startQuestion(FINAL_INDEX); }, FINAL_DELAY_MS);
});

let pendingRead = null; // ボタン待ちの間だけ入っている「読み始める (続きを読む)」処理

// 早押しボタンの上の吹き出し。read を渡すと出して待ち、null で消す。label に null を渡すと、吹き出しは出さずに待つ
function setWaitingForBuzzer(read, label = "ボタンを押して出題") {
  pendingRead = read;
  hintEl.textContent = label || "";
  hintEl.hidden = !read || label === null;
}

// 答えのふりがなを「（こぶし）」の形にする。ふりがなの無い答え (かな・数字・英字) は空
function readingLabel(q) {
  return q.reading ? `（${q.reading}）` : "";
}

// ---- 答えを言う偽天狗 (本編) ----
// カウントダウンが終わると、早押しボタンの横に偽天狗が出て「答えは / ○○ / である」と言う。
// その問題に正解するまで出たまま (ほかの問題へ移って戻ってきても出ている)。正解すると消える
const answerTengu = document.getElementById("answer-tengu");
function showAnswerTengu(q, { pop = false } = {}) {
  answerTengu.querySelector(".tut-answer").textContent = q.answer;
  answerTengu.querySelector(".tut-reading").textContent = readingLabel(q); // 漢字の答えは「（ふりがな）」も
  answerTengu.hidden = false;
  answerTengu.classList.toggle("pop", pop);
  stage.classList.add("answer-told");
}
function hideAnswerTengu() {
  answerTengu.hidden = true;
  stage.classList.remove("answer-told");
  answerTengu.classList.remove("pop");
}

// 出題音。例題は1重、1問目は「デデン！デデン！」と2回続けて、ほかは2重 (重ねて鳴らす)。
// 戻り値: 1回目を鳴らしてから問題文までに足す待ち時間 (2回続けて鳴らす分)
function playStartSound(index) {
  if (index === TUTORIAL_INDEX) { playSound("question"); return 0; } // 例題は1重 (元スライド)
  if (index === 0) { playQuestionSoundTwice(); return QUESTION_REPEAT_MS; } // 1問目 (2026-11-20 ユーザー指示)
  playQuestionSound(); // 本番は2重
  return 0;
}

// ---- 問題ごとの読み上げの進み具合 ----
// 戻る/進むで離れても覚えておき、戻ってきたときはそこまでを表示する (未解答なら、ボタンで続きから読む)。
//   started  : 読み始めたか (出題音は最初の1回だけ)
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

// 答え: 出題ゾーンには文字で出さず、偽天狗が言う (例題は tutorial.js、本編は #answer-tengu。正解済みなら出さない)
function showAnswer(q, index, { pop = false } = {}) {
  statusEl.innerHTML = "";
  if (q === EXAMPLE_QUESTION || isQuestionSolved(index)) return; // 正解済みの問題では出さない
  showAnswerTengu(q, { pop });
}

// 覚えている進み具合のところまでを、一度に表示する
function renderProgress(q, pr, index) {
  textEl.innerHTML = "";
  statusEl.innerHTML = "";
  hideAnswerTengu();
  [...q.text].slice(0, pr.chars).forEach((ch, i) => appendChar(ch, i));
  if (pr.answered) showAnswer(q, index);
  else if (pr.countdown !== null && !isQuestionSolved(index)) showCountdown(pr.countdown);
}

// 正解済みの問題でボタンを押したとき: 問題文だけを最初から読み直す (カウントダウン・答えは無し。タイマーも動かない)
async function rereadText(q, index, run, stale) {
  const wait = run.wait;
  await wait(BUZZER_TO_SOUND_MS);
  if (stale()) return;
  const extra = playStartSound(index);
  await wait(SOUND_TO_TEXT_MS + extra);
  if (stale()) return;
  textEl.innerHTML = "";
  statusEl.innerHTML = "";
  const chars = [...q.text];
  for (let i = 0; i < chars.length; i++) {
    appendChar(chars[i], i);
    await wait(CHAR_INTERVAL_MS);
    if (stale()) return;
  }
  const pr = progressOf(index);
  pr.chars = chars.length;
  setWaitingForBuzzer(() => rereadText(q, index, run, stale), null); // また押せば、もう一度読む
}

// 正解済みの問題で、ボタンを押すと問題文を読み直すようにしておく (吹き出しは出さない)
function armReread(index, run, runId) {
  if (!run) return;
  const stale = () => runId !== currentRunId;
  if (stale()) return;
  setWaitingForBuzzer(() => rereadText(questionAt(index), index, run, stale), null);
}

// 読み上げ中 (run.busy) に正解したら、問題文を最後まで読んだところで止める (カウントダウン・答えは無し)
async function readFrom(q, index, pr, run, stale) {
  run.busy = true;
  const runId = currentRunId;
  try {
    await readFromInner(q, index, pr, run, stale);
  } finally {
    run.busy = false;
    if (!stale() && isQuestionSolved(index)) armReread(index, run, runId);
  }
}

// 進み具合の続きから読む (最初からなら出題音から)
async function readFromInner(q, index, pr, run, stale) {
  const wait = run.wait;
  await wait(BUZZER_TO_SOUND_MS);
  if (stale()) return;

  // 1. 出題音 (読み始めの1回だけ。問題番号は上に小さく出ているので、大きい「n/15」は出さない: 2026-11-17)
  if (!pr.started) {
    pr.started = true;
    const extra = playStartSound(index);
    await wait(SOUND_TO_TEXT_MS + extra);
    if (stale()) return;
  }

  // ここからタイマーを動かす (問題文が出始めるのと同時)
  run.timing = true;
  if (!paused) timerRun(index);

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

  // 3. 答えまでのカウントダウン (途中で離れていたら、その数字から)。正解済みならここまで
  for (let n = pr.countdown ?? COUNTDOWN_SECONDS; n >= 1; n--) {
    if (isQuestionSolved(index)) { statusEl.innerHTML = ""; return; }
    pr.countdown = n;
    showCountdown(n);
    await wait(1000);
    if (stale()) return;
  }
  if (isQuestionSolved(index)) { statusEl.innerHTML = ""; return; }

  // 4. 答え (例題は、偽天狗が早押しボタンの横に来て言う: tutorial.js)
  pr.countdown = null;
  pr.answered = true;
  showAnswer(q, index, { pop: true });
  if (index === TUTORIAL_INDEX) document.dispatchEvent(new CustomEvent("tutorial:answer", { detail: { answer: q.answer, reading: readingLabel(q) } }));
}

function startQuestion(index) {
  timerStop(currentQuestionIndex); // 前の問題のタイマーは、離れている間は止める
  currentQuestionIndex = index;
  prepareAnswerZone(index); // 解答ゾーンをリセットし、解答済みならその配置を復元する
  const q = questionAt(index);
  const run = createRun();
  currentRun = run;
  const runId = ++currentRunId; // 質問を切り替えたら、前の進行中の待機は捨てる
  const stale = () => runId !== currentRunId;

  paused = false;
  buzzerBtn.classList.remove("is-pressed");
  buzzerBtn.setAttribute("aria-pressed", "false");
  refreshQuestionNumber(); // 上の小さい問題番号は常に出しておく
  numberEl.classList.add("show");
  stage.classList.toggle("final", index === FINAL_INDEX); // 16問目は白紙 (CSS)

  // 前に見たところまでを表示する
  const pr = progressOf(index);
  renderProgress(q, pr, index);

  renderTimer();
  if (index === FINAL_INDEX) { // 16問目: 問題は出ない。早押しボタンは押しても反応しない
    setWaitingForBuzzer(null);
    return;
  }
  // 正解済みの問題: 吹き出しは出さないが、ボタンを押すと問題文だけを最初から読み直す
  if (isQuestionSolved(index)) {
    setWaitingForBuzzer(() => rereadText(q, index, run, stale), null);
    return;
  }
  // 答えまで出し終えた未解答の問題: 読むものは無いが、ボタンを押すとタイマーが続きから動く
  if (pr.answered) {
    setWaitingForBuzzer(() => { run.timing = true; timerRun(index); }, "ボタンを押して続きから");
    return;
  }

  // 早押しボタンが押されるまで待ってから読む (途中まで読んだ問題は続きから)
  setWaitingForBuzzer(
    () => readFrom(q, index, pr, run, stale),
    pr.started ? "ボタンを押して続きから" : "ボタンを押して出題",
  );
}

// 戻る / 進む: 問題を切り替える (置いたパーツはそのまま残る)
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
function goToQuestion(i) {
  const last = finalUnlocked() ? FINAL_INDEX : LAST_QUESTION_INDEX; // 16問目は15問目に正解してから
  if (i < 0 || i > last) return;
  startQuestion(i);
}
prevBtn.addEventListener("click", () => { playSound("click"); goToQuestion(currentQuestionIndex - 1); });
nextBtn.addEventListener("click", () => { playSound("click"); goToQuestion(currentQuestionIndex + 1); });

// 早押しボタン: 最初の1回で読み始め、そのあとは押すたびに出題を一時停止・再開する (石板・解答ゾーンは常に表示のまま)
function toggleBuzzer() {
  if (inTutorial() && !tutorialAllowsBuzzer()) return; // チュートリアルで、まだ押してほしいときではない
  if (onFinalPage()) return; // 16問目: 押しても反応しない
  playSound("buzzer");
  const i = currentQuestionIndex;
  if (pendingRead) { // 出題開始 (または続きから)。タイマーは問題文が出始めたときに動く (readFrom)
    const read = pendingRead;
    setWaitingForBuzzer(null);
    read();
    return;
  }
  paused = !paused;
  if (currentRun) (paused ? currentRun.pause() : currentRun.resume());
  // 早押しでタイマーを止める / もう一度押すと再開 (問題文が出始める前なら、まだ動かさない)
  if (!isQuestionSolved(i)) {
    if (paused) timerStop(i);
    else if (currentRun && currentRun.timing) timerRun(i);
  }
  buzzerBtn.classList.toggle("is-pressed", paused);
  buzzerBtn.setAttribute("aria-pressed", String(paused));
}

// マウス/タッチは押した瞬間に反応。キーボード操作の click は detail === 0
// (マウス操作の click は pointerdown で処理済みなので無視して二重切り替えを防ぐ)
buzzerBtn.addEventListener("pointerdown", toggleBuzzer);
buzzerBtn.addEventListener("click", (e) => { if (e.detail === 0) toggleBuzzer(); });

// 最初の問題は tutorial.js が、チュートリアルを見終わってから (またはとばしたら) 始める
