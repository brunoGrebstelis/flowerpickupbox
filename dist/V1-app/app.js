const DEFAULT_API_BASE_URL = "https://xaufumsuck.execute-api.eu-central-1.amazonaws.com";

const STORAGE_KEYS = {
  apiBaseUrl: "apiBaseUrl",
  selectedUserId: "selectedUserId",
  selectedMachineId: "selectedMachineId",
};

const COMMAND_IDS = {
  OPEN_LOCKER: 1,
  SET_LOCKER_PRICE: 2,
  SET_LOCKER_COLOR: 3,
  SET_LIGHTING_MODE: 4,
  CHECK_LOCKER_CLOSED: 5,
  SET_TEMPERATURE: 6,
  SET_FANS: 7,
  SET_OPERATION_MODE: 8,
  REFRESH_STATUS: 9,
  CLEAR_ERROR: 10,
  REBOOT_RPI: 11,
  REBOOT_STM32: 12,
  SET_HEAD_LIGHTS: 13,
};

const LIGHTING_MODES = [
  { value: 1, label: "Mode 1 — V-day" },
  { value: 2, label: "Mode 2 — Disco" },
  { value: 3, label: "Mode 3 — Psychedelic" },
  { value: 4, label: "Mode 4 — Welcome" },
  { value: 5, label: "Mode 5 — Solid Disco" },
];

const FAN_BUTTONS = [
  { key: "fan1", label: "Fan1", bit: 1 },
  { key: "fan2", label: "Fan2", bit: 4 },
  { key: "fan3", label: "Fan3", bit: 8 },
  { key: "fan4", label: "Fan4", bit: 16 },
  { key: "fan5", label: "Fan5", bit: 32 },
];

const HEADLIGHT_MODES = [
  { value: 1, label: "On" },
  { value: 0, label: "Off" },
  { value: 2, label: "Auto" },
];

function resolveInitialApiBaseUrl() {
  const fromQuery = new URLSearchParams(window.location.search).get("api");
  if (fromQuery && fromQuery.trim()) {
    return fromQuery.trim().replace(/\/$/, "");
  }

  const fromStorage = (localStorage.getItem(STORAGE_KEYS.apiBaseUrl) || "").trim();
  if (fromStorage) {
    return fromStorage.replace(/\/$/, "");
  }

  return DEFAULT_API_BASE_URL;
}

const state = {
  apiBaseUrl: resolveInitialApiBaseUrl(),
  users: [],
  machines: [],
  membershipsByCompany: new Map(),
  allowedMachines: [],
  selectedUserId: null,
  selectedMachineId: null,
  selectedCompanyId: null,
  selectedRole: null,
  lockers: [],
  selectedLockerId: null,
  machineStatus: null,
  activeCommandCount: 0,
  requestTimeoutMs: 15000,
  autoRefreshTimerId: null,
  autoRefreshIntervalMs: 25000,
  lightingModeValue: 0,
  fanModeValue: 255,
  headLightsValue: 0,
  opModeValue: false,
  dbRefreshDebounceTimerId: null,
  dbRefreshDebounceMs: 370,
  pendingControlKeys: new Set(),
  fanStates: {
    fan1: false,
    fan2: false,
    fan3: false,
    fan4: false,
    fan5: false,
    auto: true,
  },
};

const el = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  userSelect: document.getElementById("userSelect"),
  machineSelect: document.getElementById("machineSelect"),
  loadBtn: document.getElementById("loadBtn"),
  clearBtn: document.getElementById("clearBtn"),
  statusBar: document.getElementById("statusBar"),
  userInfo: document.getElementById("userInfo"),
  machineInfo: document.getElementById("machineInfo"),
  machineStatus: document.getElementById("machineStatus"),
  lockerGrid: document.getElementById("lockerGrid"),
  selectedLockerText: document.getElementById("selectedLockerText"),
  lockerPrice: document.getElementById("lockerPrice"),
  colorR: document.getElementById("colorR"),
  colorG: document.getElementById("colorG"),
  colorB: document.getElementById("colorB"),
  lightingModeButtons: document.getElementById("lightingModeButtons"),
  openLockerBtn: document.getElementById("openLockerBtn"),
  setPriceBtn: document.getElementById("setPriceBtn"),
  setColorBtn: document.getElementById("setColorBtn"),
  setTemp: document.getElementById("setTemp"),
  setTempBtn: document.getElementById("setTempBtn"),
  fanButtons: document.getElementById("fanButtons"),
  headlightButtons: document.getElementById("headlightButtons"),
  toggleOpModeBtn: document.getElementById("toggleOpModeBtn"),
  rebootRpiBtn: document.getElementById("rebootRpiBtn"),
  rebootStmBtn: document.getElementById("rebootStmBtn"),
  adminStats: document.getElementById("adminStats"),
  activityLogs: document.getElementById("activityLogs"),
  purchaseLogs: document.getElementById("purchaseLogs"),
};

function setStatus(message, ok = false) {
  el.statusBar.textContent = message;
  el.statusBar.classList.remove("ok", "error");
  if (message) {
    el.statusBar.classList.add(ok ? "ok" : "error");
  }
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return Boolean(value);
}

