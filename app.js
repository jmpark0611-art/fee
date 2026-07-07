const STORAGE_KEY = "meter-billing-sms-sheets";

const fields = [
  ["phone", "전화번호"],
  ["affiliation", "소속"],
  ["name", "성명"],
  ["residence", "거주지명"],
  ["unit", "호수"],
  ["prevReading", "전월검침"],
  ["currentReading", "당월검침"],
  ["currentUsage", "당월사용량"],
  ["govSupportUsage", "국고지원량"],
  ["excessUsage", "초과사용량"],
  ["billedAmount", "청구금액"],
  ["govSupportAmount", "국고지원금"],
  ["excessAmount", "초과금액"],
  ["peopleCount", "사용인원"],
  ["personShareAmount", "인원별부담금액"],
];

const headerAliases = {
  phone: ["전화번호", "휴대폰", "휴대전화", "핸드폰", "연락처", "전화", "번호", "mobile", "phone"],
  affiliation: ["소속", "동", "부서", "단체", "그룹"],
  name: ["성명", "이름", "수신자", "입주자", "사용자", "name"],
  residence: ["거주지명", "거주지", "주소", "마을명", "건물명"],
  unit: ["호수", "호", "세대", "세대호수", "unit"],
  prevReading: ["전월검침", "전월 검침", "전월지침", "전월 지침"],
  currentReading: ["당월검침", "당월 검침", "당월지침", "당월 지침"],
  currentUsage: ["당월사용량", "당월 사용량", "사용량"],
  govSupportUsage: ["국고지원량", "국고 지원량", "지원량"],
  excessUsage: ["초과사용량", "초과 사용량"],
  billedAmount: ["청구금액", "청구 금액", "금액", "청구액"],
  govSupportAmount: ["국고지원금", "국고 지원금", "지원금"],
  excessAmount: ["초과금액", "초과 금액", "초과액"],
  peopleCount: ["사용인원", "사용 인원", "인원", "인원수"],
  personShareAmount: ["인원별부담금액", "인원별 부담금액", "인원부담금액", "개인부담금", "부담금액"],
};

const state = {
  rows: [],
  sheets: loadSheets(),
  queueCreatedAt: 0,
  queueTimer: null,
};

