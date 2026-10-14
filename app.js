// ===== 定数（アプリ内で変わらない値） =====
const PARTS = [
  { id: "chest", name: "胸", color: "#ff453a" },
  { id: "back", name: "背中", color: "#0a84ff" },
  { id: "shoulder", name: "肩", color: "#ff9f0a" },
  { id: "arm", name: "腕", color: "#bf5af2" },
  { id: "leg", name: "脚", color: "#30d158" },
  { id: "abs", name: "腹", color: "#ffd60a" },
  { id: "other", name: "その他", color: "#98989d" },
];

const TYPE_NAMES = {
  weight: "重量",
  bodyweight: "自重",
  time: "時間",
};

const LB_PER_KG = 2.20462; // 1kg = 2.20462lbs

// ===== データの保存・読み込み =====
const STORAGE_KEY = "kintore-app-data";
const DATA_VERSION = 4; // データの形の版番号。形を変えたら増やす

function createDefaultData() {
  return {
    version: DATA_VERSION,
    exercises: [
      { id: createId(), name: "ベンチプレス", part: "chest", type: "weight" },
      { id: createId(), name: "懸垂", part: "back", type: "bodyweight" },
      { id: createId(), name: "スクワット", part: "leg", type: "weight" },
      { id: createId(), name: "プランク", part: "abs", type: "time" },
    ],
    records: [],
    bodyWeights: [],
    gyms: [],      // ← 追加
    dayGyms: [],   // ← 追加
    settings: { unit: "kg", lastExport: null },
  };
}

// 古い形のデータを、今の形に直す（マイグレーション）
function migrateData(d) {
  // 版番号がない ＝ 版番号を入れる前（ステップ7まで）のデータ
  if (d.version === undefined) d.version = 1;

  // ↓ データの形を変えたら、ここに変換を追加していく

  // 版1 → 版2：セットにドロップかどうか（drop）を追加
  if (d.version === 1) {
    for (const r of d.records) {
      for (const s of r.sets) {
        if (s.drop === undefined) s.drop = false;
      }
    }
    d.version = 2;
  }

  // 版2 → 版3：記録にスーパーセットの組の番号（supersetId）を追加
  if (d.version === 2) {
    for (const r of d.records) {
      if (r.supersetId === undefined) r.supersetId = null;
    }
    d.version = 3;
  }

  // 版3 → 版4：ジムの一覧（gyms）と、日付ごとのジム（dayGyms）を追加
  if (d.version === 3) {
    if (!Array.isArray(d.gyms)) d.gyms = [];
    if (!Array.isArray(d.dayGyms)) d.dayGyms = [];
    d.version = 4;
  }

  // 足りない項目を補う
  if (!Array.isArray(d.bodyWeights)) d.bodyWeights = [];
  if (typeof d.settings !== "object" || d.settings === null) d.settings = {};
  if (d.settings.unit !== "lbs") d.settings.unit = "kg";
  if (d.settings.lastExport === undefined) d.settings.lastExport = null;

  return d;
}

function loadData() {
  const json = localStorage.getItem(STORAGE_KEY);
  if (json === null) {
    return createDefaultData(); // 初めて開いたとき
  }

  try {
    return migrateData(JSON.parse(json));
  } catch (error) {
    // 読み込めなかったデータは、消さずに別の名前で残しておく
    localStorage.setItem(STORAGE_KEY + "-broken", json);
    alert("保存データの読み込みに失敗しました。初期状態で起動します。");
    return createDefaultData();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 重ならないIDを作る（現在時刻＋ランダムな文字）
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

let data = loadData();

// ===== 共通で使う小さな関数 =====

// ユーザーが入力した文字を、HTMLとして安全な形に変換する
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Date → "2026-10-13"（日本時間のまま変換する）
function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-10-13" → Date
function fromDateString(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 入力された文字を数値にする（数字でなければ NaN）
function parseNumber(text) {
  return parseFloat(String(text).trim().replace(",", "."));
}

// 小数点以下2桁までに丸めて文字にする（62.50 → "62.5"）
function formatNumber(num) {
  return String(Math.round(num * 100) / 100);
}

// 今の単位（"kg" または "lbs"）
function unit() {
  return data.settings.unit;
}

// 保存用のkg → 画面表示用の数値
function kgToDisplay(kg) {
  return unit() === "lbs" ? kg * LB_PER_KG : kg;
}

// 画面で入力された数値 → 保存用のkg
function displayToKg(value) {
  return unit() === "lbs" ? value / LB_PER_KG : value;
}

function getExercise(id) {
  return data.exercises.find((ex) => ex.id === id);
}

function getPart(id) {
  return PARTS.find((part) => part.id === id);
}

// 1セットを表示用の文字にする
function formatSet(set, type) {
  if (type === "time") {
    return `${set.seconds}秒`;
  }

  const w = formatNumber(kgToDisplay(Math.abs(set.weight)));

  if (type === "bodyweight") {
    if (set.weight === 0) return `自重 × ${set.reps}回`;
    const sign = set.weight > 0 ? "+" : "−";
    return `自重${sign}${w}${unit()} × ${set.reps}回`;
  }

  return `${w}${unit()} × ${set.reps}回`;
}

// ===== 記録の分析（自己ベスト・推定1RM・前回の記録） =====

// 推定1RM（Epleyの式）
function estimate1RM(weight, reps) {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// 2つのセットを比べる。a の方が良ければ正の数、悪ければ負の数、同じなら0
function compareSets(a, b, type) {
  if (type === "time") {
    return a.seconds - b.seconds;
  }
  if (type === "weight") {
    return estimate1RM(a.weight, a.reps) - estimate1RM(b.weight, b.reps);
  }
  // 自重：負荷が重い方が上。同じ負荷なら回数が多い方が上
  if (a.weight !== b.weight) {
    return a.weight - b.weight;
  }
  return a.reps - b.reps;
}

// ドロップを除いたセット（自己ベストなど「強さ」の記録に使う）
function normalSets(sets) {
  const list = sets.filter((s) => !s.drop);
  return list.length > 0 ? list : sets;
}

// セットの番号（ドロップは「↳」、それ以外は 1, 2, 3 …）
function setLabels(sets) {
  let count = 0;
  return sets.map((s) => {
    if (s.drop) return "↳";
    count++;
    return String(count);
  });
}

// セットの中から一番良いものを選ぶ（ドロップは除く）
function bestSet(sets, type) {
  const list = normalSets(sets);
  let best = list[0];
  for (const set of list) {
    if (compareSets(set, best, type) > 0) best = set;
  }
  return best;
}

// この記録が、それより前の全記録を上回っているか
function isPersonalBest(record, type) {
  const earlier = data.records.filter(
    (r) => r.exerciseId === record.exerciseId && r.date < record.date
  );
  if (earlier.length === 0) return false; // 初めての記録はバッジなし

  const mine = bestSet(record.sets, type);
  return earlier.every((r) => compareSets(mine, bestSet(r.sets, type), type) > 0);
}

// 全期間で一番良いセット（記録がなければ null）
function findBestSet(exerciseId, type) {
  const allSets = data.records
    .filter((r) => r.exerciseId === exerciseId)
    .flatMap((r) => r.sets);
  if (allSets.length === 0) return null;
  return bestSet(allSets, type);
}

// 指定した日より前で、一番新しい記録（なければ null）
function findPreviousRecord(exerciseId, date) {
  let previous = null;
  for (const r of data.records) {
    if (r.exerciseId !== exerciseId) continue;
    if (r.date >= date) continue;
    if (previous === null || r.date > previous.date) previous = r;
  }
  return previous;
}

// 推定1RMを表示用の文字にする
function format1RM(set) {
  const kg = estimate1RM(set.weight, set.reps);
  return `${formatNumber(kgToDisplay(kg))}${unit()}`;
}

// "2026-10-06" → "10/6"
function formatShortDate(text) {
  const [y, m, d] = text.split("-").map(Number);
  return `${m}/${d}`;
}

// 2つの日付の差（日数）
function daysBetween(fromText, toText) {
  const ms = fromDateString(toText) - fromDateString(fromText);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// データが変わったときに、関係する画面をまとめて描き直す
function refreshAll() {
  renderExerciseList();
  renderRecordList();
  renderLastDone();
  renderCalendar();
  renderSettings();
  renderGymSettings();
  renderPhotoSummary();
}

// ===== タブ切り替え =====
const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");
const pageTitle = document.querySelector("#page-title");

function showView(name) {
  views.forEach((view) => view.classList.remove("active"));
  tabs.forEach((tab) => tab.classList.remove("active"));

  const view = document.querySelector("#view-" + name);
  const tab = document.querySelector(`.tab[data-view="${name}"]`);
  view.classList.add("active");
  tab.classList.add("active");

  pageTitle.textContent = tab.querySelector(".tab-label").textContent;
  if (name === "graph") {
    // グラフタブを開いたら、毎回「体重」から表示する
    graphExerciseId = "body";
    graphMetricId = null;
    renderGraph();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    showView(tab.dataset.view);
  });
});

// ===== 種目の管理 =====
const exerciseAddRow = document.querySelector("#exercise-add-row");
const exerciseForm = document.querySelector("#exercise-form");
const exerciseName = document.querySelector("#exercise-name");
const exercisePart = document.querySelector("#exercise-part");
const exerciseType = document.querySelector("#exercise-type");
const exerciseSubmit = document.querySelector("#exercise-submit");
const exerciseCancel = document.querySelector("#exercise-cancel");
const exerciseDelete = document.querySelector("#exercise-delete");
const exerciseList = document.querySelector("#exercise-list");

let editingId = null; // 編集中の種目のID（編集していないときは null）
const openParts = new Set(); // 開いている部位のID
function renderPartOptions() {
  exercisePart.innerHTML = PARTS
    .map((part) => `<option value="${part.id}">${part.name}</option>`)
    .join("");
}

// 種目の一覧（部位の順に、1種目1行で並べる）
// 種目の一覧（部位ごとにまとめて、押すと開く）
function renderExerciseList() {
  let html = "";

  for (const part of PARTS) {
    const list = data.exercises.filter((ex) => ex.part === part.id);
    if (list.length === 0) continue; // 種目がない部位は表示しない

    const isOpen = openParts.has(part.id);

    // 部位の行
    html += `
      <button type="button" class="settings-row part-row" data-part="${part.id}" aria-expanded="${isOpen}">
        <span class="part-dot" style="background:${part.color}"></span>
        <span class="settings-name">${part.name}</span>
        <span class="settings-meta">${list.length}種目</span>
        <span class="settings-chevron part-chevron">›</span>
      </button>`;

    if (!isOpen) continue;

    // 開いているときだけ、その部位の種目と登録の行を表示する
    html += `<div class="part-children">`;
    for (const ex of list) {
      html += `
        <button type="button" class="settings-row" data-id="${ex.id}">
          <span class="settings-name">${escapeHtml(ex.name)}</span>
          <span class="settings-meta">${TYPE_NAMES[ex.type]}</span>
          <span class="settings-chevron">›</span>
        </button>`;
    }
    html += `
        <button type="button" class="settings-row settings-action" data-add-part="${part.id}">
          ＋ ${part.name}の種目を登録
        </button>
      </div>`;
  }

  if (html === "") {
    html = `<p class="settings-empty">種目がまだありません</p>`;
  }

  exerciseList.innerHTML = html;
}

// フォームを閉じて、最初の状態に戻す
function resetExerciseForm() {
  exerciseForm.reset();
  editingId = null;
  exerciseType.disabled = false;
  exerciseForm.hidden = true;
  exerciseAddRow.hidden = false;
}

// 「＋ 種目を登録」：新しく登録するフォームを開く
// partId を渡すと、部位が最初からその部位になる
function openExerciseFormForAdd(partId = null) {
  resetExerciseForm();
  if (partId !== null) exercisePart.value = partId;

  exerciseSubmit.textContent = "登録";
  exerciseDelete.hidden = true;
  exerciseForm.hidden = false;
  exerciseAddRow.hidden = true;
  exerciseForm.scrollIntoView({ behavior: "smooth", block: "center" });
  exerciseName.focus();
}

// 種目の行を押したとき：編集するフォームを開く
function startEdit(id) {
  const ex = getExercise(id);
  exerciseName.value = ex.name;
  exercisePart.value = ex.part;
  exerciseType.value = ex.type;

  // 記録がある種目は、種類を変えられないようにする
  const hasRecords = data.records.some((r) => r.exerciseId === id);
  exerciseType.disabled = hasRecords;

  editingId = id;
  exerciseSubmit.textContent = "更新";
  exerciseDelete.hidden = false;
  exerciseForm.hidden = false;
  exerciseAddRow.hidden = true;
  exerciseForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function deleteExercise(id) {
  const ex = getExercise(id);
  const count = data.records.filter((r) => r.exerciseId === id).length;

  let message = `「${ex.name}」を削除しますか？`;
  if (count > 0) {
    message += `\nこの種目の記録（${count}件）も一緒に削除されます。`;
  }
  if (!confirm(message)) return;

  data.exercises = data.exercises.filter((e) => e.id !== id);
  data.records = data.records.filter((r) => r.exerciseId !== id);
  cleanupSupersets();
  saveData();

  if (editingId === id) resetExerciseForm();
  if (draft !== null && draft.exerciseId === id) closeEditor();
  refreshAll();
}

// 登録・更新
exerciseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = exerciseName.value.trim();
  if (name === "") return;
  const partId = exercisePart.value;

  if (editingId === null) {
    data.exercises.push({
      id: createId(),
      name: name,
      part: partId,
      type: exerciseType.value,
    });
  } else {
    const ex = getExercise(editingId);
    ex.name = name;
    ex.part = partId;
    ex.type = exerciseType.value;
  }

  openParts.add(partId); // 登録・更新した種目の部位を開いておく
  saveData();
  resetExerciseForm();
  refreshAll();
});

exerciseAddRow.addEventListener("click", () => openExerciseFormForAdd());
exerciseCancel.addEventListener("click", resetExerciseForm);
exerciseDelete.addEventListener("click", () => deleteExercise(editingId));

// 一覧の中の行を押したとき
exerciseList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button === null) return;

  // 部位の行：開く・閉じる
  if (button.dataset.part !== undefined) {
    const partId = button.dataset.part;
    if (openParts.has(partId)) {
      openParts.delete(partId);
    } else {
      openParts.add(partId);
    }
    renderExerciseList();
    return;
  }

  // 「＋ ○○の種目を登録」の行
  if (button.dataset.addPart !== undefined) {
    openExerciseFormForAdd(button.dataset.addPart);
    return;
  }

  // 種目の行：編集する
  if (button.dataset.id !== undefined) {
    startEdit(button.dataset.id);
  }
});