function syncBusyUi() {
  const busy = state.activeCommandCount > 0;
  const staticButtons = [
    el.loadBtn,
    el.openLockerBtn,
    el.setPriceBtn,
    el.setColorBtn,
    el.setTempBtn,
    el.toggleOpModeBtn,
    el.rebootRpiBtn,
    el.rebootStmBtn,
  ];

  staticButtons
    .filter(Boolean)
    .forEach((button) => {
      button.disabled = busy;
    });

  const dynamicButtons = [
    ...(el.lockerGrid ? Array.from(el.lockerGrid.querySelectorAll("button")) : []),
    ...(el.lightingModeButtons ? Array.from(el.lightingModeButtons.querySelectorAll("button")) : []),
    ...(el.fanButtons ? Array.from(el.fanButtons.querySelectorAll("button")) : []),
    ...(el.headlightButtons ? Array.from(el.headlightButtons.querySelectorAll("button")) : []),
  ];

  dynamicButtons.forEach((button) => {
    button.disabled = busy;
  });
}

function toDisplay(v) {
  return v === null || v === undefined || v === "" ? "-" : String(v);
}

function humanizeKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function toLocalTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return String(value);
  }
  return dt.toLocaleString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasPendingControl(key) {
  return state.pendingControlKeys.has(key);
}

function syncPendingControlUi() {
  const pendingByButton = [
    [el.setPriceBtn, "setPrice"],
    [el.setColorBtn, "setColor"],
    [el.setTempBtn, "setTemp"],
  ];

  pendingByButton.forEach(([button, key]) => {
    if (!button) return;
    button.classList.toggle("pending", hasPendingControl(key));
  });

  renderFanButtons();
  renderHeadlightButtons();
  renderLightingModes();
  applyOpModeButtonState(state.opModeValue);
}

function setPendingControls(keys, pending) {
  const list = Array.isArray(keys) ? keys : [keys];
  list.forEach((key) => {
    if (!key) return;
    if (pending) {
      state.pendingControlKeys.add(key);
    } else {
      state.pendingControlKeys.delete(key);
    }
  });
  syncPendingControlUi();
}

function clearPendingControls() {
  if (state.pendingControlKeys.size === 0) return;
  state.pendingControlKeys.clear();
  syncPendingControlUi();
}

function scheduleDebouncedDashboardRefresh() {
  if (state.dbRefreshDebounceTimerId) {
    window.clearTimeout(state.dbRefreshDebounceTimerId);
  }

  state.dbRefreshDebounceTimerId = window.setTimeout(async () => {
    state.dbRefreshDebounceTimerId = null;
    try {
      await loadDashboard({ quiet: true });
    } catch (error) {
      setStatus(`Dashboard refresh failed: ${error.message}`);
    } finally {
      clearPendingControls();
    }
  }, state.dbRefreshDebounceMs);
}

function bitmaskToFanStates(fanMode) {
  const safeValue = Number.isInteger(fanMode) ? fanMode : 255;
  if (safeValue === 255) {
    return {
      fan1: false,
      fan2: false,
      fan3: false,
      fan4: false,
      fan5: false,
      auto: true,
    };
  }

  const manualStates = {
    fan1: false,
    fan2: false,
    fan3: false,
    fan4: false,
    fan5: false,
    auto: false,
  };

  FAN_BUTTONS.forEach((fan) => {
    manualStates[fan.key] = Boolean(safeValue & fan.bit);
  });

  return manualStates;
}

function fanStatesToBitmask(fanStates) {
  if (fanStates.auto) return 255;
  let value = 0;
  FAN_BUTTONS.forEach((fan) => {
    if (fanStates[fan.key]) {
      value |= fan.bit;
    }
  });
  return value;
}

function buildInfoEntriesFromObject(obj, preferredOrder = []) {
  const source = obj && typeof obj === "object" ? obj : {};
  const keys = [...preferredOrder, ...Object.keys(source).filter((k) => !preferredOrder.includes(k))];
  const entries = [];
  const booleanLikeKeys = new Set([
    "is_active",
    "is_open",
    "sold",
    "internet_connected",
    "rpi_alive",
    "stm32_alive",
    "op_mode",
  ]);

  keys.forEach((key) => {
    if (!(key in source)) return;
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") return;

    let value = raw;
    if (typeof raw === "boolean" || booleanLikeKeys.has(key)) {
      const boolValue = coerceBoolean(raw);
      value = key === "op_mode" ? (boolValue ? "ON" : "OFF") : (boolValue ? "Yes" : "No");
    } else if (/(_at|_time|heartbeat)$/i.test(key)) {
      value = toLocalTime(raw);
    } else if (typeof raw === "number") {
      value = Number.isFinite(raw) ? String(raw) : "-";
    }

    entries.push({
      label: humanizeKey(key),
      value: toDisplay(value),
    });
  });

  return entries;
}

function renderInfoList(target, entries, emptyText = "-") {
  target.innerHTML = "";

  if (!entries || !entries.length) {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = emptyText;
    target.appendChild(p);
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "info-item";

    const label = document.createElement("div");
    label.className = "info-label";
    label.textContent = entry.label;

    const value = document.createElement("div");
    value.className = "info-value";
    value.textContent = entry.value;

    row.appendChild(label);
    row.appendChild(value);
    target.appendChild(row);
  });
}

function parseActivityData(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { text: raw };
  }
}

