// 開発用ツール:「正解を並べる」ボタンで、表示中の問題の正解の配置に、パーツを一発で並べる。
// ゾーンにある関係ないパーツは元の場所へ戻す。並べるだけで、「これで回答」は押さない。
// 9問目の壁・10問目の「10」・15問目の⭕の丸・音量の画面のベルのように、ふつうは取り出す操作が要るパーツも、ここではそのまま取り出して使う。
// 判定ルールを変えたら、ここの配置も answers.js の ANSWER_CHECKS に合うように直すこと。

(() => {
  const btn = document.getElementById("debug-solve-btn");
  const msgEl = document.getElementById("answer-result");

  // 問題番号 (0 始まり) -> 並べるパーツ。x, y は解答ゾーンの内側の左上を 0,0 とした座標 (中心)。
  // file を | で並べたものは、使えるほうを前から順に探す。rot は指定したものだけ回す。
  const Y = 87; // ゾーンの内側 (高さ174) の縦の中央
  const row = (files) => files.map((file, i) => ({ file, x: 110 + 150 * i, y: Y }));
  const SOLUTIONS = {
    [TUTORIAL_INDEX]: [
      { file: "tut_fu", x: 150, y: Y },
      { file: "tut_plus", x: 300, y: 50 },
      { file: "tut_bar", x: 300, y: 125 },
      { file: "tut_yama", x: 450, y: Y, rot: 0 },
    ],
    0: [{ file: "illust_tanuki", x: 440, y: Y }],
    1: row(["hira_ki", "hira_no", "hira_ko"]),
    2: [
      { file: "kanji_shou", x: 120, y: Y },
      { file: "illust_bamboo", x: 260, y: 45 },
      { file: "kanji_soku", x: 260, y: 130 },
    ],
    3: row(["kanji_shou_2", "illust_compass_south", "kanji_no", "decor_wind"]),
    4: row(["kata_n", "kanji_rei", "kata_shi", "kanji_kan"]),
    5: [{ file: "kata_to", x: 440, y: Y, rot: 90 }],
    6: row(["illust_shiga", "kata_ra", "illust_tree", "kata_ya", "illust_tree"]),
    7: [{ file: "digit_9", x: 440, y: Y, rot: 0 }],
    8: row(["illust_bell|ui_bell", "kata_ri", "kata_n", "hira_no", "wall"]),
    9: [{ file: "num_10", x: 440, y: Y }],
    10: row(["kata_te", "kata_small_i", "kata_n", "illust_car", "illust_bell|ui_bell"]),
    11: [
      { file: "kata_ru", x: 120, y: 100 },
      { file: "kata_ha", x: 250, y: 100 },
      { file: "symbol_circle|answer_circle", x: 306, y: 44 },
      { file: "kata_n", x: 400, y: 100 },
    ],
    12: [
      { file: "decor_torch", x: 200, y: Y },
      { file: "illust_arrows", x: 360, y: Y },
    ],
    13: [{ file: "illust_monalisa", x: 440, y: Y }],
    14: [
      { file: "answer_circle|symbol_circle", x: 120, y: 80 },
      { file: "punct_comma", x: 165, y: 128 },
      { file: "latin_n_lower", x: 250, y: 100, rot: 180 },
      { file: "punct_exclam", x: 330, y: 100, rot: 180 },
      { file: "latin_N", x: 410, y: 100, rot: 90 },
    ],
  };

  // 壁を取り出したことにするときの、取り出した跡の位置 (ステージ座標。左下の背景)
  const WALL_HOLE_AT = { x: 330, y: 850 };
  const MARK_CIRCLE_HOME = { x: 1420, y: 525 }; // ⭕の丸を取り出したことにするときの、石板の上の置き場所 (右下)

  let msgTimer = null;
  function say(text) {
    clearTimeout(msgTimer);
    msgEl.textContent = text;
    msgEl.classList.add("show");
    msgTimer = setTimeout(() => msgEl.classList.remove("show"), 2500);
  }

  const place = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };
  const setRot = (el, rot) => { el.dataset.rot = rot; el.style.setProperty("--rot", `${rot}deg`); };
  const setSize = (el, size) => { el.style.width = `${size}px`; el.style.height = `${size}px`; };

  // パーツを元の場所 (石板 / 背景) へ戻す
  function sendHome(el) {
    place(el, Number(el.dataset.homeX), Number(el.dataset.homeY));
    if (el.dataset.bigSize) { setSize(el, Number(el.dataset.bigSize)); el.style.zIndex = ""; }
    if (el.classList.contains("wall")) { // 壁は穴に戻してふさぐ
      el.classList.add("in-wall");
      document.getElementById("wall-hole").hidden = true;
    }
  }

  // まだ使っていない (どの問題の正解にも使われていない) パーツ
  const usable = (el) => !el.classList.contains("frozen") && consumedBy[el.dataset.partId] === undefined;

  // 壁・「10」・⭕の丸は、ふだんの取り出す操作 (9問目で背景 / 10問目で問題番号 / 解答済みの⭕をドラッグ) をしたことにして使えるようにする
  function takeOut(el) {
    if (el.classList.contains("num-part") && el.classList.contains("in-number")) {
      const span = document.querySelector("#question-number .num-take");
      const r = span.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const scale = s.width / STAGE_W;
      el.dataset.homeX = (r.left + r.width / 2 - s.left) / scale;
      el.dataset.homeY = (r.top + r.height / 2 - s.top) / scale;
      el.classList.remove("in-number");
      refreshQuestionNumber();
    }
    if (el.classList.contains("mark-circle") && el.classList.contains("in-mark")) {
      el.classList.remove("in-mark");
      delete el.dataset.fresh;
      el.dataset.homeX = MARK_CIRCLE_HOME.x;
      el.dataset.homeY = MARK_CIRCLE_HOME.y;
      takeMarkCircle();
    }
    if (el.classList.contains("ui-bell") && el.classList.contains("in-volume")) {
      el.classList.remove("in-volume");
      el.dataset.homeX = VOLUME_BELL_HOME.x;
      el.dataset.homeY = VOLUME_BELL_HOME.y;
      refreshVolumeBell();
    }
    if (el.classList.contains("wall") && el.classList.contains("in-wall")) {
      el.classList.remove("in-wall");
      el.dataset.homeX = WALL_HOLE_AT.x;
      el.dataset.homeY = WALL_HOLE_AT.y;
      const hole = document.getElementById("wall-hole");
      hole.style.left = `${WALL_HOLE_AT.x}px`;
      hole.style.top = `${WALL_HOLE_AT.y}px`;
      hole.hidden = false;
    }
  }

  function solve() {
    const index = currentQuestionIndex;
    const layout = SOLUTIONS[index];
    if (!layout) { say("(この問題の正解配置は未設定)"); return; }
    if (isQuestionSolved(index)) { say("(この問題は正解済み)"); return; }

    // 使うパーツを選ぶ (同じ file が複数あるときは、まだ選んでいないものを順に)
    const chosen = [];
    for (const item of layout) {
      const files = item.file.split("|");
      let el = null;
      for (const f of files) {
        el = [...document.querySelectorAll(`.part[data-file="${f}"]`)].find((p) => usable(p) && !chosen.includes(p));
        if (el) break;
      }
      if (!el) { say(`(${item.file} が残っていない)`); return; }
      chosen.push(el);
    }

    // ゾーンにある関係ないパーツは元の場所へ戻す
    partsInAnswerZone().forEach((el) => { if (!chosen.includes(el)) sendHome(el); });

    const z = window.getAnswerZoneRect();
    layout.forEach((item, i) => {
      const el = chosen[i];
      takeOut(el);
      if (el.dataset.bigSize) { setSize(el, Number(el.dataset.smallSize)); el.style.zIndex = 50; } // 背景の木は小さくして手前に
      if (item.rot !== undefined) setRot(el, item.rot);
      place(el, z.l + item.x, z.t + item.y);
    });
    document.dispatchEvent(new CustomEvent("parts:changed"));
  }

  btn.addEventListener("click", solve);
})();