// ===== トレーニング記録 =====
const recordDate = document.querySelector("#record-date");
const recordDateLabel = document.querySelector("#record-date-label");
const recordDateWord = document.querySelector("#record-date-word");
const datePrev = document.querySelector("#date-prev");
const dateNext = document.querySelector("#date-next");
const addExerciseButton = document.querySelector("#add-exercise-button");
const exerciseSheet = document.querySelector("#exercise-sheet");
const sheetList = document.querySelector("#sheet-list");
const sheetClose = document.querySelector("#sheet-close");
const recordEditor = document.querySelector("#record-editor");
const editorTitle = document.querySelector("#editor-title");
const setList = document.querySelector("#set-list");
const addSetButton = document.querySelector("#add-set");
const recordMemo = document.querySelector("#record-memo");
const editorCancel = document.querySelector("#editor-cancel");
const editorSave = document.querySelector("#editor-save");
const recordList = document.querySelector("#record-list");
const previousBox = document.querySelector("#previous-box");

// 入力中の記録（下書き）。入力欄が閉じているときは null
let draft = null;

// --- 種目を選ぶ一覧（下から出てくるシート） ---
function renderExerciseSheet() {
  let html = "";

  for (const part of PARTS) {
    const list = data.exercises.filter((ex) => ex.part === part.id);
    if (list.length === 0) continue;

    html += `
      <div class="sheet-part">
        <span class="part-dot" style="background:${part.color}"></span>${part.name}
      </div>
      <div class="sheet-group">`;

    for (const ex of list) {
      // 選んでいる日に、すでに記録がある種目か
      const done = data.records.some(
        (r) => r.date === recordDate.value && r.exerciseId === ex.id
      );
      html += `
        <button type="button" class="sheet-item" data-id="${ex.id}">
          <span class="sheet-name">${escapeHtml(ex.name)}</span>
          ${done ? `<span class="sheet-done">記録済み</span>` : ""}
          <span class="sheet-chevron">›</span>
        </button>`;
    }

    html += `</div>`;
  }

  if (html === "") {
    html = `<p class="empty">種目がありません。設定タブで登録してください。</p>`;
  }

  sheetList.innerHTML = html;
}

function openExerciseSheet() {
  renderExerciseSheet(); // 開くたびに、最新の状態で作り直す
  exerciseSheet.classList.add("open");
  document.body.style.overflow = "hidden"; // 後ろの画面がスクロールしないようにする
}

function closeExerciseSheet() {
  exerciseSheet.classList.remove("open");
  document.body.style.overflow = "";
}

addExerciseButton.addEventListener("click", openExerciseSheet);
sheetClose.addEventListener("click", closeExerciseSheet);

exerciseSheet.addEventListener("click", (event) => {
  // 暗い背景の部分をタップしたら閉じる
  if (event.target === exerciseSheet) {
    closeExerciseSheet();
    return;
  }

  // 種目をタップしたら、閉じてから入力欄を開く
  const item = event.target.closest("button[data-id]");
  if (item === null) return;

  closeExerciseSheet();
  openEditor(item.dataset.id);
});

// --- 日付の表示（例：2026/10/14(水)） ---
// 言葉で表示する日（何日前か → 言葉）
const DATE_WORDS = ["今日", "昨日", "一昨日", "3日前"];

// --- 日付の表示 ---
// 今日〜3日前：「今日」などの言葉を大きく、日付を小さく
// それ以外  ：日付だけ（例：2026/10/10(土)）
function renderDateLabel() {
  const date = fromDateString(recordDate.value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  recordDateLabel.textContent = `${y}/${m}/${d}(${WEEKDAYS[date.getDay()]})`;

  // 今日から何日前か（未来の日はマイナスになる）
  const daysAgo = daysBetween(recordDate.value, toDateString(new Date()));
  const word = DATE_WORDS[daysAgo]; // 0〜3以外なら undefined

  if (word === undefined) {
    recordDateWord.hidden = true;
  } else {
    recordDateWord.textContent = word;
    recordDateWord.hidden = false;
  }

  dateOpen.classList.toggle("has-word", word !== undefined);
  dateOpen.classList.toggle("is-today", daysAgo === 0);
}


// --- 日付の切り替え ---
function changeDate(days) {
  const date = fromDateString(recordDate.value);
  date.setDate(date.getDate() + days);
  recordDate.value = toDateString(date);
  closeEditor();
  renderRecordList();
}

// --- 下書きの作成 ---
function emptySet() {
  return { weight: "", reps: "", seconds: "", sign: "+", drop: false };
}

// 保存済みの1セット → 入力欄に入れる形（文字列）
function recordSetToDraft(set, type) {
  if (type === "time") {
    return { ...emptySet(), seconds: String(set.seconds) };
  }

  let weight = formatNumber(kgToDisplay(Math.abs(set.weight)));
  if (type === "bodyweight" && set.weight === 0) weight = "";

  return {
    ...emptySet(),
    weight: weight,
    sign: set.weight < 0 ? "-" : "+",
    reps: String(set.reps),
    drop: set.drop === true,
  };
}

function openEditor(exerciseId) {
  const ex = getExercise(exerciseId);
  const existing = data.records.find(
    (r) => r.date === recordDate.value && r.exerciseId === exerciseId
  );

  if (existing) {
    // 同じ日・同じ種目の記録があれば、それを編集する
    draft = {
      recordId: existing.id,
      exerciseId: exerciseId,
      memo: existing.memo,
      sets: existing.sets.map((set) => recordSetToDraft(set, ex.type)),
    };
  } else {
    draft = {
      recordId: null,
      exerciseId: exerciseId,
      memo: "",
      sets: [emptySet()],
    };
  }

  editorTitle.textContent = ex.name;
  recordMemo.value = draft.memo;
  recordEditor.hidden = false;
  renderSetList();
  renderPreviousBox();
  recordEditor.scrollIntoView({ behavior: "smooth" });
}

function closeEditor() {
  draft = null;
  recordEditor.hidden = true;
}

// --- 前回の記録と自己ベスト ---
function renderPreviousBox() {
  const ex = getExercise(draft.exerciseId);
  const previous = findPreviousRecord(ex.id, recordDate.value);
  const best = findBestSet(ex.id, ex.type);

  if (previous === null && best === null) {
    previousBox.innerHTML = "";
    return;
  }

  let html = `<div class="previous-box">`;

  if (previous !== null) {
    const setsText = previous.sets
      .map((set) => (set.drop ? "↳" : "") + formatSet(set, ex.type))
      .join(" / ");
    html += `
      <div class="previous-head">
        <span>前回（${formatShortDate(previous.date)}）</span>
        <button type="button" class="btn-small" data-action="copy-previous">コピー</button>
      </div>
      <div class="previous-sets">${setsText}</div>`;

    // 前回スーパーセットだったら、相手の種目を表示する
    const partners = supersetPartners(previous);
    if (partners.length > 0) {
      const names = partners
        .map((p) => escapeHtml(getExercise(p.exerciseId).name))
        .join("・");
      html += `<div class="previous-ss">⚡ 前回は ${names} とスーパーセット</div>`;
    }
  }

  if (best !== null) {
    let bestText = formatSet(best, ex.type);
    if (ex.type === "weight") bestText += `（推定1RM ${format1RM(best)}）`;
    html += `<div class="previous-best">🏆 自己ベスト：${bestText}</div>`;
  }

  html += `</div>`;
  previousBox.innerHTML = html;
}

// 「コピー」：前回のセットを入力欄に入れる
previousBox.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="copy-previous"]');
  if (button === null) return;

  const ex = getExercise(draft.exerciseId);
  const previous = findPreviousRecord(ex.id, recordDate.value);

  const hasInput = draft.sets.some(
    (s) => s.weight !== "" || s.reps !== "" || s.seconds !== ""
  );
  if (hasInput && !confirm("入力中のセットを、前回の内容で置き換えますか？")) return;

  draft.sets = previous.sets.map((set) => recordSetToDraft(set, ex.type));
  renderSetList();
});

// --- セットの入力欄 ---
function setRowHtml(set, i, type, label) {
  let inputs = "";

  if (type === "time") {
    inputs = `
      <input class="set-input" inputmode="numeric" placeholder="0"
        data-index="${i}" data-field="seconds" value="${escapeHtml(set.seconds)}">
      <span class="set-unit">秒</span>`;
  } else {
    if (type === "bodyweight") {
      inputs += `
        <span class="set-unit">自重</span>
        <select class="set-sign" data-index="${i}" data-field="sign">
          <option value="+" ${set.sign === "+" ? "selected" : ""}>＋</option>
          <option value="-" ${set.sign === "-" ? "selected" : ""}>−</option>
        </select>`;
    }
    inputs += `
      <input class="set-input" inputmode="decimal" placeholder="0"
        data-index="${i}" data-field="weight" value="${escapeHtml(set.weight)}">
      <span class="set-unit">${unit()}</span>
      <span class="set-x">×</span>
      <input class="set-input" inputmode="numeric" placeholder="0"
        data-index="${i}" data-field="reps" value="${escapeHtml(set.reps)}">
      <span class="set-unit">回</span>`;
  }

  // ドロップの切り替えボタン（時間の種目にはない。1セット目は押せない）
  let dropButton = "";
  if (type !== "time") {
    dropButton = `
      <button type="button" class="set-drop ${set.drop ? "active" : ""}"
        data-action="toggle-drop" data-index="${i}" ${i === 0 ? "disabled" : ""}>↓</button>`;
  }

  return `
    <div class="set-row ${set.drop ? "drop" : ""}">
      <span class="set-no">${label}</span>
      ${inputs}
      ${dropButton}
      <button type="button" class="set-remove" data-action="remove-set" data-index="${i}">×</button>
    </div>`;
}