function buildActivityText(log, activityData) {
  if (activityData.text) {
    return String(activityData.text);
  }

  if (typeof log.activity_data === "string" && log.activity_data.trim()) {
    return log.activity_data;
  }

  const commandId = Number(log.command_id || activityData.command_id || 0);
  const commandKey = String(activityData.command_key || "").trim();
  const commandName = commandKey
    ? humanizeKey(commandKey)
    : commandId
      ? `Command #${commandId}`
      : "Action";

  const lockerPart = log.locker_id ? ` locker #${log.locker_id}` : "";
  const machinePart = log.machine_id ? ` on machine #${log.machine_id}` : "";
  return `${commandName}${lockerPart}${machinePart}.`;
}

function renderActivityLogs(logs) {
  if (!el.activityLogs) return;
  el.activityLogs.innerHTML = "";

  if (!logs || !logs.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "table-empty";
    cell.textContent = "No activity logs found.";
    row.appendChild(cell);
    el.activityLogs.appendChild(row);
    return;
  }

  logs.forEach((log) => {
    const activityData = parseActivityData(log.activity_data);
    const row = document.createElement("tr");

    const whoCell = document.createElement("td");
    whoCell.textContent = log.user_id ? `User #${log.user_id}` : "System";

    const whenCell = document.createElement("td");
    whenCell.textContent = toLocalTime(log.created_at || activityData.reported_at || activityData.accepted_at);

    const actionCell = document.createElement("td");
    actionCell.textContent = buildActivityText(log, activityData);

    row.appendChild(whoCell);
    row.appendChild(whenCell);
    row.appendChild(actionCell);
    el.activityLogs.appendChild(row);
  });
}

function renderPurchaseLogs(logs) {
  if (!el.purchaseLogs) return;
  el.purchaseLogs.innerHTML = "";

  if (!logs || !logs.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "table-empty";
    cell.textContent = "No purchases found.";
    row.appendChild(cell);
    el.purchaseLogs.appendChild(row);
    return;
  }

  logs.forEach((purchase) => {
    const row = document.createElement("tr");

    const lockerCell = document.createElement("td");
    const lockerNumber = purchase.locker_number ?? purchase.locker_id;
    lockerCell.textContent = lockerNumber ? `#${lockerNumber}` : "-";

    const priceCell = document.createElement("td");
    const amount = Number(purchase.amount);
    const currency = purchase.currency ? String(purchase.currency).toUpperCase() : "EUR";
    priceCell.textContent = Number.isFinite(amount) ? `${amount.toFixed(2)} ${currency}` : "-";

    const timeCell = document.createElement("td");
    timeCell.textContent = toLocalTime(purchase.purchased_at);

    row.appendChild(lockerCell);
    row.appendChild(priceCell);
    row.appendChild(timeCell);
    el.purchaseLogs.appendChild(row);
  });
}

function applyOpModeButtonState(opModeValue) {
  state.opModeValue = coerceBoolean(opModeValue);
  if (!el.toggleOpModeBtn) return;

  el.toggleOpModeBtn.classList.remove("on", "off");
  el.toggleOpModeBtn.classList.add(state.opModeValue ? "on" : "off");
  el.toggleOpModeBtn.classList.toggle("pending", hasPendingControl("opMode"));
  el.toggleOpModeBtn.textContent = `Operation mode: ${state.opModeValue ? "ON" : "OFF"}`;
}

