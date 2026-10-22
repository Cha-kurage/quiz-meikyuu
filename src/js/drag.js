// パーツのドラッグ移動 + ダブルクリックで90度回転。
// - 解答ゾーンの中で放すと、その位置に置かれる (ゾーンからはみ出さないよう補正するだけで、吸い付き・スナップはしない)
// - 解答ゾーンの外で放すと、石板上の元の位置に戻る
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

  // パーツが変化した (置いた/回転した) ことを通知する。debug-coords.js が購読する
  function notifyChanged() {
    document.dispatchEvent(new CustomEvent("parts:changed"));
  }

  function drop(el) {
    const { x, y } = center(el);
    const z = zoneRect();
    if (x >= z.l && x <= z.r && y >= z.t && y <= z.b) {
      const half = el.offsetWidth / 2;
      setCenter(el, clampIn(x, z.l + half, z.r - half), clampIn(y, z.t + half, z.b - half));
    } else {
      el.classList.add("returning");
      setCenter(el, Number(el.dataset.homeX), Number(el.dataset.homeY));
      setTimeout(() => el.classList.remove("returning"), 250);
    }
    notifyChanged();
  }

  layer.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".part");
    if (!el || drag) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);

    const p = toStage(e);
    const c = center(el);
    drag = { el, pointerId: e.pointerId, dx: c.x - p.x, dy: c.y - p.y };
    el.classList.remove("returning");
    el.classList.add("dragging");
    el.style.zIndex = ++topZ;
  });

  layer.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = toStage(e);
    setCenter(drag.el, clamp(p.x + drag.dx, 0, STAGE_W), clamp(p.y + drag.dy, 0, STAGE_H));
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
    const rot = (Number(el.dataset.rot) + 90) % 360;
    el.dataset.rot = rot;
    el.style.setProperty("--rot", `${rot}deg`);
    notifyChanged();
  });
})();