function renderSetList() {
  const type = getExercise(draft.exerciseId).type;

  // 1セット目はドロップにできない（セットを消して、ドロップが先頭になったとき用）
  if (draft.sets.length > 0) draft.sets[0].drop = false;

  const labels = setLabels(draft.sets);
  setList.innerHTML = draft.sets
    .map((set, i) => setRowHtml(set, i, type, labels[i]))
    .join("");
}

// 入力されるたびに、下書きに書き写す
setList.addEventListener("input", (event) => {
  const el = event.target;
  const field = el.dataset.field;
  if (field === undefined) return;

  const index = Number(el.dataset.index);
  draft.sets[index][field] = el.value;
});

// セットの行のボタン（「↓」ドロップの切り替え、「×」削除）
setList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (button === null) return;

  const index = Number(button.dataset.index);

  if (button.dataset.action === "remove-set") {
    draft.sets.splice(index, 1);
    if (draft.sets.length === 0) draft.sets.push(emptySet());
  }

  if (button.dataset.action === "toggle-drop") {
    draft.sets[index].drop = !draft.sets[index].drop;
  }

  renderSetList();
});

// 「＋ セットを追加」：直前のセットと同じ値で追加する
addSetButton.addEventListener("click", () => {
  const last = draft.sets[draft.sets.length - 1];
  draft.sets.push({ ...last });
  renderSetList();
});

recordMemo.addEventListener("input", () => {
  draft.memo = recordMemo.value;
});

// --- 保存 ---
// 下書き（文字列）→ 保存用のセット（数値）。空のセットは除く
function draftToSets(type) {
  const sets = [];

  for (const s of draft.sets) {
    if (type === "time") {
      const seconds = parseInt(s.seconds, 10);
      if (seconds > 0) sets.push({ seconds: seconds, drop: false });
      continue;
    }

    const reps = parseInt(s.reps, 10);
    if (!(reps > 0)) continue; // 回数が入っていないセットは保存しない

    let weight = parseNumber(s.weight);
    if (isNaN(weight)) {
      if (type === "weight") continue; // 重量の種目で重量が空なら保存しない
      weight = 0;                      // 自重の種目で空なら「自重のみ」
    }
    if (type === "bodyweight" && s.sign === "-") weight = -weight;

    const kg = Math.round(displayToKg(weight) * 1000) / 1000;
    sets.push({ weight: kg, reps: reps, drop: s.drop });
  }

  // 空のセットを除いた結果、先頭がドロップになったら通常のセットに戻す
  if (sets.length > 0) sets[0].drop = false;

  return sets;
}
editorSave.addEventListener("click", () => {
  const type = getExercise(draft.exerciseId).type;
  const sets = draftToSets(type);

  if (sets.length === 0) {
    alert("セットを1つ以上入力してください");
    return;
  }

  if (draft.recordId === null) {
    data.records.push({
      id: createId(),
      date: recordDate.value,
      exerciseId: draft.exerciseId,
      memo: draft.memo.trim(),
      sets: sets,
      supersetId: null,   // ← この行を追加
    });
  } else {
    const record = data.records.find((r) => r.id === draft.recordId);
    record.sets = sets;
    record.memo = draft.memo.trim();
  }

  autoFillGym(recordDate.value); // ← 追加（その日のジムが決まっていなければ、前回のジムを入れる） 
  saveData();
  closeEditor();
  refreshAll();
});

editorCancel.addEventListener("click", closeEditor);

// --- スーパーセット ---
const SUPERSET_COLORS = ["#bf5af2", "#64d2ff", "#ff9f0a", "#ff375f"]; // A, B, C, D の色

// つなぐ相手を選ぶ欄を開いている記録のID（開いていなければ null）
let supersetPickerFor = null;

function getRecord(id) {
  return data.records.find((r) => r.id === id);
}

// 同じ組の、自分以外の記録
function supersetPartners(record) {
  if (record.supersetId === null) return [];
  return data.records.filter(
    (r) => r.supersetId === record.supersetId && r.id !== record.id
  );
}

// 2つの記録をつなぐ
function linkSuperset(sourceId, targetId) {
  const source = getRecord(sourceId);
  const target = getRecord(targetId);

  // どちらも組に入っていない → 新しい組を作る
  if (source.supersetId === null && target.supersetId === null) {
    const id = createId();
    source.supersetId = id;
    target.supersetId = id;
    return;
  }
  // 片方だけ組に入っている → もう片方をその組に入れる
  if (source.supersetId === null) {
    source.supersetId = target.supersetId;
    return;
  }
  if (target.supersetId === null) {
    target.supersetId = source.supersetId;
    return;
  }
  // どちらも別の組に入っている → 相手の組を、自分の組にまとめる
  const oldId = target.supersetId;
  for (const r of data.records) {
    if (r.supersetId === oldId) r.supersetId = source.supersetId;
  }
}

// 1つの記録を組から外す
function unlinkSuperset(id) {
  getRecord(id).supersetId = null;
  cleanupSupersets();
}

// 1種目だけになった組をなくす
function cleanupSupersets() {
  const counts = {};
  for (const r of data.records) {
    if (r.supersetId === null) continue;
    counts[r.supersetId] = (counts[r.supersetId] || 0) + 1;
  }
  for (const r of data.records) {
    if (r.supersetId !== null && counts[r.supersetId] < 2) r.supersetId = null;
  }
}

// つなぐ相手を選ぶ欄のHTML
function supersetPickerHtml(record) {
  // 同じ日の、自分と同じ組に入っていない記録が候補
  const candidates = data.records.filter(
    (r) =>
      r.date === record.date &&
      r.id !== record.id &&
      (record.supersetId === null || r.supersetId !== record.supersetId)
  );

  let html = `
    <div class="ss-picker">
      <div class="ss-picker-title">つなぐ種目を選んでください</div>`;

  if (candidates.length === 0) {
    html += `<p class="ss-picker-empty">この日のほかの記録がありません</p>`;
  }

  for (const c of candidates) {
    const ex = getExercise(c.exerciseId);
    const part = getPart(ex.part);
    const note = c.supersetId !== null ? `<span class="ss-note">別のスーパーセット</span>` : "";
    html += `
      <button type="button" class="ss-option" data-action="ss-link"
        data-id="${record.id}" data-target="${c.id}">
        <span class="part-dot" style="background:${part.color}"></span>
        ${escapeHtml(ex.name)}
        ${note}
      </button>`;
  }

  html += `
      <button type="button" class="btn-small" data-action="ss-close">キャンセル</button>
    </div>`;
  return html;
}

// 記録カード1枚分のHTML
// showButtons が true（記録タブ）のとき：カードを押すと編集できる。削除・スーパーセットのボタンも付ける
function recordCardHtml(record, showButtons) {
  const ex = getExercise(record.exerciseId);
  const part = getPart(ex.part);

  const labels = setLabels(record.sets);
  const setsHtml = record.sets
    .map((set, i) => `
      <li class="${set.drop ? "drop" : ""}">
        <span class="set-no">${labels[i]}</span>${formatSet(set, ex.type)}
      </li>`)
    .join("");

  const pbHtml = isPersonalBest(record, ex.type)
    ? `<span class="pb-badge">🏆 自己ベスト</span>`
    : "";

  let oneRmHtml = "";
  if (ex.type === "weight") {
    const best = bestSet(record.sets, ex.type);
    oneRmHtml = `<p class="record-1rm">推定1RM ${format1RM(best)}</p>`;
  }

  const memoHtml = record.memo
    ? `<p class="record-memo">${escapeHtml(record.memo)}</p>`
    : "";

  // 押せることを表す「›」と、削除ボタン（記録タブのときだけ）
  const chevronHtml = showButtons ? `<span class="record-chevron">›</span>` : "";
  const deleteHtml = showButtons
    ? `<button class="btn-small btn-danger" data-action="delete" data-id="${record.id}">削除</button>`
    : "";

  // スーパーセットのボタン（記録タブのときだけ）
  let supersetHtml = "";
  if (showButtons) {
    const inGroup = record.supersetId !== null;
    supersetHtml = `
      <div class="ss-actions">
        <button class="btn-small" data-action="ss-open" data-id="${record.id}">
          ${inGroup ? "⚡ 種目を追加" : "⚡ スーパーセット"}
        </button>
        ${inGroup ? `<button class="btn-small" data-action="ss-remove" data-id="${record.id}">解除</button>` : ""}
      </div>`;

    if (supersetPickerFor === record.id) {
      supersetHtml += supersetPickerHtml(record);
    }
  }

  // 記録タブのカードには、押せる目印（tappable）と、どの記録かを表すIDを付ける
  const cardAttrs = showButtons
    ? `class="card record-card tappable" data-record-id="${record.id}"`
    : `class="card record-card"`;

  return `
    <div ${cardAttrs}>
      <div class="record-head">
        <span class="part-dot" style="background:${part.color}"></span>
        <span class="record-name">${escapeHtml(ex.name)}${chevronHtml}</span>
        ${pbHtml}
        ${deleteHtml}
      </div>
      <ul class="record-sets">${setsHtml}</ul>
      ${oneRmHtml}
      ${memoHtml}
      ${supersetHtml}
    </div>`;
}

function renderRecordList() {
  renderBodyCard(); // 日付が変わったときに、体重の欄も更新する
  renderDateLabel();
  renderGymSelect();
  renderRecordPhotos(); // 日付が変わったときに、写真の欄も更新する  

  const records = data.records.filter((r) => r.date === recordDate.value);

  if (records.length === 0) {
    recordList.innerHTML = `<p class="empty">まだ記録がありません</p>`;
    return;
  }

  // スーパーセットごとにまとめる（組の並び順は、その組の最初の記録の位置）
  const groups = [];      // 例：[ [ベンチ, ロウ], [スクワット], [カール, プレスダウン] ]
  const groupById = {};   // 組の番号 → その組の配列
  for (const r of records) {
    if (r.supersetId === null) {
      groups.push([r]);
      continue;
    }
    if (groupById[r.supersetId] === undefined) {
      groupById[r.supersetId] = [];
      groups.push(groupById[r.supersetId]);
    }
    groupById[r.supersetId].push(r);
  }

  let html = "";
  let supersetCount = 0;

  for (const group of groups) {
    const cards = group.map((r) => recordCardHtml(r, true)).join("");

    if (group[0].supersetId === null) {
      html += cards; // スーパーセットでない記録は、そのまま
      continue;
    }

    const letter = String.fromCharCode(65 + supersetCount); // 65 は "A" の文字番号
    const color = SUPERSET_COLORS[supersetCount % SUPERSET_COLORS.length];
    supersetCount++;

    html += `
      <div class="ss-group" style="--ss-color:${color}">
        <div class="ss-label">⚡ スーパーセット ${letter}</div>
        ${cards}
      </div>`;
  }

  recordList.innerHTML = html;
}

