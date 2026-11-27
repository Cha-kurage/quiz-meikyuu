// パーツ置き場 (石板) の初期配置。
// 座標は石板の内側(820x440)基準の中心座標。size は画像の一辺(px)、rotate は度。
// zoneSize があるパーツは、解答ゾーンへ持っていくとその大きさになる (ドラッグ中にだんだん変わる。背景の木と同じしくみ)。
const PART_DIR = "assets/images/parts/";

// 1行ぶんを等間隔で並べる
function row(y, files, { startX, pitch, size, rotate = 0 }) {
  return files.map((file, i) => ({ file, x: startX + pitch * i, y, size, rotate }));
}
// row で作った中の1つだけ、向きや大きさを変える
function tweak(list, file, props) {
  const p = list.find((q) => q.file === file);
  Object.assign(p, props);
  return list;
}

const PARTS_LAYOUT = [
  // 1行目: きこのの９ィシテト
  // 「り」があった場所に「９」(8問目。90度左に回して置き、元の向きに戻して答える) を置く (2026-11-20 ユーザー指示)
  ...tweak(row(62, [
    "hira_ki", "hira_ko", "hira_no", "hira_no", "digit_9",
    "kata_small_i", "kata_shi", "kata_te", "kata_to",
  ], { startX: 58, pitch: 88, size: 88 }), "digit_9", { rotate: 270 }),

  // 2行目: ハヤラリルンンンン
  ...row(148, [
    "kata_ha", "kata_ya", "kata_ra", "kata_ri", "kata_ru",
    "kata_n", "kata_n", "kata_n", "kata_n",
  ], { startX: 58, pitch: 88, size: 88 }),

  // 3行目: 乃小干令即湘9
  // 3行目: 乃小干令即湘 と回る矢印 (13問目ひまわりの「まわり」。「り」の代わり: 2026-11-20 ユーザー指示)
  ...row(234, [
    "kanji_no", "kanji_shou", "kanji_kan", "kanji_rei",
    "kanji_soku", "kanji_shou_2", "illust_arrows",
  ], { startX: 58, pitch: 88, size: 88 }),

  // 3行目右端: 小さめの記号 (赤の n, N, 、, ！ と、黒の ◯)。◯ は12問目ルパンの「゜」用 (仮素材。2026-11-17 に作成)
  // 解答ゾーンに持っていくと大きくなる (「、」: 2026-11-20 / ほか: 2026-11-27 ユーザー指示。15問目「Quiz」の文字が小さすぎたので)
  ...[
    // i (！) と z (N) は大きすぎたので 85 に (2026-11-27 ユーザー指示)。12問目では◯は大きくしない (drag.js の ZONE_SIZE_BY_QUESTION)
    ["latin_n_lower", 110], ["latin_N", 85], ["punct_comma", 110], ["punct_exclam", 85], ["symbol_circle", 120],
  ].reduce((list, [file, zoneSize]) => tweak(list, file, { zoneSize }), row(240, [
    "latin_n_lower", "latin_N", "punct_comma", "punct_exclam", "symbol_circle",
  ], { startX: 648, pitch: 38, size: 50 })),

  // 4行目: イラスト
  ...row(372, [
    "illust_bell", "illust_car", "illust_tanuki", "illust_bamboo",
    "illust_compass_south", "illust_shiga", "illust_monalisa",
  ], { startX: 76, pitch: 110, size: 104 }),
];