function renderLightingModes() {
  if (!el.lightingModeButtons) return;
  el.lightingModeButtons.innerHTML = "";
  const pending = hasPendingControl("lightingMode");

  LIGHTING_MODES.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lighting-mode-btn${state.lightingModeValue === mode.value ? " active" : ""}${pending ? " pending" : ""}`;
    button.textContent = mode.label;
    button.addEventListener("click", () => {
      handleSetLightingMode(mode.value).catch((e) => setStatus(`Set lighting failed: ${e.message}`));
    });
    el.lightingModeButtons.appendChild(button);
  });

  syncBusyUi();
}

function renderFanButtons() {
  if (!el.fanButtons) return;
  el.fanButtons.innerHTML = "";
  const pending = hasPendingControl("fan");

  FAN_BUTTONS.forEach((fan) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `state-btn ${state.fanStates[fan.key] ? "on" : "off"}${pending ? " pending" : ""}`;
    button.textContent = fan.label;
    button.addEventListener("click", () => {
      handleToggleFan(fan.key).catch((e) => setStatus(`Set fans failed: ${e.message}`));
    });
    el.fanButtons.appendChild(button);
  });

  const autoButton = document.createElement("button");
  autoButton.type = "button";
  autoButton.className = `state-btn fan-auto ${state.fanStates.auto ? "on" : "off"}${pending ? " pending" : ""}`;
  autoButton.textContent = "Auto";
  autoButton.addEventListener("click", () => {
    handleSetFanAuto().catch((e) => setStatus(`Set fans failed: ${e.message}`));
  });
  el.fanButtons.appendChild(autoButton);

  syncBusyUi();
}

function renderHeadlightButtons() {
  if (!el.headlightButtons) return;
  el.headlightButtons.innerHTML = "";
  const pending = hasPendingControl("headLights");

  HEADLIGHT_MODES.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `state-btn ${state.headLightsValue === mode.value ? "on" : "off"}${pending ? " pending" : ""}`;
    button.textContent = mode.label;
    button.addEventListener("click", () => {
      handleSetHeadLights(mode.value).catch((e) => setStatus(`Set head lights failed: ${e.message}`));
    });
    el.headlightButtons.appendChild(button);
  });

  syncBusyUi();
}

function syncControlModesFromStatusAndLocker() {
  const locker = getSelectedLocker();
  state.lightingModeValue = locker && Number.isInteger(Number(locker.lighting_mode))
    ? Number(locker.lighting_mode)
    : 0;

  const rawFanMode = state.machineStatus ? Number(state.machineStatus.fan_mode) : 255;
  state.fanModeValue = Number.isInteger(rawFanMode) ? rawFanMode : 255;
  state.fanStates = bitmaskToFanStates(state.fanModeValue);

  const rawOpMode = state.machineStatus ? state.machineStatus.op_mode : false;
  state.opModeValue = coerceBoolean(rawOpMode);

  const rawHeadLights = state.machineStatus ? Number(state.machineStatus.head_lights) : 0;
  state.headLightsValue = [0, 1, 2].includes(rawHeadLights) ? rawHeadLights : 0;

  renderLightingModes();
  renderFanButtons();
  renderHeadlightButtons();
  applyOpModeButtonState(state.opModeValue);
}

async function api(path, options = {}, attempt = 1) {
  const url = `${state.apiBaseUrl}${path}`;
  const method = (options.method || "GET").toUpperCase();
  const defaultHeaders = method === "GET" || method === "HEAD"
    ? {}
    : { "Content-Type": "application/json" };
  const headers = {
    ...defaultHeaders,
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), state.requestTimeoutMs);

  let response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeoutId);

    if (attempt < 2) {
      await sleep(250);
      return api(path, options, attempt + 1);
    }

    const reason = location.protocol === "file:"
      ? "Browser blocked request from file:// (CORS). Open frontend via http:// or enable CORS on API."
      : "Network/CORS error while calling API.";
    const details = e instanceof Error ? e.message : String(e);
    throw new Error(`${reason} URL=${url} DETAILS=${details}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${response.status}`;
    throw new Error(`${msg} (HTTP ${response.status})`);
  }

  return data;
}

function isRetryableCommandError(error) {
  const message = String(error?.message || error || "");
  return /Network\/CORS error|Failed to fetch|aborted|timeout|\(HTTP\s*5\d\d\)/i.test(message);
}

function getSelectedLocker() {
  return state.lockers.find((l) => l.locker_id === state.selectedLockerId) || null;
}

function persistSelection() {
  if (state.selectedUserId) {
    localStorage.setItem(STORAGE_KEYS.selectedUserId, String(state.selectedUserId));
  } else {
    localStorage.removeItem(STORAGE_KEYS.selectedUserId);
  }

  if (state.selectedMachineId) {
    localStorage.setItem(STORAGE_KEYS.selectedMachineId, String(state.selectedMachineId));
  } else {
    localStorage.removeItem(STORAGE_KEYS.selectedMachineId);
  }
}

function resetDashboard() {
  renderInfoList(el.userInfo, [], "Select a user and machine.");
  renderInfoList(el.machineInfo, [], "-");
  renderInfoList(el.machineStatus, [], "-");
  renderInfoList(el.adminStats, [], "Only shown for admin users.");
  renderActivityLogs([]);
  renderPurchaseLogs([]);
  el.lockerGrid.innerHTML = "";
  state.lockers = [];
  state.selectedLockerId = null;
  state.machineStatus = null;
  if (state.dbRefreshDebounceTimerId) {
    window.clearTimeout(state.dbRefreshDebounceTimerId);
    state.dbRefreshDebounceTimerId = null;
  }
  clearPendingControls();
  setSelectedLockerText();
  syncSelectedLockerFormFields();
  syncControlModesFromStatusAndLocker();
  syncBusyUi();
}

function setSelectedLockerText() {
  const locker = getSelectedLocker();
  if (!locker) {
    el.selectedLockerText.textContent = "No locker selected";
    return;
  }
  el.selectedLockerText.textContent = `Locker ${locker.locker_number} selected (id=${locker.locker_id})`;
}

function syncSelectedLockerFormFields() {
  const locker = getSelectedLocker();
  if (!locker) {
    el.lockerPrice.value = "";
    el.lockerPrice.dataset.fromDb = "0";
    el.colorR.value = "";
    el.colorG.value = "";
    el.colorB.value = "";
    return;
  }

  el.lockerPrice.value = locker.price ?? "";
  el.lockerPrice.dataset.fromDb = "1";
  el.colorR.value = locker.color_r ?? "";
  el.colorG.value = locker.color_g ?? "";
  el.colorB.value = locker.color_b ?? "";
}

function scrollLockerCommandsIntoViewOnMobile() {
  if (!window.matchMedia("(max-width: 768px)").matches) {
    return;
  }

  const commandsCard = el.selectedLockerText ? el.selectedLockerText.closest(".card") : null;
  if (!commandsCard) {
    return;
  }

  window.requestAnimationFrame(() => {
    commandsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function lockerColorClass(locker) {
  if (coerceBoolean(locker.is_open)) return "orange";
  if (coerceBoolean(locker.sold)) return "red";
  return "green";
}

function lockerStateLabel(locker) {
  if (coerceBoolean(locker.is_open)) return "OPEN";
  if (coerceBoolean(locker.sold)) return "SOLD";
  return "FREE";
}

function renderLockers() {
  el.lockerGrid.innerHTML = "";
  if (!state.lockers.length) {
    el.lockerGrid.innerHTML = "<p class='subtle'>No lockers found for this machine.</p>";
    state.selectedLockerId = null;
    setSelectedLockerText();
    syncSelectedLockerFormFields();
    syncBusyUi();
    return;
  }

  state.lockers.forEach((locker) => {
    const button = document.createElement("button");
    button.className = `locker-btn ${lockerColorClass(locker)}${locker.locker_id === state.selectedLockerId ? " active" : ""}`;
    button.innerHTML = `<span>L${locker.locker_number}</span><small>${lockerStateLabel(locker)}</small>`;
    button.addEventListener("click", () => {
      state.selectedLockerId = locker.locker_id;
      setSelectedLockerText();
      syncSelectedLockerFormFields();
      state.lightingModeValue = Number.isInteger(Number(locker.lighting_mode)) ? Number(locker.lighting_mode) : 0;
      renderLockers();
      renderLightingModes();
      scrollLockerCommandsIntoViewOnMobile();
    });
    el.lockerGrid.appendChild(button);
  });

  syncBusyUi();
}

function populateUsers() {
  el.userSelect.innerHTML = "<option value=''>Choose user</option>";
  state.users.forEach((user) => {
    const option = document.createElement("option");
    option.value = String(user.user_id);
    option.textContent = `${user.name} ${user.surname} (${user.email})`;
    el.userSelect.appendChild(option);
  });
}

function populateMachines() {
  el.machineSelect.innerHTML = "<option value=''>Choose machine</option>";
  state.allowedMachines.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.machine.machine_id);
    option.textContent = `${item.machine.machine_code} - ${item.machine.machine_name}`;
    el.machineSelect.appendChild(option);
  });
  el.machineSelect.disabled = state.allowedMachines.length === 0;
}

async function fetchMembershipForCompany(companyId) {
  if (state.membershipsByCompany.has(companyId)) {
    return state.membershipsByCompany.get(companyId);
  }
  const users = await api(`/companies/${companyId}/users`);
  state.membershipsByCompany.set(companyId, users);
  return users;
}

function withBusyAction(actionLabel, fn) {
  state.activeCommandCount += 1;
  if (state.activeCommandCount === 1) {
    setStatus(`${actionLabel}...`, true);
  }
  syncBusyUi();

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      state.activeCommandCount = Math.max(0, state.activeCommandCount - 1);
      syncBusyUi();
    });
}

async function refreshDashboardAfterCommand() {
  const delays = [0, 450, 900, 1400];
  let lastError = null;

  for (const delay of delays) {
    if (delay > 0) {
      await sleep(delay);
    }
    try {
      await loadDashboard({ quiet: true });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
}

async function publishMachineCommand(commandId, params = {}, lockerId = null) {
  if (!state.selectedUserId || !state.selectedMachineId) {
    throw new Error("Choose a user and machine first.");
  }

  return api(`/machines/${state.selectedMachineId}/commands`, {
    method: "POST",
    body: JSON.stringify({
      command_id: commandId,
      user_id: state.selectedUserId,
      locker_id: lockerId ?? null,
      params,
    }),
  });
}

function requireContext({ locker = false } = {}) {
  if (!state.selectedUserId) {
    setStatus("Choose a user first.");
    return false;
  }
  if (!state.selectedMachineId) {
    setStatus("Choose a machine first.");
    return false;
  }
  if (locker && !state.selectedLockerId) {
    setStatus("Choose a locker first.");
    return false;
  }
  return true;
}

async function sendCommandAndRefresh(commandId, params = {}, lockerId = null, statusLabel = "Command") {
  if (state.activeCommandCount > 0) {
    setStatus("Please wait for current command to finish.", true);
    return null;
  }

  return withBusyAction(statusLabel, async () => {
    let response = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        response = await publishMachineCommand(commandId, params, lockerId);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2 && isRetryableCommandError(error)) {
          await sleep(350);
          continue;
        }
        break;
      }
    }

    if (lastError) {
      await loadDashboard({ quiet: true }).catch(() => {});
      throw lastError;
    }

    let refreshError = null;
    try {
      await refreshDashboardAfterCommand();
    } catch (error) {
      refreshError = error;
    }

    const requestId = response?.request_id ? ` request_id=${response.request_id}` : "";
    if (refreshError) {
      setStatus(`${statusLabel} command sent.${requestId} Dashboard refresh delayed.`, true);
      window.setTimeout(() => {
        loadDashboard({ quiet: true }).catch(() => {});
      }, 1500);
    } else {
      setStatus(`${statusLabel} command sent.${requestId}`, true);
    }

    return response;
  });
}

async function sendCommandAndDebouncedRefresh(
  commandId,
  params = {},
  lockerId = null,
  statusLabel = "Command",
  pendingKeys = []
) {
  if (state.activeCommandCount > 0) {
    setStatus("Please wait for current command to finish.", true);
    return null;
  }

  const keys = Array.isArray(pendingKeys) ? pendingKeys : [pendingKeys];
  setPendingControls(keys, true);

  let response = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await publishMachineCommand(commandId, params, lockerId);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2 && isRetryableCommandError(error)) {
        await sleep(250);
        continue;
      }
      break;
    }
  }

  if (lastError) {
    setPendingControls(keys, false);
    await loadDashboard({ quiet: true }).catch(() => {});
    throw lastError;
  }

  scheduleDebouncedDashboardRefresh();
  const requestId = response?.request_id ? ` request_id=${response.request_id}` : "";
  setStatus(`${statusLabel} command sent.${requestId}`, true);
  return response;
}

async function loadInitial() {
  state.apiBaseUrl = el.apiBaseUrl.value.trim().replace(/\/$/, "");
  if (!state.apiBaseUrl) {
    throw new Error("API URL is empty. Paste the HttpApiUrl output from CoreDataPlatformStack (execute-api URL).");
  }

  localStorage.setItem(STORAGE_KEYS.apiBaseUrl, state.apiBaseUrl);
  const [users, machines] = await Promise.all([
    api("/users"),
    api("/machines"),
  ]);

  state.users = users;
  state.machines = machines;
  populateUsers();
  setStatus(`Loaded ${users.length} users and ${machines.length} machines.`, true);
}

async function onUserSelected() {
  resetDashboard();
  state.selectedUserId = el.userSelect.value ? Number(el.userSelect.value) : null;
  state.selectedMachineId = null;
  state.selectedCompanyId = null;
  state.selectedRole = null;
  state.allowedMachines = [];
  populateMachines();
  persistSelection();

  if (!state.selectedUserId) return;

  const allowed = [];
  for (const machine of state.machines) {
    const actors = await api(`/machines/${machine.machine_id}/actors`).catch(() => []);
    if (!actors.some((x) => x.user_id === state.selectedUserId)) continue;

    const companyUsers = await fetchMembershipForCompany(machine.company_id);
    const membership = companyUsers.find((x) => x.user_id === state.selectedUserId) || null;

    allowed.push({
      machine,
      role: membership ? membership.role : null,
      companyId: machine.company_id,
    });
  }

  state.allowedMachines = allowed;
  populateMachines();

  if (!allowed.length) {
    setStatus("Selected user has no allowed machines.");
    persistSelection();
    return;
  }

  persistSelection();
  setStatus(`Loaded ${allowed.length} allowed machines for selected user.`, true);
}

function onMachineSelected() {
  resetDashboard();
  state.selectedMachineId = el.machineSelect.value ? Number(el.machineSelect.value) : null;
  if (!state.selectedMachineId) {
    state.selectedCompanyId = null;
    state.selectedRole = null;
    persistSelection();
    return;
  }

  const selected = state.allowedMachines.find((x) => x.machine.machine_id === state.selectedMachineId);
  state.selectedCompanyId = selected ? selected.companyId : null;
  state.selectedRole = selected ? selected.role : null;
  persistSelection();
}

async function loadDashboard(options = {}) {
  const quiet = Boolean(options.quiet);

  if (!state.selectedUserId) {
    if (!quiet) setStatus("Choose a user.");
    return;
  }
  if (!state.selectedMachineId) {
    if (!quiet) setStatus("Choose a machine.");
    return;
  }

  const machineId = state.selectedMachineId;
  const [user, machine, status, lockers, activityLogs, purchaseLogs] = await Promise.all([
    api(`/users/${state.selectedUserId}`),
    api(`/machines/${machineId}`),
    api(`/machine_status/${machineId}`).catch(() => null),
    api(`/lockers?machine_id=${machineId}`),
    api(`/activity_logs?machine_id=${machineId}&limit=20`).catch(() => []),
    api(`/purchase_logs?machine_id=${machineId}&limit=500`).catch(() => []),
  ]);

  state.machineStatus = status;
  state.lockers = lockers;

  if (!state.lockers.some((locker) => locker.locker_id === state.selectedLockerId)) {
    state.selectedLockerId = state.lockers.length ? state.lockers[0].locker_id : null;
  }

  const userInfo = {
    user_id: user.user_id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    is_active: user.is_active,
    role: state.selectedRole,
    company_id: state.selectedCompanyId,
  };

  renderInfoList(
    el.userInfo,
    buildInfoEntriesFromObject(userInfo, ["name", "surname", "email", "is_active", "role", "company_id", "user_id"]),
    "Select a user and machine."
  );

  renderInfoList(
    el.machineInfo,
    buildInfoEntriesFromObject(machine, [
      "machine_code",
      "machine_name",
      "country",
      "city",
      "address",
      "locker_amount",
      "software_version",
      "hardware_version",
      "machine_id",
      "company_id",
    ]),
    "No machine data found."
  );

  renderInfoList(
    el.machineStatus,
    status
      ? buildInfoEntriesFromObject(status, [
        "current_temperature",
        "current_humidity",
        "set_temperature",
        "fan_mode",
        "head_lights",
        "op_mode",
        "water_status",
        "internet_connected",
        "rpi_alive",
        "stm32_alive",
        "last_heartbeat",
        "updated_at",
      ])
      : [],
    "No machine status found."
  );

  renderActivityLogs(activityLogs || []);
  renderPurchaseLogs(purchaseLogs || []);
  renderLockers();
  syncControlModesFromStatusAndLocker();
  setSelectedLockerText();
  syncSelectedLockerFormFields();

  if (state.selectedRole === "admin") {
    await loadAdminStats(machineId);
  } else {
    renderInfoList(el.adminStats, [], "Only shown for admin users.");
  }

  if (!quiet) {
    setStatus("Dashboard loaded successfully.", true);
  }
}

async function loadAdminStats(machineId) {
  const [purchases, climate] = await Promise.all([
    api(`/purchase_logs?machine_id=${machineId}&limit=500`).catch(() => []),
    api(`/climate_logs?machine_id=${machineId}&limit=500`).catch(() => []),
  ]);

  const totalRevenue = purchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const avgPurchase = purchases.length ? totalRevenue / purchases.length : 0;
  const temps = climate.map((c) => Number(c.temperature)).filter(Number.isFinite);
  const hums = climate.map((c) => Number(c.humidity)).filter(Number.isFinite);

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const min = (arr) => (arr.length ? Math.min(...arr) : 0);
  const max = (arr) => (arr.length ? Math.max(...arr) : 0);

  renderInfoList(el.adminStats, buildInfoEntriesFromObject({
    total_purchases: purchases.length,
    total_revenue_eur: Number(totalRevenue.toFixed(2)),
    average_purchase_eur: Number(avgPurchase.toFixed(2)),
    climate_logs: climate.length,
    avg_temperature: Number(avg(temps).toFixed(2)),
    min_temperature: Number(min(temps).toFixed(2)),
    max_temperature: Number(max(temps).toFixed(2)),
    avg_humidity: Number(avg(hums).toFixed(2)),
    min_humidity: Number(min(hums).toFixed(2)),
    max_humidity: Number(max(hums).toFixed(2)),
  }));
}

async function handleOpenLocker() {
  if (!requireContext({ locker: true })) return;
  await sendCommandAndRefresh(COMMAND_IDS.OPEN_LOCKER, {}, state.selectedLockerId, "Open locker");
}

async function handleSetPrice() {
  if (!requireContext({ locker: true })) return;
  const price = Number(el.lockerPrice.value);
  if (!Number.isFinite(price) || price < 0 || price > 9999) {
    setStatus("Price must be a number between 0 and 9999.");
    return;
  }
  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_LOCKER_PRICE,
    { price },
    state.selectedLockerId,
    "Set locker price",
    ["setPrice"]
  );
}

async function handleSetColor() {
  if (!requireContext({ locker: true })) return;
  const color_r = Number(el.colorR.value);
  const color_g = Number(el.colorG.value);
  const color_b = Number(el.colorB.value);
  const all = [color_r, color_g, color_b];
  if (all.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
    setStatus("RGB values must be integers between 0 and 255.");
    return;
  }
  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_LOCKER_COLOR,
    { color_r, color_g, color_b },
    state.selectedLockerId,
    "Set locker color",
    ["setColor"]
  );
}

async function handleSetLightingMode(modeValue) {
  if (!requireContext({ locker: true })) return;
  if (!Number.isInteger(modeValue) || modeValue < 1 || modeValue > 5) {
    setStatus("Lighting mode must be one of available modes.");
    return;
  }

  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_LIGHTING_MODE,
    { lighting_mode: modeValue },
    state.selectedLockerId,
    `Set lighting mode ${modeValue}`,
    ["lightingMode"]
  );
}

async function handleToggleFan(fanKey) {
  if (!requireContext()) return;

  const nextStates = {
    ...state.fanStates,
    auto: false,
    [fanKey]: !state.fanStates[fanKey],
  };
  const fan_mode = fanStatesToBitmask(nextStates);

  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_FANS,
    { fan_mode },
    null,
    "Set fans",
    ["fan"]
  );
}

async function handleSetFanAuto() {
  if (!requireContext()) return;
  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_FANS,
    { fan_mode: 255 },
    null,
    "Set fans auto",
    ["fan"]
  );
}

async function handleToggleOperationMode() {
  if (!requireContext()) return;
  const next = !state.opModeValue;
  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_OPERATION_MODE,
    { op_mode: next },
    null,
    "Set operation mode",
    ["opMode"]
  );
}

async function handleSetHeadLights(modeValue) {
  if (!requireContext()) return;
  if (![0, 1, 2].includes(modeValue)) {
    setStatus("Head lights value must be 0 (Off), 1 (On), or 2 (Auto).");
    return;
  }

  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_HEAD_LIGHTS,
    { head_lights: modeValue },
    null,
    "Set head lights",
    ["headLights"]
  );
}

async function handleSetTemperature() {
  if (!requireContext()) return;
  const set_temperature = Number(el.setTemp.value);
  if (!Number.isFinite(set_temperature)) {
    setStatus("Set temperature must be numeric.");
    return;
  }
  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_TEMPERATURE,
    { set_temperature },
    null,
    "Set temperature",
    ["setTemp"]
  );
}

async function handleRebootRpi() {
  if (!requireContext()) return;
  await sendCommandAndRefresh(COMMAND_IDS.REBOOT_RPI, { action: "reboot_rpi" }, null, "Reboot RPI");
}

async function handleRebootStm32() {
  if (!requireContext()) return;
  await sendCommandAndRefresh(COMMAND_IDS.REBOOT_STM32, { action: "reboot_stm32" }, null, "Reboot STM32");
}

function clearAll() {
  state.selectedUserId = null;
  state.selectedMachineId = null;
  state.selectedCompanyId = null;
  state.selectedRole = null;
  state.allowedMachines = [];
  state.membershipsByCompany.clear();

  el.userSelect.value = "";
  el.machineSelect.value = "";
  populateMachines();
  resetDashboard();
  localStorage.removeItem(STORAGE_KEYS.selectedUserId);
  localStorage.removeItem(STORAGE_KEYS.selectedMachineId);
  setStatus("");
}

function startAutoRefreshLoop() {
  if (state.autoRefreshTimerId) {
    window.clearInterval(state.autoRefreshTimerId);
  }

  state.autoRefreshTimerId = window.setInterval(() => {
    if (!state.selectedUserId || !state.selectedMachineId) return;
    if (state.activeCommandCount > 0) return;
    if (document.visibilityState === "hidden") return;
    loadDashboard({ quiet: true }).catch(() => {});
  }, state.autoRefreshIntervalMs);
}

async function restoreSelectionAndAutoloadDashboard() {
  const storedUserIdRaw = localStorage.getItem(STORAGE_KEYS.selectedUserId);
  const storedMachineIdRaw = localStorage.getItem(STORAGE_KEYS.selectedMachineId);
  if (!storedUserIdRaw) return;

  const storedUserId = Number(storedUserIdRaw);
  if (!Number.isInteger(storedUserId)) return;
  if (!state.users.some((u) => Number(u.user_id) === storedUserId)) return;

  state.selectedUserId = storedUserId;
  el.userSelect.value = String(storedUserId);
  await onUserSelected();

  if (!storedMachineIdRaw) return;

  const storedMachineId = Number(storedMachineIdRaw);
  if (!Number.isInteger(storedMachineId)) return;
  if (!state.allowedMachines.some((x) => Number(x.machine.machine_id) === storedMachineId)) return;

  state.selectedMachineId = storedMachineId;
  el.machineSelect.value = String(storedMachineId);
  onMachineSelected();
  persistSelection();
  await loadDashboard();
}

function wireEvents() {
  el.apiBaseUrl.value = state.apiBaseUrl;

  [el.lockerPrice, el.colorR, el.colorG, el.colorB, el.setTemp].forEach((input) => {
    if (!input) return;
    input.addEventListener("focus", () => {
      if (input.value !== "") {
        input.select();
      }
    });
  });

  el.lockerPrice.addEventListener("pointerdown", () => {
    if (document.activeElement === el.lockerPrice && el.lockerPrice.dataset.fromDb === "1") {
      el.lockerPrice.value = "";
      el.lockerPrice.dataset.fromDb = "0";
    }
  });

  el.lockerPrice.addEventListener("focus", () => {
    if (el.lockerPrice.dataset.fromDb === "1") {
      el.lockerPrice.value = "";
      el.lockerPrice.dataset.fromDb = "0";
    }
  });

  el.apiBaseUrl.addEventListener("change", () => {
    state.apiBaseUrl = el.apiBaseUrl.value.trim().replace(/\/$/, "");
    if (state.apiBaseUrl) {
      localStorage.setItem(STORAGE_KEYS.apiBaseUrl, state.apiBaseUrl);
    }
  });

  el.userSelect.addEventListener("change", () => {
    onUserSelected().catch((e) => setStatus(`Failed to load user machines: ${e.message}`));
  });

  el.machineSelect.addEventListener("change", onMachineSelected);
  el.loadBtn.addEventListener("click", () => loadDashboard().catch((e) => setStatus(`Failed to load dashboard: ${e.message}`)));
  el.clearBtn.addEventListener("click", clearAll);

  el.openLockerBtn.addEventListener("click", () => handleOpenLocker().catch((e) => setStatus(`Open locker failed: ${e.message}`)));
  el.setPriceBtn.addEventListener("click", () => handleSetPrice().catch((e) => setStatus(`Set price failed: ${e.message}`)));
  el.setColorBtn.addEventListener("click", () => handleSetColor().catch((e) => setStatus(`Set color failed: ${e.message}`)));
  el.setTempBtn.addEventListener("click", () => handleSetTemperature().catch((e) => setStatus(`Set temperature failed: ${e.message}`)));
  el.toggleOpModeBtn.addEventListener("click", () => handleToggleOperationMode().catch((e) => setStatus(`Set operation mode failed: ${e.message}`)));
  el.rebootRpiBtn.addEventListener("click", () => handleRebootRpi().catch((e) => setStatus(`Reboot RPI failed: ${e.message}`)));
  el.rebootStmBtn.addEventListener("click", () => handleRebootStm32().catch((e) => setStatus(`Reboot STM32 failed: ${e.message}`)));
}

async function init() {
  wireEvents();
  renderLightingModes();
  renderFanButtons();
  renderHeadlightButtons();
  renderPurchaseLogs([]);
  applyOpModeButtonState(false);
  syncBusyUi();
  startAutoRefreshLoop();

  if (location.protocol === "file:") {
    setStatus("You opened frontend as file://. Browser will often block API calls (CORS). Open it with an http server.");
  }

  try {
    await loadInitial();
    await restoreSelectionAndAutoloadDashboard();
  } catch (e) {
    setStatus(`Failed to initialize frontend: ${e.message}`);
  }
}

init();