recordList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  // ボタン以外の場所を押したとき
  if (button === null) {
    // スーパーセットのボタンの周りや、相手を選ぶ欄の中を押したときは、何もしない
    if (event.target.closest(".ss-actions, .ss-picker") !== null) return;

    // カードを押したら、その記録を編集する
    const card = event.target.closest(".record-card[data-record-id]");
    if (card !== null) {
      openEditor(getRecord(card.dataset.recordId).exerciseId);
    }
    return;
  }

  const action = button.dataset.action;
  const record = getRecord(button.dataset.id);

  // 編集
  if (action === "edit") {
    openEditor(record.exerciseId);
    return;
  }

  // 削除
  if (action === "delete") {
    const name = getExercise(record.exerciseId).name;
    if (!confirm(`「${name}」の記録を削除しますか？`)) return;

    data.records = data.records.filter((r) => r.id !== record.id);
    cleanupSupersets(); // 組が1種目だけになったら、組をなくす
    saveData();
    if (draft !== null && draft.recordId === record.id) closeEditor();
    refreshAll();
    return;
  }

  // つなぐ相手を選ぶ欄を開く／閉じる
  if (action === "ss-open") {
    supersetPickerFor = record.id;
    renderRecordList();
    return;
  }
  if (action === "ss-close") {
    supersetPickerFor = null;
    renderRecordList();
    return;
  }

  // 相手を選んでつなぐ
  if (action === "ss-link") {
    linkSuperset(record.id, button.dataset.target);
    supersetPickerFor = null;
    saveData();
    refreshAll();
    return;
  }

  // 組から外す
  if (action === "ss-remove") {
    if (!confirm("この種目をスーパーセットから外しますか？")) return;
    unlinkSuperset(record.id);
    saveData();
    refreshAll();
  }
});


datePrev.addEventListener("click", () => changeDate(-1));
dateNext.addEventListener("click", () => changeDate(1));


// ===== 部位ごとの最終実施日 =====
const lastDoneList = document.querySelector("#last-done-list");

function renderLastDone() {
  const today = toDateString(new Date());
  let html = "";

  for (const part of PARTS) {
    // 種目が1つもない部位は表示しない
    const hasExercise = data.exercises.some((ex) => ex.part === part.id);
    if (!hasExercise) continue;

    // この部位の記録の中で、一番新しい日付を探す
    let last = null;
    for (const record of data.records) {
      if (record.date > today) continue; // 未来の日付の記録は除く
      if (getExercise(record.exerciseId).part !== part.id) continue;
      if (last === null || record.date > last) last = record.date;
    }

    // 大きく表示する部分
    let valueHtml = `<span class="last-done-none">記録なし</span>`;
    if (last !== null) {
      const days = daysBetween(last, today);
      if (days === 0) {
        valueHtml = `<span class="last-done-word">今日</span>`;
      } else if (days === 1) {
        valueHtml = `<span class="last-done-word">昨日</span>`;
      } else {
        valueHtml = `<span class="last-done-word">${days}</span><span class="last-done-unit">日前</span>`;
      }
    }

    html += `
      <div class="card last-done-tile">
        <div class="last-done-part">
          <span class="part-dot" style="background:${part.color}"></span>${part.name}
        </div>
        <div class="last-done-value">${valueHtml}</div>
      </div>`;
  }

  lastDoneList.innerHTML = html;
}

// ===== カレンダー =====
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const calPrev = document.querySelector("#cal-prev");
const calNext = document.querySelector("#cal-next");
const calTitle = document.querySelector("#cal-title");
const calGrid = document.querySelector("#cal-grid");
const calSummary = document.querySelector("#cal-summary");
const calSummaryLabel = document.querySelector("#cal-summary-label");
const calToday = document.querySelector("#cal-today");
const calLegend = document.querySelector("#cal-legend");
const calDetail = document.querySelector("#cal-detail");

// 表示中の月（その月の1日）
const now = new Date();
let calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);

// タップして選んでいる日付（選んでいなければ null）
let selectedDate = null;

