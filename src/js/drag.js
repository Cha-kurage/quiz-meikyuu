// パーツのドラッグ移動 + ダブルクリックで90度回転。
// - 解答ゾーンの中で放すと、その位置に置かれる (ゾーンからはみ出さないよう補正するだけで、吸い付き・スナップはしない)
// - 背景に大きく置いたパーツ (木) は、ドラッグするとだんだん小さくなり、ゾーンの外で放すと元の大きさで背景へ戻る
// - 解答ゾーンの外で放すと、石板上の元の位置に戻る (解答済みで凍結中のゾーンも、外と同じ扱いで置けない)
// - 9問目だけ、背景 (何も無い所) をドラッグすると壁がパーツとして取れる。跡からは外の草原と鉄格子が見える
// - 16問目だけ、音量の画面の鼻と、「説明をもう一度見る」で出てくる偽天狗をドラッグすると、パーツとして取り出せる
// - 音量の画面 (メニューから開く) の鼻の左のベルは、ドラッグすると画面が閉じてパーツとして取り出せる。
//   解答ゾーンの外で放すと音量の画面に戻る。動かさずに押したときは、ベルが鳴るだけ
// - 10問目だけ、問題番号「10/15」の「10」をドラッグするとパーツとして取れる。ゾーンの外で放すと番号に戻る
// - チュートリアル中は、例題 (富士山) のパーツのうち、いまのセリフで使うものだけ動かせる (tutorial.js)
// - 解答済みの問題の⭕をドラッグすると、丸のパーツとして取り出せる (15問目 Quiz の Q)。
//   石板の上で放すとそこに置かれてパーツになる。石板以外で放すと⭕に戻る
// マウス・タッチ共通 (Pointer Events)。ステージの拡縮を考慮してステージ座標で扱う。

