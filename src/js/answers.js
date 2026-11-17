// 正誤判定。
//
// 絶対座標では判定しない。どこに置いても良く、パーツ同士の「座標の関係」だけをチェックする。
// 座標はパーツの中心。x は右へ、y は下へ向かって大きくなる (画面の座標系)。
// 位置合わせの基準値は「座標を調べる」ボタン (debug-coords.js) で正解の配置を作って読み取る。
//
// ルールの種類:
//   ltX    : a の x が b の x より小さい (a が b より左にある)
//   ltY    : a の y が b の y より小さい (a が b より上にある)
//   dx     : (b の x) - (a の x) が value に近いか (tol, px 以内。縦位置は自由)
//   dy     : (b の y) - (a の y) が value に近いか (tol, px 以内。横位置は自由)
//   closeX : a と b の x 座標の差が tol (px) 以内か (縦に並べる、のような「揃える」系の制約)
//   closeY : a と b の y 座標の差が tol (px) 以内か (横に並べる、のような「揃える」系の制約)
//   rot    : a の回転角が value 度か (value は 0/90/180/270。ダブルクリックで90度ずつ時計回りに回る)
//   rotated: a が回転している (0度以外ならどの向きでも良い)
//
// required のパーツがすべて解答ゾーンにあり、rules をすべて満たせば正解。
// ゾーンに required 以外のパーツが混ざっているときは不正解 (関係ないパーツは外してから解答する)。
// 同じ file を2回使う答え (信楽焼の「木」など) は、required に "illust_tree#1", "illust_tree#2" のように
// "#番号" を付けて書く。rules でもその名前で呼び分ける (file は # より前の部分)。
// どちらのパーツでも良いもの (石板のベル / 右上の音量ボタンのベル) は "illust_bell|ui_bell" のように | で並べる。
// 同じ file のパーツが複数ゾーンにあるとき (の が2個、ン が4個など) は、どの1個を使っても良いので、
// どれか1つの組み合わせでルールを満たせば正解にする。
// ルールが無い(=キーが無い)問題は、まだ判定ロジックを用意していない問題。