// "2026-10-13" → "10月13日（火）"
function formatLongDate(text) {
  const date = fromDateString(text);
  return `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}

// 日付ごとに、トレーニングした部位を集める
// 例）{ "2026-10-06": Set {"chest", "arm"}, "2026-10-08": Set {"leg"} }
function collectPartsByDate() {
  const map = {};
  for (const record of data.records) {
    const partId = getExercise(record.exerciseId).part;
    if (map[record.date] === undefined) {
      map[record.date] = new Set();
    }
    map[record.date].add(partId);
  }
  return map;
}

// 1か月分の日付のマスのHTMLを作る（カレンダータブと、日付を選ぶポップアップの両方で使う）
// selected：黄緑の枠を付ける日付
function calendarCellsHtml(year, month, selected) {
  // 1日の前に入れる空白の数（月曜始まり：月=0, 火=1, …, 土=5, 日=6）
  const blanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate(); // その月の日数
  const today = toDateString(new Date());
  const partsByDate = collectPartsByDate();

  let html = "";

  for (let i = 0; i < blanks; i++) {
    html += `<div class="cal-cell empty"></div>`;
  }

  let trainedDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateText = toDateString(new Date(year, month, day));
    const weekday = new Date(year, month, day).getDay(); // 0=日曜, 6=土曜
    const parts = partsByDate[dateText];

    const classes = ["cal-cell"];
    if (weekday === 0) classes.push("sun");
    if (weekday === 6) classes.push("sat");
    if (dateText === today) classes.push("today");
    if (dateText === selected) classes.push("selected");

    let dotsHtml = "";
    if (parts !== undefined) {
      trainedDays++;
      classes.push("trained");
      for (const part of PARTS) {
        if (parts.has(part.id)) {
          dotsHtml += `<span class="cal-dot" style="background:${part.color}"></span>`;
        }
      }
    }

    html += `
      <button type="button" class="${classes.join(" ")}" data-date="${dateText}">
        <span class="cal-day">${day}</span>
        <span class="cal-dots">${dotsHtml}</span>
      </button>`;
  }

  return { html: html, trainedDays: trainedDays };
}

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth(); // 0〜11

  calTitle.textContent = `${year}年${month + 1}月`;

  const result = calendarCellsHtml(year, month, selectedDate);
  calGrid.innerHTML = result.html;

  calSummaryLabel.textContent = `${month + 1}月のトレーニング`;
  calSummary.textContent = result.trainedDays;
  renderCalendarDetail();
}

// 選んだ日の記録を、カレンダーの下に表示する
function renderCalendarDetail() {
  if (selectedDate === null) {
    calDetail.innerHTML = `<p class="empty">日付をタップすると、その日の記録が表示されます</p>`;
    return;
  }

  const records = data.records.filter((r) => r.date === selectedDate);

  let html = `
    <div class="detail-head">
      <h2 class="section-title">${formatLongDate(selectedDate)}</h2>
      <button type="button" class="btn-small" data-action="open-record">記録画面で開く</button>
    </div>`;

  // その日のジム
  const dayGym = findDayGym(selectedDate);
  if (dayGym !== null && dayGym.gymId !== null) {
    html += `<p class="detail-gym">📍 ${escapeHtml(getGym(dayGym.gymId).name)}</p>`;
  }

  if (records.length === 0) {
    html += `<p class="empty">記録がありません</p>`;
  } else {
    html += records.map((r) => recordCardHtml(r, false)).join("");
  }

  // その日の写真（中身は renderCalendarPhotos() で後から入れる）
  html += `<div id="cal-photo-list" class="photo-grid detail-photos"></div>`;

  calDetail.innerHTML = html;
  renderCalendarPhotos();
}

// 色の凡例
function renderCalendarLegend() {
  calLegend.innerHTML = PARTS
    .map((part) => `
      <span class="cal-legend-item">
        <span class="cal-dot" style="background:${part.color}"></span>${part.name}
      </span>`)
    .join("");
}

// 月を切り替える（-1 で前の月、1 で次の月）
function changeMonth(diff) {
  calendarMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + diff,
    1
  );
  renderCalendar();
}

calPrev.addEventListener("click", () => changeMonth(-1));
calNext.addEventListener("click", () => changeMonth(1));

calToday.addEventListener("click", () => {
  const today = new Date();
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = toDateString(today);
  renderCalendar();
});

// 日付のマスをタップしたとき
calGrid.addEventListener("click", (event) => {
  const cell = event.target.closest("button[data-date]");
  if (cell === null) return;

  selectedDate = cell.dataset.date;
  renderCalendar();
});

// 「記録画面で開く」
calDetail.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="open-record"]');
  if (button === null) return;

  recordDate.value = selectedDate;
  closeEditor();
  renderRecordList();
  showView("record");
  window.scrollTo(0, 0);
});

// ===== 体重・体脂肪率 =====
const bodyCard = document.querySelector("#body-card");
const bodySavedBadge = document.querySelector("#body-saved-badge");
const bodyInputArea = document.querySelector("#body-input-area");
const bodySavedArea = document.querySelector("#body-saved-area");
const bodySavedValues = document.querySelector("#body-saved-values");
const bodyDiff = document.querySelector("#body-diff");
const bodyEditButton = document.querySelector("#body-edit");
const bodyDeleteButton = document.querySelector("#body-delete");
const bodyWeightInput = document.querySelector("#body-weight");
const bodyWeightUnit = document.querySelector("#body-weight-unit");
const bodyFatInput = document.querySelector("#body-fat");
const bodySave = document.querySelector("#body-save");
const bodyStatus = document.querySelector("#body-status");

// 保存済みの体重を編集している日付（編集していないときは null）
let bodyEditDate = null;

// 指定した日の体重の記録（なければ null）
function findBodyRecord(date) {
  const body = data.bodyWeights.find((b) => b.date === date);
  return body === undefined ? null : body;
}

// 指定した日より前で、一番新しい体重の記録（なければ null）
function findPreviousBody(date) {
  let previous = null;
  for (const b of data.bodyWeights) {
    if (b.date >= date) continue;
    if (previous === null || b.date > previous.date) previous = b;
  }
  return previous;
}

// 体重と体脂肪率を表示用の文字にする（例："70.2kg / 18.5%"）
function formatBody(body) {
  let text = `${formatNumber(kgToDisplay(body.weight))}${unit()}`;
  if (body.fat !== null) text += ` / ${formatNumber(body.fat)}%`;
  return text;
}

// 状態に合わせて「保存済みの表示」か「入力欄」のどちらかを出す
function renderBodyCard() {
  const body = findBodyRecord(recordDate.value);
  const editing = body !== null && bodyEditDate === recordDate.value;
  bodyWeightUnit.textContent = unit();

  if (body !== null && !editing) {
    showBodySaved(body);
  } else {
    showBodyInput(body);
  }
}

// --- 保存済みの表示 ---
function showBodySaved(body) {
  bodyCard.classList.add("saved");
  bodySavedBadge.hidden = false;
  bodyInputArea.hidden = true;
  bodySavedArea.hidden = false;

  // 大きな数字で表示する（体脂肪率がない日は体重だけ）
  let html = `<span class="body-value">${formatNumber(kgToDisplay(body.weight))}<small>${unit()}</small></span>`;
  if (body.fat !== null) {
    html += `<span class="body-value">${formatNumber(body.fat)}<small>%</small></span>`;
  }
  bodySavedValues.innerHTML = html;

  // 前回比
  const previous = findPreviousBody(body.date);
  if (previous === null) {
    bodyDiff.textContent = "";
    return;
  }

  const diff = Math.round((kgToDisplay(body.weight) - kgToDisplay(previous.weight)) * 100) / 100;
  let sign = "±";
  if (diff > 0) sign = "+";
  if (diff < 0) sign = "−";

  bodyDiff.textContent =
    `前回比 ${sign}${formatNumber(Math.abs(diff))}${unit()}（${formatShortDate(previous.date)}）`;
}

// --- 入力欄（新しく入力するとき、または編集中） ---
function showBodyInput(body) {
  bodyCard.classList.remove("saved");
  bodySavedBadge.hidden = true;
  bodyInputArea.hidden = false;
  bodySavedArea.hidden = true;

  if (body !== null) {
    // 編集中：保存済みの値を入れておく
    bodyWeightInput.value = formatNumber(kgToDisplay(body.weight));
    bodyFatInput.value = body.fat === null ? "" : formatNumber(body.fat);
    bodySave.textContent = "更新";
    bodyStatus.innerHTML = `編集中<button type="button" class="link-button" data-action="cancel-body">キャンセル</button>`;
    return;
  }

  // 新しく入力する：空にして、前回の値を参考に表示する
  bodyWeightInput.value = "";
  bodyFatInput.value = "";
  bodySave.textContent = "保存";

  const previous = findPreviousBody(recordDate.value);
  bodyStatus.textContent = previous === null
    ? ""
    : `前回（${formatShortDate(previous.date)}）：${formatBody(previous)}`;
}

// --- 保存・更新 ---
bodySave.addEventListener("click", () => {
  const weight = parseNumber(bodyWeightInput.value);
  const fat = parseNumber(bodyFatInput.value);

  if (isNaN(weight) || weight <= 0) {
    alert("体重を入力してください");
    return;
  }
  if (!isNaN(fat) && (fat <= 0 || fat >= 100)) {
    alert("体脂肪率は0〜100の間で入力してください");
    return;
  }

  const kg = Math.round(displayToKg(weight) * 1000) / 1000;
  const fatValue = isNaN(fat) ? null : fat;

  const body = findBodyRecord(recordDate.value);
  if (body !== null) {
    body.weight = kg;
    body.fat = fatValue;
  } else {
    data.bodyWeights.push({ date: recordDate.value, weight: kg, fat: fatValue });
  }

  bodyEditDate = null; // 保存したら、保存済みの表示に戻す
  saveData();
  refreshAll();
});

// --- 編集 ---
bodyEditButton.addEventListener("click", () => {
  bodyEditDate = recordDate.value;
  renderBodyCard();
  bodyWeightInput.focus();
});

// --- 編集のキャンセル ---
bodyStatus.addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="cancel-body"]');
  if (button === null) return;

  bodyEditDate = null;
  renderBodyCard();
});

// --- 削除 ---
bodyDeleteButton.addEventListener("click", () => {
  if (!confirm("この日の体重の記録を削除しますか？")) return;

  data.bodyWeights = data.bodyWeights.filter((b) => b.date !== recordDate.value);
  bodyEditDate = null;
  saveData();
  refreshAll();
});

// ===== ジム =====
const gymSelect = document.querySelector("#gym-select");
const gymEmpty = document.querySelector("#gym-empty");
const gymForm = document.querySelector("#gym-form");
const gymName = document.querySelector("#gym-name");
const gymList = document.querySelector("#gym-list");

function getGym(id) {
  return data.gyms.find((g) => g.id === id);
}

// その日のジムの登録（なければ null）
// gymId が null の登録は「自分で未設定を選んだ」という意味
function findDayGym(date) {
  const entry = data.dayGyms.find((d) => d.date === date);
  return entry === undefined ? null : entry;
}

// その日のジムを決める
function setDayGym(date, gymId) {
  const entry = findDayGym(date);
  if (entry !== null) {
    entry.gymId = gymId;
  } else {
    data.dayGyms.push({ date: date, gymId: gymId });
  }
}

// 指定した日より前で、最後に行ったジムのID（なければ null）
function findPreviousGymId(date) {
  let previous = null;
  for (const d of data.dayGyms) {
    if (d.date >= date || d.gymId === null) continue;
    if (previous === null || d.date > previous.date) previous = d;
  }
  return previous === null ? null : previous.gymId;
}

// その日のジムがまだ決まっていなければ、前回のジムを入れる
function autoFillGym(date) {
  if (findDayGym(date) !== null) return; // 自分で選んだ日（未設定を含む）は何もしない
  const gymId = findPreviousGymId(date);
  if (gymId !== null) setDayGym(date, gymId);
}

// --- 記録タブのジムの選択欄 ---
function renderGymSelect() {
  if (data.gyms.length === 0) {
    gymSelect.hidden = true;
    gymEmpty.hidden = false;
    return;
  }
  gymSelect.hidden = false;
  gymEmpty.hidden = true;

  let html = `<option value="">ジム未設定</option>`;
  for (const gym of data.gyms) {
    html += `<option value="${gym.id}">${escapeHtml(gym.name)}</option>`;
  }
  gymSelect.innerHTML = html;

  const entry = findDayGym(recordDate.value);
  gymSelect.value = entry === null || entry.gymId === null ? "" : entry.gymId;
}

gymSelect.addEventListener("change", () => {
  const gymId = gymSelect.value === "" ? null : gymSelect.value;
  setDayGym(recordDate.value, gymId);
  saveData();
  refreshAll();
});

// --- 設定タブのジムの管理 ---
const gymAddRow = document.querySelector("#gym-add-row");
const gymSubmit = document.querySelector("#gym-submit");
const gymCancel = document.querySelector("#gym-cancel");
const gymDelete = document.querySelector("#gym-delete");

let gymEditingId = null; // 編集中のジムのID（編集していないときは null）

function renderGymSettings() {
  let html = "";

  for (const gym of data.gyms) {
    const days = data.dayGyms.filter((d) => d.gymId === gym.id).length;
    html += `
      <button type="button" class="settings-row" data-id="${gym.id}">
        <span class="settings-name">${escapeHtml(gym.name)}</span>
        <span class="settings-meta">${days}日</span>
        <span class="settings-chevron">›</span>
      </button>`;
  }

  if (html === "") {
    html = `<p class="settings-empty">ジムはまだ登録されていません</p>`;
  }

  gymList.innerHTML = html;
}

// フォームを閉じて、最初の状態に戻す
function resetGymForm() {
  gymForm.reset();
  gymEditingId = null;
  gymForm.hidden = true;
  gymAddRow.hidden = false;
}

// フォームを開く（id が null なら新しく登録、それ以外はそのジムを編集）
function openGymForm(id) {
  resetGymForm();

  if (id !== null) {
    gymEditingId = id;
    gymName.value = getGym(id).name;
  }

  gymSubmit.textContent = id === null ? "登録" : "更新";
  gymDelete.hidden = id === null;
  gymForm.hidden = false;
  gymAddRow.hidden = true;
  gymName.focus();
}

gymAddRow.addEventListener("click", () => openGymForm(null));
gymCancel.addEventListener("click", resetGymForm);

// ジムの行を押したとき
gymList.addEventListener("click", (event) => {
  const row = event.target.closest("button[data-id]");
  if (row === null) return;
  openGymForm(row.dataset.id);
});

// 登録・更新
gymForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = gymName.value.trim();
  if (name === "") return;

  if (gymEditingId === null) {
    data.gyms.push({ id: createId(), name: name });
  } else {
    getGym(gymEditingId).name = name;
  }

  resetGymForm();
  saveData();
  refreshAll();
});

// 削除
gymDelete.addEventListener("click", () => {
  const gym = getGym(gymEditingId);
  const usedDays = data.dayGyms.filter((d) => d.gymId === gym.id);

  let message = `「${gym.name}」を削除しますか？`;
  if (usedDays.length > 0) {
    message += `\n${usedDays.length}日分の記録で使われています。その日のジムは未設定になります。`;
  }
  if (!confirm(message)) return;

  for (const d of usedDays) d.gymId = null;
  data.gyms = data.gyms.filter((g) => g.id !== gym.id);

  resetGymForm();
  saveData();
  refreshAll();
});

// ===== グラフ =====

// グラフの文字と目盛りの線を、黒い背景で見やすい色にする
Chart.defaults.color = "#8e8e93";
Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";

// 種類ごとの指標。calc は「その日のセット」から値を1つ計算する関数
// 種類ごとの指標。calc は「その日のセット」から値を1つ計算する関数
// 最大値の指標はドロップを除き（normalSets）、合計の指標はドロップも含める
const METRICS = {
  weight: [
    {
      id: "1rm", name: "推定1RM", unit: "weight",
      calc: (sets) => Math.max(...normalSets(sets).map((s) => estimate1RM(s.weight, s.reps))),
    },
    {
      id: "max", name: "最大重量", unit: "weight",
      calc: (sets) => Math.max(...normalSets(sets).map((s) => s.weight)),
    },
    {
      id: "volume", name: "総挙上量", unit: "weight",
      calc: (sets) => sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    },
  ],
  bodyweight: [
    {
      id: "maxReps", name: "最大回数", unit: "回",
      calc: (sets) => Math.max(...normalSets(sets).map((s) => s.reps)),
    },
    {
      id: "totalReps", name: "総回数", unit: "回",
      calc: (sets) => sets.reduce((sum, s) => sum + s.reps, 0),
    },
    {
      id: "maxLoad", name: "最大加重", unit: "weight",
      calc: (sets) => Math.max(...normalSets(sets).map((s) => s.weight)),
    },
  ],
  time: [
    {
      id: "maxTime", name: "最長時間", unit: "秒",
      calc: (sets) => Math.max(...normalSets(sets).map((s) => s.seconds)),
    },
    {
      id: "totalTime", name: "合計時間", unit: "秒",
      calc: (sets) => sets.reduce((sum, s) => sum + s.seconds, 0),
    },
  ],
};

// 期間ごとに何か月さかのぼるか（null は全期間）
const PERIOD_MONTHS = { "1m": 1, "3m": 3, "1y": 12, "all": null };
// 体重・体脂肪率の指標。value は体重の記録1つから値を取り出す関数
const BODY_METRICS = [
  { id: "weight", name: "体重", unit: "weight", value: (b) => b.weight },
  { id: "fat", name: "体脂肪率", unit: "%", value: (b) => b.fat },
];

const graphExercise = document.querySelector("#graph-exercise");
const graphMetric = document.querySelector("#graph-metric");
const graphPeriods = document.querySelector("#graph-periods");
const chartWrap = document.querySelector("#chart-wrap");
const graphCanvas = document.querySelector("#graph-canvas");
const graphEmpty = document.querySelector("#graph-empty");
const graphSummary = document.querySelector("#graph-summary");
const graphTitle = document.querySelector("#graph-title");
const graphSubtitle = document.querySelector("#graph-subtitle");

let graphExerciseId = null; // 表示中の種目
let graphMetricId = null;   // 表示中の指標
let graphPeriod = "3m";     // 表示中の期間
let graphChart = null;      // Chart.js で作ったグラフ

// 一番最近記録した種目のID（記録がなければ null）
function latestExerciseId() {
  let latest = null;
  for (const r of data.records) {
    if (latest === null || r.date >= latest.date) latest = r;
  }
  return latest === null ? null : latest.exerciseId;
}

// 期間の開始日（全期間なら null）
function periodStartDate(periodId) {
  const months = PERIOD_MONTHS[periodId];
  if (months === null) return null;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
  return toDateString(start);
}

// 指標の値と単位を、表示用にする
function metricDisplayValue(value, metric) {
  const v = metric.unit === "weight" ? kgToDisplay(value) : value;
  return Math.round(v * 100) / 100;
}

function metricUnitLabel(metric) {
  return metric.unit === "weight" ? unit() : metric.unit;
}

// 種目・指標の選択欄と、期間ボタンの表示を整える
function renderGraphControls() {
  const recordedIds = new Set(data.records.map((r) => r.exerciseId));
  const hasBody = data.bodyWeights.length > 0;

  // 選んでいた項目が表示できなくなっていたら、選び直す
  const isValid =
    (graphExerciseId === "body" && hasBody) || recordedIds.has(graphExerciseId);
  if (!isValid) {
    graphExerciseId = latestExerciseId();
    if (graphExerciseId === null && hasBody) graphExerciseId = "body";
    graphMetricId = null;
  }

  // 選択欄：一番上に「体重・体脂肪率」、その下に記録がある種目
  let html = "";
  if (hasBody) {
    html += `<optgroup label="からだ"><option value="body">体重・体脂肪率</option></optgroup>`;
  }
  for (const part of PARTS) {
    const list = data.exercises.filter(
      (ex) => ex.part === part.id && recordedIds.has(ex.id)
    );
    if (list.length === 0) continue;

    html += `<optgroup label="${part.name}">`;
    for (const ex of list) {
      html += `<option value="${ex.id}">${escapeHtml(ex.name)}</option>`;
    }
    html += `</optgroup>`;
  }
  graphExercise.innerHTML = html;

  graphPeriods.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.period === graphPeriod);
  });

  if (graphExerciseId === null) {
    graphMetric.innerHTML = "";
    return;
  }
  graphExercise.value = graphExerciseId;

  // 指標の選択欄（体重か、種目の種類かで変わる）
  const metrics = graphExerciseId === "body"
    ? BODY_METRICS
    : METRICS[getExercise(graphExerciseId).type];

  if (!metrics.some((m) => m.id === graphMetricId)) {
    graphMetricId = metrics[0].id;
  }
  graphMetric.innerHTML = metrics
    .map((m) => `<option value="${m.id}">${m.name}</option>`)
    .join("");
  graphMetric.value = graphMetricId;
}

// グラフの代わりにメッセージを出す
function showGraphEmpty(message) {
  if (graphChart !== null) {
    graphChart.destroy();
    graphChart = null;
  }
  chartWrap.hidden = true;
  graphSummary.hidden = true;
  graphEmpty.hidden = false;
  graphEmpty.textContent = message;
}

function renderGraph() {
  renderGraphControls();

  if (graphExerciseId === null) {
    graphTitle.textContent = "";
    graphSubtitle.textContent = "";
    showGraphEmpty("記録がまだありません");
    return;
  }

  const isBody = graphExerciseId === "body";
  const metrics = isBody ? BODY_METRICS : METRICS[getExercise(graphExerciseId).type];
  const metric = metrics.find((m) => m.id === graphMetricId);
  const label = metricUnitLabel(metric);
  // グラフの見出し（例：「ベンチプレス　推定1RM」）
  graphTitle.textContent = isBody ? "体重・体脂肪率" : getExercise(graphExerciseId).name;
  graphSubtitle.textContent = metric.name;
  const start = periodStartDate(graphPeriod);

  // 体重でも種目でも、{ date, value } という同じ形のリストにそろえる
  let points;
  if (isBody) {
    points = data.bodyWeights
      .filter((b) => metric.value(b) !== null) // 体脂肪率がない日は除く
      .map((b) => ({ date: b.date, value: metric.value(b) }));
  } else {
    points = data.records
      .filter((r) => r.exerciseId === graphExerciseId)
      .map((r) => ({ date: r.date, value: metric.calc(r.sets) }));
  }

  // 期間で絞り込んで、日付の古い順に並べる
  points = points
    .filter((p) => start === null || p.date >= start)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (points.length === 0) {
    showGraphEmpty("この期間の記録がありません");
    return;
  }

  // 年をまたぐときは、日付に年も付ける
  const firstYear = points[0].date.slice(0, 4);
  const lastYear = points[points.length - 1].date.slice(0, 4);
  const withYear = firstYear !== lastYear;

  const labels = points.map((p) =>
    withYear ? p.date.slice(0, 4) + "/" + formatShortDate(p.date) : formatShortDate(p.date)
  );
  const values = points.map((p) => metricDisplayValue(p.value, metric));

  chartWrap.hidden = false;
  graphEmpty.hidden = true;
  if (graphChart !== null) graphChart.destroy();

  graphChart = new Chart(graphCanvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          borderColor: "#b6f03c",
          backgroundColor: "rgba(182, 240, 60, 0.12)",
          pointBackgroundColor: "#b6f03c",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${metric.name} ${context.parsed.y}${label}`,
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => value + label,
          },
        },
      },
    },
  });

  // 体重は増減のどちらが良いとは言えないので、色を付けない
  renderGraphSummary(points, values, label, !isBody);
}

