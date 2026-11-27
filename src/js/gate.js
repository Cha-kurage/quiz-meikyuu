// 迷宮の門 (2026-11-27 ユーザー指示「最初と最後は門が開く演出」)。
// - 最初: ページを開くと、閉じた門 (上に「Quiz迷宮」の額) が画面をふさいでいる。「門を開ける」を押すと、
//   門がゴゴゴと揺れてから奥へゆっくり開き、光が差して、門が消える。少し間をおいてから "gate:opened" を出す
//   (tutorial.js がそれを合図に、偽天狗がしゃべり始める)。
//   ボタンを1回押してもらうので、ブラウザの自動再生の制限もここで外れる (チュートリアルの音が最初から鳴る)。
// - 最後: 16問目 (天狗) に正解すると、閉じた門がすっと現れて (フェードイン)、ゴゴゴと開き、光の中に「迷宮の門が開いた！」。
//   その下に「あなたの早押しクイズ力」の画像 (rank.js) と、「画像を保存」「ネタバレのない感想をポスト」(X) 「閉じる」。
//   (2026-11-27 ユーザー指示。最初は「開いた門が急に閉まってから開く」だったのを、フェードインに変えた)
// 門の絵は CSS だけで描いている (style.css の #gate)。音は sound.js の playGateSound。

(() => {
  const gate = document.getElementById("gate");
  const openBtn = document.getElementById("gate-open");
  const closeBtn = document.getElementById("gate-close");
  const postBtn = document.getElementById("gate-post");
  const saveLink = document.getElementById("gate-save");
  const rankImg = document.getElementById("gate-rank-img");

  // 2026-11-27 ユーザー指示: 開くのをゆっくりに、開いてから偽天狗がしゃべり始めるまで間をあける
  const SHAKE_MS = 900;      // 開く前に揺れる時間 (CSS の gate-shake と同じ)
  const SWING_MS = 3600;     // 扉が開く時間 (CSS の transition と同じ)
  const OPEN_HOLD_MS = 700;  // 最初: 開ききってから、門が消え始めるまで
  const FADE_MS = 1000;      // 最初: 開いた門が消える時間 (CSS と同じ)
  const TALK_PAUSE_MS = 1000; // 最初: 門が消えてから、偽天狗がしゃべり始める ("gate:opened") まで
  const FINAL_WAIT_MS = 1300;   // 最後: 正解の音を聞かせてから、門を出すまで
  const FINAL_FADE_IN_MS = 600; // 最後: 閉じた門が現れる時間 (CSS の #gate.final と同じ)
  const CLOSED_HOLD_MS = 700;   // 最後: 現れてから開き始めるまで

  // 「ネタバレのない感想をポスト」で X に出す文 (2026-11-27 ユーザー指定)
  const POST_TEXT = "最後のクイズに正解し、クイズ迷宮をクリアした！\n\n#天狗のクイズ迷宮\n#からのもぬけ";

  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const setState = (...cls) => {
    gate.classList.remove("closed", "shaking", "open", "fading", "done");
    gate.classList.add(...cls);
  };

  // 揺れてから開く。done は開ききったころに呼ぶ
  function swingOpen({ done } = {}) {
    setState("closed", "shaking");
    playGateSound((SHAKE_MS + SWING_MS) / 1000);
    later(() => {
      setState("open");
      later(() => done && done(), SWING_MS);
    }, SHAKE_MS);
  }

  // ---- 最初 ----
  function intro() {
    gate.hidden = false;
    gate.classList.remove("final");
    setState("closed");
    openBtn.hidden = false;
    openBtn.focus({ preventScroll: true });
  }
  openBtn.addEventListener("click", () => {
    openBtn.hidden = true;
    // 開ききる → 少し待って門が消える → 少し間をあけて偽天狗がしゃべり始める
    swingOpen({
      done: () => later(() => {
        gate.classList.add("fading");
        later(() => {
          gate.classList.add("blocking"); // 見えないが、しゃべり始めるまでは画面を触れないようにしておく
          later(() => {
            gate.hidden = true;
            gate.classList.remove("blocking");
            document.dispatchEvent(new CustomEvent("gate:opened"));
          }, TALK_PAUSE_MS);
        }, FADE_MS);
      }, OPEN_HOLD_MS),
    });
  });

  // ---- 最後: 16問目に正解したら ----
  document.addEventListener("question:solved", (e) => {
    if (e.detail.index !== FINAL_INDEX) return;
    // 評価の画像は先に作っておく (門が開くころには出せるように)
    drawRankImage(quizRank()).then((url) => {
      rankImg.src = url;
      saveLink.href = url;
    });
    later(() => {
      gate.classList.add("final");
      setState("closed", "fading"); // 閉じた門を、見えない状態から
      openBtn.hidden = true;
      gate.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        gate.classList.remove("fading"); // すっと現れる
        later(() => swingOpen({
          done: () => { gate.classList.add("done"); closeBtn.focus({ preventScroll: true }); },
        }), FINAL_FADE_IN_MS + CLOSED_HOLD_MS);
      }));
    }, FINAL_WAIT_MS);
  });
  postBtn.addEventListener("click", () => {
    playSound("click");
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(POST_TEXT)}`, "_blank", "noopener");
  });
  saveLink.addEventListener("click", (e) => {
    if (!rankImg.src) e.preventDefault(); // 画像ができる前は何もしない
    playSound("click");
  });
  closeBtn.addEventListener("click", () => {
    playSound("click");
    gate.classList.add("fading");
    later(() => { gate.hidden = true; gate.classList.remove("final", "fading"); }, FADE_MS);
  });

  intro();
})();
