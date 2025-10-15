let items = [];
let index = 0;
let showingAnswer = false;

const card = document.getElementById("card");
const stateLabel = document.getElementById("stateLabel");
const rowReadingEl = document.getElementById("rowReading");
const rowKanjiEl = document.getElementById("rowKanji");
const meaningEl = document.getElementById("meaning");
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

function split4(str) {
  const arr = str.trim().split(/\s+/);
  const cols = 4;
  return Array.from({ length: cols }, (_, i) => arr[i] ?? "");
}

function buildRow(targetEl, texts, className) {
  targetEl.innerHTML = "";
  texts.forEach(t => {
    const cell = document.createElement("div");
    cell.className = `cell ${className}`;
    cell.textContent = t;
    targetEl.appendChild(cell);
  });
}

/*
  指定した要素群（読み+漢字）のテキストがセル内に収まる最大フォントサイズを求めて適用。
  - 同一問題内で読みセルと漢字セルのサイズを連動させるため、同一サイズで調整。
  - 最小/最大サイズ、ステップは任意に調整可能。
*/
function fitFontSizeForCurrentProblem() {
  const readingCells = rowReadingEl.querySelectorAll(".cell.reading");
  const kanjiCells = rowKanjiEl.querySelectorAll(".cell.kanji");
  const allCells = [...readingCells, ...kanjiCells];

  if (allCells.length === 0) return;

  // 探索範囲（px）
  const maxSize = 32;  // 上限（PC想定）
  const minSize = 14;  // 下限（小さすぎを防ぐ）
  let lo = minSize;
  let hi = maxSize;
  const padding = 2; // 安全マージン

  // まず全セルを上限サイズに
  allCells.forEach(el => el.style.fontSize = hi + "px");

  // 判定関数：すべてのセルで横幅・縦幅オーバーが無いか
  const fits = size => {
    allCells.forEach(el => el.style.fontSize = size + "px");
    // 再計測のためレイアウト確定
    // eslint-disable-next-line no-unused-expressions
    rowReadingEl.offsetHeight;

    for (const el of allCells) {
      const overflows =
        el.scrollWidth > el.clientWidth + padding ||
        el.scrollHeight > el.clientHeight + padding;
      if (overflows) return false;
    }
    return true;
  };

  // 二分探索で最大サイズを求める
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const finalSize = Math.max(minSize, hi);
  allCells.forEach(el => el.style.fontSize = finalSize + "px");
}

function render() {
  if (items.length === 0) {
    rowReadingEl.innerHTML = "";
    rowKanjiEl.innerHTML = "";
    meaningEl.textContent = "";
    progressEl.textContent = "0 / 0";
    stateLabel.textContent = "読み";
    card.classList.remove("show-kanji");
    return;
  }

  const item = items[index];
  const readings = split4(item.reading);
  const kanjis = split4(item.kanji);

  buildRow(rowReadingEl, readings, "reading");
  buildRow(rowKanjiEl, kanjis, "kanji");

  if (showingAnswer) {
    card.classList.add("show-kanji");
    meaningEl.textContent = item.meaning; // クリックで意味を描画
    stateLabel.textContent = "解答（もう一度クリックで次へ）";
  } else {
    card.classList.remove("show-kanji");
    meaningEl.textContent = ""; // 初期は空（領域は確保済み）
    stateLabel.textContent = "読み（クリックで漢字と意味を表示）";
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
    stateLabel.textContent = "読み込み中…";
    const res = await fetch("idioms.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) throw new Error("JSONは配列である必要があります");
    const normalized = data.filter(
      x => x && typeof x.reading === "string" && typeof x.kanji === "string" && typeof x.meaning === "string"
    );
    if (!normalized.length) throw new Error("有効なデータがありません");

    items = normalized;

    setControlsEnabled(true);
    // 初期状態でシャッフル
    shuffle();
  } catch (e) {
    setControlsEnabled(false);
    stateLabel.textContent = "読み込みに失敗しました";
    progressEl.textContent = "0 / 0";
    errorEl.textContent = `データの読み込みでエラーが発生しました: ${e.message}`;
    meaningEl.textContent = "";
    card.classList.remove("show-kanji");
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