// グラフの下のまとめ
// まとめの小さなカード1枚分のHTML
function summaryTileHtml(title, value, unitLabel, sub, valueClass = "") {
  return `
    <div class="card summary-tile">
      <div class="summary-label">${title}</div>
      <div class="summary-number">
        <span class="summary-value ${valueClass}">${value}</span>
        <span class="summary-unit">${unitLabel}</span>
      </div>
      <div class="summary-sub">${sub}</div>
    </div>`;
}

// colorize が true のとき、増えたら黄緑・減ったら赤で表示する
function renderGraphSummary(points, values, label, colorize) {
  const first = values[0];
  const last = values[values.length - 1];
  const max = Math.max(...values);
  const maxIndex = values.indexOf(max);
  const diff = Math.round((last - first) * 100) / 100;

  let diffClass = "";
  let diffText = String(diff);
  if (diff > 0) {
    diffText = "+" + diff;
    if (colorize) diffClass = "summary-up";
  } else if (diff < 0) {
    if (colorize) diffClass = "summary-down";
  }

  const firstDate = formatShortDate(points[0].date);
  const lastDate = formatShortDate(points[points.length - 1].date);
  const maxDate = formatShortDate(points[maxIndex].date);

  graphSummary.innerHTML =
    summaryTileHtml("最新", last, label, lastDate) +
    summaryTileHtml("期間中の変化", diffText, label, "最初との差", diffClass) +
    summaryTileHtml("最初", first, label, firstDate) +
    summaryTileHtml("期間中の最高", max, label, maxDate);

  graphSummary.hidden = false;
}

graphExercise.addEventListener("change", () => {
  graphExerciseId = graphExercise.value;
  graphMetricId = null; // 種類が変わるかもしれないので、指標は選び直す
  renderGraph();
});

graphMetric.addEventListener("change", () => {
  graphMetricId = graphMetric.value;
  renderGraph();
});

graphPeriods.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-period]");
  if (button === null) return;

  graphPeriod = button.dataset.period;
  renderGraph();
});

// ===== 設定 =====
const unitSwitch = document.querySelector("#unit-switch");
const dataSummary = document.querySelector("#data-summary");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFile = document.querySelector("#import-file");

function renderSettings() {
  // 単位の切り替え：今の単位に active を付ける
  unitSwitch.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.unit === unit());
  });

  // データの件数と、最後に書き出した日
  const lastExport = data.settings.lastExport;
  dataSummary.innerHTML = `
    種目 ${data.exercises.length}件 ／ 記録 ${data.records.length}件 ／ 体重 ${data.bodyWeights.length}件<br>
    最後の書き出し：${lastExport === null ? "まだありません" : formatLongDate(lastExport)}`;
}

// --- 単位の切り替え ---
unitSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-unit]");
  if (button === null) return;
  if (button.dataset.unit === unit()) return; // 同じ単位なら何もしない

  // 入力途中の数字は前の単位で入っているので、下書きは捨てる
  if (draft !== null && !confirm("入力中の記録は破棄されます。単位を切り替えますか？")) return;

  data.settings.unit = button.dataset.unit;
  saveData();
  closeEditor();
  refreshAll();
});

// ファイルをダウンロードする（PC用）
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportData() {
  const json = JSON.stringify(data, null, 2);
  const fileName = `kintore-backup-${toDateString(new Date())}.json`;
  const file = new File([json], fileName, { type: "application/json" });

  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  let done = false;

  // iPhone：まず共有の画面を試す
  if (isIPhone && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      done = true;
    } catch (error) {
      if (error.name === "AbortError") return; // 共有の画面でキャンセルした
      console.error("共有に失敗したので、ダウンロードに切り替えます", error);
    }
  }

  // PC、または共有に失敗したとき：ダウンロードする
  if (!done) {
    try {
      downloadFile(file);
    } catch (error) {
      console.error(error);
      alert("書き出しに失敗しました：" + error.message);
      return;
    }
  }

  data.settings.lastExport = toDateString(new Date());
  saveData();
  renderSettings();
}
exportButton.addEventListener("click", exportData);

// --- 読み込み ---

// このアプリのデータとして最低限の形になっているか
function isValidData(d) {
  return (
    typeof d === "object" &&
    d !== null &&
    Array.isArray(d.exercises) &&
    Array.isArray(d.records)
  );
}

// 「読み込む」ボタンで、隠してあるファイル選択を開く
importButton.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  importFile.value = ""; // 同じファイルをもう一度選べるようにする
  if (file === undefined) return;

  // ファイルを読んで、JSONとして解釈する
  let imported;
  try {
    imported = JSON.parse(await file.text());
  } catch {
    alert("ファイルを読み込めませんでした。このアプリで書き出したJSONファイルを選んでください。");
    return;
  }

  // 中身のチェック
  if (!isValidData(imported)) {
    alert("このアプリのバックアップファイルではありません。");
    return;
  }
  if (imported.version !== undefined && imported.version > DATA_VERSION) {
    alert("新しいバージョンのアプリで書き出されたファイルです。アプリを更新してから読み込んでください。");
    return;
  }

  const message =
    `次のデータで置き換えます。今のデータは消えます。\n\n` +
    `種目 ${imported.exercises.length}件 ／ 記録 ${imported.records.length}件\n\n` +
    `よろしいですか？`;
  if (!confirm(message)) return;

  data = migrateData(imported);
  saveData();
  closeEditor();
  resetExerciseForm();
  resetGymForm();
  refreshAll();
  alert("読み込みが完了しました。");
});

// ===== PWA（オフライン対応と更新） =====
const updateBanner = document.querySelector("#update-banner");
const updateButton = document.querySelector("#update-button");

let waitingWorker = null; // 待機中の新しいバージョン

// 開発中（Live Server）は、Service Workerを使わない
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

if ("serviceWorker" in navigator && !isLocal) {
  registerServiceWorker();

  // 新しいバージョンに切り替わったら、ページを読み込み直す
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register("sw.js");

  // すでに新しいバージョンが待機中なら、お知らせを出す
  if (registration.waiting && navigator.serviceWorker.controller) {
    showUpdateBanner(registration.waiting);
  }

  // 新しいバージョンが見つかったとき
  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateBanner(newWorker);
      }
    });
  });

  // アプリを開き直したとき（バックグラウンドから戻ったとき）に、更新を確認する
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") registration.update();
  });
}

function showUpdateBanner(worker) {
  waitingWorker = worker;
  updateBanner.hidden = false;
}

updateButton.addEventListener("click", () => {
  if (draft !== null && !confirm("入力中の記録は破棄されます。更新しますか？")) return;
  waitingWorker.postMessage("skipWaiting");
});

// ===== 日付を選ぶポップアップ =====
const dateOpen = document.querySelector("#date-open");
const datePicker = document.querySelector("#date-picker");
const pickerPrev = document.querySelector("#picker-prev");
const pickerNext = document.querySelector("#picker-next");
const pickerTitle = document.querySelector("#picker-title");
const pickerGrid = document.querySelector("#picker-grid");
const pickerToday = document.querySelector("#picker-today");
const pickerClose = document.querySelector("#picker-close");

// ポップアップで表示している月（その月の1日）
let pickerMonth = null;

function renderDatePicker() {
  const year = pickerMonth.getFullYear();
  const month = pickerMonth.getMonth();

  pickerTitle.textContent = `${year}年${month + 1}月`;
  pickerGrid.innerHTML = calendarCellsHtml(year, month, recordDate.value).html;
}

function openDatePicker() {
  // 今選んでいる日付の月から表示する
  const date = fromDateString(recordDate.value);
  pickerMonth = new Date(date.getFullYear(), date.getMonth(), 1);

  renderDatePicker();
  datePicker.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDatePicker() {
  datePicker.classList.remove("open");
  document.body.style.overflow = "";
}

// 日付を決めて、記録タブをその日にする
function selectRecordDate(dateText) {
  recordDate.value = dateText;
  closeEditor();
  renderRecordList();
  closeDatePicker();
}

function changePickerMonth(diff) {
  pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + diff, 1);
  renderDatePicker();
}

dateOpen.addEventListener("click", openDatePicker);
pickerPrev.addEventListener("click", () => changePickerMonth(-1));
pickerNext.addEventListener("click", () => changePickerMonth(1));
pickerToday.addEventListener("click", () => selectRecordDate(toDateString(new Date())));
pickerClose.addEventListener("click", closeDatePicker);

datePicker.addEventListener("click", (event) => {
  // 暗い部分をタップしたら、日付を変えずに閉じる
  if (event.target === datePicker) {
    closeDatePicker();
    return;
  }

  // 日付のマスをタップしたら、その日に移る
  const cell = event.target.closest("button[data-date]");
  if (cell === null) return;
  selectRecordDate(cell.dataset.date);
});

