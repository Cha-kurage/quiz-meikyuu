// 開発用ツール:「座標を調べる」ボタンで、解答ゾーンに置いたパーツの
// ゾーン内座標(左上を0,0とする)と回転角を一覧表示する。
// 正解の位置にパーツを置いて、ここに出た数値を answers.js (今後作成) の
// 正誤判定の基準値として使うことを想定している。

(() => {
  const btn = document.getElementById("debug-coords-btn");
  const panel = document.getElementById("debug-coords-panel");
  let active = false;

  function refresh() {
    if (!active) return;
    const z = window.getAnswerZoneRect();
    const lines = [...document.querySelectorAll(".part")]
      .map((el) => {
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        if (x < z.l || x > z.r || y < z.t || y > z.b) return null; // ゾーン外は対象外
        const rot = Number(el.dataset.rot) || 0;
        return `${el.dataset.file}: x=${Math.round(x - z.l)}, y=${Math.round(y - z.t)}, rot=${rot}`;
      })
      .filter(Boolean);
    panel.textContent = lines.length ? lines.join("\n") : "(解答ゾーンにパーツがありません)";
  }

  btn.addEventListener("click", () => {
    active = !active;
    btn.classList.toggle("active", active);
    panel.hidden = !active;
    refresh();
  });

  document.addEventListener("parts:changed", refresh);
})();
