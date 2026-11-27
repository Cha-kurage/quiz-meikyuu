// クリア後の「あなたの早押しクイズ力」(2026-11-27 ユーザー指示)。評価は D・C・B・A・S・SS。
// 評価のしかた (2026-11-27 ユーザー指示: 全問の解答にかかった時間の平均から出す):
//   1〜15問目それぞれの「記録」(quiz.js の solveTimes = 正解したときのタイマーの値。タイマーは問題文が出始めると動き、
//   早押しボタンで止まる) を15問ぶん足して15で割る。正解していない問題は 0秒 として数える
//   (早めに最終問題に気付いて、ほかのクイズに答えずにクリアした人ほど、平均が短くなって評価が高くなるように。2026-11-27 ユーザー指示)。
//   平均が RANKS の maxSec 秒以下なら、いちばん上から当てはまる評価 (区切りの秒数は Claude が決めたもの。変えるときはここだけ)。
//   目安: 問題文 (15文字) を出し切るのに約2.7秒、天狗が答えを言うまで約8秒。
// 画像は canvas で描いて PNG にする (保存・長押しで保存できる)。ネタバレになる答えや問題文は載せない。

const UNSOLVED_MS = 0; // 正解していない問題は 0秒 として数える
const RANKS = [ // 平均が maxSec 秒以下ならその評価
  { rank: "SS", maxSec: 3, color: ["#fff1b8", "#e8b83c", "#c0392b"], comment: "天狗もびっくりの早押し王！" },
  { rank: "S", maxSec: 5, color: ["#fff1b8", "#e8b83c", "#b8860b"], comment: "迷宮も驚く早押しの達人！" },
  { rank: "A", maxSec: 8, color: ["#ffd0c4", "#e05a3c", "#9c2a17"], comment: "かなりの早押し上手！" },
  { rank: "B", maxSec: 15, color: ["#d8ecff", "#5a9be0", "#2a5c9c"], comment: "なかなかの早押し力！" },
  { rank: "C", maxSec: 30, color: ["#dff5d8", "#5cb85c", "#2e7a2e"], comment: "じっくり考えるタイプ！" },
  { rank: "D", maxSec: Infinity, color: ["#eeeeee", "#a8a8a8", "#666666"], comment: "天狗の答えをよく聞いた！" },
];

function quizRank() {
  let total = 0;
  let unsolved = 0;
  const count = LAST_QUESTION_INDEX + 1; // 1〜15問目
  for (let i = 0; i < count; i++) {
    if (i in solveTimes) total += solveTimes[i];
    else { total += UNSOLVED_MS; unsolved++; }
  }
  const avgSec = total / count / 1000;
  const r = RANKS.find((x) => avgSec <= x.maxSec) || RANKS[RANKS.length - 1];
  return { ...r, avgSec, unsolved };
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
  const grad = g.createLinearGradient(0, 210, 0, 450);
  grad.addColorStop(0, c0);
  grad.addColorStop(0.5, c1);
  grad.addColorStop(1, c2);
  g.save();
  g.shadowColor = c1;
  g.shadowBlur = 40;
  g.fillStyle = grad;
  g.fillText(result.rank, W / 2, 335);
  g.restore();
  g.lineWidth = 4;
  g.strokeStyle = "rgba(40, 20, 8, .8)";
  g.strokeText(result.rank, W / 2, 335);

  // 平均の解答時間 (正解していない問題はペナルティの時間で数えている)
  g.fillStyle = "#e9cf86";
  g.font = `bold 30px ${MINCHO}`;
  g.fillText(`平均解答時間  ${result.avgSec.toFixed(1)}秒`, W / 2, 470);

  // ひとこと
  g.fillStyle = "#f3e2b0";
  g.font = `bold 40px ${MINCHO}`;
  g.fillText(result.comment, W / 2, 522);

  // 下: ハッシュタグ
  g.fillStyle = "#c9a24a";
  g.font = `26px ${MINCHO}`;
  g.fillText("#天狗のクイズ迷宮  #からのもぬけ", W / 2, 574);

  return c.toDataURL("image/png");
}
