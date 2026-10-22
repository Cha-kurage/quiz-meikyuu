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

// 松明・風は答えのパーツではないが、ドラッグで動かせる装飾として置く。
// home 位置=現在の飾り位置なので、解答ゾーンの外に放せばここに戻る。
const DECOR_LAYOUT = [
  { file: "decor_torch", src: "assets/images/decor/torch.png", cx: 1505, cy: 153, size: 130 },
  { file: "decor_wind", src: "assets/images/decor/wind.png", cx: 565, cy: 161, size: 130, opacity: .85 },
];

function renderDecor() {
  const layer = document.getElementById("parts-layer");
  DECOR_LAYOUT.forEach((d) => {
    const img = document.createElement("img");
    img.className = "part";
    img.src = d.src;
    img.alt = "";
    img.draggable = false;
    img.dataset.partId = d.file;
    img.dataset.file = d.file;
    img.dataset.homeX = d.cx;
    img.dataset.homeY = d.cy;
    img.dataset.rot = 0;
    img.style.left = `${d.cx}px`;
    img.style.top = `${d.cy}px`;
    img.style.width = `${d.size}px`;
    img.style.height = `${d.size}px`;
    img.style.setProperty("--rot", "0deg");
    if (d.opacity) img.style.opacity = d.opacity;
    layer.appendChild(img);
  });
}

window.addEventListener("resize", fitStage);
fitStage();
renderParts();
renderDecor();