const ANSWER_CHECKS = {
  0: { // Q1 たぬき: 単体イラストなので置く位置はどこでも良い
    required: ["illust_tanuki"],
    rules: [],
  },
  1: { // Q2 きのこ: x が き < の < こ の順になっていれば良い (y は自由)
    required: ["hira_ki", "hira_no", "hira_ko"],
    rules: [
      { type: "ltX", a: "hira_ki", b: "hira_no" },
      { type: "ltX", a: "hira_no", b: "hira_ko" },
    ],
  },
  2: { // Q3 小節: 小が竹・即より左にあり、竹が即の上にある (「竹」の下に「即」で「節」)
    required: ["kanji_shou", "illust_bamboo", "kanji_soku"],
    rules: [
      { type: "ltX", a: "kanji_shou", b: "illust_bamboo" },
      { type: "ltX", a: "kanji_shou", b: "kanji_soku" },
      { type: "ltY", a: "illust_bamboo", b: "kanji_soku" },
    ],
  },
  3: { // Q4 湘南乃風: x が 湘 < 南 < 乃 < 風 の順になっていれば良い (風は装飾のイラストをドラッグして使う)
    required: ["kanji_shou_2", "illust_compass_south", "kanji_no", "decor_wind"],
    rules: [
      { type: "ltX", a: "kanji_shou_2", b: "illust_compass_south" },
      { type: "ltX", a: "illust_compass_south", b: "kanji_no" },
      { type: "ltX", a: "kanji_no", b: "decor_wind" },
    ],
  },
  4: { // Q5 冷汗: x が ン < 令 < シ < 干 の順 (冷 = ン + 令、汗 = シ + 干)。ン は4個あるのでどれでも良い
    required: ["kata_n", "kanji_rei", "kata_shi", "kanji_kan"],
    rules: [
      { type: "ltX", a: "kata_n", b: "kanji_rei" },
      { type: "ltX", a: "kanji_rei", b: "kata_shi" },
      { type: "ltX", a: "kata_shi", b: "kanji_kan" },
    ],
  },
  5: { // Q6 T: ト を90度回転 (ダブルクリック1回) すれば T に見える。置く位置は自由
    required: ["kata_to"],
    rules: [
      { type: "rot", a: "kata_to", value: 90 },
    ],
  },
  6: { // Q7 信楽焼 (しがらきやき): x が 滋賀 < ラ < 木 < ヤ < 木 の順。木は背景の2本のどちらでも良い
    required: ["illust_shiga", "kata_ra", "illust_tree#1", "kata_ya", "illust_tree#2"],
    rules: [
      { type: "ltX", a: "illust_shiga", b: "kata_ra" },
      { type: "ltX", a: "kata_ra", b: "illust_tree#1" },
      { type: "ltX", a: "illust_tree#1", b: "kata_ya" },
      { type: "ltX", a: "kata_ya", b: "illust_tree#2" },
    ],
  },
  7: { // Q8 ９: 単体パーツなので置く位置はどこでも良い (元スライドの使用パーツも「９」のみ)
    required: ["digit_9"],
    rules: [],
  },
  8: { // Q9 ベルリンの壁: x が ベル < リ < ン < の < 壁 の順。壁は9問目だけ、背景をドラッグして取り出せる (drag.js)。
    // ベルは石板のベル・右上の音量ボタンのベルのどちらでも良い (もう片方は11問目で使う)
    required: ["illust_bell|ui_bell", "kata_ri", "kata_n", "hira_no", "wall"],
    rules: [
      { type: "ltX", a: "illust_bell|ui_bell", b: "kata_ri" },
      { type: "ltX", a: "kata_ri", b: "kata_n" },
      { type: "ltX", a: "kata_n", b: "hira_no" },
      { type: "ltX", a: "hira_no", b: "wall" },
    ],
  },
  9: { // Q10 １０ (テン): 読点「、」(テン) 1つ。置く位置・向きは自由 (ユーザー指定 2026-11-16)。
    // 「、」は元スライドでは15問目 (、uZi) 用だったので、15問目を作るときは別の形を考える
    required: ["punct_comma"],
    rules: [],
  },
  10: { // Q11 ティンカーベル: x が テ < ィ < ン < 車(カー) < ベル の順。ベルはどちらでも良い
    required: ["kata_te", "kata_small_i", "kata_n", "illust_car", "illust_bell|ui_bell"],
    rules: [
      { type: "ltX", a: "kata_te", b: "kata_small_i" },
      { type: "ltX", a: "kata_small_i", b: "kata_n" },
      { type: "ltX", a: "kata_n", b: "illust_car" },
      { type: "ltX", a: "illust_car", b: "illust_bell|ui_bell" },
    ],
  },
  11: { // Q12 ルパン: x が ル < ハ < ン の順。ハ の右上に赤丸 (゜) を置いて パ にする (ユーザー指定 2026-11-17)。
    // 赤丸は、前の問題 (解答済み) の⭕をドラッグして石板に持っていくと取れる (drag.js)。
    // 「右上」は、赤丸の中心が ハ の中心より右かつ上で、ン の中心より左にあることで見る
    required: ["kata_ru", "kata_ha", "red_circle", "kata_n"],
    rules: [
      { type: "ltX", a: "kata_ru", b: "kata_ha" },
      { type: "ltX", a: "kata_ha", b: "kata_n" },
      { type: "ltX", a: "kata_ha", b: "red_circle" },
      { type: "ltY", a: "red_circle", b: "kata_ha" },
      { type: "ltX", a: "red_circle", b: "kata_n" },
    ],
  },
  12: { // Q13 ひまわり: 松明(ひ = 火)を回転させて (まわ) その右に り を置く → ひ・まわ・り。松明の向きは0度以外なら良い
    required: ["decor_torch", "hira_ri"],
    rules: [
      { type: "rotated", a: "decor_torch" },
      { type: "ltX", a: "decor_torch", b: "hira_ri" },
    ],
  },
  13: { // Q14 モナ・リザ: 単体イラスト。この問題の後も石板に 、uZi だけが残る (最終問題用) ので、他のパーツは使わない
    required: ["illust_monalisa"],
    rules: [],
  },
};

const allParts = () => [...document.querySelectorAll(".part")];

function isInAnswerZone(el) {
  const z = window.getAnswerZoneRect();
  const x = parseFloat(el.style.left);
  const y = parseFloat(el.style.top);
  return x >= z.l && x <= z.r && y >= z.t && y <= z.b;
}

