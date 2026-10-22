// 正誤判定。
//
// 絶対座標では判定しない。どこに置いても良く、パーツ同士の「座標の差」だけを
// 許容範囲(tol, px)つきでチェックする。位置合わせの基準値は「座標を調べる」
// ボタン (debug-coords.js) で正解の配置を作って読み取った数値を使う。
//
// ルールの種類:
//   dx     : (b の x) - (a の x) が value に近いか (縦位置は自由)
//   dy     : (b の y) - (a の y) が value に近いか (横位置は自由)
//   closeX : a と b の x 座標が近いか (縦に並べる、のような「揃える」系の制約)
//   closeY : a と b の y 座標が近いか (横に並べる、のような「揃える」系の制約)
//
// ルールが無い(=キーが無い)問題は、まだ判定ロジックを用意していない問題。

const ANSWER_CHECKS = {
  0: { // Q1 たぬき: 単体イラストなので置く位置はどこでも良い
    required: ["illust_tanuki"],
    rules: [],
  },
  1: { // Q2 きのこ: き基準で の/こ の x だけが合っていれば良い (y は自由)
    // 誤差は一旦大きめにしてある (実際のドラッグ操作は数値メモほど正確にならないため)
    required: ["hira_ki", "hira_no", "hira_ko"],
    rules: [
      { type: "dx", a: "hira_ki", b: "hira_no", value: 182, tol: 90 },
      { type: "dx", a: "hira_ki", b: "hira_ko", value: 92, tol: 90 },
    ],
  },
  2: { // Q3 小節: 「竹」の下に「即」を重ねて「節」に見せる。x が近ければ良い
    required: ["kanji_shou", "illust_bamboo", "kanji_soku"],
    rules: [
      { type: "closeX", a: "illust_bamboo", b: "kanji_soku", tol: 35 },
    ],
  },
};

function partsInAnswerZone() {
  const z = window.getAnswerZoneRect();
  return [...document.querySelectorAll(".part")].filter((el) => {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    return x >= z.l && x <= z.r && y >= z.t && y <= z.b;
  });
}

// 戻り値: true=正解 / false=不正解 / null=この問題はまだ判定ルール未設定
function checkAnswer(index) {
  const cfg = ANSWER_CHECKS[index];
  if (!cfg) return null;

  const zoneEls = partsInAnswerZone();
  const byFile = {};
  for (const file of cfg.required) {
    const el = zoneEls.find((e) => e.dataset.file === file);
    if (!el) return false; // 必要なパーツが解答ゾーンに無い
    byFile[file] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  }

  for (const rule of cfg.rules) {
    const a = byFile[rule.a];
    const b = byFile[rule.b];
    let diff;
    if (rule.type === "dx") diff = (b.x - a.x) - rule.value;
    else if (rule.type === "dy") diff = (b.y - a.y) - rule.value;
    else if (rule.type === "closeX") diff = b.x - a.x;
    else if (rule.type === "closeY") diff = b.y - a.y;
    if (Math.abs(diff) > rule.tol) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 解答ゾーンの見た目 (⭕/❌) と、問題ごとの解答済み状態の保存・復元。
//
// - 不正解の❌はポップして1秒ほどで消える。
// - 正解の⭕は消さない。問題を切り替えて後で戻ってきたときも、
//   そのときの配置と⭕をそのまま復元して見せる (「解答は保存されている」ように見せる)。
// - 問題を切り替えるときは、まず解答ゾーンを空にする (置いてあったパーツは石板に戻る)。
//   ただし切り替え先の問題が解答済みなら、そのときの配置を復元する。
// ---------------------------------------------------------------------------

const submitBtn = document.getElementById("submit-btn");
const markEl = document.getElementById("answer-mark");
const resultEl = document.getElementById("answer-result");
const CROSS_HIDE_MS = 1000;

let markHideTimer = null;
let resultHideTimer = null;

// 問題ごとの正解時スナップショット。 { [questionIndex]: [{file,x,y,rot}, ...] }
const solvedSnapshots = {};

function hideMark() {
  clearTimeout(markHideTimer);
  markEl.classList.remove("show", "circle", "cross");
}

// 解答ゾーンに今あるパーツを、石板の元の位置に戻す
function clearAnswerZone() {
  partsInAnswerZone().forEach((el) => {
    el.classList.add("returning");
    el.style.left = `${el.dataset.homeX}px`;
    el.style.top = `${el.dataset.homeY}px`;
    setTimeout(() => el.classList.remove("returning"), 250);
  });
}

function saveSolvedSnapshot(index) {
  solvedSnapshots[index] = partsInAnswerZone().map((el) => ({
    file: el.dataset.file,
    x: parseFloat(el.style.left),
    y: parseFloat(el.style.top),
    rot: Number(el.dataset.rot) || 0,
  }));
}

// 問題を表示する直前に quiz.js (startQuestion) から呼ばれる。
function prepareAnswerZone(index) {
  clearAnswerZone();
  hideMark();

  const snapshot = solvedSnapshots[index];
  if (!snapshot) return;

  const allParts = [...document.querySelectorAll(".part")];
  snapshot.forEach(({ file, x, y, rot }) => {
    const el = allParts.find((e) => e.dataset.file === file);
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.dataset.rot = rot;
    el.style.setProperty("--rot", `${rot}deg`);
  });
  markEl.classList.add("circle", "show"); // 解答済み: ⭕は消さずに出しておく
}

submitBtn.addEventListener("click", () => {
  const result = checkAnswer(currentQuestionIndex);
  hideMark();
  clearTimeout(resultHideTimer);
  resultEl.classList.remove("show");

  if (result === true) {
    saveSolvedSnapshot(currentQuestionIndex);
    markEl.classList.add("circle");
    requestAnimationFrame(() => markEl.classList.add("show"));
    // 正解は自動で消さない
  } else if (result === false) {
    markEl.classList.add("cross");
    requestAnimationFrame(() => markEl.classList.add("show"));
    markHideTimer = setTimeout(() => markEl.classList.remove("show"), CROSS_HIDE_MS);
  } else {
    resultEl.textContent = "(この問題の判定は未設定です)";
    resultEl.classList.add("show");
    resultHideTimer = setTimeout(() => resultEl.classList.remove("show"), 2000);
  }
});

// 表示中の⭕/❌がある状態でパーツを動かしたら、古い判定結果なので消す
document.addEventListener("parts:changed", () => {
  if (markEl.classList.contains("show")) hideMark();
});