// ===== 写真 =====
const PHOTO_DB_NAME = "kintore-photos"; // 写真用のデータベースの名前
const PHOTO_STORE = "photos";           // 写真を入れる入れ物の名前
const PHOTO_MAX_SIZE = 1280;            // 長い辺を何ピクセルに縮めるか
const PHOTO_QUALITY = 0.8;              // JPEGの画質（0〜1）

// --- IndexedDB（写真の保存場所）の準備 ---
let photoDbPromise = null;

function openPhotoDb() {
  if (photoDbPromise === null) {
    photoDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB_NAME, 1);

      // 初めて開いたとき：写真を入れる入れ物を作る
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore(PHOTO_STORE, { keyPath: "id" });
        store.createIndex("date", "date"); // 日付で探せるようにする
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return photoDbPromise;
}

// IndexedDBの1回分の操作を、await で待てる形にする
function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 写真を1枚保存する
async function addPhoto(photo) {
  const db = await openPhotoDb();
  const store = db.transaction(PHOTO_STORE, "readwrite").objectStore(PHOTO_STORE);
  await requestToPromise(store.add(photo));
}

// その日の写真を、撮った順に取り出す
async function getPhotosByDate(date) {
  const db = await openPhotoDb();
  const store = db.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE);
  const photos = await requestToPromise(store.index("date").getAll(date));
  return photos.sort((a, b) => a.createdAt - b.createdAt);
}

// 写真を1枚削除する
async function deletePhoto(id) {
  const db = await openPhotoDb();
  const store = db.transaction(PHOTO_STORE, "readwrite").objectStore(PHOTO_STORE);
  await requestToPromise(store.delete(id));
}

// すべての写真を取り出す
async function getAllPhotos() {
  const db = await openPhotoDb();
  const store = db.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE);
  return requestToPromise(store.getAll());
}

// そのIDの写真がすでにあるか
async function hasPhoto(id) {
  const db = await openPhotoDb();
  const store = db.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE);
  const photo = await requestToPromise(store.get(id));
  return photo !== undefined;
}

// iPhoneに「このアプリのデータを消さないで」とお願いする
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // お願いできなかったときは何もしない
    }
  }
}

// --- 写真を縮小・圧縮する ---
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    img.src = url;
  });
}

// 画像や映像を、長い辺が PHOTO_MAX_SIZE のJPEGにする
// source：<img> か <video>、mirror：true なら左右反転して保存する
function drawToJpeg(source, sourceWidth, sourceHeight, mirror) {
  // 長い辺が PHOTO_MAX_SIZE になるように縮める（もともと小さければそのまま）
  const longSide = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, PHOTO_MAX_SIZE / longSide);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (mirror) {
    // キャンバスの向きを左右反転させてから描く
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像を変換できませんでした"))),
      "image/jpeg",
      PHOTO_QUALITY
    );
  });
}

// 写真アプリから選んだ写真を、小さくする
async function compressImage(file) {
  const img = await loadImage(file);
  return drawToJpeg(img, img.naturalWidth, img.naturalHeight, false);
}

// --- 写真を表示するためのURL ---
// 保存した写真（Blob）を <img> で表示するには、一時的なURLが必要
const photoUrlCache = new Map(); // 写真のID → URL

function photoUrl(photo) {
  if (!photoUrlCache.has(photo.id)) {
    photoUrlCache.set(photo.id, URL.createObjectURL(photo.blob));
  }
  return photoUrlCache.get(photo.id);
}

function forgetPhotoUrl(id) {
  if (photoUrlCache.has(id)) {
    URL.revokeObjectURL(photoUrlCache.get(id));
    photoUrlCache.delete(id);
  }
}

// 小さな写真の一覧のHTML
function photoThumbsHtml(photos) {
  return photos
    .map((p, i) => `
      <button type="button" class="photo-thumb" data-index="${i}">
        <img src="${photoUrl(p)}" alt="">
      </button>`)
    .join("");
}

// --- 記録タブの写真の欄 ---
const photoPick = document.querySelector("#photo-pick");
const photoInput = document.querySelector("#photo-input");
const photoList = document.querySelector("#photo-list");

let recordPhotos = []; // 記録タブに表示している写真

async function renderRecordPhotos() {
  const date = recordDate.value;

  let photos;
  try {
    photos = await getPhotosByDate(date);
  } catch (error) {
    console.error(error);
    photoList.innerHTML = `<p class="photo-empty">写真を読み込めませんでした</p>`;
    return;
  }

  // 読み込んでいる間に日付が変わっていたら、古い結果は使わない
  if (date !== recordDate.value) return;

  recordPhotos = photos;
  photoList.innerHTML = photos.length === 0
    ? `<p class="photo-empty">写真はまだありません</p>`
    : photoThumbsHtml(photos);
}

// 「写真から選ぶ」：隠してあるファイル選択を開く
photoPick.addEventListener("click", () => photoInput.click());

// 写真が選ばれたら、縮小して保存する
photoInput.addEventListener("change", async () => {
  const files = Array.from(photoInput.files);
  photoInput.value = ""; // 同じ写真をもう一度選べるようにする
  if (files.length === 0) return;

  const date = recordDate.value;
  photoPick.disabled = true;
  photoPick.textContent = "保存中…";

  try {
    for (const file of files) {
      const blob = await compressImage(file);
      await addPhoto({ id: createId(), date: date, blob: blob, createdAt: Date.now() });
    }
    requestPersistentStorage();
  } catch (error) {
    console.error(error);
    alert("写真を保存できませんでした：" + error.message);
  } finally {
    photoPick.disabled = false;
    photoPick.textContent = "写真から選ぶ";
  }

  refreshPhotoViews();
});

// 小さな写真をタップしたら、全画面で表示する
photoList.addEventListener("click", (event) => {
  const thumb = event.target.closest(".photo-thumb");
  if (thumb === null) return;
  openViewer(recordPhotos, Number(thumb.dataset.index));
});

// --- カレンダーの詳細の写真 ---
let calendarPhotos = []; // カレンダーの詳細に表示している写真

async function renderCalendarPhotos() {
  const date = selectedDate;
  if (date === null) return;

  let photos;
  try {
    photos = await getPhotosByDate(date);
  } catch (error) {
    console.error(error);
    return;
  }

  // 読み込んでいる間に、選んでいる日が変わっていたら使わない
  if (date !== selectedDate) return;

  const container = document.querySelector("#cal-photo-list");
  if (container === null) return;

  calendarPhotos = photos;
  container.innerHTML = photoThumbsHtml(photos);
}

calDetail.addEventListener("click", (event) => {
  const thumb = event.target.closest(".photo-thumb");
  if (thumb === null) return;
  openViewer(calendarPhotos, Number(thumb.dataset.index));
});

// 写真が増えたり減ったりしたときに、写真の表示をまとめて描き直す
function refreshPhotoViews() {
  renderRecordPhotos();
  renderCalendarPhotos();
  renderPhotoSummary();
  resetPhotoExport(); // 写真が変わったら、準備済みのZIPファイルは古くなるので作り直す
}

// --- 全画面表示 ---
const photoViewer = document.querySelector("#photo-viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerCount = document.querySelector("#viewer-count");
const viewerClose = document.querySelector("#viewer-close");
const viewerPrev = document.querySelector("#viewer-prev");
const viewerNext = document.querySelector("#viewer-next");
const viewerDelete = document.querySelector("#viewer-delete");

let viewerPhotos = []; // 全画面表示で切り替える写真の一覧
let viewerIndex = 0;   // 今表示している写真の番号

function openViewer(photos, index) {
  viewerPhotos = photos;
  viewerIndex = index;
  renderViewer();
  photoViewer.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeViewer() {
  photoViewer.classList.remove("open");
  document.body.style.overflow = "";
}

function renderViewer() {
  const photo = viewerPhotos[viewerIndex];
  viewerImage.src = photoUrl(photo);
  viewerCount.textContent = `${viewerIndex + 1} / ${viewerPhotos.length}`;
  viewerPrev.disabled = viewerIndex === 0;
  viewerNext.disabled = viewerIndex === viewerPhotos.length - 1;
}

viewerClose.addEventListener("click", closeViewer);

viewerPrev.addEventListener("click", () => {
  if (viewerIndex > 0) {
    viewerIndex--;
    renderViewer();
  }
});

viewerNext.addEventListener("click", () => {
  if (viewerIndex < viewerPhotos.length - 1) {
    viewerIndex++;
    renderViewer();
  }
});

viewerDelete.addEventListener("click", async () => {
  if (!confirm("この写真を削除しますか？")) return;

  const photo = viewerPhotos[viewerIndex];
  try {
    await deletePhoto(photo.id);
  } catch (error) {
    console.error(error);
    alert("写真を削除できませんでした：" + error.message);
    return;
  }

  forgetPhotoUrl(photo.id);
  viewerPhotos = viewerPhotos.filter((p) => p.id !== photo.id);

  if (viewerPhotos.length === 0) {
    closeViewer();
  } else {
    viewerIndex = Math.min(viewerIndex, viewerPhotos.length - 1);
    renderViewer();
  }

  refreshPhotoViews();
});

// ===== カメラ =====
const CAMERA_COUNTDOWN = 3; // カウントダウンの秒数

const photoCamera = document.querySelector("#photo-camera");
const camera = document.querySelector("#camera");
const cameraVideo = document.querySelector("#camera-video");
const cameraCountdown = document.querySelector("#camera-countdown");
const cameraFlash = document.querySelector("#camera-flash");
const cameraSaved = document.querySelector("#camera-saved");
const cameraClose = document.querySelector("#camera-close");
const cameraShutter = document.querySelector("#camera-shutter");
const cameraSwitch = document.querySelector("#camera-switch");

let cameraStream = null;    // カメラの映像の流れ
let cameraFacing = "user";  // "user"：前のカメラ、"environment"：後ろのカメラ
let cameraOpen = false;     // カメラの画面を開いているか
let cameraSavedCount = 0;   // 今回カメラを開いてから保存した枚数

// 指定した時間だけ待つ
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// アニメーションを、最初からもう一度再生する
function replayAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth; // ブラウザに一度画面を計算させる（これがないと再生し直されない）
  element.classList.add(className);
}

// --- カメラの映像を始める・止める ---
async function startCameraStream() {
  stopCameraStream();

  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: cameraFacing,
      width: { ideal: 1920 },
      height: { ideal: 1920 },
    },
    audio: false,
  });

  cameraVideo.srcObject = cameraStream;
  cameraVideo.classList.toggle("mirror", cameraFacing === "user");
  await cameraVideo.play();
}

function stopCameraStream() {
  if (cameraStream !== null) {
    for (const track of cameraStream.getTracks()) {
      track.stop(); // カメラを止める（iPhoneの画面の上の緑の点も消える）
    }
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
}

function cameraErrorMessage(error) {
  if (error.name === "NotAllowedError") {
    return "カメラの使用が許可されていません。もう一度開いて「許可」を選んでください。";
  }
  if (error.name === "NotFoundError") {
    return "使えるカメラが見つかりませんでした。";
  }
  return "カメラを起動できませんでした：" + error.message;
}

// --- カメラの画面を開く・閉じる ---
async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("この端末ではカメラを使えません。");
    return;
  }

  cameraFacing = "user"; // いつも前のカメラから
  cameraSavedCount = 0;
  cameraSaved.textContent = "";
  cameraOpen = true;
  camera.classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    await startCameraStream();
  } catch (error) {
    console.error(error);
    closeCamera();
    alert(cameraErrorMessage(error));
  }
}

function closeCamera() {
  cameraOpen = false;
  stopCameraStream();
  camera.classList.remove("open");
  document.body.style.overflow = "";
  cameraCountdown.hidden = true;
  cameraShutter.disabled = false;
  cameraSwitch.disabled = false;

  if (cameraSavedCount > 0) refreshPhotoViews(); // 撮った写真を一覧に表示する
}