const els = {
  appView: document.querySelector("#appView"),
  detailView: document.querySelector("#detailView"),
  detailTitle: document.querySelector("#detailTitle"),
  detailCard: document.querySelector("#detailCard"),
  sheetName: document.querySelector("#sheetNameInput"),
  savedSheets: document.querySelector("#savedSheets"),
  messageTemplate: document.querySelector("#messageTemplate"),
  recipientRows: document.querySelector("#recipientRows"),
  addRowBtn: document.querySelector("#addRowBtn"),
  addSampleBtn: document.querySelector("#addSampleBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  saveSheetBtn: document.querySelector("#saveSheetBtn"),
  newSheetBtn: document.querySelector("#newSheetBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  csvInput: document.querySelector("#csvInput"),
  dropZone: document.querySelector("#dropZone"),
  filePickerBtn: document.querySelector("#filePickerBtn"),
  importStatus: document.querySelector("#importStatus"),
  sendAllBtn: document.querySelector("#sendAllBtn"),
  intervalInputs: [...document.querySelectorAll('input[name="intervals"]')],
  queueDialog: document.querySelector("#queueDialog"),
  queueList: document.querySelector("#queueList"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
};

init();

function init() {
  if (renderDetailFromHash()) return;

  state.rows = [createRow()];
  renderRows();
  renderSavedSheets();
  bindEvents();
}

function createRow(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    selected: true,
    phone: "",
    affiliation: "",
    name: "",
    residence: "",
    unit: "",
    prevReading: "",
    currentReading: "",
    currentUsage: "",
    govSupportUsage: "",
    excessUsage: "",
    billedAmount: "",
    govSupportAmount: "",
    excessAmount: "",
    peopleCount: "",
    personShareAmount: "",
    ...overrides,
  };
}

function bindEvents() {
  els.recipientRows.addEventListener("input", (event) => {
    const tr = event.target.closest("tr");
    const row = state.rows.find((item) => item.id === tr?.dataset.id);
    const field = event.target.dataset.field;
    if (!row || !field) return;

    row[field] = field === "selected" ? event.target.checked : event.target.value;
    refreshRow(row.id);
  });

  els.recipientRows.addEventListener("click", (event) => {
    if (event.target.dataset.action !== "delete") return;
    const id = event.target.closest("tr").dataset.id;
    state.rows = state.rows.filter((row) => row.id !== id);
    renderRows();
  });

  els.savedSheets.addEventListener("click", (event) => {
    const id = event.target.dataset.load;
    if (id) loadSheet(id);
    const deleteId = event.target.dataset.delete;
    if (deleteId) deleteSavedSheet(deleteId);
  });

  els.queueList.addEventListener("click", async (event) => {
    const index = event.target.dataset.copy;
    if (index === undefined) return;
    const item = buildQueue()[Number(index)];
    await navigator.clipboard.writeText(item.message);
    event.target.textContent = "복사됨";
  });

  els.messageTemplate.addEventListener("input", renderRows);
  els.addRowBtn.addEventListener("click", () => {
    state.rows.push(createRow());
    renderRows();
  });
  els.addSampleBtn.addEventListener("click", addSampleRows);
  els.clearBtn.addEventListener("click", () => {
    state.rows = [];
    renderRows();
  });
  els.saveSheetBtn.addEventListener("click", saveCurrentSheet);
  els.newSheetBtn.addEventListener("click", resetSheet);
  els.exportBtn.addEventListener("click", downloadCsv);
  els.filePickerBtn.addEventListener("click", () => {
    els.csvInput.click();
  });
  els.dropZone.addEventListener("click", () => {
    els.csvInput.click();
  });
  els.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.csvInput.click();
    }
  });
  els.csvInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      setImportStatus("선택된 파일이 없습니다.", true);
      return;
    }
    await importSheetFile(file);
    event.target.value = "";
  });
  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-active");
  });
  els.dropZone.addEventListener("dragleave", () => {
    els.dropZone.classList.remove("is-active");
  });
  els.dropZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-active");
    const [file] = event.dataTransfer.files;
    if (file) await importSheetFile(file);
  });
  window.addEventListener("paste", async (event) => {
    const [file] = [...event.clipboardData.files].filter(isSheetFile);
    if (file) await importSheetFile(file);
  });
  els.sendAllBtn.addEventListener("click", () => {
    state.queueCreatedAt = Date.now();
    renderQueue();
  });
  els.closeDialogBtn.addEventListener("click", () => {
    window.clearInterval(state.queueTimer);
    els.queueDialog.close();
  });
}

function loadSheets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function persistSheets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sheets));
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim().replace(/^="?(.+?)"?$/, "$1");
  const digits = raw.replace(/[^\d]/g, "");
  if (/^10\d{7,8}$/.test(digits)) return `0${digits}`;
  if (/^1[016789]\d{7,8}$/.test(digits)) return `0${digits}`;
  return digits;
}

function normalizeImportedValue(key, value) {
  const text = String(value || "").trim();
  if (key === "phone") return normalizePhone(text);
  return text;
}

function formatMoney(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(number) || value === "") return value || "";
  return number.toLocaleString("ko-KR");
}

function detailUrl(row) {
  const detail = {};
  fields.forEach(([key, label]) => {
    detail[label] = row[key] || "";
  });
  const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(detail)))));
  return `${location.origin}${location.pathname}#detail=${encoded}`;
}

function renderMessage(row) {
  const values = {
    "{전화번호}": row.phone,
    "{소속}": row.affiliation,
    "{성명}": row.name,
    "{거주지명}": row.residence,
    "{호수}": row.unit,
    "{전월검침}": row.prevReading,
    "{당월검침}": row.currentReading,
    "{당월사용량}": row.currentUsage,
    "{국고지원량}": row.govSupportUsage,
    "{초과사용량}": row.excessUsage,
    "{청구금액}": formatMoney(row.billedAmount),
    "{국고지원금}": formatMoney(row.govSupportAmount),
    "{초과금액}": formatMoney(row.excessAmount),
    "{사용인원}": row.peopleCount,
    "{인원별부담금액}": formatMoney(row.personShareAmount),
    "{상세링크}": detailUrl(row),
  };

  return Object.entries(values).reduce(
    (message, [token, value]) => message.replaceAll(token, value || ""),
    els.messageTemplate.value,
  );
}