(() => {
  const layer = document.getElementById("parts-layer");
  const zone = document.getElementById("answer-zone");

  let topZ = 1;
  let drag = null; // { el, pointerId, dx, dy, moved }

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  // 範囲より部品が大きいときは中央に寄せる
  const clampIn = (v, min, max) => (min > max ? (min + max) / 2 : clamp(v, min, max));

  function toStage(e) {
    const r = stage.getBoundingClientRect();
    const scale = r.width / STAGE_W;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  const center = (el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
  function setCenter(el, x, y) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  // 解答ゾーンの内側(枠線を除く)の範囲。debug-coords.js からも使うので公開する
  function zoneRect() {
    const l = zone.offsetLeft + zone.clientLeft;
    const t = zone.offsetTop + zone.clientTop;
    return { l, t, r: l + zone.clientWidth, b: t + zone.clientHeight };
  }
  window.getAnswerZoneRect = zoneRect;

  // 大きさは高さで扱う。正方形でないパーツ (偽天狗・鼻) は data-aspect (幅/高さ) で幅を決める
  function setSize(el, size) {
    el.style.width = `${size * (Number(el.dataset.aspect) || 1)}px`;
    el.style.height = `${size}px`;
  }

  // 要素の中心 (ステージ座標)
  function stageCenterOf(el) {
    const r = el.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const scale = s.width / STAGE_W;
    return { x: (r.left + r.width / 2 - s.left) / scale, y: (r.top + r.height / 2 - s.top) / scale };
  }

  // 石板の内側 (枠を除く) の範囲
  const tablet = document.getElementById("parts-tablet");
  function pointInTablet(x, y) {
    const l = tablet.offsetLeft + tablet.clientLeft;
    const t = tablet.offsetTop + tablet.clientTop;
    return x >= l && x <= l + tablet.clientWidth && y >= t && y <= t + tablet.clientHeight;
  }

  function pointInZone(x, y) {
    const z = zoneRect();
    return x >= z.l && x <= z.r && y >= z.t && y <= z.b;
  }

  // 背景に大きく置いてあるパーツ (木) は、ドラッグで動かした距離に応じて big → small へだんだん小さくなる。
  // 掴んだ位置が絵の上で同じ場所に留まるよう、掴んだ位置からの相対位置 (rel, サイズ比) を保ってサイズを変える。
  // すでに小さいもの (解答ゾーンに置いた木) を掴んだときは、小さいまま。
  function shrinkInfo(el, p, c) {
    if (!el.dataset.bigSize) return null;
    const big = Number(el.dataset.bigSize);
    const small = Number(el.dataset.smallSize);
    const size = el.offsetHeight;
    return {
      big, small,
      dist: Number(el.dataset.shrinkDist),
      startFrac: clamp((big - size) / (big - small), 0, 1), // 0=大きい / 1=小さい
      from: p,
      rel: { x: (c.x - p.x) / size, y: (c.y - p.y) / size },
    };
  }

  // パーツが変化した (置いた/回転した) ことを通知する。debug-coords.js が購読する
  function notifyChanged() {
    document.dispatchEvent(new CustomEvent("parts:changed"));
  }

  function drop(el) {
    const { x, y } = center(el);
    const z = zoneRect();
    const zoneOpen = !isQuestionSolved(currentQuestionIndex); // 解答済み(凍結中)の問題のゾーンには置けない
    if (zoneOpen && x >= z.l && x <= z.r && y >= z.t && y <= z.b) {
      if (el.dataset.bigSize) setSize(el, Number(el.dataset.smallSize)); // 解答ゾーンに置いた木は必ず小さいサイズ
      const hw = el.offsetWidth / 2, hh = el.offsetHeight / 2;
      setCenter(el, clampIn(x, z.l + hw, z.r - hw), clampIn(y, z.t + hh, z.b - hh));
    } else if (["mark", "ask", "nose"].includes(el.dataset.origin) && pointInTablet(x, y)) {
      // 取り出したパーツ (⭕の丸 / 偽天狗 / 鼻) は、石板の上で放すとそこに置かれる (以後はそこが戻り先)
      el.dataset.homeX = x;
      el.dataset.homeY = y;
      if (el.dataset.bigSize) el.dataset.bigSize = el.offsetHeight; // 戻るときも、今の大きさのまま
      delete el.dataset.fresh;
    } else {
      el.classList.add("returning");
      setCenter(el, Number(el.dataset.homeX), Number(el.dataset.homeY));
      if (el.dataset.bigSize) setSize(el, Number(el.dataset.bigSize)); // 背景の元の大きさに戻る
      setTimeout(() => {
        el.classList.remove("returning");
        if (el.classList.contains("dragging")) return; // 戻る途中でまた掴まれていたら、そのまま
        if (el.classList.contains("bg")) el.style.zIndex = ""; // 戻り終えたら背景の後ろへ
        if (el.classList.contains("wall")) closeWallHole(el); // 壁は元の穴に収まり、穴がふさがる
        if (el.dataset.fresh) { // まだ石板に置いていない、取り出したパーツは元に戻る
          delete el.dataset.fresh;
          restoreTaken(el);
        }
        if (el.classList.contains("num-part")) { // 「10」は問題番号の中に戻る
          el.classList.add("in-number");
          refreshQuestionNumber();
        }
      }, 250);
    }
    notifyChanged();
  }

  const TAP_MOVE_PX = 6; // これ以上動かしたらドラッグ、動かさずに放したら「押した」扱い (音量の画面のベル)

  function beginDrag(el, e) {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);

    const p = toStage(e);
    const c = center(el);
    drag = { el, pointerId: e.pointerId, dx: c.x - p.x, dy: c.y - p.y, shrink: shrinkInfo(el, p, c) };
    el.classList.remove("returning");
    el.classList.add("dragging");
    el.style.zIndex = ++topZ;
  }

  layer.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".part");
    if (!el || drag) return;
    // チュートリアル中は、いまのセリフで使う例題のパーツだけ動かせる (tutorial.js)
    if (inTutorial() && !tutorialCanMove(el)) { e.preventDefault(); return; }
    beginDrag(el, e);
  });

  // ---- 9問目の壁: 背景 (何も無い所) をドラッグすると、そこの壁がパーツとして取れる ----
  // 取った跡 (#wall-hole) からは、外の草原と鉄格子が見える。
  // 解答ゾーンの外で放すと元の穴に戻ってふさがる。答えに使う (正解する) と、穴は開いたまま。
  const wallHole = document.getElementById("wall-hole");

  function closeWallHole(wall) {
    wall.classList.add("in-wall");
    wallHole.hidden = true;
  }

  stage.addEventListener("pointerdown", (e) => {
    if (e.target !== stage || drag) return; // ゾーンやボタン、パーツの上ではなく、背景そのものを押したときだけ
    if (currentQuestionIndex !== WALL_QUESTION_INDEX) return;
    const wall = document.querySelector(".part.wall");
    if (!wall || !wall.classList.contains("in-wall")) return; // 壁は1つだけ。もう取り出してあるときは何もしない

    const p = toStage(e);
    wall.dataset.homeX = p.x;
    wall.dataset.homeY = p.y;
    setCenter(wall, p.x, p.y);
    wallHole.style.left = `${p.x}px`;
    wallHole.style.top = `${p.y}px`;
    wallHole.hidden = false;
    wall.classList.remove("in-wall");
    beginDrag(wall, e);
  });

  // ---- 解答済みの問題の⭕: ドラッグすると丸のパーツとして取り出せる ----
  const markEl = document.getElementById("answer-mark");
  markEl.addEventListener("pointerdown", (e) => {
    if (drag || !markEl.classList.contains("grabbable")) return;
    const circle = document.querySelector(".part.mark-circle");
    if (!circle || !circle.classList.contains("in-mark")) return; // 取り出せるのは1つだけ

    const cs = getComputedStyle(markEl);
    circle.dataset.homeX = parseFloat(cs.left); // 石板まで持っていかなければ、⭕の位置へ戻る
    circle.dataset.homeY = parseFloat(cs.top);
    circle.dataset.fresh = "1";
    circle.dataset.origin = "mark";
    const p = toStage(e);
    setCenter(circle, p.x, p.y);
    circle.classList.remove("in-mark");
    takeMarkCircle();
    beginDrag(circle, e);
  });

  // ---- 10問目: 問題番号「10/15」の「10」をドラッグすると、パーツとして取り出せる ----
  document.getElementById("question-number").addEventListener("pointerdown", (e) => {
    const span = e.target.closest(".num-take");
    if (!span || drag || span.classList.contains("taken")) return;
    if (currentQuestionIndex !== TEN_QUESTION_INDEX || isQuestionSolved(currentQuestionIndex)) return;
    const part = document.querySelector(".part.num-part");
    if (!part || !part.classList.contains("in-number")) return;

    // 番号の「10」がある位置 (ステージ座標) から取り出す。戻すときもここへ
    const r = span.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const scale = s.width / STAGE_W;
    const cx = (r.left + r.width / 2 - s.left) / scale;
    const cy = (r.top + r.height / 2 - s.top) / scale;
    part.dataset.homeX = cx;
    part.dataset.homeY = cy;
    setCenter(part, cx, cy);
    part.classList.remove("in-number");
    refreshQuestionNumber();
    beginDrag(part, e);
  });

  // ---- 画面の中の絵をドラッグすると、パーツとして取り出せるもの (音量の画面のベル・鼻、偽天狗) ----
  // 押しただけでは取り出さず、少し (TAP_MOVE_PX) 動かしたところで取り出す。
  //   pressable(e): 押したのを受け付けるか (受け付けたら、ほかの処理 (音量のつまみなど) には渡さない)
  //   takeable(): 取り出してよいか / part(): 取り出すパーツ / hideClass: パーツが元の所にある間のクラス
  //   onTake(): 取り出したときの後始末 (画面を閉じるなど) / onTap(): 押しただけのとき
  function pressToTake(source, opts) {
    let press = null; // { pointerId, from }
    source.addEventListener("pointerdown", (e) => {
      if (drag || press || !opts.pressable(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      press = { pointerId: e.pointerId, from: toStage(e) };
    });
    document.addEventListener("pointermove", (e) => {
      if (!press || e.pointerId !== press.pointerId) return;
      const p = toStage(e);
      if (Math.hypot(p.x - press.from.x, p.y - press.from.y) < TAP_MOVE_PX) return;
      const from = press.from;
      press = null;
      const part = opts.part();
      if (!opts.takeable() || !part || !part.classList.contains(opts.hideClass)) return;

      // 画面の絵の位置 (ステージ座標) から取り出す。石板に置くまでは、戻るときもここへ
      const c = stageCenterOf(source);
      part.dataset.homeX = c.x;
      part.dataset.homeY = c.y;
      part.dataset.fresh = "1";
      if (part.dataset.bigSize) setSize(part, Number(part.dataset.bigSize));
      setCenter(part, c.x + p.x - from.x, c.y + p.y - from.y); // 掴んだ位置が絵の上で同じ場所に留まるように
      part.classList.remove(opts.hideClass);
      opts.onTake();
      beginDrag(part, e);
    });
    const end = (e, tapped) => {
      if (!press || e.pointerId !== press.pointerId) return;
      press = null;
      if (tapped && opts.onTap) opts.onTap(e);
    };
    document.addEventListener("pointerup", (e) => end(e, true));
    document.addEventListener("pointercancel", (e) => end(e, false));
  }

  // 取り出したパーツを、石板に置かずに放したとき: 元の所 (⭕ / 音量の画面 / 天狗) に戻す
  function restoreTaken(el) {
    switch (el.dataset.origin) {
      case "mark": el.classList.add("in-mark"); restoreMarkCircle(); break;
      case "bell": el.classList.add("in-volume"); refreshVolumeBell(); break;
      case "nose": el.classList.add("in-nose"); refreshVolumeNose(); break;
      case "ask": el.classList.add("in-ask"); break;
    }
  }

  // 音量の画面の鼻の左のベル: 押しただけならベルが鳴る。チュートリアル中・16問目は取り出せない
  const volumeBell = document.getElementById("volume-bell");
  pressToTake(volumeBell, {
    pressable: () => !volumeBell.classList.contains("taken"),
    takeable: () => !inTutorial() && currentQuestionIndex !== FINAL_INDEX,
    part: () => document.querySelector(".part.ui-bell"),
    hideClass: "in-volume",
    onTake: () => { refreshVolumeBell(); closeVolume(); }, // 解答ゾーンが見えるように、音量の画面を閉じる (menu.js)
    onTap: () => playSound("bell"),
  });

  // 16問目: 音量の画面の天狗の鼻 (つまみ以外の所) をドラッグすると、鼻を取り出せる (鼻が真っ赤のときだけ)。
  // ほかの問題や、つまみを押したときは、ふだんどおり音量を変える (menu.js)
  const volumeTrack = document.getElementById("volume-track");
  const nosePart = () => document.querySelector(".part.tengu-nose");
  // 鼻が真っ赤 (音量 100) のときだけ (2026-11-20 ユーザー指示)。それ以外は鼻を押すと、ふだんどおり音量が変わる
  const noseTakeable = () => !inTutorial() && currentQuestionIndex === FINAL_INDEX && !isQuestionSolved(FINAL_INDEX) &&
    getVolume() >= 100 &&
    !!nosePart() && nosePart().classList.contains("in-nose");
  pressToTake(volumeTrack, {
    pressable: (e) => noseTakeable() && !e.target.closest("#volume-knob"),
    takeable: noseTakeable,
    part: nosePart,
    hideClass: "in-nose",
    onTake: () => { refreshVolumeNose(); closeVolume(); },
  });

  // 「説明をもう一度見る」で出てきた偽天狗をドラッグすると、偽天狗を取り出せる (どの問題でも)
  const askTengu = document.getElementById("tut-tengu");
  const tenguPart = () => document.querySelector(".part.nise-tengu");
  // 16問目に限らず、どの問題でも取り出せる (2026-11-24 ユーザー指示)。取り出した偽天狗は、ほかのパーツと同じに扱う
  const tenguTakeable = () => isTutorialAsking() && !inTutorial() && !isQuestionSolved(FINAL_INDEX) &&
    !!tenguPart() && tenguPart().classList.contains("in-ask");
  pressToTake(askTengu, {
    pressable: tenguTakeable,
    takeable: tenguTakeable,
    part: tenguPart,
    hideClass: "in-ask",
    onTake: () => closeTutorialAsk(), // 聞くのをやめて、天狗はパーツになる (tutorial.js)
  });

  layer.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = toStage(e);
    const s = drag.shrink;
    if (s) {
      const moved = Math.hypot(p.x - s.from.x, p.y - s.from.y);
      const frac = pointInZone(p.x, p.y) ? 1 : clamp(s.startFrac + moved / s.dist, 0, 1);
      const size = s.big + (s.small - s.big) * frac;
      setSize(drag.el, size);
      setCenter(drag.el, clamp(p.x + s.rel.x * size, 0, STAGE_W), clamp(p.y + s.rel.y * size, 0, STAGE_H));
    } else {
      setCenter(drag.el, clamp(p.x + drag.dx, 0, STAGE_W), clamp(p.y + drag.dy, 0, STAGE_H));
    }
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const el = drag.el;
    drag = null;
    el.classList.remove("dragging");
    drop(el);
  }
  layer.addEventListener("pointerup", endDrag);
  layer.addEventListener("pointercancel", endDrag);

  // ダブルクリック(ダブルタップ)で90度回転
  layer.addEventListener("dblclick", (e) => {
    const el = e.target.closest(".part");
    if (!el) return;
    if (inTutorial() && !tutorialCanMove(el)) return;
    const rot = (Number(el.dataset.rot) + 90) % 360;
    el.dataset.rot = rot;
    el.style.setProperty("--rot", `${rot}deg`);
    notifyChanged();
  });
})();