// 判定・凍結の対象になるパーツ: 解答ゾーンの中にあって、いま見えていて、まだ凍結されていないもの
function partsInAnswerZone() {
  return allParts().filter((el) =>
    !el.classList.contains("is-hidden") && !el.classList.contains("frozen") && isInAnswerZone(el));
}

function ruleHolds(rule, byFile) {
  const a = byFile[rule.a];
  const b = byFile[rule.b];
  switch (rule.type) {
    case "ltX": return a.x < b.x;
    case "ltY": return a.y < b.y;
    case "dx": return Math.abs((b.x - a.x) - rule.value) <= rule.tol;
    case "dy": return Math.abs((b.y - a.y) - rule.value) <= rule.tol;
    case "closeX": return Math.abs(b.x - a.x) <= rule.tol;
    case "closeY": return Math.abs(b.y - a.y) <= rule.tol;
    case "rot": return (((a.rot % 360) + 360) % 360) === rule.value;
    case "rotated": return (((a.rot % 360) + 360) % 360) !== 0;
    default: return false;
  }
}

// 判定して、正解なら「正解に使われたパーツ(要素)の配列」を返す。
// 戻り値: 配列=正解 / null=不正解 / undefined=この問題はまだ判定ルール未設定
function matchAnswer(index) {
  const cfg = ANSWER_CHECKS[index];
  if (!cfg) return undefined;

  // required の file ごとに、解答ゾーンにあるパーツ(複数ありうる)を集める
  const zoneEls = partsInAnswerZone();
  // 答えに関係ないパーツがゾーンに混ざっていたら不正解 (全部置けば通ってしまうのを防ぐ)
  if (zoneEls.length !== cfg.required.length) return null;
  const filesOf = (key) => key.split("#")[0].split("|");
  const candidates = cfg.required.map((key) => zoneEls.filter((e) => filesOf(key).includes(e.dataset.file)));
  if (candidates.some((c) => c.length === 0)) return null; // 必要なパーツが解答ゾーンに無い

  const posOf = (el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), rot: Number(el.dataset.rot) || 0 });

  // 同じ file が複数あるときは、どれか1つの組み合わせで全ルールを満たせば正解。
  // (required に同じ file を2回書いたときは、別々のパーツを使う)
  const search = (i, chosen) => {
    if (i === cfg.required.length) {
      const byFile = {};
      chosen.forEach((el, k) => { byFile[cfg.required[k]] = posOf(el); });
      return cfg.rules.every((rule) => ruleHolds(rule, byFile)) ? chosen : null;
    }
    for (const el of candidates[i]) {
      if (chosen.includes(el)) continue;
      const found = search(i + 1, [...chosen, el]);
      if (found) return found;
    }
    return null;
  };
  return search(0, []);
}

// 戻り値: true=正解 / false=不正解 / null=この問題はまだ判定ルール未設定
function checkAnswer(index) {
  const matched = matchAnswer(index);
  return matched === undefined ? null : matched !== null;
}

// ---------------------------------------------------------------------------
// 解答ゾーンの見た目 (⭕/❌) と、パーツの「使用済み」「凍結」の管理。
//
// - 不正解の❌はポップして1秒ほどで消える。正解の⭕は消さない。
// - 未解答の問題: ゾーンに置いたパーツは、問題を切り替えてもそのまま残り、石板には戻らない。
//   石板へ戻すには、ゾーンの外へドラッグして放す (ゾーン外で放すと元の位置に戻る: drag.js)。
// - 正解した問題: 正解に使ったパーツを凍結して、その問題のゾーンを凍結する
//   (パーツは動かせない・回転できない。「これで解答」も押せない。新しいパーツも置けない)。
//   ゾーンにあった正解以外のパーツは、使用済みにならず未使用のまま残る
//   (先に置いておいた次の問題のパーツが、巻き込まれて使えなくなるのを防ぐ)。
// - 凍結したパーツは使用済みで、石板にも他の問題の画面にも戻らない。
//   その問題を開き直したときだけ、凍結した配置と⭕が見える。
// ---------------------------------------------------------------------------

const submitBtn = document.getElementById("submit-btn");
const markEl = document.getElementById("answer-mark");
const resultEl = document.getElementById("answer-result");
const CROSS_HIDE_MS = 1000;

let markHideTimer = null;
let resultHideTimer = null;