function renderRows() {
  els.recipientRows.innerHTML = "";
  state.rows.forEach((row) => els.recipientRows.appendChild(createRowElement(row)));
}

function createRowElement(row) {
  const tr = document.createElement("tr");
  tr.dataset.id = row.id;

  const cells = [
    `<td><input data-field="selected" type="checkbox" ${row.selected ? "checked" : ""}></td>`,
    ...fields.map(([key]) => inputCell(row, key)),
    `<td class="link-cell"><a href="${detailUrl(row)}" target="_blank" rel="noreferrer">상세보기</a></td>`,
    `<td class="preview">${escapeHtml(renderMessage(row))}</td>`,
    `<td><button data-action="delete" class="danger" type="button">삭제</button></td>`,
  ];

  tr.innerHTML = cells.join("");
  return tr;
}

function inputCell(row, key) {
  const className =
    key === "personShareAmount" ? "money-red" : key === "excessAmount" ? "money-blue" : "";
  const readonly = key === "phone" ? "readonly" : "";
  const title = key === "phone" ? "엑셀/CSV 파일에서 추출된 전화번호입니다." : "";
  return `<td><input class="${className}" data-field="${key}" type="text" value="${escapeAttr(row[key])}" ${readonly} title="${title}"></td>`;
}

function refreshRow(rowId) {
  const row = state.rows.find((item) => item.id === rowId);
  const tr = els.recipientRows.querySelector(`tr[data-id="${rowId}"]`);
  if (!row || !tr) return;

  const preview = tr.querySelector(".preview");
  const link = tr.querySelector(".link-cell a");
  if (preview) preview.textContent = renderMessage(row);
  if (link) link.href = detailUrl(row);
}

