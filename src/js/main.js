const STAGE_W = 1600;
const STAGE_H = 900;

const stage = document.getElementById("stage");

// ステージを画面いっぱい(アスペクト比維持)に拡縮して中央に置く
function fitStage() {
  const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const offsetX = (window.innerWidth - STAGE_W * scale) / 2;
  const offsetY = (window.innerHeight - STAGE_H * scale) / 2;
  stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// 初期配置のパーツを並べる。
// parts.js の座標は石板の内側基準なので、ステージ座標に変換して置く。
// data-home-x/y は石板上の元の位置 (解答ゾーンの外に放したときに戻る場所)。
function renderParts() {
  const tablet = document.getElementById("parts-tablet");
  const layer = document.getElementById("parts-layer");
  const originX = tablet.offsetLeft + tablet.clientLeft;
  const originY = tablet.offsetTop + tablet.clientTop;

  PARTS_LAYOUT.forEach((p, i) => {
    const homeX = originX + p.x;
    const homeY = originY + p.y;
    const rot = p.rotate || 0;
    const img = document.createElement("img");
    img.className = "part";
    img.src = `${PART_DIR}${p.file}.png`;
    img.alt = "";
    img.draggable = false;
    img.dataset.partId = `${p.file}-${i}`;
    img.dataset.file = p.file;
    img.dataset.homeX = homeX;
    img.dataset.homeY = homeY;
    img.dataset.rot = rot;
    img.style.left = `${homeX}px`;
    img.style.top = `${homeY}px`;
    img.style.width = `${p.size}px`;
    img.style.height = `${p.size}px`;
    img.style.setProperty("--rot", `${rot}deg`);
    if (p.zoneSize) setZoneSize(img, p.size, p.zoneSize);
    layer.appendChild(img);
  });
}

// 解答ゾーンに持っていくと大きさが変わるパーツにする (drag.js が、ドラッグした距離に応じてだんだん変える)。
// 名前は背景の木 (大きい → 小さい) に合わせて bigSize=元の大きさ、smallSize=ゾーンでの大きさ。大きくなる向きでも同じしくみで動く
const ZONE_SIZE_DIST = 300; // これだけ動かすと、ゾーンでの大きさになりきる
function setZoneSize(el, homeSize, zoneSize, dist = ZONE_SIZE_DIST) {
  el.dataset.bigSize = homeSize;
  el.dataset.smallSize = zoneSize;
  el.dataset.shrinkDist = dist;
}

// 松明・風・背景の木を、ドラッグで動かせる装飾として置く (どれも答えに使う。松明は13問目の「ひ」)。
// home 位置=現在の飾り位置なので、解答ゾーンの外に放せばここに戻る。
const DECOR_LAYOUT = [
  { file: "decor_torch", src: "assets/images/decor/torch.png", cx: 1505, cy: 153, size: 130 },
  { file: "decor_wind", src: "assets/images/decor/wind.png", cx: 565, cy: 161, size: 130, opacity: .85 },
  // 背景に置いた大きな木 (Q7 信楽焼の「木」を2回使う)。普段は石板・出題ゾーンの後ろに隠れ、上端と右端から茂みがのぞく。
  // ドラッグするとだんだん小さくなって (size → smallSize。shrinkDist px 動かすと最小)、解答ゾーンに置けるサイズになる。
  // 解答ゾーンの外で放すと、元の大きさで背景 (cx, cy) に戻る。
  { file: "illust_tree", id: "illust_tree-1", src: `${PART_DIR}illust_tree.png`, cx: 230, cy: 20, size: 620, smallSize: 104, shrinkDist: 450, bg: true },
  { file: "illust_tree", id: "illust_tree-2", src: `${PART_DIR}illust_tree.png`, cx: 1330, cy: 10, size: 560, smallSize: 104, shrinkDist: 450, bg: true },
];

function renderDecor() {
  const layer = document.getElementById("parts-layer");
  DECOR_LAYOUT.forEach((d) => {
    const img = document.createElement("img");
    img.className = "part";
    img.src = d.src;
    img.alt = "";
    img.draggable = false;
    img.classList.add("decor"); // チュートリアル中も見せたまま (触れない) にする装飾
    img.dataset.partId = d.id || d.file; // 同じ絵を複数置くもの (木) は id で区別する
    img.dataset.file = d.file;
    img.dataset.homeX = d.cx;
    img.dataset.homeY = d.cy;
    const rot = d.rotate || 0;
    img.dataset.rot = rot;
    img.style.left = `${d.cx}px`;
    img.style.top = `${d.cy}px`;
    img.style.width = `${d.size}px`;
    img.style.height = `${d.size}px`;
    img.style.setProperty("--rot", `${rot}deg`);
    if (d.opacity) img.style.opacity = d.opacity;
    if (d.bg) { // 背景に大きく置くパーツ: ふだんは他のものの後ろ。ドラッグ中は drag.js が前に出して小さくする
      img.classList.add("bg");
      img.dataset.bigSize = d.size;
      img.dataset.smallSize = d.smallSize;
      img.dataset.shrinkDist = d.shrinkDist;
    }
    layer.appendChild(img);
  });
}

// 9問目の「壁」のパーツ。ふだんは壁の中 (非表示) で、9問目だけ背景をドラッグすると取り出せる (drag.js)。
// 大きさは背景の格子 1マスぶん。home (戻る場所) は取り出した位置になる。
const WALL_QUESTION_INDEX = 8; // 9問目
const WALL_W = 128;
const WALL_H = 64;

function renderWall() {
  const el = document.createElement("div");
  el.className = "part wall in-wall";
  el.dataset.partId = "wall";
  el.dataset.file = "wall";
  el.dataset.rot = 0;
  el.style.width = `${WALL_W}px`;
  el.style.height = `${WALL_H}px`;
  el.style.left = "0px";
  el.style.top = "0px";
  document.getElementById("parts-layer").appendChild(el);
}

// 10問目の答え「10」のパーツ。ふだんは問題番号「10/15」の中 (非表示)。
// 10問目だけ、問題番号の「10」(黒字) をドラッグすると取り出せる (drag.js)。解答ゾーンの外で放すと番号に戻る。
const TEN_QUESTION_INDEX = 9; // 10問目
const NUM_PART_W = 64;
const NUM_PART_H = 48;

function renderNumberPart() {
  const el = document.createElement("div");
  el.className = "part num-part in-number";
  el.dataset.partId = "num_10";
  el.dataset.file = "num_10";
  el.dataset.rot = 0;
  el.textContent = "10";
  el.style.width = `${NUM_PART_W}px`;
  el.style.height = `${NUM_PART_H}px`;
  el.style.left = "0px";
  el.style.top = "0px";
  document.getElementById("parts-layer").appendChild(el);
}

// 正解の⭕から取り出すパーツ。15問目「Quiz」の Q の丸に使う。
// ふだんは⭕の中 (非表示)。解答済みの問題の⭕をドラッグして石板の上で放すと、パーツになる (drag.js)。
// 取り出した後は、正解しても⭕は出なくなり、正解の音だけが鳴る (answers.js)。
const MARK_PART_SIZE = 80;

function renderMarkCirclePart() {
  const el = document.createElement("div");
  el.className = "part mark-circle in-mark";
  el.dataset.partId = "answer_circle";
  el.dataset.file = "answer_circle";
  el.dataset.rot = 0;
  el.style.width = `${MARK_PART_SIZE}px`;
  el.style.height = `${MARK_PART_SIZE}px`;
  el.style.left = "0px";
  el.style.top = "0px";
  document.getElementById("parts-layer").appendChild(el);
}

// 音量の調節画面 (天狗の鼻の左) にあるベルのパーツ。もう1つのベルとして答えに使える (9問目 / 11問目)。
// ふだんは音量の画面の中 (ステージ上は非表示)。音量の画面のベルをドラッグすると、画面が閉じてパーツとして取り出せる (drag.js)。
// 解答ゾーンの外で放すと、音量の画面に戻る。押しただけ (動かさない) のときはベルが鳴るだけ。
const VOLUME_BELL_SIZE = 64; // 音量の画面のベル (#volume-bell) と同じ大きさ
const VOLUME_BELL_ZONE_SIZE = 96; // 解答ゾーンに持っていくと、この大きさになる
const VOLUME_BELL_HOME = { x: 652, y: 415 }; // 音量の画面のベルの中心 (ステージ座標)。開いていないときに使う目安 (debug-solve.js)

function renderVolumeBellPart() {
  const img = document.createElement("img");
  img.className = "part ui-bell in-volume";
  img.src = `${PART_DIR}illust_bell.png`;
  img.alt = "";
  img.draggable = false;
  img.dataset.partId = "ui_bell";
  img.dataset.file = "ui_bell";
  img.dataset.origin = "bell"; // 石板に置かずに放したら、音量の画面に戻る (drag.js)
  img.dataset.rot = 270; // 音量の画面のベルと同じ、90度左に回した向き
  img.style.setProperty("--rot", "270deg");
  img.dataset.homeX = VOLUME_BELL_HOME.x;
  img.dataset.homeY = VOLUME_BELL_HOME.y;
  img.style.left = `${VOLUME_BELL_HOME.x}px`;
  img.style.top = `${VOLUME_BELL_HOME.y}px`;
  img.style.width = `${VOLUME_BELL_SIZE}px`;
  img.style.height = `${VOLUME_BELL_SIZE}px`;
  setZoneSize(img, VOLUME_BELL_SIZE, VOLUME_BELL_ZONE_SIZE);
  document.getElementById("parts-layer").appendChild(img);
}

// 音量の画面のベルは、パーツを取り出している間は空っぽ (見えない) にする
function refreshVolumeBell() {
  const part = document.querySelector(".part.ui-bell");
  document.getElementById("volume-bell").classList.toggle("taken", !part || !part.classList.contains("in-volume"));
}

// 16問目 (最終問題「天狗」) のパーツ: 偽天狗と、天狗の鼻。16問目でだけ出る (CSS #stage.final)。
// - 偽天狗: メニューの「説明をもう一度見る」で出てくる偽天狗をドラッグすると取り出せる (ふだんは in-ask で非表示)
// - 鼻: 音量の画面の鼻 (つまみ以外の所) をドラッグすると取り出せる (ふだんは in-nose で非表示)
// どちらも石板か解答ゾーンに置ける。それ以外で放すと元 (天狗 / 音量の画面) に戻る。
// 絵の縦横比が正方形でないので、data-aspect (幅/高さ) を持たせ、大きさは高さで扱う (drag.js)
const FINAL_PARTS = [
  { file: "nise_tengu", origin: "ask", cls: "nise-tengu in-ask", src: "assets/images/tengu/nise_tengu.png", aspect: 954 / 1061, size: 214, zoneSize: 150, rot: 0 },
  { file: "tengu_nose", origin: "nose", cls: "tengu-nose in-nose", src: "assets/images/tengu/tengu_nose.png", aspect: 432 / 272, size: 118, zoneSize: 76, rot: 180 },
];

function renderFinalParts() {
  const layer = document.getElementById("parts-layer");
  FINAL_PARTS.forEach((p) => {
    const img = document.createElement("img");
    img.className = `part final-part ${p.cls}`;
    img.src = p.src;
    img.alt = "";
    img.draggable = false;
    img.dataset.partId = p.file;
    img.dataset.file = p.file;
    img.dataset.aspect = p.aspect;
    img.dataset.origin = p.origin;
    img.dataset.rot = p.rot;
    img.style.setProperty("--rot", `${p.rot}deg`);
    img.style.left = "0px";
    img.style.top = "0px";
    img.style.width = `${p.size * p.aspect}px`;
    img.style.height = `${p.size}px`;
    setZoneSize(img, p.size, p.zoneSize);
    layer.appendChild(img);
  });
}

// 音量の画面の鼻は、16問目で取り出している間・答えに使った後は消す
function refreshVolumeNose() {
  const part = document.querySelector(".part.tengu-nose");
  document.getElementById("volume-nose").classList.toggle("taken", !!part && !part.classList.contains("in-nose"));
}

// チュートリアルの例題 (富士山) 用のパーツ。チュートリアル中だけ石板に出る (ほかのパーツは隠れる)。
// 「山」は逆さま (180度) で置いておき、ダブルクリック2回で元に戻すのを教える。
const TUTORIAL_PARTS = [
  { file: "tut_fu", x: 825, y: 330, rot: 0 },
  { file: "tut_plus", x: 975, y: 330, rot: 0 },
  { file: "tut_bar", x: 1125, y: 330, rot: 0 },
  { file: "tut_yama", x: 1275, y: 330, rot: 180 },
];
const TUTORIAL_PART_SIZE = 100;

function renderTutorialParts() {
  const layer = document.getElementById("parts-layer");
  TUTORIAL_PARTS.forEach((p) => {
    const img = document.createElement("img");
    img.className = "part tut-part";
    img.src = `${PART_DIR}${p.file}.png`;
    img.alt = "";
    img.draggable = false;
    img.dataset.partId = p.file;
    img.dataset.file = p.file;
    img.dataset.homeX = p.x;
    img.dataset.homeY = p.y;
    img.dataset.startRot = p.rot;
    img.style.width = `${TUTORIAL_PART_SIZE}px`;
    img.style.height = `${TUTORIAL_PART_SIZE}px`;
    layer.appendChild(img);
  });
  resetTutorialParts();
}

// 例題のパーツを最初の位置・向きに戻す (チュートリアルをもう一度見るときにも使う)
function resetTutorialParts() {
  document.querySelectorAll(".part.tut-part").forEach((el) => {
    el.style.left = `${el.dataset.homeX}px`;
    el.style.top = `${el.dataset.homeY}px`;
    el.dataset.rot = el.dataset.startRot;
    el.style.setProperty("--rot", `${el.dataset.startRot}deg`);
    el.classList.remove("frozen", "is-hidden", "returning", "dragging");
  });
}

window.addEventListener("resize", fitStage);
fitStage();
renderParts();
renderDecor();
renderWall();
renderNumberPart();
renderMarkCirclePart();
renderVolumeBellPart();
renderFinalParts();
renderTutorialParts();
