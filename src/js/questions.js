// 問題データ。表示は 5 文字ごとに改行される。
// answer は出題ゾーンに表示するテキスト。漢字が入る答えには reading (ふりがな) を付ける: 偽天狗が「小節（こぶし）」のように言う (2026-11-27 ユーザー指示)。
//正誤判定に使う配置ルールは answers.js 側 (ANSWER_CHECKS) に分けている。
const TOTAL_QUESTIONS = 15; // 「1/15」の分母

// チュートリアルの例題 (元スライドの富士山の問題)。問題番号の代わりに TUTORIAL_INDEX (-1) で扱う
const TUTORIAL_INDEX = -1;
const EXAMPLE_QUESTION = { text: "日本一高い山は何？", answer: "富士山", reading: "ふじさん" };
function questionAt(index) {
  if (index === TUTORIAL_INDEX) return EXAMPLE_QUESTION;
  if (index === FINAL_INDEX) return FINAL_QUESTION;
  return QUESTIONS[index];
}

const QUESTIONS = [
  { text: "赤いきつねと対比の麺は緑の何？", answer: "たぬき" },
  { text: "きくらげとはどんなものの仲間？", answer: "きのこ" },
  { text: "声を伸ばし震わせる歌い方は何？", answer: "小節", reading: "こぶし" },
  { text: "『はなび』何のレゲエグループ？", answer: "湘南乃風", reading: "しょうなんのかぜ" }, // 旧4問目「げっぷ」を置き換え
  { text: "緊張をしたときの汗を何という？", answer: "冷汗", reading: "ひやあせ" },
  { text: "おでこから鼻の部分は何ゾーン？", answer: "T" },
  { text: "タヌキの置物が有名な焼物は何？", answer: "信楽焼", reading: "しがらきやき" },
  { text: "囲碁盤の天元は特にいくつの点？", answer: "９" },
  { text: "ドイツの分裂を象徴する壁は何？", answer: "ベルリンの壁", reading: "ベルリンのかべ" },
  { text: "「風速」とは何分間の風の平均？", answer: "１０" },
  { text: "ピーターパンの相棒の妖精は何？", answer: "ティンカーベル" },
  { text: "モンキー・パンチの漫画怪盗何？", answer: "ルパン" },
  { text: "ひにかこまれるのはどんなはな？", answer: "ひまわり" },
  { text: "ダヴィンチの有名な女性画は何？", answer: "モナ・リザ" },
  { text: "あなたはいまなにをしているか？", answer: "Quiz" }, // 15問目 (What're you doing？/ Quiz)
];

// 16問目 (最終問題)。15問目に正解すると開く。問題は出ない (白紙)。答えは「天狗」:
// メニューの「説明をもう一度見る」で出てくる偽天狗と、音量の画面の天狗の鼻を解答ゾーンに置く (2026-11-20 ユーザー指定)
const FINAL_INDEX = QUESTIONS.length; // 15 (16問目)
const FINAL_QUESTION = { text: "", answer: "天狗" };
