// パーツ置き場 (石板) の初期配置。
// 座標は石板の内側(820x440)基準の中心座標。size は画像の一辺(px)、rotate は度。
const PART_DIR = "assets/images/parts/";

// 1行ぶんを等間隔で並べる
function row(y, files, { startX, pitch, size, rotate = 0 }) {
  return files.map((file, i) => ({ file, x: startX + pitch * i, y, size, rotate }));
}

const PARTS_LAYOUT = [
  // 1行目: きこののりィシテト
  ...row(62, [
    "hira_ki", "hira_ko", "hira_no", "hira_no", "hira_ri",
    "kata_small_i", "kata_shi", "kata_te", "kata_to",
  ], { startX: 58, pitch: 88, size: 88 }),

  // 2行目: ハヤラリルンンンン
  ...row(148, [
    "kata_ha", "kata_ya", "kata_ra", "kata_ri", "kata_ru",
    "kata_n", "kata_n", "kata_n", "kata_n",
  ], { startX: 58, pitch: 88, size: 88 }),

  // 3行目: 乃小干令即湘9
  ...row(234, [
    "kanji_no", "kanji_shou", "kanji_kan", "kanji_rei",
    "kanji_soku", "kanji_shou_2", "digit_9",
  ], { startX: 58, pitch: 88, size: 88 }),

  // 3行目右端: 赤い小さめの記号 (n, N, 、, ！)
  ...row(240, [
    "latin_n_lower", "latin_N", "punct_comma", "punct_exclam",
  ], { startX: 645, pitch: 47, size: 54 }),

  // 4行目: イラスト
  ...row(372, [
    "illust_bell", "illust_car", "illust_tanuki", "illust_bamboo",
    "illust_compass_south", "illust_shiga", "illust_monalisa",
  ], { startX: 76, pitch: 110, size: 104 }),
];