function renderSavedSheets() {
  els.savedSheets.innerHTML = "";

  if (state.sheets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "저장된 시트가 없습니다.";
    els.savedSheets.appendChild(empty);
    return;
  }

  state.sheets.forEach((sheet) => {
    const item = document.createElement("div");
    item.className = "saved-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(sheet.name)}</strong>
        <small>${sheet.rows.length}명</small>
      </div>
      <div class="saved-actions">
        <button data-load="${sheet.id}" type="button">불러오기</button>
        <button data-delete="${sheet.id}" class="danger" type="button">삭제</button>
      </div>
    `;
    els.savedSheets.appendChild(item);
  });
}

function saveCurrentSheet() {
  const name = els.sheetName.value.trim() || "이름 없는 시트";
  const sheet = {
    id: crypto.randomUUID(),
    name,
    template: els.messageTemplate.value,
    rows: state.rows,
    savedAt: new Date().toISOString(),
  };

  state.sheets = [sheet, ...state.sheets.filter((item) => item.name !== name)].slice(0, 20);
  persistSheets();
  renderSavedSheets();
}

function loadSheet(id) {
  const sheet = state.sheets.find((item) => item.id === id);
  if (!sheet) return;

  els.sheetName.value = sheet.name;
  els.sheetName.classList.remove("is-imported");
  els.messageTemplate.value = sheet.template;
  state.rows = sheet.rows.map((row) => createRow(row));
  renderRows();
}

function deleteSavedSheet(id) {
  state.sheets = state.sheets.filter((sheet) => sheet.id !== id);
  persistSheets();
  renderSavedSheets();
}

function resetSheet() {
  els.sheetName.value = "7월 검침 청구";
  els.sheetName.classList.remove("is-imported");
  els.messageTemplate.value = `안녕하세요 {성명}님.
{거주지명} {호수}호 검침 청구 내역입니다.
청구금액: {청구금액}원
인원별 부담금액: {인원별부담금액}원
상세내역: {상세링크}`;
  state.rows = [createRow()];
  renderRows();
}

function addSampleRows() {
  state.rows = [
    createRow({
      phone: "01012345678",
      affiliation: "A동",
      name: "김민준",
      residence: "한빛마을",
      unit: "101",
      prevReading: "1240",
      currentReading: "1325",
      currentUsage: "85",
      govSupportUsage: "60",
      excessUsage: "25",
      billedAmount: "48000",
      govSupportAmount: "18000",
      excessAmount: "12000",
      peopleCount: "3",
      personShareAmount: "16000",
    }),
    createRow({
      phone: "01023456789",
      affiliation: "B동",
      name: "이서연",
      residence: "한빛마을",
      unit: "203",
      prevReading: "880",
      currentReading: "948",
      currentUsage: "68",
      govSupportUsage: "60",
      excessUsage: "8",
      billedAmount: "39000",
      govSupportAmount: "18000",
      excessAmount: "4500",
      peopleCount: "2",
      personShareAmount: "19500",
    }),
  ];
  renderRows();
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((line) => line.some((cell) => cell.trim()));
}

function importCsv(text, fileName = "CSV 시트") {
  importRows(parseCsv(text), sheetNameFromFile(fileName));
}

async function importSheetFile(file) {
  if (!isSheetFile(file)) {
    setImportStatus("CSV, XLS, XLSX 파일만 첨부할 수 있습니다.", true);
    return;
  }

  setImportStatus(`${file.name} 읽는 중...`);
  const extension = file.name.split(".").pop().toLowerCase();

  if (extension === "xlsx" || extension === "xls") {
    if (!window.XLSX) {
      setImportStatus("Excel 파일 읽기 라이브러리를 불러오지 못했습니다. CSV로 저장한 뒤 다시 가져와 주세요.", true);
      return;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const [firstSheetName] = workbook.SheetNames;
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      importRows(rows, firstSheetName || sheetNameFromFile(file.name));
    } catch (error) {
      setImportStatus(`Excel 파일을 읽지 못했습니다: ${error.message}`, true);
    }
    return;
  }

  try {
    importCsv(await file.text(), file.name);
  } catch (error) {
    setImportStatus(`CSV 파일을 읽지 못했습니다: ${error.message}`, true);
  }
}

function importRows(rows, sheetName = "가져온 시트") {
  const [headers = [], ...records] = rows;
  const normalizedHeaders = headers.map((header) => String(header).trim());
  const columnMap = buildColumnMap(normalizedHeaders);
  applyImportedSheetName(sheetName);

  state.rows = records
    .filter((record) => record.some((cell) => String(cell).trim()))
    .map((record) => {
      const row = createRow();
      Object.entries(columnMap).forEach(([key, index]) => {
        row[key] = normalizeImportedValue(key, record[index]);
      });
      return row;
    });

  renderRows();
  const phoneCount = state.rows.filter((row) => normalizePhone(row.phone)).length;
  setImportStatus(`${sheetName} 시트에서 ${state.rows.length}행을 불러왔고, 전화번호 ${phoneCount}개를 추출했습니다.`);
}

function sheetNameFromFile(fileName) {
  return String(fileName || "가져온 시트").replace(/\.[^.]+$/, "");
}

function applyImportedSheetName(sheetName) {
  els.sheetName.value = sheetName || "가져온 시트";
  els.sheetName.classList.add("is-imported");
}

function buildColumnMap(headers) {
  const normalized = headers.map(normalizeHeader);
  const map = {};

  fields.forEach(([key, label]) => {
    const aliases = [label, ...(headerAliases[key] || [])].map(normalizeHeader);
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) map[key] = index;
  });

  return map;
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_(){}\[\]-]/g, "");
}

function isSheetFile(file) {
  return /\.(csv|xlsx|xls)$/i.test(file.name);
}

function setImportStatus(message, isError = false) {
  els.importStatus.textContent = message;
  els.importStatus.classList.toggle("is-error", isError);
}

function toCsv() {
  const header = fields.map(([, label]) => label);
  const lines = state.rows.map((row) => fields.map(([key]) => csvCell(row[key])).join(","));
  return [header.join(","), ...lines].join("\r\n");
}

function csvCell(value) {
  const text = String(value || "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv() {
  const blob = new Blob(["\ufeff", toCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${els.sheetName.value.trim() || "검침청구시트"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildQueue() {
  return state.rows
    .filter((row) => row.selected && normalizePhone(row.phone))
    .map((row) => ({
      recipients: [normalizePhone(row.phone)],
      label: row.name || row.phone,
      message: renderMessage(row),
    }));
}

function smsHref(item) {
  const recipients = item.recipients.map(encodeURIComponent).join(",");
  const joiner = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
  return `sms:${recipients}${joiner}body=${encodeURIComponent(item.message)}`;
}

function renderQueue() {
  const queue = buildQueue();
  const intervals = selectedIntervals();
  const now = Date.now();
  if (!state.queueCreatedAt) state.queueCreatedAt = now;

  els.queueList.innerHTML = "";

  if (queue.length === 0) {
    els.queueList.innerHTML = `<p class="hint">선택된 수신자 또는 전화번호가 없습니다.</p>`;
    if (!els.queueDialog.open) els.queueDialog.showModal();
    return;
  }

  queue.forEach((item, index) => {
    const unlockAt = state.queueCreatedAt + elapsedBefore(index, intervals);
    const remainingMs = unlockAt - now;
    const isReady = remainingMs <= 0;
    const remainingText = isReady ? "발송 가능" : `${Math.ceil(remainingMs / 1000)}초 후 가능`;
    const intervalText = index === 0 ? "즉시" : `${intervals[(index - 1) % intervals.length] / 1000}초 간격`;
    const card = document.createElement("div");
    card.className = "queue-item";
    card.innerHTML = `
      <strong>${index + 1}. ${escapeHtml(item.label)}</strong>
      <div class="queue-meta">${escapeHtml(item.recipients.join(", "))}</div>
      <div class="queue-status">${remainingText} · ${intervalText}</div>
      <div class="preview">${escapeHtml(item.message)}</div>
      <div class="queue-actions">
        <a class="${isReady ? "" : "disabled"}" href="${isReady ? smsHref(item) : "#"}"><button type="button" class="primary" ${isReady ? "" : "disabled"}>문자 앱 열기</button></a>
        <button data-copy="${index}" type="button">문구 복사</button>
      </div>
    `;
    els.queueList.appendChild(card);
  });

  if (!els.queueDialog.open) els.queueDialog.showModal();
  window.clearInterval(state.queueTimer);
  state.queueTimer = window.setInterval(() => {
    if (!els.queueDialog.open) {
      window.clearInterval(state.queueTimer);
      return;
    }
    renderQueue();
  }, 1000);
}

function selectedIntervals() {
  const values = els.intervalInputs
    .filter((input) => input.checked)
    .map((input) => Number(input.value) * 1000)
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? values : [60_000, 70_000, 90_000, 120_000];
}

function elapsedBefore(index, intervals) {
  let elapsed = 0;
  for (let i = 0; i < index; i += 1) {
    elapsed += intervals[i % intervals.length];
  }
  return elapsed;
}

function renderDetailFromHash() {
  const match = location.hash.match(/^#detail=(.+)$/);
  if (!match) return false;

  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(match[1]))));
    const detail = JSON.parse(json);
    els.appView.hidden = true;
    els.detailView.hidden = false;
    els.detailTitle.textContent = `${detail["성명"] || ""}님 청구 내역`;
    els.detailCard.innerHTML = fields
      .filter(([, label]) => label !== "전화번호")
      .map(([, label]) => detailItem(label, detail[label]))
      .join("");
    return true;
  } catch {
    return false;
  }
}

function detailItem(label, value) {
  const className =
    label === "인원별부담금액" ? "amount-red" : label === "초과금액" ? "amount-blue" : "";
  const displayValue = label.includes("금액") || label === "국고지원금" ? `${formatMoney(value)}원` : value || "-";
  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <strong class="${className}">${escapeHtml(displayValue)}</strong>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}
