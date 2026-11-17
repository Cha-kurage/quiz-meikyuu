// パーツのドラッグ移動 + ダブルクリックで90度回転。
// - 解答ゾーンの中で放すと、その位置に置かれる (ゾーンからはみ出さないよう補正するだけで、吸い付き・スナップはしない)
// - 背景に大きく置いたパーツ (木) は、ドラッグするとだんだん小さくなり、ゾーンの外で放すと元の大きさで背景へ戻る
// - 解答ゾーンの外で放すと、石板上の元の位置に戻る (解答済みで凍結中のゾーンも、外と同じ扱いで置けない)
// - 9問目だけ、背景 (何も無い所) をドラッグすると壁がパーツとして取れる。跡からは外の草原と鉄格子が見える
// - 右上のベル (音量ボタン) は、動かさずに押すと音量ボタン、ドラッグするとパーツとして動く
// - 解答済みの問題の⭕をドラッグすると、赤丸のパーツとして取り出せる (12問目ルパンの「゜」)。
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

  function setSize(el, size) {
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }

  // 石板の内側 (枠を除く) の範囲
  const tablet = document.getElementById("parts-tablet");
  function tabletRect() {
    const l = tablet.offsetLeft + tablet.clientLeft;
    const t = tablet.offsetTop + tablet.clientTop;
    return { l, t, r: l + tablet.clientWidth, b: t + tablet.clientHeight };
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
    const size = el.offsetWidth;
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
      const half = el.offsetWidth / 2;
      setCenter(el, clampIn(x, z.l + half, z.r - half), clampIn(y, z.t + half, z.b - half));
    } else if (el.classList.contains("red-circle") && (() => { const t = tabletRect(); return x >= t.l && x <= t.r && y >= t.t && y <= t.b; })()) {
      // 赤丸は石板の上で放すと、そこに置かれる (以後はそこが戻り先)
      const t = tabletRect();
      const half = el.offsetWidth / 2;
      setCenter(el, clampIn(x, t.l + half, t.r - half), clampIn(y, t.t + half, t.b - half));
      el.dataset.homeX = parseFloat(el.style.left);
      el.dataset.homeY = parseFloat(el.style.top);
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
        if (el.dataset.fresh) { // まだ石板に置いていない赤丸は、⭕に戻る
          delete el.dataset.fresh;
          el.classList.add("in-mark");
          restoreCircleMark();
        }
      }, 250);
    }
    notifyChanged();
  }

  const TAP_MOVE_PX = 6; // これ以上動かしたらドラッグ、動かさずに放したら「押した」扱い (右上のベル)

  function beginDrag(el, e) {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);

    const p = toStage(e);
    const c = center(el);
    drag = { el, pointerId: e.pointerId, dx: c.x - p.x, dy: c.y - p.y, shrink: shrinkInfo(el, p, c), from: p, moved: false };
    el.classList.remove("returning");
    el.classList.add("dragging");
    el.style.zIndex = ++topZ;
  }

  layer.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".part");
    if (!el || drag) return;
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

  // ---- 解答済みの問題の⭕: ドラッグすると赤丸のパーツとして取り出せる ----
  const markEl = document.getElementById("answer-mark");
  markEl.addEventListener("pointerdown", (e) => {
    if (drag || !markEl.classList.contains("grabbable")) return;
    const circle = document.querySelector(".part.red-circle");
    if (!circle || !circle.classList.contains("in-mark")) return; // 赤丸は1つだけ

    const cs = getComputedStyle(markEl);
    circle.dataset.homeX = parseFloat(cs.left); // 石板まで持っていかなければ、⭕の位置へ戻る
    circle.dataset.homeY = parseFloat(cs.top);
    circle.dataset.fresh = "1";
    const p = toStage(e);
    setCenter(circle, p.x, p.y);
    circle.classList.remove("in-mark");
    takeCircleMark(currentQuestionIndex);
    beginDrag(circle, e);
  });

  layer.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = toStage(e);
    if (!drag.moved && Math.hypot(p.x - drag.from.x, p.y - drag.from.y) >= TAP_MOVE_PX) drag.moved = true;
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
    const tapped = !drag.moved;
    drag = null;
    el.classList.remove("dragging");
    // 右上のベルを、動かさずに押して放したときは音量ボタンとして扱う (元の位置にあるときだけ)
    const atHome = parseFloat(el.style.left) === Number(el.dataset.homeX) && parseFloat(el.style.top) === Number(el.dataset.homeY);
    if (tapped && el.dataset.ui === "volume" && atHome) {
      document.dispatchEvent(new CustomEvent("volume:press"));
      return;
    }
    drop(el);
  }
  layer.addEventListener("pointerup", endDrag);
  layer.addEventListener("pointercancel", endDrag);

  // ダブルクリック(ダブルタップ)で90度回転
  layer.addEventListener("dblclick", (e) => {
    const el = e.target.closest(".part");
    if (!el) return;
    const rot = (Number(el.dataset.rot) + 90) % 360;
    el.dataset.rot = rot;
    el.style.setProperty("--rot", `${rot}deg`);
    notifyChanged();
  });
})();