const solvedParts = {}; // 問題番号 -> 正解したときに解答ゾーンにあったパーツの id (partId)
const consumedBy = {};  // パーツの id -> そのパーツを使って正解した問題の番号

function hideMark() {
  clearTimeout(markHideTimer);
  markEl.classList.remove("show", "circle", "cross", "grabbable");
}

// ---- ⭕から赤丸を取り出す (12問目ルパンの「゜」) ----
// 取り出せる赤丸は1つだけ。取り出した問題の⭕は、それ以降その問題では出さない。
let circleTakenFrom = null; // 赤丸を取り出した問題の番号 (取り出していなければ null)

// 解答済みの問題で⭕を出す。まだ赤丸を取り出していなければ、⭕を掴めるようにする
function showSolvedMark(index) {
  if (index === circleTakenFrom) return;
  markEl.classList.add("circle", "show");
  const circle = document.querySelector(".part.red-circle");
  markEl.classList.toggle("grabbable", circleTakenFrom === null && !!circle && circle.classList.contains("in-mark"));
}

// drag.js から: ⭕を掴んだ (赤丸のパーツとして取り出した)
function takeCircleMark(index) {
  circleTakenFrom = index;
  hideMark();
}

// drag.js から: 石板まで持っていかずに放したので、赤丸を⭕に戻す
function restoreCircleMark() {
  circleTakenFrom = null;
  if (isQuestionSolved(currentQuestionIndex)) showSolvedMark(currentQuestionIndex);
}

// 表示する問題に合わせて、パーツの表示/非表示と凍結状態を切り替える
function showQuestionZone(index) {
  const solved = index in solvedParts;
  allParts().forEach((el) => {
    const owner = consumedBy[el.dataset.partId];
    const own = owner === index;
    // 使用済みパーツは、それを使った問題の画面でだけ見える。
    // 解答済みの問題では凍結した中身だけを見せたいので、ゾーンに置いてある未使用パーツは一時的に隠す。
    const hidden = owner !== undefined ? !own : solved && isInAnswerZone(el);
    el.classList.toggle("is-hidden", hidden);
    el.classList.toggle("frozen", own);
  });
  submitBtn.disabled = solved;
}

// 正解した問題のゾーンを凍結する (els = 正解に使ったパーツ)
function freezeAnswerZone(index, els) {
  solvedParts[index] = els.map((el) => el.dataset.partId);
  els.forEach((el) => { consumedBy[el.dataset.partId] = index; });
  showQuestionZone(index); // 正解パーツを凍結し、ゾーンにある未使用パーツは、この問題の画面では隠す
}

// 解答済み(凍結中)の問題か。drag.js が、凍結中のゾーンに新しいパーツを置かせないために使う
function isQuestionSolved(index) {
  return index in solvedParts;
}

// 問題を表示する直前に quiz.js (startQuestion) から呼ばれる。
function prepareAnswerZone(index) {
  hideMark();
  showQuestionZone(index);
  if (index in solvedParts) showSolvedMark(index); // 解答済み: ⭕は消さずに出しておく
}

submitBtn.addEventListener("click", () => {
  const matched = matchAnswer(currentQuestionIndex);
  hideMark();
  clearTimeout(resultHideTimer);
  resultEl.classList.remove("show");

  playSound(matched ? "correct" : matched === null ? "incorrect" : "click");
  if (matched) {
    freezeAnswerZone(currentQuestionIndex, matched);
    markEl.classList.add("circle");
    requestAnimationFrame(() => showSolvedMark(currentQuestionIndex));
    // 正解は自動で消さない
  } else if (matched === null) {
    markEl.classList.add("cross");
    requestAnimationFrame(() => markEl.classList.add("show"));
    markHideTimer = setTimeout(() => markEl.classList.remove("show"), CROSS_HIDE_MS);
  } else {
    resultEl.textContent = "(この問題の判定は未設定です)";
    resultEl.classList.add("show");
    resultHideTimer = setTimeout(() => resultEl.classList.remove("show"), 2000);
  }
});

// 表示中の⭕/❌がある状態でパーツを動かしたら、古い判定結果なので消す。
// ただし解答済み(凍結中)の問題の⭕は、石板のパーツを触っただけでは消さない。
document.addEventListener("parts:changed", () => {
  if (markEl.classList.contains("show") && !isQuestionSolved(currentQuestionIndex)) hideMark();
});
