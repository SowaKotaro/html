let items = [];
let index = 0;
let showingAnswer = false;

const card = document.getElementById("card");
const questionKanjiEl = document.getElementById("question-kanji");
const answerGroupEl = document.getElementById("answer-group");
const answerTextEl = document.getElementById("answer-text");
const remarkTextEl = document.getElementById("remark-text");

const toggleBtn = document.getElementById("toggleBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const progressEl = document.getElementById("progress");
const errorEl = document.getElementById("error");

function setControlsEnabled(enabled) {
  toggleBtn.disabled = !enabled;
  shuffleBtn.disabled = !enabled;
  resetBtn.disabled = !enabled;
}

function render() {
  if (items.length === 0) {
    questionKanjiEl.textContent = "";
    answerTextEl.textContent = "";
    remarkTextEl.textContent = "";
    progressEl.textContent = "0 / 0";
    card.classList.remove("show-answer");
    return;
  }

  const item = items[index];
  questionKanjiEl.textContent = item.question;

  if (showingAnswer) {
    card.classList.add("show-answer");
    answerTextEl.textContent = item.answer;
    remarkTextEl.textContent = item.remark || ""; // remark might be empty
  } else {
    card.classList.remove("show-answer");
    answerTextEl.textContent = "";
    remarkTextEl.textContent = "";
  }

  progressEl.textContent = `${index + 1} / ${items.length}`;
}

function showAnswerOrNext() {
  if (!items.length) return;
  if (!showingAnswer) {
    showingAnswer = true;
  } else {
    index = (index + 1) % items.length;
    showingAnswer = false;
  }
  render();
}

function shuffle() {
  if (!items.length) return;
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  index = 0;
  showingAnswer = false;
  render();
}

function reset() {
  index = 0;
  showingAnswer = false;
  render();
}

async function loadData() {
  try {
    errorEl.textContent = "";
    const res = await fetch("busyu_data.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("JSONは配列である必要があります");
    const normalized = data.filter(
      x => x && typeof x.question === "string" && typeof x.answer === "string"
    );
    if (!normalized.length) throw new Error("有効なデータがありません");

    items = normalized;

    setControlsEnabled(true);
    shuffle();
  } catch (e) {
    setControlsEnabled(false);
    progressEl.textContent = "0 / 0";
    errorEl.textContent = `データの読み込みでエラーが発生しました: ${e.message}`;
    questionKanjiEl.textContent = "!";
  }
}

card.addEventListener("click", showAnswerOrNext);
toggleBtn.addEventListener("click", showAnswerOrNext);
shuffleBtn.addEventListener("click", shuffle);
resetBtn.addEventListener("click", reset);

document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    showAnswerOrNext();
  }
});

loadData();