// --- カウントダウン（途中で閉じられたら false を返す） ---
async function runCountdown() {
  cameraCountdown.hidden = false;

  for (let n = CAMERA_COUNTDOWN; n >= 1; n--) {
    if (!cameraOpen) return false;
    cameraCountdown.textContent = n;
    replayAnimation(cameraCountdown, "tick");
    await sleep(1000);
  }

  cameraCountdown.hidden = true;
  return cameraOpen;
}

// --- 今の映像を1枚の写真にする ---
async function captureFrame() {
  const width = cameraVideo.videoWidth;
  const height = cameraVideo.videoHeight;
  if (width === 0 || height === 0) {
    throw new Error("カメラの映像がまだ準備できていません");
  }
  return drawToJpeg(cameraVideo, width, height, cameraFacing === "user");
}

// --- ボタン ---
photoCamera.addEventListener("click", openCamera);
cameraClose.addEventListener("click", closeCamera);

cameraShutter.addEventListener("click", async () => {
  cameraShutter.disabled = true;
  cameraSwitch.disabled = true;
  const date = recordDate.value;

  const finished = await runCountdown();

  if (finished) {
    try {
      const blob = await captureFrame();
      await addPhoto({ id: createId(), date: date, blob: blob, createdAt: Date.now() });
      requestPersistentStorage();

      cameraSavedCount++;
      cameraSaved.textContent = `${cameraSavedCount}枚 保存しました`;
      replayAnimation(cameraFlash, "on");
    } catch (error) {
      console.error(error);
      alert("写真を保存できませんでした：" + error.message);
    }
  }

  cameraShutter.disabled = false;
  cameraSwitch.disabled = false;
});

cameraSwitch.addEventListener("click", async () => {
  cameraFacing = cameraFacing === "user" ? "environment" : "user";
  try {
    await startCameraStream();
  } catch (error) {
    console.error(error);
    alert(cameraErrorMessage(error));
  }
});

// 別のアプリに切り替えたら、カメラを閉じる（電池の節約と、カメラの消し忘れ防止）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && cameraOpen) closeCamera();
});

// ===== 写真のバックアップ =====
const photoExportButton = document.querySelector("#photo-export-button");
const photoImportButton = document.querySelector("#photo-import-button");
const photoImportInput = document.querySelector("#photo-import-input");
const photoSummary = document.querySelector("#photo-summary");

let preparedPhotoZip = null; // 準備ができたZIPファイル（まだなければ null）

// 写真のファイル名に、日付・撮った時刻・IDを入れておく
// 例：kintore_2026-10-15_1760500000000_lx3k9abc.jpg
function photoFileName(photo) {
  return `kintore_${photo.date}_${photo.createdAt}_${photo.id}.jpg`;
}

// ファイル名から、日付・撮った時刻・IDを取り出す（このアプリの写真でなければ null）
function parsePhotoFileName(name) {
  const match = name.match(/^kintore_(\d{4}-\d{2}-\d{2})_(\d+)_([0-9a-z]+)\.jpe?g$/i);
  if (match === null) return null;
  return { date: match[1], createdAt: Number(match[2]), id: match[3] };
}

// バイト数をMBにする（例：7340032 → "7.0"）
function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

// 設定タブの「写真 36枚（約7.2MB）」
async function renderPhotoSummary() {
  try {
    const photos = await getAllPhotos();
    const bytes = photos.reduce((sum, p) => sum + p.blob.size, 0);
    photoSummary.textContent = `写真 ${photos.length}枚（約${formatMB(bytes)}MB）`;
  } catch (error) {
    console.error(error);
    photoSummary.textContent = "";
  }
}

// --- 書き出し ---
function resetPhotoExport() {
  preparedPhotoZip = null;
  photoExportButton.textContent = "写真を書き出す";
}

// すべての写真を、ZIPファイル1つにまとめる
async function preparePhotoZip() {
  const photos = await getAllPhotos();
  if (photos.length === 0) {
    alert("書き出す写真がありません。");
    return null;
  }

  const zip = new JSZip();
  for (const photo of photos) {
    zip.file(photoFileName(photo), photo.blob);
  }

  // JPEGはもう圧縮されているので、ZIPではそれ以上圧縮しない（STORE）
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const fileName = `kintore-photos-${toDateString(new Date())}.zip`;
  return new File([blob], fileName, { type: "application/zip" });
}

// ZIPファイルを保存する（iPhoneは共有の画面、PCはダウンロード）
// 保存できたら true、共有の画面でキャンセルしたら false
async function savePhotoZip(file) {
  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);

  if (isIPhone && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
      console.error("共有に失敗したので、ダウンロードに切り替えます", error);
    }
  }

  downloadFile(file);
  return true;
}

photoExportButton.addEventListener("click", async () => {
  // 2回目：準備ができたファイルを保存する
  if (preparedPhotoZip !== null) {
    const saved = await savePhotoZip(preparedPhotoZip);
    if (saved) resetPhotoExport(); // キャンセルしたときは、準備したファイルを残しておく
    return;
  }

  // 1回目：ZIPファイルを準備する
  photoExportButton.disabled = true;
  photoExportButton.textContent = "準備中…";

  try {
    const file = await preparePhotoZip();
    if (file === null) {
      resetPhotoExport();
      return;
    }
    preparedPhotoZip = file;
    photoExportButton.textContent = `準備ができました。押して保存（約${formatMB(file.size)}MB）`;
  } catch (error) {
    console.error(error);
    alert("写真を書き出せませんでした：" + error.message);
    resetPhotoExport();
  } finally {
    photoExportButton.disabled = false;
  }
});

// --- 読み込み ---
photoImportButton.addEventListener("click", () => photoImportInput.click());

photoImportInput.addEventListener("change", async () => {
  const file = photoImportInput.files[0];
  photoImportInput.value = ""; // 同じファイルをもう一度選べるようにする
  if (file === undefined) return;

  photoImportButton.disabled = true;
  photoImportButton.textContent = "読み込み中…";

  let added = 0;   // 追加した枚数
  let skipped = 0; // すでにあったので飛ばした枚数
  let invalid = 0; // このアプリの写真ではなかったファイルの数

  try {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    for (const entry of entries) {
      const name = entry.name.split("/").pop(); // フォルダの名前を除いた、ファイル名だけ
      const info = parsePhotoFileName(name);
      if (info === null) {
        invalid++;
        continue;
      }
      if (await hasPhoto(info.id)) {
        skipped++;
        continue;
      }

      const data = await entry.async("blob");
      const blob = new Blob([data], { type: "image/jpeg" });
      await addPhoto({ id: info.id, date: info.date, blob: blob, createdAt: info.createdAt });
      added++;
    }

    requestPersistentStorage();

    let message = `${added}枚の写真を読み込みました。`;
    if (skipped > 0) message += `\n${skipped}枚は、すでにあるので飛ばしました。`;
    if (invalid > 0) message += `\n${invalid}個のファイルは、このアプリの写真ではないので飛ばしました。`;
    alert(message);
  } catch (error) {
    console.error(error);
    alert("写真を読み込めませんでした。このアプリで書き出したZIPファイルを選んでください。");
  } finally {
    photoImportButton.disabled = false;
    photoImportButton.textContent = "写真を読み込む";
    refreshPhotoViews();
  }
});

// ===== スワイプ =====
const SWIPE_DISTANCE = 50; // これ以上横に動かしたら「スワイプした」とみなす（px）
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// area：スワイプを受け付ける場所
// target：指についてきて動く部分
// onSwipe(direction)：スワイプしたときの処理（direction は -1：前、1：次）
function addSwipe(area, target, onSwipe) {
  let pointerId = null;        // 今動かしている指（またはマウス）
  let startX = 0;
  let startY = 0;
  let moveX = 0;               // 横に動いた距離
  let dragging = false;        // 横のスワイプとして動かしているか
  let animating = false;       // 切り替えのアニメーション中か
  let suppressClick = false;   // スワイプの後のクリックを取り消すか

  // 中身を、指定した位置まで動かす（アニメーションの長さを ms で指定。0なら一瞬で）
  function moveTarget(x, opacity, ms) {
    target.style.transition = ms > 0 ? `transform ${ms}ms ease-out, opacity ${ms}ms` : "none";
    target.style.transform = `translateX(${x}px)`;
    target.style.opacity = opacity;
  }

  // 元の位置に戻す
  function snapBack() {
    moveTarget(0, 1, 200);
  }

  // 滑るように次（前）に切り替える
  async function slide(direction) {
    if (reduceMotion.matches) {
      // 「視差効果を減らす」がオンのときは、動かさずにすぐ切り替える
      moveTarget(0, 1, 0);
      onSwipe(direction);
      return;
    }

    animating = true;
    const width = target.offsetWidth;

    // ① 今の中身を、指を動かした方向へ滑らせて消す
    moveTarget(direction > 0 ? -width : width, 0, 150);
    await sleep(150);

    // ② 中身を新しい日（月）に描き直す
    onSwipe(direction);

    // ③ 新しい中身を反対側に置いてから、真ん中まで滑らせる
    moveTarget(direction > 0 ? width : -width, 0, 0);
    void target.offsetWidth; // 位置を確定させてから、次のアニメーションを始める
    moveTarget(0, 1, 200);
    await sleep(200);

    animating = false;
  }

  area.addEventListener("pointerdown", (event) => {
    if (animating) return;
    if (event.pointerType === "mouse" && event.button !== 0) return; // 左クリック以外は無視

    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    moveX = 0;
    dragging = false;
    suppressClick = false;
  });

  area.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging) {
      if (Math.abs(dx) < 10) return; // まだ少ししか動いていない
      if (Math.abs(dy) > Math.abs(dx)) {
        pointerId = null; // 縦の動きなので、スワイプではない（スクロールに任せる）
        return;
      }
      dragging = true;
      area.setPointerCapture(event.pointerId); // 指が枠の外に出ても、動きを受け取り続ける
    }

    moveX = dx;
    moveTarget(moveX, 1, 0); // 指についてくる
  });

  area.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (!dragging) return; // 動かしていなければ、普通のタップ

    dragging = false;
    suppressClick = true; // この後に起きるクリックは取り消す

    if (Math.abs(moveX) >= SWIPE_DISTANCE) {
      slide(moveX < 0 ? 1 : -1); // 左へ動かしたら次、右へ動かしたら前
    } else {
      snapBack();
    }
  });

  area.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (dragging) {
      dragging = false;
      snapBack();
    }
  });

  // スワイプした直後のクリック（日付の欄を押した、日付を選んだ、など）を取り消す
  area.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    },
    true
  );
}

// 記録タブの日付の欄：前の日・次の日
addSwipe(
  document.querySelector(".date-bar"),
  document.querySelector("#date-inner"),
  (direction) => changeDate(direction)
);

// カレンダータブ：前の月・次の月
addSwipe(calGrid, calGrid, (direction) => changeMonth(direction));

// 日付を選ぶポップアップ：前の月・次の月
addSwipe(pickerGrid, pickerGrid, (direction) => changePickerMonth(direction));

// ===== 起動画面 =====
const splash = document.querySelector("#splash");

function removeSplash() {
  if (splash.isConnected) splash.remove();
}

// 背景が消えるアニメーションが終わったら、起動画面を取り除く
splash.addEventListener("animationend", (event) => {
  if (event.target === splash) removeSplash();
});

// 念のため、アニメーションの終わりが伝わらなかったときも1.5秒後には取り除く
setTimeout(removeSplash, 1500);

// ===== 拡大・縮小を止める =====
// iPhoneで2本指を使った拡大・縮小が始まったら、それを取り消す（Safari専用の出来事）
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("gesturechange", (event) => event.preventDefault());
// iPhoneで、押している間のCSS（:active）が効くようにする
document.addEventListener("touchstart", () => {}, { passive: true });

// ===== 起動時の処理 =====
recordDate.value = toDateString(new Date());
renderPartOptions();
renderCalendarLegend();
refreshAll();