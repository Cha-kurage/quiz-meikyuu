// クリア後の「あなたの早押しクイズ力」(2026-11-27 ユーザー指示)。評価は D・C・B・A・S・SS。
// 評価のしかた (Claude が決めたもの。変えるときはここだけ):
//   1〜15問目それぞれ、どの段階で正解したか (quiz.js の solveStage) で点をつける。
//     問題文を読み終わる前に正解 (早押し) = 2点 / 読み終わってから、天狗が答えを言う前 = 1点 / 天狗が答えを言った後・未正解 = 0点
//   合計 (最大30点) で RANKS のいちばん上から当てはまるもの。
// 画像は canvas で描いて PNG にする (保存・長押しで保存できる)。ネタバレになる答えや問題文は載せない。

const RANK_POINTS = { early: 2, read: 1, told: 0 };
const RANKS = [ // min 点以上ならその評価
  { rank: "SS", min: 27, color: ["#fff1b8", "#e8b83c", "#c0392b"], comment: "天狗もびっくりの早押し王！" },
  { rank: "S", min: 22, color: ["#fff1b8", "#e8b83c", "#b8860b"], comment: "迷宮も驚く早押しの達人！" },
  { rank: "A", min: 16, color: ["#ffd0c4", "#e05a3c", "#9c2a17"], comment: "かなりの早押し上手！" },
  { rank: "B", min: 10, color: ["#d8ecff", "#5a9be0", "#2a5c9c"], comment: "なかなかの早押し力！" },
  { rank: "C", min: 5, color: ["#dff5d8", "#5cb85c", "#2e7a2e"], comment: "じっくり考えるタイプ！" },
  { rank: "D", min: 0, color: ["#eeeeee", "#a8a8a8", "#666666"], comment: "天狗の答えをよく聞いた！" },
];

function quizRank() {
  const stages = { early: 0, read: 0, told: 0 };
  let points = 0;
  for (let i = 0; i <= LAST_QUESTION_INDEX; i++) {
    const st = solveStage[i];
    if (!st) continue;
    stages[st]++;
    points += RANK_POINTS[st];
  }
  const r = RANKS.find((x) => points >= x.min) || RANKS[RANKS.length - 1];
  return { ...r, points, stages };
}

const RANK_IMG_W = 1200;
const RANK_IMG_H = 630;
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// 「あなたの早押しクイズ力」の画像 (PNG の data URL) を作る
async function drawRankImage(result) {
  const c = document.createElement("canvas");
  c.width = RANK_IMG_W;
  c.height = RANK_IMG_H;
  const g = c.getContext("2d");
  const W = RANK_IMG_W;
  const H = RANK_IMG_H;

  // 背景: 暗い木の色に、真ん中だけ光
  const bg = g.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, W * 0.7);
  bg.addColorStop(0, "#5a3416");
  bg.addColorStop(0.55, "#2a170c");
  bg.addColorStop(1, "#120a05");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // 金のふち (二重)
  g.strokeStyle = "#c9a24a";
  g.lineWidth = 10;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.lineWidth = 2;
  g.strokeRect(40, 40, W - 80, H - 80);

  // 天狗 (左下と右下に、向かい合わせ)
  const tengu = await loadImage("assets/images/tengu/nise_tengu.png");
  if (tengu) {
    const th = 230;
    const tw = th * tengu.width / tengu.height;
    g.globalAlpha = 0.9;
    g.drawImage(tengu, 70, H - th - 62, tw, th);
    g.save();
    g.translate(W - 70, H - th - 62);
    g.scale(-1, 1);
    g.drawImage(tengu, 0, 0, tw, th);
    g.restore();
    g.globalAlpha = 1;
  }

  g.textAlign = "center";
  g.textBaseline = "middle";

  // 上: 「Quiz迷宮」と「あなたの早押しクイズ力」
  g.fillStyle = "#c9a24a";
  g.font = `bold 34px ${MINCHO}`;
  g.fillText("Quiz迷宮  クリア", W / 2, 92);
  g.fillStyle = "#f3e2b0";
  g.font = `bold 62px ${MINCHO}`;
  g.fillText("あなたの早押しクイズ力", W / 2, 162);

  // 評価の文字 (大きく、光らせて)
  const [c0, c1, c2] = result.color;
  const size = result.rank.length > 1 ? 250 : 280;
  g.font = `bold ${size}px ${MINCHO}`;
  const grad = g.createLinearGradient(0, 230, 0, 470);
  grad.addColorStop(0, c0);
  grad.addColorStop(0.5, c1);
  grad.addColorStop(1, c2);
  g.save();
  g.shadowColor = c1;
  g.shadowBlur = 40;
  g.fillStyle = grad;
  g.fillText(result.rank, W / 2, 355);
  g.restore();
  g.lineWidth = 4;
  g.strokeStyle = "rgba(40, 20, 8, .8)";
  g.strokeText(result.rank, W / 2, 355);

  // ひとこと
  g.fillStyle = "#f3e2b0";
  g.font = `bold 40px ${MINCHO}`;
  g.fillText(result.comment, W / 2, 500);

  // 下: ハッシュタグ
  g.fillStyle = "#c9a24a";
  g.font = `28px ${MINCHO}`;
  g.fillText("#天狗のクイズ迷宮  #からのもぬけ", W / 2, 562);

  return c.toDataURL("image/png");
}
