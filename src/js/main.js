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
    layer.appendChild(img);
  });
}

// 松明・風・背景の木・右上のベルを、ドラッグで動かせる装飾として置く (どれも答えに使う。松明は13問目の「ひ」)。
// home 位置=現在の飾り位置なので、解答ゾーンの外に放せばここに戻る。
const DECOR_LAYOUT = [
  { file: "decor_torch", src: "assets/images/decor/torch.png", cx: 1505, cy: 153, size: 130 },
  { file: "decor_wind", src: "assets/images/decor/wind.png", cx: 565, cy: 161, size: 130, opacity: .85 },
  // 右上の音量ボタンのベル (90度左に回した状態)。そのままドラッグすれば、もう1つのベルとして答えに使える (9問目 / 11問目)。
  // ドラッグせずに押したときは、音量ボタンとして扱う (音量ページは未実装。今はベルの音を鳴らすだけ: sound.js)
  { file: "ui_bell", src: `${PART_DIR}illust_bell.png`, cx: 1538, cy: 54, size: 76, rotate: 270, ui: "volume" },
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
    if (d.ui) img.dataset.ui = d.ui;
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

// 正解の⭕ (赤丸) から取り出すパーツ。12問目「ルパン」の「゜」(ハ → パ) に使う。
// ふだんは⭕の中 (非表示)。解答済みの問題の⭕をドラッグすると取り出せ、石板に置くとパーツになる (drag.js)。
const RED_CIRCLE_SIZE = 44;

function renderRedCircle() {
  const el = document.createElement("div");
  el.className = "part red-circle in-mark";
  el.dataset.partId = "red_circle";
  el.dataset.file = "red_circle";
  el.dataset.rot = 0;
  el.style.width = `${RED_CIRCLE_SIZE}px`;
  el.style.height = `${RED_CIRCLE_SIZE}px`;
  el.style.left = "0px";
  el.style.top = "0px";
  document.getElementById("parts-layer").appendChild(el);
}

window.addEventListener("resize", fitStage);
fitStage();
renderParts();
renderDecor();
renderWall();
renderRedCircle();
