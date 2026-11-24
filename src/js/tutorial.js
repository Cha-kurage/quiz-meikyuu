// チュートリアル: 偽天狗が吹き出しでしゃべりながら、遊び方を教える。
// 画面の構成 (木・松明・風・石板・解答ゾーン・早押しボタン) はそのまま。石板には例題 (富士山) のパーツだけを出す。
// セリフは元スライドの2〜29ページを、Web 版の操作 (早押しボタン、ドラッグ、ダブルクリック、「これで回答」) に合わせて書き直したもの。
// waitFor があるセリフは、その操作をするまで先へ進めない (できたら少し待って自動で次へ)。
// ページを開くと最初に始まる。メニューの「説明をもう一度見る」では、まず偽天狗が「もう一度チュートリアルを見るかい？」と聞き、
// 「はい」で始まる (終わると元の問題に戻る)。「いいえ」なら天狗は引っ込む。
// 聞いてきた偽天狗は、ドラッグするとパーツとして取り出せる (どの問題でも。最終問題「天狗」の答えに使う: drag.js)。

(() => {
  const root = document.getElementById("tutorial");
  const tengu = document.getElementById("tut-tengu");
  const textEl = document.getElementById("tut-text");
  const nextBtn = document.getElementById("tut-next");
  const skipBtn = document.getElementById("tut-skip"); // 今は外している (index.html)。無ければ使わない
  const yesBtn = document.getElementById("tut-yes");
  const noBtn = document.getElementById("tut-no");

  const TYPE_MS = 35;        // 1文字ずつ出す間隔 (しゃべっている感じ)
  const AUTO_NEXT_MS = 700;  // 操作ができてから次のセリフへ進むまで
  const CHECK_MS = 150;      // 操作ができたかを見に行く間隔
  const MOVE_MS = 650;       // 偽天狗が早押しボタンの横へ行く / 戻る時間 (CSS の transition より少し長く)
  const REVEAL_HOLD_MS = 2200; // 「答えは 〜 だよ」を言い終えてから戻るまで

  const part = (file) => document.querySelector(`.part.tut-part[data-file="${file}"]`);
  const pos = (el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
  const inZone = (el) => el && !el.classList.contains("is-hidden") && isInAnswerZone(el);

  // 操作ができたか
  let volumeOpenedSinceStep = false;
  let revealDone = false;
  const CONDITIONS = {
    volumeOpened: () => volumeOpenedSinceStep || isVolumeOpen(),
    volumeClosed: () => !isVolumeOpen(),
    revealed: () => revealDone, // 偽天狗が例題の答えを言い終えて戻ってきた
    fuPlaced: () => inZone(part("tut_fu")),
    shiPlaced: () => {
      const fu = part("tut_fu"), plus = part("tut_plus"), bar = part("tut_bar");
      if (!inZone(plus) || !inZone(bar)) return false;
      const p = pos(plus), b = pos(bar), f = pos(fu);
      return p.y < b.y && Math.abs(p.x - b.x) <= 50 && (!inZone(fu) || (f.x < p.x && f.x < b.x));
    },
    yamaPlaced: () => {
      const yama = part("tut_yama"), plus = part("tut_plus"), bar = part("tut_bar");
      if (!inZone(yama) || Number(yama.dataset.rot) % 360 !== 0) return false;
      const y = pos(yama);
      return y.x > pos(plus).x && y.x > pos(bar).x;
    },
    solved: () => isQuestionSolved(TUTORIAL_INDEX),
  };

  const TUT_PARTS = ['.part.tut-part'];
  // movable: そのセリフの間だけ動かせる例題のパーツ (それ以外のセリフでは、例題のパーツも動かない)
  // submit: そのセリフの間だけ「これで回答」を押せる
  // buzzer: そのセリフの間だけ早押しボタンを押せる / menu: このセリフから先はメニューを開ける (押してほしいときまでは押せない)
  const STEPS = [
    { text: "やあ！はじめまして！\n僕が君たちの案内役を務めるよ" },
    { text: "君たちが開いたのは、\n最後のクイズを解かないと決して出られない「Quiz迷宮」の門" },
    { text: "これから君たちには、クイズに挑戦してもらうよ" },
    { text: "ただ、クイズといっても緊張しなくていいよ。\n僕が君たちをサポートするから" },
    { text: "まずは基本的な操作から。" },
    { text: "左上の三本線がメニューのボタン。音量を調節したり、この説明を\nもう一度見たりできるよ。試しにメニューを開いて「音量の調節」を押してみて！", focus: ["#menu-btn", '[data-menu="volume"]'], waitFor: "volumeOpened", menu: true },
    { text: "つまみを左右に動かすと、音量が変わるよ。\n聞きやすい大きさにして「閉じる」を押してね", waitFor: "volumeClosed" },
    { text: "肝心のクイズについてだけど、基本的には早押しボタンを押して答える、\nいわゆる早押しクイズをやってもらうよ", focus: ["#buzzer-btn"] },
    { text: "これは解答ゾーンというよ！この中に、イラストや文字を使って\nクイズの答えを作れば、それが君たちの回答になるよ", focus: ["#answer-zone"] },
    { text: "早押しボタンを押さずにしばらく待つと、\n僕がクイズの答えを教えてあげる。" },
    // 答えが出たら、偽天狗が早押しボタンの横へ行って答えを言い、戻ってきて次のセリフ「ほらね！」へ (reveal)
    { text: "嘘だと思うなら、一度例題を見てみよう。早押しボタンを押すと問題が流れるよ！\n押したら、そのまま答えが出るまで待ってね", focus: ["#buzzer-btn"], waitFor: "revealed", buzzer: true },
    { text: "ほらね！石板には、答えになるパーツが置いてあるよ。今回は\n「富」「＋」「ー」「山」の4つを解答ゾーンに置いて回答すれば正解になるよ", focus: TUT_PARTS },
    { text: "ただし、正しい配置で回答しないと不正解になるから注意してね" },
    { text: "まずは「富」をドラッグして、解答ゾーンに置いてみよう", focus: ['.part[data-file="tut_fu"]', "#answer-zone"], waitFor: "fuPlaced", movable: ["tut_fu"] },
    { text: "次に「＋」と「ー」を、「士」の形になるように上下に重ねて、\n「富」の右に置こう", focus: ['.part[data-file="tut_plus"]', '.part[data-file="tut_bar"]'], waitFor: "shiPlaced", movable: ["tut_plus", "tut_bar"] },
    { text: "最後に「山」。今は逆さまだね。パーツをダブルタップすると\n90度回るから、2回ダブルタップして元の向きにして、「士」の右に置こう", focus: ['.part[data-file="tut_yama"]'], waitFor: "yamaPlaced", movable: ["tut_yama"] },
    { text: "これで「富士山」の完成！\n「これで回答」を押そう", focus: ["#submit-btn"], waitFor: "solved", submit: true },
    { text: "⭕が出て正解の音が鳴れば、君の回答は正解だということだ" },
    { text: "もし❌が出て不正解の音が鳴ったら、\nその回答で正しいかよく考えてから、やり直してね" },
    { text: "ちなみに、一度回答に使ったパーツは、全ての問題から無くなるよ。\n前に戻っても元には戻らないから注意してね" },
    { text: "クイズの流れは、だいたい理解できたかな？" },
    { text: "最後のクイズに正解すると見事クリア！\n君たちは晴れてこの迷宮から脱出できる" },
    { text: "ただし、最後のクイズが解けないと、永遠にこの迷宮をさまようことになるから\n頑張ってね！" },
    { text: "それでは、Quiz迷宮への挑戦、スタート！", nextLabel: "スタート ▶" },
  ];

  let active = false;
  let stepIndex = 0;
  let returnIndex = 0;    // チュートリアルが終わったら開く問題
  let typingTimer = null;
  let typedAll = true;
  let checkTimer = null;
  let autoTimer = null;
  let focused = [];

  function clearFocus() {
    focused.forEach((el) => el.classList.remove("tut-focus"));
    focused = [];
  }

  function setFocus(selectors = []) {
    clearFocus();
    selectors.forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
      if (el.classList.contains("is-hidden")) return;
      el.classList.add("tut-focus");
      focused.push(el);
    }));
  }

  // セリフを1文字ずつ出す。出している間は天狗が揺れる。
  // content は文字列か、区切りの配列 [{ text, cls }] (区切りごとに1行。cls で見た目を変える: 例題の答え)
  let typingSegs = [];
  function typeText(content, onDone) {
    clearInterval(typingTimer);
    textEl.innerHTML = "";
    typedAll = false;
    tengu.classList.add("talking");
    const multi = typeof content !== "string";
    typingSegs = (multi ? content : [{ text: content }]).map((seg) => {
      const el = document.createElement(multi ? "div" : "span");
      if (seg.cls) el.className = seg.cls;
      textEl.appendChild(el);
      return { el, chars: [...seg.text], shown: 0 };
    });
    let k = 0;
    typingTimer = setInterval(() => {
      while (k < typingSegs.length && typingSegs[k].shown >= typingSegs[k].chars.length) k++;
      if (k >= typingSegs.length) { finishTyping(); return; }
      const seg = typingSegs[k];
      seg.el.textContent += seg.chars[seg.shown++];
    }, TYPE_MS);
    typingDone = onDone || null;
  }
  let typingDone = null;
  function finishTyping() {
    clearInterval(typingTimer);
    typingSegs.forEach((seg) => { seg.el.textContent = seg.chars.join(""); seg.shown = seg.chars.length; });
    typedAll = true;
    tengu.classList.remove("talking");
    const done = typingDone;
    typingDone = null;
    if (done) done();
  }

  function updateNextButton() {
    const step = STEPS[stepIndex];
    const waiting = step.waitFor && !CONDITIONS[step.waitFor]();
    nextBtn.disabled = waiting;
    nextBtn.textContent = waiting ? "やってみよう" : (step.nextLabel || "次へ ▶");
  }

  function showStep(i) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, i));
    const step = STEPS[stepIndex];
    clearTimeout(autoTimer);
    autoTimer = null;
    volumeOpenedSinceStep = false;
    // 例題を流すセリフから先は、早押しボタンの上の「ボタンを押して出題」を出す
    const buzzerFrom = STEPS.findIndex((s) => s.buzzer);
    stage.classList.toggle("tut-buzzer", stepIndex >= buzzerFrom);
    // いまのセリフで使わない例題のパーツは動かせない。回答するセリフ以外では「これで回答」も押せない
    document.querySelectorAll(".part.tut-part").forEach((el) => el.classList.toggle("tut-still", !canMove(el)));
    stage.classList.toggle("tut-no-submit", !step.submit);
    stage.classList.toggle("tut-no-buzzer", !step.buzzer);
    stage.classList.toggle("tut-no-menu", stepIndex < STEPS.findIndex((s) => s.menu));
    typeText(step.text);
    setFocus(step.focus);
    updateNextButton();
  }

  const canMove = (el) => active && el.classList.contains("tut-part") && (STEPS[stepIndex].movable || []).includes(el.dataset.file);

  // ---- 例題の答え: 偽天狗が早押しボタンの横へ行って「答えは 〜 だよ」と言い、戻ってきて「ほらね！」へ ----
  let revealTimers = [];
  let revealing = false;
  function clearReveal() {
    revealTimers.forEach(clearTimeout);
    revealTimers = [];
    revealing = false;
    root.classList.remove("reveal", "moving");
  }
  const later = (fn, ms) => revealTimers.push(setTimeout(fn, ms));

  function reveal(answer) {
    if (!active || STEPS[stepIndex].waitFor !== "revealed" || revealing) return;
    revealing = true;
    clearFocus();
    root.classList.add("reveal", "moving"); // 移動中は吹き出しを隠す
    later(() => {
      root.classList.remove("moving");
      // 「答えは / (答え: 大きめの赤字) / だよ」の3行
      typeText([{ text: "答えは" }, { text: answer, cls: "tut-answer" }, { text: "だよ" }], () => later(goBack, REVEAL_HOLD_MS));
    }, MOVE_MS);
    function goBack() {
      root.classList.add("moving");
      root.classList.remove("reveal");
      later(() => {
        root.classList.remove("moving");
        revealing = false;
        revealDone = true;
        showStep(stepIndex + 1);
      }, MOVE_MS);
    }
  }
  document.addEventListener("tutorial:answer", (e) => reveal(e.detail.answer));

  // 操作待ちのセリフで、できたかを見に行く。できたら少し待って次へ
  function check() {
    if (!active || asking) return;
    updateNextButton();
    const step = STEPS[stepIndex];
    if (step.waitFor === "revealed") return; // 答えを言い終えたら reveal() が次へ進める
    if (step.waitFor && CONDITIONS[step.waitFor]() && !autoTimer) {
      autoTimer = setTimeout(() => { autoTimer = null; if (active) next(); }, AUTO_NEXT_MS);
    }
  }

  function next() {
    if (revealing || asking) return;
    if (!typedAll) { finishTyping(); return; } // しゃべっている途中なら、まず全部出す
    const step = STEPS[stepIndex];
    if (step.waitFor && !CONDITIONS[step.waitFor]()) return;
    if (stepIndex >= STEPS.length - 1) { endTutorial(); return; }
    showStep(stepIndex + 1);
  }

  // 例題の状態 (パーツ・正解・読み上げ・タイマー) を最初に戻す
  function resetExample() {
    resetTutorialParts(); // main.js
    document.querySelectorAll(".part.tut-part").forEach((el) => { delete consumedBy[el.dataset.partId]; });
    delete solvedParts[TUTORIAL_INDEX];
    delete readProgress[TUTORIAL_INDEX];
    delete questionTimers[TUTORIAL_INDEX];
    delete solveTimes[TUTORIAL_INDEX];
  }

  function startTutorial() {
    closeAsk();
    returnIndex = active ? returnIndex : (currentQuestionIndex === TUTORIAL_INDEX ? 0 : currentQuestionIndex);
    active = true;
    clearReveal();
    revealDone = false;
    resetExample();
    stage.classList.add("tutorial");
    root.hidden = false;
    startQuestion(TUTORIAL_INDEX); // 出題ゾーンは例題、石板は例題のパーツ
    showStep(0);
    clearInterval(checkTimer);
    checkTimer = setInterval(check, CHECK_MS);
  }

  function endTutorial() {
    active = false;
    clearInterval(checkTimer);
    clearInterval(typingTimer);
    clearTimeout(autoTimer);
    autoTimer = null;
    clearReveal();
    clearFocus();
    root.hidden = true;
    stage.classList.remove("tutorial", "tut-buzzer", "tut-no-submit", "tut-no-buzzer", "tut-no-menu");
    startQuestion(returnIndex);
  }

  // ---- 「もう一度チュートリアルを見るかい？」 ----
  let asking = false;
  function askTutorial() {
    asking = true;
    clearFocus();
    root.hidden = false;
    root.classList.add("ask");
    // 聞いてくる偽天狗は掴める (どの問題でも。チュートリアルの途中と、もう取り出してあるときは除く)
    const tenguPart = document.querySelector(".part.nise-tengu");
    root.classList.toggle("ask-final", !active && !!tenguPart && tenguPart.classList.contains("in-ask"));
    nextBtn.hidden = true;
    yesBtn.hidden = false;
    noBtn.hidden = false;
    typeText("もう一度チュートリアルを見るかい？");
  }
  function closeAsk() {
    if (!asking) return;
    asking = false;
    root.classList.remove("ask", "ask-final");
    nextBtn.hidden = false;
    yesBtn.hidden = true;
    noBtn.hidden = true;
    if (!active) { // チュートリアルの途中でなければ、天狗は引っ込む
      clearInterval(typingTimer);
      typingDone = null;
      tengu.classList.remove("talking");
      root.hidden = true;
    }
  }
  yesBtn.addEventListener("click", () => { playSound("click"); closeAsk(); startTutorial(); });
  noBtn.addEventListener("click", () => {
    playSound("click");
    closeAsk();
    if (active) showStep(stepIndex); // チュートリアルの途中で聞いたときは、そのセリフに戻る
  });

  window.askTutorial = askTutorial; // menu.js
  window.closeTutorialAsk = closeAsk; // drag.js (16問目で天狗を取り出したとき)
  window.isTutorialAsking = () => asking;
  window.startTutorial = startTutorial;
  window.isTutorialActive = () => active;
  window.tutorialCanMove = canMove; // drag.js
  window.tutorialAllowsSubmit = () => !active || !!STEPS[stepIndex].submit; // answers.js
  window.tutorialAllowsBuzzer = () => !active || (!!STEPS[stepIndex].buzzer && !revealing); // quiz.js

  nextBtn.addEventListener("click", () => { playSound("click"); next(); });
  textEl.addEventListener("click", () => { if (!typedAll) finishTyping(); });
  if (skipBtn) skipBtn.addEventListener("click", () => { playSound("click"); endTutorial(); });
  document.addEventListener("volume:opened", () => { volumeOpenedSinceStep = true; });

  // ページを開いたら、まずチュートリアルから
  startTutorial();
})();
