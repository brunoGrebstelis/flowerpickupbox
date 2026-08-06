const DEFAULT_API_BASE_URL = "https://xaufumsuck.execute-api.eu-central-1.amazonaws.com";

const STORAGE_KEYS = {
  apiBaseUrl: "apiBaseUrl",
  selectedUserId: "selectedUserId",
  selectedMachineId: "selectedMachineId",
  authIdToken: "authIdToken",
  authAccessToken: "authAccessToken",
  authRefreshToken: "authRefreshToken",
  authExpiresAt: "authExpiresAt",
  authEmail: "authEmail",
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
  { key: "fan2", label: "Fan2", bit: 2 },
  { key: "fan3", label: "Fan3", bit: 4 },
  { key: "fan4", label: "Fan4", bit: 8 },
  { key: "fan5", label: "Fan5", bit: 16 },
];

const HEADLIGHT_MODES = [
  { value: 1, label: "On" },
  { value: 0, label: "Off" },
  { value: 2, label: "Auto" },
];

const VERIFICATION_REFRESH_DELAYS_MS = [150, 200, 250];
const MAX_VERIFICATION_SEND_ATTEMPTS = VERIFICATION_REFRESH_DELAYS_MS.length;
const OPTIMISTIC_ACTIVITY_SUCCESS_TTL_MS = 120000;
const CLIMATE_PAGE_SIZE = 5000;
const MAX_CLIMATE_PAGES = 1000;
const PURCHASE_PAGE_SIZE = 5000;
const MAX_PURCHASE_PAGES = 1000;

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
  authConfig: {
    enabled: false,
    region: "",
    userPoolId: "",
    appClientId: "",
    issuer: "",
  },
  auth: {
    isAuthenticated: false,
    idToken: "",
    accessToken: "",
    refreshToken: "",
    expiresAt: 0,
    email: "",
    pendingChallenge: null,
  },
  users: [],
  machines: [],
  membershipsByCompany: new Map(),
  allowedMachines: [],
  selectedUserId: null,
  selectedMachineId: null,
  selectedCompanyId: null,
  selectedRole: null,
  currentMachine: null,
  latestClimatePreview: [],
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
  dbRefreshDebounceMs: 100,
  pendingControlKeys: new Set(),
  failedControlKeys: new Set(),
  pendingVerifications: [],
  optimisticSuccessfulRequestIds: new Map(),
  pendingLockerPriceById: new Map(),
  pendingLockerColorById: new Map(),
  fanStates: {
    fan1: false,
    fan2: false,
    fan3: false,
    fan4: false,
    fan5: false,
    auto: true,
  },
  ui: {
    activeView: "service",
    lockerCommandsOpen: false,
    temperatureModalOpen: false,
    lockerLayoutFrameId: null,
    lightingCollapsed: true,
    machineCommandsCollapsed: false,
    climateCollapsed: true,
  },
  latestStatsRaw: {
    purchases: [],
    climate: [],
  },
  latestRenderedStatsSignature: "",
  chartMeta: {
    purchasesByDay: [],
    revenueByDay: [],
    temperatureByTime: [],
    humidityByTime: [],
  },
  stats: {
    activeChart: "",
    customFrom: "",
    customTo: "",
    climateSensorId: 1,
    climateRequestSequence: 0,
    climateLoadError: "",
    purchaseLoadError: "",
  },
  colorPickerModalOpen: false,
  chartRenderSignature: "",
};

const el = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  newPasswordBlock: document.getElementById("newPasswordBlock"),
  newPassword: document.getElementById("newPassword"),
  newPasswordConfirm: document.getElementById("newPasswordConfirm"),
  setNewPasswordBtn: document.getElementById("setNewPasswordBtn"),
  authStatus: document.getElementById("authStatus"),
  signInCard: document.getElementById("signInCard"),
  sessionCard: document.getElementById("sessionCard"),
  machineStrip: document.getElementById("machineStrip"),
  signedInUser: document.getElementById("signedInUser"),
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
  setColorAllBtn: document.getElementById("setColorAllBtn"),
  pickColorBtn: document.getElementById("pickColorBtn"),
  colorPicker: document.getElementById("colorPicker"),
  lightingModesBlock: document.getElementById("lightingModesBlock"),
  lightingToggleBtn: document.getElementById("lightingToggleBtn"),
  lightingModesContent: document.getElementById("lightingModesContent"),
  setTemp: document.getElementById("setTemp"),
  setTempBtn: document.getElementById("setTempBtn"),
  fanButtons: document.getElementById("fanButtons"),
  headlightButtons: document.getElementById("headlightButtons"),
  toggleOpModeBtn: document.getElementById("toggleOpModeBtn"),
  machineCommandsBlock: document.getElementById("machineCommandsBlock"),
  machineCommandsToggleBtn: document.getElementById("machineCommandsToggleBtn"),
  machineCommandsContent: document.getElementById("machineCommandsContent"),
  topCurrentTemperature: document.getElementById("topCurrentTemperature"),
  topHeartbeatDot: document.getElementById("topHeartbeatDot"),
  topHeartbeatText: document.getElementById("topHeartbeatText"),
  temperatureModal: document.getElementById("temperatureModal"),
  temperatureMachineText: document.getElementById("temperatureMachineText"),
  temperatureReadings: document.getElementById("temperatureReadings"),
  closeTemperatureModalBtn: document.getElementById("closeTemperatureModalBtn"),
  adminStats: document.getElementById("adminStats"),
  adminStatsDetails: document.getElementById("adminStatsDetails"),
  statsPeriodSelect: document.getElementById("statsPeriodSelect"),
  toggleClimateDetailsBtn: document.getElementById("toggleClimateDetailsBtn"),
  climateDetailsContent: document.getElementById("climateDetailsContent"),
  climateSensorButtons: document.getElementById("climateSensorButtons"),
  adminClimateStats: document.getElementById("adminClimateStats"),
  purchasesChart: document.getElementById("purchasesChart"),
  revenueChart: document.getElementById("revenueChart"),
  temperatureChart: document.getElementById("temperatureChart"),
  temperatureChartTitle: document.getElementById("temperatureChartTitle"),
  humidityChart: document.getElementById("humidityChart"),
  humidityChartTitle: document.getElementById("humidityChartTitle"),
  chartGrid: document.getElementById("chartGrid"),
  statsPeriodToggleBtn: document.getElementById("statsPeriodToggleBtn"),
  statsPeriodMenu: document.getElementById("statsPeriodMenu"),
  statsPeriodPanel: document.getElementById("statsPeriodPanel"),
  statsCustomRange: document.getElementById("statsCustomRange"),
  statsCustomRangePicker: document.getElementById("statsCustomRangePicker"),
  statsCustomRangeLegacy: document.getElementById("statsCustomRangeLegacy"),
  statsCustomFrom: document.getElementById("statsCustomFrom"),
  statsCustomTo: document.getElementById("statsCustomTo"),
  activitySection: document.getElementById("activitySection"),
  appViews: document.getElementById("appViews"),
  serviceView: document.getElementById("serviceView"),
  settingsView: document.getElementById("settingsView"),
  statsView: document.getElementById("statsView"),
  lockerCommandsSheet: document.getElementById("lockerCommandsSheet"),
  lockerSheetBackdrop: document.getElementById("lockerSheetBackdrop"),
  closeLockerCommandsBtn: document.getElementById("closeLockerCommandsBtn"),
  mobileQuickNav: document.getElementById("mobileQuickNav"),
  quickNavServiceBtn: document.getElementById("quickNavServiceBtn"),
  quickNavSettingsBtn: document.getElementById("quickNavSettingsBtn"),
  quickNavStatsBtn: document.getElementById("quickNavStatsBtn"),
  downloadPurchasesCsvBtn: document.getElementById("downloadPurchasesCsvBtn"),
  downloadClimateCsvBtn: document.getElementById("downloadClimateCsvBtn"),
  activityLogs: document.getElementById("activityLogs"),
  purchaseLogs: document.getElementById("purchaseLogs"),
};

function formatMonthYearLabel(dateObj = new Date()) {
  return dateObj.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function updateStatsPeriodButtonLabel() {
  if (!el.statsPeriodToggleBtn) return;
  const mode = String(el.statsPeriodSelect?.value || "this_month");
  if (mode === "today") {
    el.statsPeriodToggleBtn.textContent = "Today";
    syncStatsPeriodMenuActiveState();
    return;
  }
  if (mode === "yesterday") {
    el.statsPeriodToggleBtn.textContent = "Yesterday";
    syncStatsPeriodMenuActiveState();
    return;
  }
  if (mode === "this_month") {
    el.statsPeriodToggleBtn.textContent = formatMonthYearLabel(new Date());
    syncStatsPeriodMenuActiveState();
    return;
  }
  if (mode === "last_month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    el.statsPeriodToggleBtn.textContent = formatMonthYearLabel(d);
    syncStatsPeriodMenuActiveState();
    return;
  }
  if (mode === "this_year") {
    el.statsPeriodToggleBtn.textContent = String(new Date().getFullYear());
    syncStatsPeriodMenuActiveState();
    return;
  }
  if (mode === "all_time") {
    el.statsPeriodToggleBtn.textContent = "Total";
    syncStatsPeriodMenuActiveState();
    return;
  }
  if (mode === "custom") {
    const from = String(el.statsCustomFrom?.value || "");
    const to = String(el.statsCustomTo?.value || "");
    el.statsPeriodToggleBtn.textContent = from && to ? `${from} → ${to}` : "Custom range";
    syncStatsPeriodMenuActiveState();
    return;
  }
  el.statsPeriodToggleBtn.textContent = formatMonthYearLabel(new Date());
  syncStatsPeriodMenuActiveState();
}

function syncStatsPeriodMenuActiveState() {
  if (!el.statsPeriodMenu || !el.statsPeriodSelect) return;
  const current = String(el.statsPeriodSelect.value || "this_month");
  const buttons = Array.from(el.statsPeriodMenu.querySelectorAll("[data-period-value]"));
  buttons.forEach((btn) => {
    const value = String(btn.getAttribute("data-period-value") || "");
    btn.classList.toggle("active", value === current);
  });
}

function setStatsPeriodMenuVisible(visible) {
  if (!el.statsPeriodMenu) return;
  el.statsPeriodMenu.hidden = !visible;
  if (visible) {
    syncStatsPeriodMenuActiveState();
  }
}

function setRgbFieldsFromHex(hex) {
  const value = String(hex || "#000000").replace("#", "");
  if (value.length !== 6) return;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (!Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b)) return;
  el.colorR.value = String(r);
  el.colorG.value = String(g);
  el.colorB.value = String(b);
}

function openNativeColorPicker(inputEl) {
  if (!inputEl) return;
  try {
    if (typeof inputEl.showPicker === "function") {
      inputEl.showPicker();
      return;
    }
  } catch {
    // Fallback below for browsers that restrict showPicker.
  }
  try {
    inputEl.click();
  } catch {
    // No-op if browser blocks synthetic click.
  }
}

function closeStatsPeriodPanel() {
  setStatsPeriodMenuVisible(false);
}

function formatDateForInput(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
}

function getStatsRangePickerInstance() {
  const picker = el.statsCustomRangePicker && el.statsCustomRangePicker._flatpickr;
  return picker || null;
}

function syncStatsRangePickerFromInputs() {
  const picker = getStatsRangePickerInstance();
  if (!picker) return;
  const fromRaw = String(el.statsCustomFrom?.value || "").trim();
  const toRaw = String(el.statsCustomTo?.value || "").trim();
  if (!fromRaw && !toRaw) {
    picker.clear(false);
    return;
  }
  const selected = [];
  if (fromRaw) selected.push(fromRaw);
  if (toRaw) selected.push(toRaw);
  picker.setDate(selected, false, "Y-m-d");
}

function ensureFlatpickrYearDropdown(instance) {
  if (!instance || !instance.calendarContainer) return;

  const calendar = instance.calendarContainer;
  const monthRow = calendar.querySelector(".flatpickr-current-month");
  const yearWrapper = calendar.querySelector(".numInputWrapper");
  const yearInput = calendar.querySelector("input.cur-year");
  if (!monthRow || !yearWrapper || !yearInput) return;

  let yearSelect = calendar.querySelector("select.flatpickr-yearDropdown");
  if (!yearSelect) {
    yearSelect = document.createElement("select");
    yearSelect.className = "flatpickr-yearDropdown";
    monthRow.appendChild(yearSelect);
  }

  const parsedMin = instance.config?.minDate ? new Date(instance.config.minDate) : null;
  const parsedMax = instance.config?.maxDate ? new Date(instance.config.maxDate) : null;
  const nowYear = new Date().getFullYear();

  const minYear = parsedMin && !Number.isNaN(parsedMin.getTime())
    ? parsedMin.getFullYear()
    : (nowYear - 30);
  const maxAllowedByConfig = parsedMax && !Number.isNaN(parsedMax.getTime())
    ? parsedMax.getFullYear()
    : nowYear;
  const topYear = Math.min(nowYear, maxAllowedByConfig);
  const bottomYear = Math.min(topYear, minYear);

  const currentYearClamped = Math.min(instance.currentYear, topYear);
  const currentValue = String(currentYearClamped);
  const existingOptions = Array.from(yearSelect.options).map((opt) => opt.value);
  const expectedCount = Math.max(0, topYear - bottomYear + 1);

  if (existingOptions.length !== expectedCount || !existingOptions.includes(currentValue)) {
    yearSelect.innerHTML = "";
    for (let y = topYear; y >= bottomYear; y -= 1) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }
  }

  yearSelect.value = currentValue;
  yearSelect.onchange = () => {
    const selectedYear = Number(yearSelect.value);
    if (!Number.isInteger(selectedYear)) return;
    instance.changeYear(selectedYear);
    instance.redraw();
  };

  calendar.classList.add("year-dropdown-ready");
}

function updateStatsRangeInputsFromDates(selectedDates) {
  const from = selectedDates[0] || null;
  const to = selectedDates[1] || null;
  if (el.statsCustomFrom) {
    el.statsCustomFrom.value = formatDateForInput(from);
  }
  if (el.statsCustomTo) {
    el.statsCustomTo.value = formatDateForInput(to);
  }
}

function initStatsRangePicker() {
  if (!el.statsCustomRangePicker) return;

  if (typeof window.flatpickr !== "function") {
    if (el.statsCustomRangeLegacy) {
      el.statsCustomRangeLegacy.hidden = false;
    }
    if (el.statsCustomRange && el.statsPeriodSelect) {
      el.statsCustomRange.hidden = el.statsPeriodSelect.value !== "custom";
    }
    return;
  }

  if (el.statsCustomRangeLegacy) {
    el.statsCustomRangeLegacy.hidden = true;
  }
  if (el.statsCustomRange) {
    el.statsCustomRange.hidden = true;
  }

  const defaultDates = [];
  const fromRaw = String(el.statsCustomFrom?.value || "").trim();
  const toRaw = String(el.statsCustomTo?.value || "").trim();
  if (fromRaw) defaultDates.push(fromRaw);
  if (toRaw) defaultDates.push(toRaw);

  window.flatpickr(el.statsCustomRangePicker, {
    mode: "range",
    monthSelectorType: "dropdown",
    dateFormat: "Y-m-d",
    disableMobile: true,
    allowInput: false,
    position: "auto center",
    appendTo: document.body,
    positionElement: el.statsPeriodToggleBtn || undefined,
    defaultDate: defaultDates.length ? defaultDates : undefined,
    locale: {
      rangeSeparator: " → ",
    },
    onReady(_selectedDates, _dateStr, instance) {
      ensureFlatpickrYearDropdown(instance);
    },
    onOpen(_selectedDates, _dateStr, instance) {
      ensureFlatpickrYearDropdown(instance);
    },
    onYearChange(_selectedDates, _dateStr, instance) {
      ensureFlatpickrYearDropdown(instance);
    },
    onMonthChange(_selectedDates, _dateStr, instance) {
      ensureFlatpickrYearDropdown(instance);
    },
    onChange(selectedDates) {
      updateStatsRangeInputsFromDates(selectedDates);
      updateStatsPeriodButtonLabel();
      if (selectedDates.length === 2) {
        refreshStatsForSelectedPeriod();
      }
    },
    onClose(selectedDates) {
      if (selectedDates.length === 0) {
        updateStatsRangeInputsFromDates([]);
        updateStatsPeriodButtonLabel();
        refreshStatsForSelectedPeriod();
      }
    },
  });

  syncStatsRangePickerFromInputs();
}

function setChartVisibility(mode = "", options = {}) {
  state.stats.activeChart = mode;
  if (!el.chartGrid) return;
  el.chartGrid.hidden = false;

  let targetCard = null;

  if (el.purchasesChart) {
    const card = el.purchasesChart.closest(".chart-card");
    if (card) {
      card.hidden = false;
      if (mode === "purchases") {
        targetCard = card;
      }
    }
  }
  if (el.revenueChart) {
    const card = el.revenueChart.closest(".chart-card");
    if (card) {
      card.hidden = false;
      if (mode === "revenue") {
        targetCard = card;
      }
    }
  }
  if (el.temperatureChart) {
    const card = el.temperatureChart.closest(".chart-card");
    if (card) {
      card.hidden = false;
      if (mode === "temperature") {
        targetCard = card;
      }
    }
  }

  if (Boolean(options?.scroll) && targetCard) {
    window.requestAnimationFrame(() => {
      targetCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}

function openColorPickerModal() {
  const input = el.colorPicker;
  const r = Number(el.colorR.value);
  const g = Number(el.colorG.value);
  const b = Number(el.colorB.value);
  const currentHex = [r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ? `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
    : (el.colorPicker?.value || "#ffffff");
  if (input) {
    input.value = currentHex;
    openNativeColorPicker(input);
  }
}

function blurAuthFieldsIfFocused() {
  const active = document.activeElement;
  if ((active === el.authEmail || active === el.authPassword) && typeof active?.blur === "function") {
    active.blur();
  }
}

function scheduleAuthFieldBlur() {
  const delays = [0, 120, 320, 800];
  window.requestAnimationFrame(blurAuthFieldsIfFocused);
  delays.forEach((delay) => {
    window.setTimeout(blurAuthFieldsIfFocused, delay);
  });
}

function blurActiveAuthFieldOnInit() {
  scheduleAuthFieldBlur();
}

function getSignedInUserLabel() {
  const selected = state.users.find((u) => Number(u.user_id) === Number(state.selectedUserId));
  if (!selected) return state.auth.email || "-";
  return [selected.name, selected.surname].map((x) => String(x || "").trim()).filter(Boolean).join(" ") || state.auth.email || "-";
}

function formatUserFullName(name, surname) {
  const parts = [name, surname]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : "";
}

function setAuthLayoutVisible(isAuthenticated) {
  document.body.classList.toggle("app-authenticated", isAuthenticated);
  if (el.signInCard) {
    el.signInCard.hidden = isAuthenticated;
  }
  if (el.sessionCard) {
    el.sessionCard.hidden = !isAuthenticated;
  }

  const authOnlyBlocks = Array.from(document.querySelectorAll(".auth-only"));
  authOnlyBlocks.forEach((node) => {
    node.hidden = !isAuthenticated;
  });

  if (el.signedInUser) {
    el.signedInUser.value = isAuthenticated ? getSignedInUserLabel() : "-";
  }

  if (el.mobileQuickNav) {
    el.mobileQuickNav.hidden = !isAuthenticated;
  }

  if (!isAuthenticated) {
    state.ui.activeView = "service";
    closeLockerCommands();
    closeTemperatureModal();
    scheduleAuthFieldBlur();
  } else {
    setActiveView(state.ui.activeView);
  }
}

function setActiveView(viewName, options = {}) {
  const normalized = ["service", "settings", "stats"].includes(viewName) ? viewName : "service";
  state.ui.activeView = normalized;
  closeTemperatureModal();

  [el.serviceView, el.settingsView, el.statsView].filter(Boolean).forEach((panel) => {
    const isActive = panel.dataset.view === normalized;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });

  [el.quickNavServiceBtn, el.quickNavSettingsBtn, el.quickNavStatsBtn].filter(Boolean).forEach((button) => {
    const isActive = button.dataset.viewTarget === normalized;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  if (normalized !== "service") {
    closeLockerCommands();
  }

  if (el.appViews) {
    el.appViews.scrollTop = 0;
  }

  if (normalized === "stats") {
    window.requestAnimationFrame(() => {
      state.chartRenderSignature = "";
      state.latestRenderedStatsSignature = "";
      applyAdminStatsView();
    });
  }

  if (options.focus) {
    document.querySelector(`[data-view-target="${normalized}"]`)?.focus();
  }
}

function openLockerCommands() {
  if (!getSelectedLocker() || !el.lockerCommandsSheet) return;
  state.ui.lightingCollapsed = true;
  syncCollapsibleUi();
  state.ui.lockerCommandsOpen = true;
  el.lockerCommandsSheet.hidden = false;
  if (el.lockerSheetBackdrop) el.lockerSheetBackdrop.hidden = false;
  document.body.classList.add("locker-sheet-open");
  window.requestAnimationFrame(() => {
    el.closeLockerCommandsBtn?.focus({ preventScroll: true });
  });
}

function closeLockerCommands() {
  state.ui.lockerCommandsOpen = false;
  if (el.lockerCommandsSheet) el.lockerCommandsSheet.hidden = true;
  if (el.lockerSheetBackdrop) el.lockerSheetBackdrop.hidden = true;
  document.body.classList.remove("locker-sheet-open");
}

function parseDateMaybe(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasExplicitTimezone = /(?:Z|[+\-]\d{2}:?\d{2})$/i.test(raw);
  const looksLikeNaiveIsoDateTime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/.test(raw);
  const normalized = !hasExplicitTimezone && looksLikeNaiveIsoDateTime
    ? `${raw.replace(" ", "T")}Z`
    : raw;

  const dt = new Date(normalized);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function getCurrentMachineCode() {
  return String(getCurrentMachine()?.machine_code || "").trim().toUpperCase();
}

function getTemperatureSensorLabel(sensorId) {
  if (/^M0*2$/.test(getCurrentMachineCode())) {
    const meaning = ({ 1: "Automat", 2: "E-box", 3: "Outside" })[sensorId];
    return meaning ? `Sensor ${sensorId} — ${meaning}` : `Sensor ${sensorId}`;
  }
  return `Sensor ${sensorId}`;
}

function syncClimateSensorButtons() {
  if (!el.climateSensorButtons) return;
  const selectedSensorId = Number(state.stats.climateSensorId) || 1;
  el.climateSensorButtons.querySelectorAll("[data-climate-sensor]").forEach((button) => {
    const sensorId = Number(button.dataset.climateSensor);
    const fullLabel = getTemperatureSensorLabel(sensorId);
    button.textContent = `S${sensorId}`;
    button.title = fullLabel;
    button.setAttribute("aria-label", fullLabel);
    const isActive = sensorId === selectedSensorId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getLatestClimateReading(sensorId) {
  const matching = (state.latestClimatePreview || [])
    .filter((entry) => Number(entry.sensor_id) === sensorId)
    .slice()
    .sort((a, b) => {
      const aTime = parseDateMaybe(getClimateLogTime(a))?.getTime() || 0;
      const bTime = parseDateMaybe(getClimateLogTime(b))?.getTime() || 0;
      return bTime - aTime;
    });
  return matching[0] || null;
}

function renderTemperatureReadings() {
  if (!el.temperatureReadings) return;
  const machineCode = getCurrentMachineCode();
  if (el.temperatureMachineText) {
    el.temperatureMachineText.textContent = machineCode
      ? `${machineCode} · current sensor readings`
      : "Current sensor readings";
  }

  el.temperatureReadings.innerHTML = "";
  [1, 2, 3].forEach((sensorId) => {
    const reading = getLatestClimateReading(sensorId);
    const readingTemperature = reading?.temperature;
    let rawTemperature = readingTemperature === null || readingTemperature === undefined || readingTemperature === ""
      ? NaN
      : Number(readingTemperature);
    if (sensorId === 1 && !Number.isFinite(rawTemperature)) {
      rawTemperature = Number(state.machineStatus?.current_temperature);
    }

    const row = document.createElement("div");
    row.className = "temperature-reading";

    const identity = document.createElement("div");
    identity.className = "temperature-reading-identity";
    identity.innerHTML = `<span class="temperature-sensor-number">${sensorId}</span><span class="temperature-sensor-name"></span>`;
    identity.querySelector(".temperature-sensor-name").textContent = getTemperatureSensorLabel(sensorId);

    const value = document.createElement("strong");
    value.className = "temperature-reading-value";
    value.textContent = Number.isFinite(rawTemperature) ? `${rawTemperature.toFixed(1)} °C` : "–";

    row.appendChild(identity);
    row.appendChild(value);
    el.temperatureReadings.appendChild(row);
  });
}

function openTemperatureModal() {
  if (!state.selectedMachineId || !el.temperatureModal) return;
  renderTemperatureReadings();
  state.ui.temperatureModalOpen = true;
  el.temperatureModal.hidden = false;
  window.requestAnimationFrame(() => {
    el.closeTemperatureModalBtn?.focus({ preventScroll: true });
  });
}

function closeTemperatureModal() {
  state.ui.temperatureModalOpen = false;
  if (el.temperatureModal) el.temperatureModal.hidden = true;
}

function updateTopMachineStrip() {
  const status = state.machineStatus;
  const rawTemp = status ? Number(status.current_temperature) : NaN;
  if (el.topCurrentTemperature) {
    el.topCurrentTemperature.textContent = Number.isFinite(rawTemp)
      ? `${rawTemp.toFixed(1)} °C`
      : "-";
    el.topCurrentTemperature.disabled = !state.selectedMachineId;
  }

  if (state.ui.temperatureModalOpen) renderTemperatureReadings();

  const beatValue = status ? (status.last_heartbeat || status.updated_at) : null;
  const beatDate = parseDateMaybe(beatValue);
  const now = Date.now();
  const maxDelayMs = 10 * 60 * 1000;
  const toleratedFutureSkewMs = 2 * 60 * 1000;
  const beatAgeMs = beatDate ? (now - beatDate.getTime()) : Number.POSITIVE_INFINITY;
  const isFresh = Boolean(beatDate && beatAgeMs <= maxDelayMs && beatAgeMs >= -toleratedFutureSkewMs);

  if (el.topHeartbeatDot) {
    el.topHeartbeatDot.classList.remove("heartbeat-ok", "heartbeat-bad", "heartbeat-unknown");
    el.topHeartbeatDot.classList.add(beatDate ? (isFresh ? "heartbeat-ok" : "heartbeat-bad") : "heartbeat-unknown");
  }

  if (el.topHeartbeatText) {
    el.topHeartbeatText.textContent = "";
  }
}

function setCollapseState(blockEl, contentEl, collapsed) {
  if (!blockEl || !contentEl) return;
  blockEl.classList.toggle("collapsed", collapsed);
  contentEl.hidden = collapsed;
}

function syncCollapsibleUi() {
  setCollapseState(el.lightingModesBlock, el.lightingModesContent, state.ui.lightingCollapsed);
  setCollapseState(el.machineCommandsBlock, el.machineCommandsContent, state.ui.machineCommandsCollapsed);
  setCollapseState(el.adminStatsDetails, el.climateDetailsContent, state.ui.climateCollapsed);
}

function normalizeLockerLabel(lockerNumberOrId) {
  if (lockerNumberOrId === null || lockerNumberOrId === undefined || lockerNumberOrId === "") return "-";
  return `Locker ${lockerNumberOrId}`;
}

function getCanvasDisplaySize(canvas, minWidth, minHeight) {
  const rect = canvas.getBoundingClientRect();
  const fallbackWidth = Number(canvas.getAttribute("width")) || canvas.clientWidth || minWidth;
  const fallbackHeight = Number(canvas.getAttribute("height")) || canvas.clientHeight || minHeight;
  const width = Math.max(minWidth, Math.floor(rect.width || fallbackWidth || minWidth));
  const height = Math.max(minHeight, Math.floor(rect.height || fallbackHeight || minHeight));
  return { width, height };
}

function drawSimpleBars(canvas, labels, values, color, suffix = "") {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const { width, height } = getCanvasDisplaySize(canvas, 320, 150);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = 28;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const maxValue = Math.max(1, ...values.map((v) => Number(v) || 0));
  const barCount = Math.max(1, values.length);
  const gap = 10;
  const barW = Math.max(10, (chartW - gap * (barCount - 1)) / barCount);

  ctx.strokeStyle = "#d9e0ec";
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + chartH);
  ctx.lineTo(pad + chartW, pad + chartH);
  ctx.stroke();

  const bars = [];
  values.forEach((raw, idx) => {
    const v = Math.max(0, Number(raw) || 0);
    const h = (v / maxValue) * (chartH - 8);
    const x = pad + idx * (barW + gap);
    const y = pad + chartH - h;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = "#1f2d46";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(`${v}${suffix}`, x + barW / 2, y - 4);

    const label = String(labels[idx] || "").slice(0, 8);
    ctx.fillStyle = "#60708d";
    ctx.fillText(label, x + barW / 2, pad + chartH + 14);

    bars.push({ x, y, width: barW, height: h, index: idx });
  });

  return { bars, width, height };
}

function drawSimpleLine(canvas, labels, values, color, suffix = "", options = {}) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const { width, height } = getCanvasDisplaySize(canvas, 320, 170);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const isNarrowChart = width <= 480;
  const padLeft = 48;
  const padRight = 16;
  const padTop = 24;
  const padBottom = isNarrowChart ? 62 : 42;
  const chartW = Math.max(10, width - padLeft - padRight);
  const chartH = Math.max(10, height - padTop - padBottom);

  const allowNegative = Boolean(options.allowNegative);
  const decimals = Number.isInteger(Number(options.decimals)) ? Number(options.decimals) : 2;
  const nums = values.map((value) => {
    const parsed = Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : 0;
    return allowNegative ? numeric : Math.max(0, numeric);
  });
  let minValue = allowNegative && nums.length ? Math.min(...nums) : 0;
  let maxValue = nums.length ? Math.max(...nums) : 1;
  if (!allowNegative) maxValue = Math.max(1, maxValue);
  if (maxValue === minValue) {
    minValue -= 1;
    maxValue += 1;
  }
  const valueRange = Math.max(1, maxValue - minValue);
  const count = Math.max(1, nums.length);
  const stepX = count > 1 ? chartW / (count - 1) : 0;

  ctx.strokeStyle = "#d9e0ec";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + chartH);
  ctx.lineTo(padLeft + chartW, padTop + chartH);
  ctx.stroke();

  ctx.fillStyle = "#60708d";
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "right";
  ctx.fillText(String(maxValue.toFixed(decimals)), padLeft - 6, padTop + 4);
  ctx.fillText(String(minValue.toFixed(decimals)), padLeft - 6, padTop + chartH);

  ctx.textAlign = "left";
  ctx.fillText(String(options.yLabel || "Revenue"), 8, 14);

  if (!nums.length) {
    ctx.fillStyle = "#54637e";
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("No data", padLeft + chartW / 2, padTop + chartH / 2);
    return { bars: [], width, height, points: [] };
  }

  const points = nums.map((v, idx) => {
    const x = padLeft + idx * stepX;
    const y = padTop + chartH - ((v - minValue) / valueRange) * (chartH - 8);
    return { x, y, value: v, index: idx };
  });

  const truncatedLabels = labels.map((x) => String(x || "").slice(0, 10));
  ctx.font = "11px Segoe UI";
  const labelWidths = truncatedLabels.map((txt) => ctx.measureText(txt).width);
  const maxLabelWidth = Math.max(0, ...labelWidths);
  const minTickSpacing = isNarrowChart
    ? Math.max(70, Math.ceil(maxLabelWidth + 24))
    : Math.max(48, Math.ceil(maxLabelWidth + 14));
  const maxTickCount = Math.max(2, Math.floor(chartW / minTickSpacing));
  const labelStep = Math.max(1, Math.ceil(points.length / maxTickCount));

  const labelBoundsForIndex = (idx) => {
    const textW = labelWidths[idx] || 0;
    let left = points[idx].x - textW / 2;
    let right = points[idx].x + textW / 2;
    const hardLeft = padLeft + 2;
    const hardRight = padLeft + chartW - 2;
    if (left < hardLeft) {
      right += hardLeft - left;
      left = hardLeft;
    }
    if (right > hardRight) {
      left -= right - hardRight;
      right = hardRight;
    }
    return { left, right };
  };

  const candidateLabelIndexes = [];
  for (let idx = 0; idx < points.length; idx += 1) {
    if (idx === 0 || idx === points.length - 1 || idx % labelStep === 0) {
      candidateLabelIndexes.push(idx);
    }
  }

  const visibleLabelIndexes = [];
  const minLabelGap = isNarrowChart ? 10 : 6;
  candidateLabelIndexes.forEach((idx) => {
    if (!visibleLabelIndexes.length) {
      visibleLabelIndexes.push(idx);
      return;
    }

    const prevIdx = visibleLabelIndexes[visibleLabelIndexes.length - 1];
    const prevBounds = labelBoundsForIndex(prevIdx);
    const currBounds = labelBoundsForIndex(idx);
    const overlapsPrev = currBounds.left < (prevBounds.right + minLabelGap);

    if (!overlapsPrev) {
      visibleLabelIndexes.push(idx);
      return;
    }

    const isLast = idx === points.length - 1;
    if (!isLast || visibleLabelIndexes.length < 2) {
      return;
    }

    const prevPrevIdx = visibleLabelIndexes[visibleLabelIndexes.length - 2];
    const prevPrevBounds = labelBoundsForIndex(prevPrevIdx);
    if (currBounds.left >= (prevPrevBounds.right + minLabelGap)) {
      visibleLabelIndexes.pop();
      visibleLabelIndexes.push(idx);
    }
  });

  if (points.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  points.forEach((p, idx) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (idx === 0) return;
    if (idx === points.length - 1) return;
  });

  let globalMaxIdx = 0;
  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] > nums[globalMaxIdx]) {
      globalMaxIdx = i;
    }
  }

  const peakCandidates = [];
  if (nums.length === 1) {
    peakCandidates.push(0);
  } else {
    for (let i = 0; i < nums.length; i += 1) {
      const value = nums[i];
      const prev = i > 0 ? nums[i - 1] : Number.NEGATIVE_INFINITY;
      const next = i < nums.length - 1 ? nums[i + 1] : Number.NEGATIVE_INFINITY;
      const isBoundaryPeak = (i === 0 && value > next) || (i === nums.length - 1 && value > prev);
      const isLocalPeak = i > 0 && i < nums.length - 1
        && (value >= prev && value >= next)
        && (value > prev || value > next);
      if (isBoundaryPeak || isLocalPeak) {
        peakCandidates.push(i);
      }
    }
  }

  if (!peakCandidates.includes(globalMaxIdx)) {
    peakCandidates.push(globalMaxIdx);
  }

  const maxPeakLabels = isNarrowChart ? 4 : 6;
  const minPeakDx = isNarrowChart ? 46 : 36;
  const chosenPeakIndexes = [];
  peakCandidates
    .slice()
    .sort((a, b) => {
      const delta = nums[b] - nums[a];
      if (delta !== 0) return delta;
      return a - b;
    })
    .forEach((idx) => {
      if (chosenPeakIndexes.length >= maxPeakLabels) return;
      const tooClose = chosenPeakIndexes.some((otherIdx) => {
        const dx = Math.abs(points[otherIdx].x - points[idx].x);
        const dy = Math.abs(points[otherIdx].y - points[idx].y);
        return dx < minPeakDx && dy < 18;
      });
      if (!tooClose) {
        chosenPeakIndexes.push(idx);
      }
    });

  if (!chosenPeakIndexes.includes(globalMaxIdx)) {
    if (chosenPeakIndexes.length >= maxPeakLabels) {
      chosenPeakIndexes.pop();
    }
    chosenPeakIndexes.push(globalMaxIdx);
  }

  const pointSuffix = suffix || "€";
  const formatPointLabel = (value) => `${Number(value || 0).toFixed(decimals)}${pointSuffix}`;
  ctx.font = isNarrowChart ? "10px Segoe UI" : "11px Segoe UI";
  ctx.textAlign = "center";
  chosenPeakIndexes
    .slice()
    .sort((a, b) => a - b)
    .forEach((idx) => {
      const p = points[idx];
      const label = formatPointLabel(p.value);
      const y = Math.max(padTop + 10, p.y - 10);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.96)";
      ctx.strokeText(label, p.x, y);
      ctx.fillStyle = "#1f2d46";
      ctx.fillText(label, p.x, y);
    });

  ctx.fillStyle = "#60708d";
  ctx.font = "11px Segoe UI";
  visibleLabelIndexes.forEach((idx) => {
    const label = truncatedLabels[idx] || "";
    if (!label) return;
    if (isNarrowChart) {
      ctx.save();
      ctx.translate(points[idx].x, padTop + chartH + 22);
      ctx.rotate(-Math.PI / 6);
      ctx.textAlign = "right";
      ctx.fillText(label, 0, 0);
      ctx.restore();
      return;
    }
    ctx.textAlign = "center";
    ctx.fillText(label, points[idx].x, padTop + chartH + 16);
  });

  ctx.fillStyle = "#60708d";
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText("Time", padLeft + chartW / 2, height - 6);

  const hit = points.map((p) => ({
    x: p.x - 8,
    y: p.y - 8,
    width: 16,
    height: 16,
    index: p.index,
  }));

  return { bars: hit, width, height, points };
}

function buildBucketKey(dt, bucketType = "day") {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
  if (bucketType === "hour") {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:00`;
  }
  if (bucketType === "week") {
    const day = new Date(dt);
    const dayOfWeek = (day.getDay() + 6) % 7;
    day.setDate(day.getDate() - dayOfWeek);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }
  if (bucketType === "month") {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }
  return dt.toISOString().slice(0, 10);
}

function bucketByDate(logs, valueSelector, options = {}) {
  const mode = String(options.mode || "auto");
  const aggregation = String(options.aggregation || "sum");
  const dateSelector = typeof options.dateSelector === "function"
    ? options.dateSelector
    : (item) => item.purchased_at || item.created_at || item.timestamp;
  const byDay = new Map();
  const withDate = [];
  logs.forEach((item) => {
    const dt = parseDateMaybe(dateSelector(item));
    if (!dt) return;
    withDate.push({ item, dt });
  });

  if (!withDate.length) {
    return { keys: [], labels: [], values: [] };
  }

  withDate.sort((a, b) => a.dt.getTime() - b.dt.getTime());
  const minT = withDate[0].dt.getTime();
  const maxT = withDate[withDate.length - 1].dt.getTime();
  const spanMs = Math.max(1, maxT - minT);
  const oneDay = 24 * 60 * 60 * 1000;

  let bucketType = "day";
  if (mode === "line") {
    if (spanMs <= 2 * oneDay) bucketType = "hour";
    else if (spanMs <= 45 * oneDay) bucketType = "day";
    else if (spanMs <= 400 * oneDay) bucketType = "week";
    else bucketType = "month";
  }

  withDate.forEach(({ item, dt }) => {
    const key = buildBucketKey(dt, bucketType);
    const value = Number(valueSelector(item));
    const numericValue = Number.isFinite(value) ? value : 0;
    if (aggregation === "average") {
      const current = byDay.get(key) || { sum: 0, count: 0 };
      current.sum += numericValue;
      current.count += 1;
      byDay.set(key, current);
    } else {
      byDay.set(key, (byDay.get(key) || 0) + numericValue);
    }
  });

  const entries = Array.from(byDay.entries())
    .map(([key, value]) => {
      if (aggregation === "average") {
        return [key, value.count ? value.sum / value.count : 0];
      }
      return [key, value];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
  const tail = options.includeAllBuckets
    ? entries
    : (mode === "line" ? entries.slice(-24) : entries.slice(-10));

  const labels = tail.map(([k]) => {
    if (bucketType === "hour") return k.slice(11, 16);
    if (bucketType === "month") return k;
    return k.slice(5);
  });

  return {
    keys: tail.map(([k]) => k),
    labels,
    values: tail.map(([, v]) => Number(v.toFixed ? v.toFixed(2) : v)),
    bucketType,
  };
}

function setPurchaseLogsByBucket(bucketKey, bucketType = "day") {
  const all = state.latestStatsRaw.purchases || [];
  const filtered = all.filter((p) => {
    const dt = parseDateMaybe(p.purchased_at || p.created_at);
    return dt && buildBucketKey(dt, bucketType) === bucketKey;
  });
  renderPurchaseLogs(filtered);
  setStatus(`Showing ${filtered.length} purchases for ${bucketKey}.`, true);
}

function setPurchaseLogsByLocker(lockerKey) {
  const period = String(el.statsPeriodSelect?.value || "this_month");
  const inPeriod = dateFilterForPeriod(period);
  const all = (state.latestStatsRaw.purchases || [])
    .filter((purchase) => inPeriod(purchase.purchased_at || purchase.created_at));
  const key = String(lockerKey || "").trim();
  if (!key) {
    renderPurchaseLogs(all);
    setStatus(`Showing ${all.length} purchases.`, true);
    return;
  }

  const filtered = all.filter((p) => {
    const lockerNumber = p.locker_number ?? p.locker_id;
    return String(lockerNumber) === key;
  });
  renderPurchaseLogs(filtered);
  setStatus(`Showing ${filtered.length} purchases for locker ${key}.`, true);
}

function bindCanvasPointClicks(canvas, chartMeta, dayKeys, onPick) {
  if (!canvas || !dayKeys?.length) return;
  canvas.onclick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let pickedIndex = -1;

    const bars = Array.isArray(chartMeta)
      ? chartMeta
      : (Array.isArray(chartMeta?.bars) ? chartMeta.bars : []);

    if (bars.length) {
      const picked = bars.find((bar) => {
        return x >= bar.x && x <= (bar.x + bar.width) && y >= bar.y && y <= (bar.y + bar.height);
      });
      if (picked && Number.isInteger(picked.index)) {
        pickedIndex = picked.index;
      }
    }

    if (pickedIndex < 0 && chartMeta && Array.isArray(chartMeta.slices)) {
      const dx = x - Number(chartMeta.cx || 0);
      const dy = y - Number(chartMeta.cy || 0);
      const radius = Number(chartMeta.radius || 0);
      const dist = Math.hypot(dx, dy);
      if (radius > 0 && dist <= radius) {
        const full = Math.PI * 2;
        const normalize = (a) => ((a % full) + full) % full;
        const angle = normalize(Math.atan2(dy, dx));
        const pickedSlice = chartMeta.slices.find((slice) => {
          const start = normalize(slice.start);
          const end = normalize(slice.end);
          if (end < start) {
            return angle >= start || angle <= end;
          }
          return angle >= start && angle <= end;
        });
        if (pickedSlice && Number.isInteger(pickedSlice.idx)) {
          pickedIndex = pickedSlice.idx;
        }
      }
    }

    if (pickedIndex < 0) return;
    const dayKey = dayKeys[pickedIndex];
    if (!dayKey) return;
    onPick(dayKey);
  };
}

function aggregateLockerRevenue(purchases) {
  const byLocker = new Map();
  (purchases || []).forEach((p) => {
    const lockerNumber = p.locker_number ?? p.locker_id;
    if (lockerNumber === null || lockerNumber === undefined || lockerNumber === "") return;
    const key = String(lockerNumber);
    const amount = Number(p.amount || 0);
    byLocker.set(key, (byLocker.get(key) || 0) + (Number.isFinite(amount) ? amount : 0));
  });

  const entries = Array.from(byLocker.entries())
    .map(([locker, revenue]) => ({ locker, revenue: Number(revenue.toFixed(2)) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    keys: entries.map((x) => x.locker),
    labels: entries.map((x) => `L${x.locker}`),
    values: entries.map((x) => x.revenue),
  };
}

function getStatsPeriodBounds(period) {
  const now = new Date();
  if (period === "all_time") return { start: null, end: null };

  let start = null;
  let end = now;
  if (period === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "yesterday") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  } else if (period === "last_7_days") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === "last_30_days") {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === "this_year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (period === "custom") {
    const fromRaw = String(el.statsCustomFrom?.value || "").trim();
    const toRaw = String(el.statsCustomTo?.value || "").trim();
    start = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null;
    end = toRaw ? new Date(`${toRaw}T23:59:59.999`) : null;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start, end };
}

function dateFilterForPeriod(period) {
  const { start, end } = getStatsPeriodBounds(period);

  return (value) => {
    const dt = parseDateMaybe(value);
    if (!dt) return false;
    if (start && dt < start) return false;
    if (end && dt > end) return false;
    return true;
  };
}

function formatClimateApiBoundary(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return value.toISOString().replace(/Z$/, "");
}

function buildClimateLogsPath(machineId, options = {}) {
  const period = String(el.statsPeriodSelect?.value || "this_month");
  const { start, end } = getStatsPeriodBounds(period);
  const limit = Math.max(1, Math.min(Number(options.limit) || CLIMATE_PAGE_SIZE, CLIMATE_PAGE_SIZE));
  const offset = Math.max(0, Number(options.offset) || 0);
  const params = new URLSearchParams({
    machine_id: String(machineId),
    all: "true",
    limit: String(limit),
    offset: String(offset),
  });
  if (start) params.set("from", formatClimateApiBoundary(start));
  if (end) params.set("to", formatClimateApiBoundary(end));
  return `/climate_logs?${params.toString()}`;
}

function buildPurchaseLogsPath(machineId, options = {}) {
  const period = String(el.statsPeriodSelect?.value || "this_month");
  const { start, end } = getStatsPeriodBounds(period);
  const limit = Math.max(1, Math.min(Number(options.limit) || PURCHASE_PAGE_SIZE, PURCHASE_PAGE_SIZE));
  const offset = Math.max(0, Number(options.offset) || 0);
  const params = new URLSearchParams({
    machine_id: String(machineId),
    all: "true",
    limit: String(limit),
    offset: String(offset),
  });
  if (start) params.set("from", formatClimateApiBoundary(start));
  if (end) params.set("to", formatClimateApiBoundary(end));
  return `/purchase_logs?${params.toString()}`;
}

function getClimateLogIdentity(entry) {
  const rowId = entry?.climate_log_id ?? entry?.id;
  if (rowId !== null && rowId !== undefined && rowId !== "") return `id:${rowId}`;
  return [
    entry?.machine_id ?? "",
    entry?.sensor_id ?? "",
    getClimateLogTime(entry) || "",
    entry?.temperature ?? "",
    entry?.humidity ?? "",
  ].join("|");
}

async function fetchAllClimateLogsForSelectedPeriod(machineId) {
  const climate = [];
  const seen = new Set();
  let offset = 0;

  for (let pageIndex = 0; pageIndex < MAX_CLIMATE_PAGES; pageIndex += 1) {
    const page = await api(buildClimateLogsPath(machineId, {
      limit: CLIMATE_PAGE_SIZE,
      offset,
    }));
    if (!Array.isArray(page)) {
      throw new Error("Climate API returned an invalid response.");
    }

    let added = 0;
    page.forEach((entry) => {
      const identity = getClimateLogIdentity(entry);
      if (seen.has(identity)) return;
      seen.add(identity);
      climate.push(entry);
      added += 1;
    });

    if (page.length < CLIMATE_PAGE_SIZE || added === 0) break;
    offset += page.length;
  }

  return climate;
}

function getPurchaseLogIdentity(entry) {
  const rowId = entry?.purchase_log_id ?? entry?.id;
  if (rowId !== null && rowId !== undefined && rowId !== "") return `id:${rowId}`;
  return [
    entry?.machine_id ?? "",
    entry?.locker_id ?? "",
    entry?.locker_number ?? "",
    entry?.purchased_at || entry?.created_at || "",
    entry?.amount ?? "",
  ].join("|");
}

async function fetchAllPurchaseLogsForSelectedPeriod(machineId) {
  const purchases = [];
  const seen = new Set();
  let offset = 0;

  for (let pageIndex = 0; pageIndex < MAX_PURCHASE_PAGES; pageIndex += 1) {
    const page = await api(buildPurchaseLogsPath(machineId, {
      limit: PURCHASE_PAGE_SIZE,
      offset,
    }));
    if (!Array.isArray(page)) {
      throw new Error("Purchase API returned an invalid response.");
    }

    let added = 0;
    page.forEach((entry) => {
      const identity = getPurchaseLogIdentity(entry);
      if (seen.has(identity)) return;
      seen.add(identity);
      purchases.push(entry);
      added += 1;
    });

    if (page.length < PURCHASE_PAGE_SIZE || added === 0) break;
    offset += page.length;
  }

  return purchases;
}

function csvEscape(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatCsvDateAndTime(value) {
  const dt = parseDateMaybe(value);
  if (!dt) {
    return { date: "", time: "" };
  }
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`,
  };
}

function getClimateLogTime(entry) {
  return entry?.logged_at || entry?.recorded_at || entry?.created_at;
}

function downloadPurchasesCsv() {
  if (!state.auth.isAuthenticated || state.selectedRole !== "admin") {
    setStatus("CSV download is available only for admin users.");
    return;
  }

  const period = String(el.statsPeriodSelect?.value || "this_month");
  const inPeriod = dateFilterForPeriod(period);
  const purchases = (state.latestStatsRaw.purchases || [])
    .filter((x) => inPeriod(x.purchased_at || x.created_at))
    .slice()
    .sort((a, b) => {
      const ta = parseDateMaybe(a.purchased_at || a.created_at)?.getTime() || 0;
      const tb = parseDateMaybe(b.purchased_at || b.created_at)?.getTime() || 0;
      return ta - tb;
    });

  if (!purchases.length) {
    setStatus("No purchases found for selected period.");
    return;
  }

  const rows = purchases.map((purchase) => {
    const lockerNumber = purchase.locker_number ?? purchase.locker_id ?? "";
    const { date, time } = formatCsvDateAndTime(purchase.purchased_at || purchase.created_at);
    const amount = Number(purchase.amount);
    const price = Number.isFinite(amount) ? amount.toFixed(2) : "";
    return [
      csvEscape(lockerNumber),
      csvEscape(date),
      csvEscape(time),
      csvEscape(price),
    ].join(",");
  });

  const csv = ["Locker number,Date,Time,Price", ...rows].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const periodSafe = period.replace(/[^a-z0-9_-]/gi, "_");
  const machineSafe = state.selectedMachineId ? `machine_${state.selectedMachineId}` : "machine";
  const filename = `purchases_${machineSafe}_${periodSafe}_${stamp}.csv`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);

  setStatus(`Downloaded CSV with ${purchases.length} purchases.`, true);
}

function downloadClimateCsv() {
  if (!state.auth.isAuthenticated || state.selectedRole !== "admin") {
    setStatus("CSV download is available only for admin users.");
    return;
  }

  const period = String(el.statsPeriodSelect?.value || "this_month");
  const inPeriod = dateFilterForPeriod(period);
  const selectedSensorId = Number(state.stats.climateSensorId) || 1;
  const climate = (state.latestStatsRaw.climate || [])
    .filter((x) => Number(x.sensor_id) === selectedSensorId)
    .filter((x) => inPeriod(getClimateLogTime(x)))
    .slice()
    .sort((a, b) => {
      const ta = parseDateMaybe(getClimateLogTime(a))?.getTime() || 0;
      const tb = parseDateMaybe(getClimateLogTime(b))?.getTime() || 0;
      return ta - tb;
    });

  if (!climate.length) {
    setStatus(`No climate logs found for selected period (sensor ${selectedSensorId}).`);
    return;
  }

  const rows = climate.map((entry) => {
    const { date, time } = formatCsvDateAndTime(getClimateLogTime(entry));
    const temperature = Number(entry.temperature);
    const humidity = Number(entry.humidity);
    const fanMode = Number(entry.fan_mode);
    const setTemp = Number(entry.set_temp);

    return [
      csvEscape(entry.climate_log_id ?? ""),
      csvEscape(entry.machine_id ?? ""),
      csvEscape(entry.sensor_id ?? ""),
      csvEscape(date),
      csvEscape(time),
      csvEscape(Number.isFinite(temperature) ? temperature.toFixed(2) : ""),
      csvEscape(Number.isFinite(humidity) ? humidity.toFixed(2) : ""),
      csvEscape(Number.isFinite(fanMode) ? String(fanMode) : ""),
      csvEscape(Number.isFinite(setTemp) ? setTemp.toFixed(2) : ""),
    ].join(",");
  });

  const csv = ["Climate log id,Machine id,Sensor id,Date,Time,Temperature,Humidity,Fan mode,Set temp", ...rows].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const periodSafe = period.replace(/[^a-z0-9_-]/gi, "_");
  const machineSafe = state.selectedMachineId ? `machine_${state.selectedMachineId}` : "machine";
  const filename = `climate_sensor${selectedSensorId}_${machineSafe}_${periodSafe}_${stamp}.csv`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);

  setStatus(`Downloaded CSV with ${climate.length} climate logs (sensor ${selectedSensorId}).`, true);
}

function applyAdminStatsView() {
  updateStatsPeriodButtonLabel();

  const period = (el.statsPeriodSelect?.value || "this_month");
  const inPeriod = dateFilterForPeriod(period);
  const selectedSensorId = Number(state.stats.climateSensorId) || 1;
  syncClimateSensorButtons();

  const purchases = (state.latestStatsRaw.purchases || []).filter((x) => inPeriod(x.purchased_at || x.created_at));
  const climateForPeriod = (state.latestStatsRaw.climate || []).filter((x) => inPeriod(getClimateLogTime(x)));
  const climate = climateForPeriod.filter((x) => Number(x.sensor_id) === selectedSensorId);

  renderPurchaseLogs(purchases);

  const signature = JSON.stringify({
    period,
    selectedSensorId,
    purchasesLen: purchases.length,
    climateLen: climate.length,
    purchasesTail: purchases.slice(-30).map((x) => [x.purchase_log_id || x.id || null, x.purchased_at || x.created_at || null, Number(x.amount || 0)]),
    climateTail: climate.slice(-30).map((x) => [x.climate_log_id || x.id || null, getClimateLogTime(x) || null, Number(x.temperature || 0), Number(x.humidity || 0)]),
  });
  if (state.chartRenderSignature === signature) {
    return;
  }
  state.chartRenderSignature = signature;

  const nextSignature = JSON.stringify({
    period,
    selectedSensorId,
    purchasesCount: purchases.length,
    climateCount: climate.length,
    purchaseTail: purchases.slice(-20).map((p) => [p.purchase_log_id || p.id || null, p.purchased_at || p.created_at || null, Number(p.amount || 0)]),
    climateTail: climate.slice(-20).map((c) => [c.climate_log_id || c.id || null, getClimateLogTime(c) || null, Number(c.temperature || 0), Number(c.humidity || 0)]),
  });

  if (state.latestRenderedStatsSignature && state.latestRenderedStatsSignature === nextSignature) {
    return;
  }
  state.latestRenderedStatsSignature = nextSignature;

  const totalRevenue = purchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  if (el.adminStats) {
    el.adminStats.innerHTML = "";
    if (state.stats.purchaseLoadError) {
      const errorMessage = document.createElement("p");
      errorMessage.className = "placeholder";
      errorMessage.textContent = state.stats.purchaseLoadError;
      el.adminStats.appendChild(errorMessage);
    }
    const rows = [
      {
        key: "purchases",
        label: "Purchases",
        value: String(purchases.length),
        chartMode: "purchases",
      },
      {
        key: "revenue_eur",
        label: "Revenue Eur",
        value: Number(totalRevenue.toFixed(2)).toFixed(2),
        chartMode: "revenue",
      },
    ];

    rows.forEach((rowDef) => {
      const row = document.createElement("div");
      row.className = "info-item";
      row.innerHTML = `<div class="info-label">${rowDef.label}</div><div class="info-value">${rowDef.value}</div>`;
      el.adminStats.appendChild(row);
    });
  }

  const temps = climate.map((c) => Number(c.temperature)).filter(Number.isFinite);
  const hums = climate.map((c) => Number(c.humidity)).filter(Number.isFinite);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const min = (arr) => (arr.length ? arr.reduce((lowest, value) => Math.min(lowest, value), arr[0]) : 0);
  const max = (arr) => (arr.length ? arr.reduce((highest, value) => Math.max(highest, value), arr[0]) : 0);

  renderInfoList(el.adminClimateStats, buildInfoEntriesFromObject({
    sensor: getTemperatureSensorLabel(selectedSensorId),
    climate_logs: climate.length,
    avg_temperature: Number(avg(temps).toFixed(2)),
    min_temperature: Number(min(temps).toFixed(2)),
    max_temperature: Number(max(temps).toFixed(2)),
    avg_humidity: Number(avg(hums).toFixed(2)),
    min_humidity: Number(min(hums).toFixed(2)),
    max_humidity: Number(max(hums).toFixed(2)),
  }), state.stats.climateLoadError || "No climate data for selected period.");

  const purchasesSeries = aggregateLockerRevenue(purchases);
  const purchasesMeta = drawSimplePie(el.purchasesChart, purchasesSeries.labels, purchasesSeries.values, "Revenue share by locker");

  const revenueSeries = bucketByDate(purchases, (x) => Number(x.amount || 0), { mode: "line" });
  const revenueMeta = drawSimpleLine(el.revenueChart, revenueSeries.labels, revenueSeries.values, "#2fa46b", "");

  const temperatureSeries = bucketByDate(
    climate.filter((entry) => Number.isFinite(Number(entry.temperature))),
    (entry) => Number(entry.temperature),
    {
      mode: "line",
      aggregation: "average",
      dateSelector: getClimateLogTime,
      includeAllBuckets: true,
    }
  );
  const sensorLabel = getTemperatureSensorLabel(selectedSensorId);
  if (el.temperatureChartTitle) {
    el.temperatureChartTitle.textContent = `${sensorLabel} temperature (°C)`;
  }
  drawSimpleLine(
    el.temperatureChart,
    temperatureSeries.labels,
    temperatureSeries.values,
    "#e07a35",
    "°C",
    { yLabel: "Temperature", decimals: 1, allowNegative: true }
  );

  const humiditySeries = bucketByDate(
    climate.filter((entry) => Number.isFinite(Number(entry.humidity))),
    (entry) => Number(entry.humidity),
    {
      mode: "line",
      aggregation: "average",
      dateSelector: getClimateLogTime,
      includeAllBuckets: true,
    }
  );
  if (el.humidityChartTitle) {
    el.humidityChartTitle.textContent = `${sensorLabel} humidity (%)`;
  }
  drawSimpleLine(
    el.humidityChart,
    humiditySeries.labels,
    humiditySeries.values,
    "#2f83c5",
    "%",
    { yLabel: "Humidity", decimals: 1 }
  );

  state.chartMeta.purchasesByDay = purchasesSeries.keys;
  state.chartMeta.revenueByDay = revenueSeries.keys;
  state.chartMeta.temperatureByTime = temperatureSeries.keys;
  state.chartMeta.humidityByTime = humiditySeries.keys;

  bindCanvasPointClicks(
    el.purchasesChart,
    purchasesMeta,
    purchasesSeries.keys,
    (lockerKey) => setPurchaseLogsByLocker(lockerKey)
  );

  bindCanvasPointClicks(
    el.revenueChart,
    revenueMeta,
    revenueSeries.keys,
    (dayKey) => setPurchaseLogsByBucket(dayKey, revenueSeries.bucketType || "day")
  );

  setChartVisibility(state.stats.activeChart || "revenue");
}

function drawSimplePie(canvas, labels, values, title = "") {
  if (!canvas || !canvas.getContext) return { slices: [] };
  const ctx = canvas.getContext("2d");
  if (!ctx) return { slices: [] };

  const dpr = window.devicePixelRatio || 1;
  const { width, height } = getCanvasDisplaySize(canvas, 280, 170);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const total = values.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  const cx = 90;
  const cy = Math.floor(height / 2);
  const radius = 56;
  const palette = ["#3f7edb", "#2ba56a", "#f29c3a", "#8b6de6", "#e05656", "#17a2b8", "#6c757d", "#f4c430", "#a05d56", "#20c997"];

  const slices = [];
  let angle = -Math.PI / 2;
  if (total <= 0) {
    ctx.fillStyle = "#e8edf7";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#54637e";
    ctx.font = "12px Segoe UI";
    ctx.fillText("No data", cx - 18, cy + 4);
    return { slices: [] };
  }

  const zipped = values
    .map((v, i) => ({ label: labels[i] || "-", value: Math.max(0, Number(v) || 0), idx: i }));

  zipped.forEach((entry) => {
    const v = entry.value;
    const share = v / total;
    const next = angle + share * Math.PI * 2;
    const color = palette[entry.idx % palette.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, next);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    slices.push({ idx: entry.idx, start: angle, end: next, value: v, label: entry.label || "-" });
    angle = next;
  });

  ctx.fillStyle = "#1f2d46";
  ctx.font = "12px Segoe UI";
  ctx.fillText(title, 18, 16);

  const legendX = 170;
  let legendY = 28;
  slices.slice(0, 6).forEach((slice, i) => {
    const color = palette[slice.idx % palette.length];
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY + i * 22, 10, 10);
    ctx.fillStyle = "#2a3f63";
    const pct = ((slice.value / total) * 100).toFixed(0);
    const txt = `${slice.label}: ${pct}%`;
    ctx.fillText(txt.slice(0, 22), legendX + 14, legendY + 9 + i * 22);
  });

  return { slices, cx, cy, radius };
}

function setAuthStatus(message, ok = false) {
  if (!el.authStatus) return;
  el.authStatus.textContent = message;
  el.authStatus.classList.remove("ok", "error");
  if (message) {
    el.authStatus.classList.add(ok ? "ok" : "error");
  }
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEYS.authIdToken);
  localStorage.removeItem(STORAGE_KEYS.authAccessToken);
  localStorage.removeItem(STORAGE_KEYS.authRefreshToken);
  localStorage.removeItem(STORAGE_KEYS.authExpiresAt);
  localStorage.removeItem("authPassword");
}

function rememberAuth(authResult, fallbackEmail = "") {
  const idToken = String(authResult?.IdToken || "");
  const accessToken = String(authResult?.AccessToken || "");
  const refreshTokenFromResult = String(authResult?.RefreshToken || "");
  const refreshToken = refreshTokenFromResult || state.auth.refreshToken || "";
  const expiresInSeconds = Number(authResult?.ExpiresIn || 3600);
  const expiresAt = Date.now() + Math.max(30, expiresInSeconds - 30) * 1000;

  const tokenEmail = (() => {
    try {
      const payloadRaw = idToken.split(".")[1] || "";
      const normalized = payloadRaw.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(normalized));
      return String(decoded?.email || "").trim();
    } catch {
      return "";
    }
  })();

  const email = tokenEmail || fallbackEmail || state.auth.email || "";

  state.auth.idToken = idToken;
  state.auth.accessToken = accessToken;
  state.auth.refreshToken = refreshToken;
  state.auth.expiresAt = expiresAt;
  state.auth.email = email;

  localStorage.setItem(STORAGE_KEYS.authIdToken, idToken);
  localStorage.setItem(STORAGE_KEYS.authAccessToken, accessToken);
  localStorage.setItem(STORAGE_KEYS.authRefreshToken, refreshToken);
  localStorage.setItem(STORAGE_KEYS.authExpiresAt, String(expiresAt));
  localStorage.setItem(STORAGE_KEYS.authEmail, email);
}

function resetAuthState() {
  state.auth.isAuthenticated = false;
  state.auth.idToken = "";
  state.auth.accessToken = "";
  state.auth.refreshToken = "";
  state.auth.expiresAt = 0;
  state.auth.email = "";
  state.auth.pendingChallenge = null;
}

function setNewPasswordChallengeVisible(visible) {
  if (!el.newPasswordBlock) return;
  el.newPasswordBlock.hidden = !visible;
  el.newPasswordBlock.classList.toggle("show", visible);

  if (!visible) {
    if (el.newPassword) el.newPassword.value = "";
    if (el.newPasswordConfirm) el.newPasswordConfirm.value = "";
  }
}

function cognitoEndpoint() {
  return `https://cognito-idp.${state.authConfig.region}.amazonaws.com/`;
}

async function cognitoRequest(target, payload) {
  const response = await fetch(cognitoEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || "Unknown Cognito error" };
  }

  if (!response.ok) {
    const msg = data?.message || data?.Message || data?.__type || `HTTP ${response.status}`;
    throw new Error(`Cognito auth failed: ${msg}`);
  }

  return data;
}

async function signInWithCognito(email, password) {
  const data = await cognitoRequest(
    "AWSCognitoIdentityProviderService.InitiateAuth",
    {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: state.authConfig.appClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }
  );

  if (data?.ChallengeName) {
    if (String(data.ChallengeName) === "NEW_PASSWORD_REQUIRED") {
      const username = String(data?.ChallengeParameters?.USER_ID_FOR_SRP || data?.ChallengeParameters?.USERNAME || email || "").trim();
      return {
        challengeName: "NEW_PASSWORD_REQUIRED",
        session: String(data?.Session || ""),
        username,
      };
    }
    throw new Error(`Cognito challenge not supported in this frontend: ${data.ChallengeName}`);
  }

  if (!data?.AuthenticationResult?.IdToken) {
    throw new Error("Cognito did not return IdToken.");
  }

  rememberAuth(data.AuthenticationResult, email);
  state.auth.isAuthenticated = true;
  state.auth.pendingChallenge = null;
  return { challengeName: null };
}

async function respondToNewPasswordChallenge(challenge, newPassword) {
  const payload = {
    ClientId: state.authConfig.appClientId,
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: challenge?.session || "",
    ChallengeResponses: {
      USERNAME: String(challenge?.username || challenge?.email || "").trim(),
      NEW_PASSWORD: newPassword,
    },
  };

  return cognitoRequest(
    "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
    payload
  );
}

async function refreshCognitoSession() {
  if (!state.auth.refreshToken || !state.authConfig.appClientId) {
    return false;
  }

  const data = await cognitoRequest(
    "AWSCognitoIdentityProviderService.InitiateAuth",
    {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: state.authConfig.appClientId,
      AuthParameters: {
        REFRESH_TOKEN: state.auth.refreshToken,
      },
    }
  );

  if (!data?.AuthenticationResult?.IdToken) {
    return false;
  }

  rememberAuth(data.AuthenticationResult, state.auth.email || localStorage.getItem(STORAGE_KEYS.authEmail) || "");
  state.auth.isAuthenticated = true;
  return true;
}

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

function lockerIsOpened(locker) {
  if (!locker || typeof locker !== "object") return false;
  if ("is_opened" in locker) return coerceBoolean(locker.is_opened);
  return coerceBoolean(locker.is_open);
}

function syncBusyUi() {
  const busy = state.activeCommandCount > 0;
  const canUseApp = state.auth.isAuthenticated;
  const staticButtons = [
    el.loadBtn,
    el.openLockerBtn,
    el.setPriceBtn,
    el.setColorBtn,
    el.setColorAllBtn,
    el.setTempBtn,
    el.toggleOpModeBtn,
    el.lightingToggleBtn,
    el.machineCommandsToggleBtn,
    el.toggleClimateDetailsBtn,
    el.downloadPurchasesCsvBtn,
    el.downloadClimateCsvBtn,
  ];

  staticButtons
    .filter(Boolean)
    .forEach((button) => {
      button.disabled = busy || !canUseApp;
    });

  if (el.userSelect) {
    el.userSelect.disabled = !canUseApp;
  }
  if (el.machineSelect) {
    el.machineSelect.disabled = !canUseApp || state.allowedMachines.length === 0;
  }

  if (el.signInBtn) {
    el.signInBtn.disabled = busy || !state.authConfig.enabled || canUseApp;
  }
  if (el.signOutBtn) {
    el.signOutBtn.disabled = !canUseApp;
  }
  if (el.setNewPasswordBtn) {
    const hasChallenge = Boolean(state.auth.pendingChallenge && state.auth.pendingChallenge.challengeName === "NEW_PASSWORD_REQUIRED");
    el.setNewPasswordBtn.disabled = busy || !hasChallenge || canUseApp;
  }

  const dynamicButtons = [
    ...(el.lockerGrid ? Array.from(el.lockerGrid.querySelectorAll("button")) : []),
    ...(el.lightingModeButtons ? Array.from(el.lightingModeButtons.querySelectorAll("button")) : []),
    ...(el.fanButtons ? Array.from(el.fanButtons.querySelectorAll("button")) : []),
    ...(el.headlightButtons ? Array.from(el.headlightButtons.querySelectorAll("button")) : []),
  ];

  dynamicButtons.forEach((button) => {
    button.disabled = busy || !canUseApp;
  });

  if (el.statsPeriodSelect) {
    el.statsPeriodSelect.disabled = busy || !canUseApp || state.selectedRole !== "admin";
  }

  if (el.statsPeriodMenu) {
    const disabled = busy || !canUseApp || state.selectedRole !== "admin";
    Array.from(el.statsPeriodMenu.querySelectorAll("button")).forEach((button) => {
      button.disabled = disabled;
    });
  }

  const customRangeEnabled = !busy
    && canUseApp
    && state.selectedRole === "admin";
  [el.statsCustomRangePicker, el.statsCustomFrom, el.statsCustomTo]
    .filter(Boolean)
    .forEach((input) => {
      input.disabled = !customRangeEnabled;
    });

  if (el.statsPeriodToggleBtn) {
    el.statsPeriodToggleBtn.disabled = busy || !canUseApp || state.selectedRole !== "admin";
  }
  if (el.downloadPurchasesCsvBtn) {
    el.downloadPurchasesCsvBtn.disabled = busy || !canUseApp || state.selectedRole !== "admin";
  }
  if (el.downloadClimateCsvBtn) {
    el.downloadClimateCsvBtn.disabled = busy || !canUseApp || state.selectedRole !== "admin";
  }
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

function hasFailedControl(key) {
  return state.failedControlKeys.has(key);
}

function setFailedControls(keys, failed) {
  const list = Array.isArray(keys) ? keys : [keys];
  list.forEach((key) => {
    if (!key) return;
    if (failed) {
      state.failedControlKeys.add(key);
    } else {
      state.failedControlKeys.delete(key);
    }
  });
  syncPendingControlUi();
}

function clearFailedControls() {
  if (state.failedControlKeys.size === 0) return;
  state.failedControlKeys.clear();
  syncPendingControlUi();
}

function syncPendingControlUi() {
  const pendingByButton = [
    [el.openLockerBtn, "openLocker"],
    [el.setPriceBtn, "setPrice"],
    [el.setColorBtn, "setColor"],
    [el.setColorAllBtn, "setColor"],
    [el.setTempBtn, "setTemp"],
  ];

  pendingByButton.forEach(([button, key]) => {
    if (!button) return;
    button.classList.toggle("pending", hasPendingControl(key));
    button.classList.toggle("failed", hasFailedControl(key));
  });

  if (el.lockerPrice) {
    el.lockerPrice.classList.toggle("failed", hasFailedControl("setPrice"));
  }

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

function computeVerificationActual(commandId, lockerId = null) {
  const selectedLocker = lockerId != null
    ? state.lockers.find((locker) => Number(locker.locker_id) === Number(lockerId)) || null
    : null;

  switch (commandId) {
    case COMMAND_IDS.OPEN_LOCKER:
      return selectedLocker ? lockerIsOpened(selectedLocker) : null;
    case COMMAND_IDS.SET_LOCKER_PRICE:
      return selectedLocker ? Number(selectedLocker.price) : null;
    case COMMAND_IDS.SET_LOCKER_COLOR:
      return selectedLocker
        ? {
          color_r: Number(selectedLocker.color_r),
          color_g: Number(selectedLocker.color_g),
          color_b: Number(selectedLocker.color_b),
        }
        : null;
    case COMMAND_IDS.SET_LIGHTING_MODE:
      return selectedLocker ? Number(selectedLocker.lighting_mode) : null;
    case COMMAND_IDS.SET_TEMPERATURE:
      return state.machineStatus ? Number(state.machineStatus.set_temperature) : null;
    case COMMAND_IDS.SET_FANS:
      return state.machineStatus ? Number(state.machineStatus.fan_mode) : null;
    case COMMAND_IDS.SET_OPERATION_MODE:
      return state.machineStatus ? coerceBoolean(state.machineStatus.op_mode) : null;
    case COMMAND_IDS.SET_HEAD_LIGHTS:
      return state.machineStatus ? Number(state.machineStatus.head_lights) : null;
    default:
      return null;
  }
}

function verificationMatchesExpected(actual, expected) {
  if (expected === undefined || expected === null) {
    return true;
  }

  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if (!actual || typeof actual !== "object") return false;
    return Object.keys(expected).every((key) => verificationMatchesExpected(actual[key], expected[key]));
  }

  if (typeof expected === "boolean") {
    return coerceBoolean(actual) === expected;
  }

  if (typeof expected === "number") {
    const actualNumber = Number(actual);
    if (!Number.isFinite(actualNumber)) return false;
    return Math.abs(actualNumber - expected) < 0.000001;
  }

  return String(actual) === String(expected);
}

function queueVerification(item) {
  state.pendingVerifications.push(item);
}

function pruneOptimisticSuccessfulRequests() {
  const now = Date.now();
  for (const [requestId, recordedAt] of state.optimisticSuccessfulRequestIds.entries()) {
    if (!requestId || !Number.isFinite(recordedAt) || (now - recordedAt) > OPTIMISTIC_ACTIVITY_SUCCESS_TTL_MS) {
      state.optimisticSuccessfulRequestIds.delete(requestId);
    }
  }
}

function markOptimisticSuccessfulRequest(requestId) {
  const token = String(requestId || "").trim();
  if (!token) return;
  pruneOptimisticSuccessfulRequests();
  state.optimisticSuccessfulRequestIds.set(token, Date.now());
}

function isOptimisticSuccessfulRequest(requestId) {
  const token = String(requestId || "").trim();
  if (!token) return false;
  pruneOptimisticSuccessfulRequests();
  return state.optimisticSuccessfulRequestIds.has(token);
}

async function processPendingVerifications() {
  if (!state.pendingVerifications.length) return;

  const queue = [...state.pendingVerifications];
  state.pendingVerifications = [];

  for (const item of queue) {
    const {
      commandId,
      params = {},
      lockerId = null,
      statusLabel = "Command",
      pendingKeys = [],
      attempts = 1,
      requestId = null,
    } = item;
    const keys = Array.isArray(pendingKeys) ? pendingKeys : [pendingKeys];
    const attemptCount = Number.isInteger(Number(attempts)) && Number(attempts) > 0
      ? Number(attempts)
      : 1;
    const expected = item.expected !== undefined ? item.expected : null;
    const actual = computeVerificationActual(commandId, lockerId);
    const success = verificationMatchesExpected(actual, expected);

    if (success) {
      markOptimisticSuccessfulRequest(requestId);
      setPendingControls(keys, false);
      setFailedControls(keys, false);
      scheduleDebouncedDashboardRefresh({
        delayMs: 0,
      });
      continue;
    }

    if (attemptCount >= MAX_VERIFICATION_SEND_ATTEMPTS) {
      if (commandId === COMMAND_IDS.SET_LOCKER_PRICE && lockerId != null) {
        state.pendingLockerPriceById.delete(lockerId);
      }
      if (commandId === COMMAND_IDS.SET_LOCKER_COLOR && lockerId != null) {
        state.pendingLockerColorById.delete(lockerId);
      }
      setFailedControls(keys, true);
      setPendingControls(keys, false);
      const label = keys.includes("setPrice") ? "Price" : statusLabel;
      setStatus(`${label} not confirmed after ${MAX_VERIFICATION_SEND_ATTEMPTS} tries.`, false);
      scheduleDebouncedDashboardRefresh({
        delayMs: getVerificationDelayMs(attemptCount + 1),
      });
      continue;
    }

    setStatus(`${statusLabel} mismatch detected. Retrying...`, true);

    let retryError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await publishMachineCommand(commandId, params, lockerId);
        retryError = null;
        break;
      } catch (error) {
        retryError = error;
        if (attempt < 2 && isRetryableCommandError(error)) {
          await sleep(250);
          continue;
        }
        break;
      }
    }

    if (retryError) {
      if (commandId === COMMAND_IDS.SET_LOCKER_PRICE && lockerId != null) {
        state.pendingLockerPriceById.delete(lockerId);
      }
      if (commandId === COMMAND_IDS.SET_LOCKER_COLOR && lockerId != null) {
        state.pendingLockerColorById.delete(lockerId);
      }
      setFailedControls(keys, true);
      setPendingControls(keys, false);
      setStatus(`${statusLabel} retry failed: ${retryError.message}`, false);
      scheduleDebouncedDashboardRefresh({
        delayMs: getVerificationDelayMs(attemptCount + 1),
      });
      continue;
    }

    const nextAttemptCount = attemptCount + 1;
    queueVerification({
      ...item,
      attempts: nextAttemptCount,
    });
    scheduleDebouncedDashboardRefresh({
      delayMs: getVerificationDelayMs(nextAttemptCount),
    });
  }
}

function getVerificationDelayMs(attemptNumber = 1) {
  const parsed = Number(attemptNumber);
  const index = Number.isInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
  const value = VERIFICATION_REFRESH_DELAYS_MS[index];
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  const last = VERIFICATION_REFRESH_DELAYS_MS[VERIFICATION_REFRESH_DELAYS_MS.length - 1];
  if (Number.isFinite(last) && last >= 0) {
    return last;
  }

  return state.dbRefreshDebounceMs;
}

function scheduleDebouncedDashboardRefresh(options = {}) {
  const requestedDelay = Number(options.delayMs);
  const delayMs = Number.isFinite(requestedDelay) && requestedDelay >= 0
    ? requestedDelay
    : state.dbRefreshDebounceMs;
  const clearPendingKeys = Array.isArray(options.clearPendingKeys) ? options.clearPendingKeys : null;

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
      if (clearPendingKeys && clearPendingKeys.length) {
        setPendingControls(clearPendingKeys, false);
      }
    }
  }, delayMs);
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
    "is_opened",
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

function getUserDisplayName(userId, explicitName = "", explicitSurname = "") {
  const explicit = formatUserFullName(explicitName, explicitSurname);
  if (explicit) return explicit;

  if (!Number.isInteger(Number(userId))) return "System";
  const numericUserId = Number(userId);
  const user = state.users.find((item) => Number(item.user_id) === numericUserId);
  if (!user) return "Unknown user";

  return formatUserFullName(user.name, user.surname) || "Unknown user";
}

function splitDisplayName(name) {
  const clean = String(name || "").trim();
  if (!clean) return { first: "System", last: "" };
  const chunks = clean.split(/\s+/);
  if (chunks.length === 1) return { first: chunks[0], last: "" };
  return {
    first: chunks.slice(0, -1).join(" "),
    last: chunks[chunks.length - 1],
  };
}

function formatCommandValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  return String(value);
}

function commandLabelShort(commandKey, commandId = null) {
  const key = String(commandKey || "").trim();
  const map = {
    open_locker: "Open",
    check_locker_closed: "Close chk",
    set_locker_price: "Price",
    set_locker_color: "Color",
    set_lighting_mode: "Light mode",
    set_temperature: "Temp",
    set_fans: "Fans",
    set_operation_mode: "Op mode",
    refresh_status: "Refresh",
    clear_error: "Clr err",
    reboot_rpi: "Reboot RPI",
    reboot_stm32: "Reboot STM32",
    set_head_lights: "Head lights",
  };

  if (key && map[key]) return map[key];
  if (key) return humanizeKey(key);
  if (Number.isInteger(Number(commandId)) && Number(commandId) > 0) return `Cmd #${Number(commandId)}`;
  return "Action";
}

function buildCompactActivityText(log, activityData) {
  const commandKey = String(activityData.command_key || "").trim();
  const commandId = Number(log.command_id || activityData.command_id || 0);
  const label = commandLabelShort(commandKey, commandId);

  const phase = String(activityData.phase || "").trim().toLowerCase();
  const result = String(activityData.result || "").trim().toLowerCase();
  const lockerFromData = Number(activityData.locker_id);
  const lockerId = Number.isInteger(lockerFromData)
    ? lockerFromData
    : (Number.isInteger(Number(log.locker_id)) ? Number(log.locker_id) : null);
  const lockerNumberFromData = Number(activityData.locker_number);
  const lockerNumberFromLog = Number(log.locker_number);
  const mappedLocker = lockerId !== null
    ? state.lockers.find((locker) => Number(locker.locker_id) === lockerId) || null
    : null;
  const lockerNumber = Number.isInteger(lockerNumberFromData)
    ? lockerNumberFromData
    : (Number.isInteger(lockerNumberFromLog)
      ? lockerNumberFromLog
      : (mappedLocker && Number.isInteger(Number(mappedLocker.locker_number))
        ? Number(mappedLocker.locker_number)
        : null));
  const lockerPart = lockerNumber !== null ? ` L${lockerNumber}` : "";

  const expected = activityData.expected_change && typeof activityData.expected_change === "object"
    ? activityData.expected_change
    : null;
  const before = expected ? expected.before : null;
  const after = expected ? expected.expected : null;
  const field = expected ? expected.field : null;

  if (commandKey === "set_locker_price" && field === "price") {
    const fromValue = formatCommandValue(before);
    const toValue = formatCommandValue(after);
    return `Price${lockerPart}: ${fromValue}→${toValue}`;
  }

  if (commandKey === "set_temperature" && field === "set_temperature") {
    return `Temp: ${formatCommandValue(before)}→${formatCommandValue(after)}`;
  }

  if (commandKey === "set_fans" && field === "fan_mode") {
    return `Fans: ${formatCommandValue(before)}→${formatCommandValue(after)}`;
  }

  if (commandKey === "set_operation_mode" && field === "op_mode") {
    return `Op mode: ${formatCommandValue(before)}→${formatCommandValue(after)}`;
  }

  if (commandKey === "set_head_lights" && field === "head_lights") {
    return `Head lights: ${formatCommandValue(before)}→${formatCommandValue(after)}`;
  }

  if (commandKey === "set_lighting_mode" && field === "lighting_mode") {
    return `Light mode${lockerPart}: ${formatCommandValue(before)}→${formatCommandValue(after)}`;
  }

  if (commandKey === "set_locker_color" && field === "color_rgb" && before && after) {
    const fromRgb = `${formatCommandValue(before.color_r)},${formatCommandValue(before.color_g)},${formatCommandValue(before.color_b)}`;
    const toRgb = `${formatCommandValue(after.color_r)},${formatCommandValue(after.color_g)},${formatCommandValue(after.color_b)}`;
    return `Color${lockerPart}: ${fromRgb}→${toRgb}`;
  }

  if (commandKey === "open_locker") {
    return `Open${lockerPart}`;
  }

  if (commandKey === "check_locker_closed") {
    return `Close check${lockerPart}`;
  }

  if (phase === "publish_failed" || result === "failed" || result === "error") {
    return `${label}${lockerPart}: failed`;
  }

  if (phase === "pending_publish") {
    return `${label}${lockerPart}: pending`;
  }

  if (phase === "sent") {
    return `${label}${lockerPart}: sent`;
  }

  if (phase === "ack" && result === "success") {
    return `${label}${lockerPart}: done`;
  }

  return buildActivityText(log, activityData);
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
    const userId = activityData.user_id ?? log.user_id;
    const displayName = getUserDisplayName(userId, log.user_name, log.user_surname);
    const nameParts = splitDisplayName(displayName);
    whoCell.innerHTML = `<span class="who-name"><span class="who-first">${nameParts.first || ""}</span><span class="who-last">${nameParts.last || ""}</span></span>`;

    const whenCell = document.createElement("td");
    whenCell.textContent = toLocalTime(log.created_at || activityData.reported_at || activityData.accepted_at);

    const actionCell = document.createElement("td");
    actionCell.textContent = buildCompactActivityText(log, activityData);
    const activityResult = String(activityData.result || "").trim().toLowerCase();
    const activityPhase = String(activityData.phase || "").trim().toLowerCase();
    const optimisticSuccess = isOptimisticSuccessfulRequest(activityData.request_id);
    if (coerceBoolean(log.successful) || optimisticSuccess) {
      actionCell.classList.add("activity-action-success");
    } else if (activityResult === "failed" || activityResult === "error" || activityPhase === "publish_failed") {
      actionCell.classList.add("activity-action-failed");
    }

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
    lockerCell.textContent = normalizeLockerLabel(lockerNumber);

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
  el.toggleOpModeBtn.classList.toggle("failed", hasFailedControl("opMode"));
  el.toggleOpModeBtn.textContent = `Operation mode: ${state.opModeValue ? "ON" : "OFF"}`;
}

function renderLightingModes() {
  if (!el.lightingModeButtons) return;
  el.lightingModeButtons.innerHTML = "";
  const pending = hasPendingControl("lightingMode");
  const failed = hasFailedControl("lightingMode");

  LIGHTING_MODES.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lighting-mode-btn${state.lightingModeValue === mode.value ? " active" : ""}${pending ? " pending" : ""}${failed ? " failed" : ""}`;
    button.textContent = mode.label;
    button.addEventListener("click", () => {
      handleSetLightingMode(mode.value)
        .then((response) => {
          if (response) closeLockerCommands();
        })
        .catch((e) => setStatus(`Set lighting failed: ${e.message}`));
    });
    el.lightingModeButtons.appendChild(button);
  });

  syncBusyUi();
}

function renderFanButtons() {
  if (!el.fanButtons) return;
  el.fanButtons.innerHTML = "";
  const pending = hasPendingControl("fan");
  const failed = hasFailedControl("fan");

  FAN_BUTTONS.forEach((fan) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `state-btn ${state.fanStates[fan.key] ? "on" : "off"}${pending ? " pending" : ""}${failed ? " failed" : ""}`;
    button.textContent = fan.label;
    button.addEventListener("click", () => {
      handleToggleFan(fan.key).catch((e) => setStatus(`Set fans failed: ${e.message}`));
    });
    el.fanButtons.appendChild(button);
  });

  const autoButton = document.createElement("button");
  autoButton.type = "button";
  autoButton.className = `state-btn fan-auto ${state.fanStates.auto ? "on" : "off"}${pending ? " pending" : ""}${failed ? " failed" : ""}`;
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
  const failed = hasFailedControl("headLights");

  HEADLIGHT_MODES.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `state-btn ${state.headLightsValue === mode.value ? "on" : "off"}${pending ? " pending" : ""}${failed ? " failed" : ""}`;
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
  const { skipAuth = false, ...fetchOptions } = options;
  const url = `${state.apiBaseUrl}${path}`;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const defaultHeaders = method === "GET" || method === "HEAD"
    ? {}
    : { "Content-Type": "application/json" };
  const headers = {
    ...defaultHeaders,
    ...(fetchOptions.headers || {}),
  };

  if (!skipAuth && state.auth.idToken) {
    headers.Authorization = `Bearer ${state.auth.idToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), state.requestTimeoutMs);

  let response;
  try {
    response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeoutId);

    if (attempt < 2) {
      await sleep(250);
      return api(path, { ...fetchOptions, skipAuth }, attempt + 1);
    }

    const reason = location.protocol === "file:"
      ? "Browser blocked request from file:// (CORS). Open frontend via http:// or enable CORS on API."
      : "Network/CORS error while calling API.";
    const details = e instanceof Error ? e.message : String(e);
    throw new Error(`${reason} URL=${url} DETAILS=${details}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 && !skipAuth && attempt < 2) {
    try {
      const refreshed = await refreshCognitoSession();
      if (refreshed) {
        return api(path, { ...fetchOptions, skipAuth: false }, attempt + 1);
      }
    } catch {
      // Let normal error handling run below.
    }
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
  renderInfoList(el.adminStats, [], "Only shown for admin users.");
  renderInfoList(el.adminClimateStats, [], "-");
  renderActivityLogs([]);
  renderPurchaseLogs([]);
  el.lockerGrid.innerHTML = "";
  state.lockers = [];
  state.currentMachine = null;
  state.latestClimatePreview = [];
  state.selectedLockerId = null;
  state.machineStatus = null;
  state.latestStatsRaw.purchases = [];
  state.latestStatsRaw.climate = [];
  state.stats.climateRequestSequence += 1;
  state.stats.climateLoadError = "";
  state.stats.purchaseLoadError = "";
  state.chartRenderSignature = "";
  state.latestRenderedStatsSignature = "";
  state.pendingLockerPriceById.clear();
  state.pendingLockerColorById.clear();
  if (state.dbRefreshDebounceTimerId) {
    window.clearTimeout(state.dbRefreshDebounceTimerId);
    state.dbRefreshDebounceTimerId = null;
  }
  clearPendingControls();
  closeLockerCommands();
  closeTemperatureModal();
  setSelectedLockerText();
  syncSelectedLockerFormFields();
  syncControlModesFromStatusAndLocker();
  updateTopMachineStrip();
  syncBusyUi();
}

function setSelectedLockerText() {
  const locker = getSelectedLocker();
  if (!locker) {
    el.selectedLockerText.textContent = "No locker selected";
    return;
  }
  el.selectedLockerText.textContent = `Locker ${locker.locker_number}`;
}

function syncSelectedLockerFormFields() {
  const locker = getSelectedLocker();
  if (!locker) {
    el.lockerPrice.value = "";
    el.lockerPrice.dataset.fromDb = "0";
    el.colorR.value = "";
    el.colorG.value = "";
    el.colorB.value = "";
    if (el.colorPicker) {
      el.colorPicker.value = "#ffffff";
    }
    return;
  }

  if (state.pendingLockerPriceById.has(locker.locker_id)) {
    el.lockerPrice.value = state.pendingLockerPriceById.get(locker.locker_id) ?? "";
    el.lockerPrice.dataset.fromDb = "0";
  } else {
    el.lockerPrice.value = locker.price ?? "";
    el.lockerPrice.dataset.fromDb = "1";
  }

  el.colorR.value = locker.color_r ?? "";
  el.colorG.value = locker.color_g ?? "";
  el.colorB.value = locker.color_b ?? "";

  const r = Number(el.colorR.value);
  const g = Number(el.colorG.value);
  const b = Number(el.colorB.value);
  if (el.colorPicker && [r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    el.colorPicker.value = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
}

function lockerColorClass(locker) {
  if (coerceBoolean(locker.sold)) return "red";
  if (lockerIsOpened(locker) && !coerceBoolean(locker.sold)) return "green";
  if (lockerIsOpened(locker)) return "green";
  return "green";
}

function lockerStateLabel(locker) {
  if (lockerIsOpened(locker) && !coerceBoolean(locker.sold)) return "FREE";
  if (lockerIsOpened(locker)) return "OPEN";
  if (coerceBoolean(locker.sold)) return "SOLD";
  return "FREE";
}

function createLockerButton(locker, placement = null) {
  const button = document.createElement("button");
  const placementClass = placement ? ` locker-size-${placement.size.toLowerCase()}` : "";
  button.type = "button";
  button.className = `locker-btn ${lockerColorClass(locker)}${placementClass}${lockerIsOpened(locker) ? " opened-text" : ""}`;
  button.setAttribute("aria-label", `Locker ${locker.locker_number}, ${lockerStateLabel(locker).toLowerCase()}`);
  button.innerHTML = placement
    ? `<span>${locker.locker_number}</span>`
    : `<span>L${locker.locker_number}</span><small>${lockerStateLabel(locker)}</small>`;
  button.addEventListener("click", () => {
    state.selectedLockerId = locker.locker_id;
    setSelectedLockerText();
    syncSelectedLockerFormFields();
    state.lightingModeValue = Number.isInteger(Number(locker.lighting_mode)) ? Number(locker.lighting_mode) : 0;
    renderLockers();
    renderLightingModes();
    openLockerCommands();
  });
  return button;
}

function parseLockerPlacement(rawPlacement) {
  const raw = String(rawPlacement || "").trim();
  if (!raw) return null;

  const parts = raw.split(";").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;

  const seenLockerNumbers = new Set();
  const placements = [];
  for (const [index, part] of parts.entries()) {
    const match = part.match(/^(\d+)-(\d+)([LMS])$/i);
    if (!match) return null;

    const lockerNumber = Number(match[1]);
    const row = Number(match[2]);
    const size = match[3].toUpperCase();
    if (!Number.isInteger(lockerNumber) || lockerNumber < 1 || !Number.isInteger(row) || row < 1 || seenLockerNumbers.has(lockerNumber)) {
      return null;
    }

    seenLockerNumbers.add(lockerNumber);
    placements.push({ lockerNumber, row, size, index });
  }

  const lockerNumbers = new Set(state.lockers.map((locker) => Number(locker.locker_number)));
  if (placements.length !== lockerNumbers.size || placements.some((placement) => !lockerNumbers.has(placement.lockerNumber))) {
    return null;
  }

  return placements;
}

function getCurrentMachine() {
  if (state.currentMachine) return state.currentMachine;
  return state.allowedMachines.find((item) => Number(item.machine.machine_id) === Number(state.selectedMachineId))?.machine || null;
}

function renderPlacedLockers(placements) {
  const lockersByNumber = new Map(state.lockers.map((locker) => [Number(locker.locker_number), locker]));
  const rowNumbers = [...new Set(placements.map((placement) => placement.row))].sort((a, b) => a - b);
  const rows = document.createElement("div");
  rows.className = "locker-layout-rows";
  rows.style.setProperty("--locker-row-count", String(rowNumbers.length));

  rowNumbers.forEach((rowNumber, rowIndex) => {
    const row = document.createElement("div");
    row.className = `locker-layout-row${rowIndex === 0 ? " is-first" : ""}${rowIndex === rowNumbers.length - 1 ? " is-last" : ""}`;
    row.dataset.row = String(rowNumber);
    placements
      .filter((placement) => placement.row === rowNumber)
      .sort((a, b) => a.index - b.index)
      .forEach((placement) => {
        row.appendChild(createLockerButton(lockersByNumber.get(placement.lockerNumber), placement));
      });
    rows.appendChild(row);
  });

  el.lockerGrid.appendChild(rows);
  syncPlacedLockerHeights();
}

function syncPlacedLockerHeights() {
  if (state.ui.lockerLayoutFrameId) {
    window.cancelAnimationFrame(state.ui.lockerLayoutFrameId);
  }
  state.ui.lockerLayoutFrameId = window.requestAnimationFrame(() => {
    state.ui.lockerLayoutFrameId = null;
    if (!el.lockerGrid?.classList.contains("has-placement")) return;
    const referenceLargeLocker = el.lockerGrid.querySelector(".locker-size-l");
    const referenceLargeHeight = referenceLargeLocker?.getBoundingClientRect().height || 0;
    el.lockerGrid.querySelectorAll(".locker-layout-row").forEach((row) => {
      const largeLocker = row.querySelector(".locker-size-l");
      const largeHeight = largeLocker?.getBoundingClientRect().height || referenceLargeHeight;
      if (largeHeight <= 0) {
        row.style.removeProperty("--locker-large-height");
        return;
      }
      row.style.setProperty("--locker-large-height", `${largeHeight}px`);
    });
  });
}

function renderLockers() {
  el.lockerGrid.innerHTML = "";
  el.lockerGrid.classList.remove("has-placement");
  if (!state.lockers.length) {
    el.lockerGrid.innerHTML = "<p class='subtle'>No lockers found for this machine.</p>";
    state.selectedLockerId = null;
    closeLockerCommands();
    setSelectedLockerText();
    syncSelectedLockerFormFields();
    syncBusyUi();
    return;
  }

  const placements = parseLockerPlacement(getCurrentMachine()?.locker_placement);
  if (placements) {
    el.lockerGrid.classList.add("has-placement");
    renderPlacedLockers(placements);
  } else {
    state.lockers.forEach((locker) => {
      el.lockerGrid.appendChild(createLockerButton(locker));
    });
  }

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

  if (el.signedInUser) {
    el.signedInUser.value = state.auth.isAuthenticated ? getSignedInUserLabel() : "-";
  }
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
  pendingKeys = [],
  options = {}
) {
  if (state.activeCommandCount > 0) {
    setStatus("Please wait for current command to finish.", true);
    return null;
  }

  const keys = Array.isArray(pendingKeys) ? pendingKeys : [pendingKeys];
  setPendingControls(keys, true);
  if (options.clearFailed !== false) {
    setFailedControls(keys, false);
  }

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

  const initialAttempt = Number.isInteger(Number(options.attempts)) && Number(options.attempts) > 0
    ? Number(options.attempts)
    : 1;
  const rawRequestId = String(response?.request_id || "").trim();

  if (options.verifyAfterRefresh) {
    queueVerification({
      commandId,
      params,
      lockerId,
      statusLabel,
      pendingKeys: keys,
      expected: options.expected,
      attempts: initialAttempt,
      requestId: rawRequestId || null,
    });
    scheduleDebouncedDashboardRefresh({
      delayMs: getVerificationDelayMs(initialAttempt),
    });
  } else {
    scheduleDebouncedDashboardRefresh({
      delayMs: state.dbRefreshDebounceMs,
      clearPendingKeys: keys,
    });
  }

  const requestId = rawRequestId ? ` request_id=${rawRequestId}` : "";
  setStatus(`${statusLabel} command sent.${requestId}`, true);
  return response;
}

async function loadInitial() {
  state.apiBaseUrl = String(el.apiBaseUrl?.value || state.apiBaseUrl || DEFAULT_API_BASE_URL).trim().replace(/\/$/, "");
  if (!state.apiBaseUrl) {
    throw new Error("API URL is empty. Paste the HttpApiUrl output from CoreDataPlatformStack (execute-api URL).");
  }

  if (el.apiBaseUrl) {
    el.apiBaseUrl.value = state.apiBaseUrl;
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

async function loadAuthConfig() {
  const config = await api("/auth/config", { skipAuth: true });
  state.authConfig.enabled = Boolean(config?.enabled);
  state.authConfig.region = String(config?.region || "");
  state.authConfig.userPoolId = String(config?.user_pool_id || "");
  state.authConfig.appClientId = String(config?.app_client_id || "");
  state.authConfig.issuer = String(config?.issuer || "");

  if (!state.authConfig.enabled) {
    setAuthStatus("Auth is not configured on backend.");
  }
}

async function restoreAuthFromStorageAndRefreshIfNeeded() {
  const storedRefresh = (localStorage.getItem(STORAGE_KEYS.authRefreshToken) || "").trim();
  if (!storedRefresh) {
    return false;
  }

  state.auth.idToken = (localStorage.getItem(STORAGE_KEYS.authIdToken) || "").trim();
  state.auth.accessToken = (localStorage.getItem(STORAGE_KEYS.authAccessToken) || "").trim();
  state.auth.refreshToken = storedRefresh;
  state.auth.expiresAt = Number(localStorage.getItem(STORAGE_KEYS.authExpiresAt) || "0");
  state.auth.email = (localStorage.getItem(STORAGE_KEYS.authEmail) || "").trim();

  const now = Date.now();
  if (!state.auth.idToken || !Number.isFinite(state.auth.expiresAt) || state.auth.expiresAt <= now + 30000) {
    try {
      return await refreshCognitoSession();
    } catch {
      return false;
    }
  }

  state.auth.isAuthenticated = true;
  return true;
}

async function restoreMachineSelectionAndAutoloadDashboard(preferredMachineIdRaw = null) {
  const storedMachineIdRaw = preferredMachineIdRaw ?? localStorage.getItem(STORAGE_KEYS.selectedMachineId);
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

async function bootstrapAuthenticatedApp() {
  const sessionBefore = await api("/auth/session");
  if (sessionBefore?.needs_profile) {
    await api("/auth/complete-profile", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  const session = sessionBefore?.needs_profile ? await api("/auth/session") : sessionBefore;
  if (!session?.user?.user_id) {
    throw new Error("Authenticated user profile is unavailable.");
  }

  await loadInitial();

  const authUserId = Number(session.user.user_id);
  const authUserEmail = String(session.user.email || state.auth.email || "");
  state.users = state.users.filter((u) => Number(u.user_id) === authUserId);
  if (!state.users.length) {
    state.users = [session.user];
  }
  populateUsers();

  state.selectedUserId = authUserId;
  el.userSelect.value = String(authUserId);
  el.userSelect.disabled = true;

  const storedMachineIdRaw = localStorage.getItem(STORAGE_KEYS.selectedMachineId);
  await onUserSelected();
  await restoreMachineSelectionAndAutoloadDashboard(storedMachineIdRaw);

  state.auth.isAuthenticated = true;
  setAuthLayoutVisible(true);
  state.ui.lightingCollapsed = true;
  state.ui.machineCommandsCollapsed = false;
  state.ui.climateCollapsed = true;
  syncCollapsibleUi();
  const signedInLabel = getSignedInUserLabel() || authUserEmail || "authenticated user";
  setAuthStatus(`Signed in as ${signedInLabel}.`, true);
  syncBusyUi();
}

async function handleSignIn() {
  if (!state.authConfig.enabled) {
    throw new Error("Authentication is not configured by backend.");
  }

  const email = (el.authEmail?.value || "").trim().toLowerCase();
  const password = String(el.authPassword?.value || "");
  if (!email || !password) {
    throw new Error("Enter email and password.");
  }

  setAuthStatus("Signing in...", true);
  const signInResult = await signInWithCognito(email, password);
  if (signInResult?.challengeName === "NEW_PASSWORD_REQUIRED") {
    state.auth.pendingChallenge = {
      challengeName: "NEW_PASSWORD_REQUIRED",
      session: signInResult.session || "",
      username: signInResult.username || email,
      email,
    };
    setNewPasswordChallengeVisible(true);
    setAuthStatus("First sign-in requires password change. Enter a new password below.", false);
    setStatus("First sign-in requires password change. Enter and confirm new password.", false);
    syncBusyUi();
    return;
  }

  setNewPasswordChallengeVisible(false);
  await bootstrapAuthenticatedApp();
  if (el.authPassword) {
    el.authPassword.value = "";
  }
}

async function handleSetNewPassword() {
  const challenge = state.auth.pendingChallenge;
  if (!challenge || challenge.challengeName !== "NEW_PASSWORD_REQUIRED") {
    throw new Error("No pending password-change challenge.");
  }

  const newPassword = String(el.newPassword?.value || "");
  const confirmPassword = String(el.newPasswordConfirm?.value || "");

  if (!newPassword || !confirmPassword) {
    throw new Error("Enter and confirm new password.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("New password and confirmation do not match.");
  }

  setAuthStatus("Setting new password...", true);

  const data = await respondToNewPasswordChallenge(challenge, newPassword);
  if (!data?.AuthenticationResult?.IdToken) {
    throw new Error("Cognito did not return IdToken after password change.");
  }

  rememberAuth(data.AuthenticationResult, challenge.email || (el.authEmail?.value || "").trim().toLowerCase());
  state.auth.isAuthenticated = true;
  state.auth.pendingChallenge = null;
  setNewPasswordChallengeVisible(false);

  if (el.authPassword) {
    el.authPassword.value = "";
  }

  await bootstrapAuthenticatedApp();
}

function handleSignOut() {
  clearAuthStorage();
  resetAuthState();
  setNewPasswordChallengeVisible(false);

  state.users = [];
  state.machines = [];
  state.allowedMachines = [];
  state.membershipsByCompany.clear();
  state.selectedUserId = null;
  state.selectedMachineId = null;
  state.selectedCompanyId = null;
  state.selectedRole = null;

  el.userSelect.innerHTML = "<option value=''>Choose user</option>";
  el.userSelect.disabled = true;
  el.machineSelect.innerHTML = "<option value=''>Choose machine</option>";
  el.machineSelect.disabled = true;

  localStorage.removeItem(STORAGE_KEYS.selectedUserId);
  localStorage.removeItem(STORAGE_KEYS.selectedMachineId);

  resetDashboard();
  setAuthLayoutVisible(false);
  setAuthStatus("Signed out.", true);
  setStatus("Sign in to continue.", true);
  syncBusyUi();
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
  const [user, machine, status, lockers, activityLogs, purchaseLogs, climatePreview] = await Promise.all([
    api(`/users/${state.selectedUserId}`),
    api(`/machines/${machineId}`),
    api(`/machine_status/${machineId}`).catch(() => null),
    api(`/lockers?machine_id=${machineId}`),
    api(`/activity_logs?machine_id=${machineId}&limit=20`).catch(() => []),
    api(`/purchase_logs?machine_id=${machineId}&limit=500`).catch(() => []),
    api(`/climate_logs?machine_id=${machineId}&limit=60`).catch(() => []),
  ]);

  state.machineStatus = status;
  state.currentMachine = machine;
  state.latestClimatePreview = Array.isArray(climatePreview) ? climatePreview : [];
  state.lockers = lockers;

  state.lockers.forEach((locker) => {
    if (!state.pendingLockerPriceById.has(locker.locker_id)) return;

    const optimisticPrice = Number(state.pendingLockerPriceById.get(locker.locker_id));
    const dbPrice = Number(locker.price);

    if (Number.isFinite(optimisticPrice) && Number.isFinite(dbPrice) && Math.abs(dbPrice - optimisticPrice) < 0.000001) {
      state.pendingLockerPriceById.delete(locker.locker_id);
      return;
    }

    if (Number.isFinite(optimisticPrice)) {
      locker.price = optimisticPrice;
    }
  });

  state.lockers.forEach((locker) => {
    if (!state.pendingLockerColorById.has(locker.locker_id)) return;

    const optimisticColor = state.pendingLockerColorById.get(locker.locker_id) || {};
    const optimisticR = Number(optimisticColor.color_r);
    const optimisticG = Number(optimisticColor.color_g);
    const optimisticB = Number(optimisticColor.color_b);
    const dbR = Number(locker.color_r);
    const dbG = Number(locker.color_g);
    const dbB = Number(locker.color_b);

    const dbMatchesOptimistic =
      Number.isInteger(optimisticR)
      && Number.isInteger(optimisticG)
      && Number.isInteger(optimisticB)
      && dbR === optimisticR
      && dbG === optimisticG
      && dbB === optimisticB;

    if (dbMatchesOptimistic) {
      state.pendingLockerColorById.delete(locker.locker_id);
      return;
    }

    if (Number.isInteger(optimisticR) && Number.isInteger(optimisticG) && Number.isInteger(optimisticB)) {
      locker.color_r = optimisticR;
      locker.color_g = optimisticG;
      locker.color_b = optimisticB;
    }
  });

  if (!state.lockers.some((locker) => locker.locker_id === state.selectedLockerId)) {
    state.selectedLockerId = state.lockers.length ? state.lockers[0].locker_id : null;
  }

  const _unusedUser = user;
  renderActivityLogs(activityLogs || []);
  renderPurchaseLogs(purchaseLogs || []);
  renderLockers();
  syncControlModesFromStatusAndLocker();
  updateTopMachineStrip();
  setSelectedLockerText();
  syncSelectedLockerFormFields();
  await processPendingVerifications();

  if (state.selectedRole === "admin") {
    const hasLoadedStats = state.latestStatsRaw.purchases.length > 0
      || state.latestStatsRaw.climate.length > 0
      || state.stats.purchaseLoadError
      || state.stats.climateLoadError;
    if (!quiet || !hasLoadedStats) {
      await loadAdminStats(machineId);
    } else {
      applyAdminStatsView();
    }
  } else {
    renderInfoList(el.adminStats, [], "Only shown for admin users.");
  }

  if (!quiet) {
    setStatus("Dashboard loaded successfully.", true);
    if (el.machineStrip) {
      window.requestAnimationFrame(() => {
        el.machineStrip.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
}

async function loadAdminStats(machineId) {
  const requestSequence = ++state.stats.climateRequestSequence;
  let climateLoadError = "";
  let purchaseLoadError = "";
  const [purchases, climate] = await Promise.all([
    fetchAllPurchaseLogsForSelectedPeriod(machineId).catch((error) => {
      purchaseLoadError = `Purchase data could not be loaded: ${error.message || error}`;
      return [];
    }),
    fetchAllClimateLogsForSelectedPeriod(machineId).catch((error) => {
      climateLoadError = `Climate data could not be loaded: ${error.message || error}`;
      return [];
    }),
  ]);

  if (Number(machineId) !== Number(state.selectedMachineId)) return;
  if (requestSequence === state.stats.climateRequestSequence) {
    state.latestStatsRaw.purchases = purchases;
    state.latestStatsRaw.climate = climate;
    state.stats.purchaseLoadError = purchaseLoadError;
    state.stats.climateLoadError = climateLoadError;
  }
  state.chartRenderSignature = "";
  state.latestRenderedStatsSignature = "";

  if (el.adminStatsDetails) {
    el.adminStatsDetails.hidden = false;
  }
  applyAdminStatsView();
  syncCollapsibleUi();
}

async function refreshAdminStatsForSelectedPeriod() {
  if (!state.auth.isAuthenticated || state.selectedRole !== "admin" || !state.selectedMachineId) {
    applyAdminStatsView();
    return;
  }

  const requestSequence = ++state.stats.climateRequestSequence;
  const machineId = state.selectedMachineId;
  let purchaseLoadError = "";
  let climateLoadError = "";
  const [purchases, climate] = await Promise.all([
    fetchAllPurchaseLogsForSelectedPeriod(machineId).catch((error) => {
      purchaseLoadError = `Purchase data could not be loaded: ${error.message || error}`;
      return [];
    }),
    fetchAllClimateLogsForSelectedPeriod(machineId).catch((error) => {
      climateLoadError = `Climate data could not be loaded: ${error.message || error}`;
      return [];
    }),
  ]);
  if (requestSequence !== state.stats.climateRequestSequence || Number(machineId) !== Number(state.selectedMachineId)) {
    return;
  }

  state.latestStatsRaw.purchases = Array.isArray(purchases) ? purchases : [];
  state.latestStatsRaw.climate = Array.isArray(climate) ? climate : [];
  state.stats.purchaseLoadError = purchaseLoadError;
  state.stats.climateLoadError = climateLoadError;
  state.chartRenderSignature = "";
  state.latestRenderedStatsSignature = "";
  applyAdminStatsView();
  const loadErrors = [purchaseLoadError, climateLoadError].filter(Boolean);
  if (loadErrors.length) setStatus(loadErrors.join(" "));
}

function refreshStatsForSelectedPeriod() {
  state.chartRenderSignature = "";
  state.latestRenderedStatsSignature = "";
  applyAdminStatsView();
  refreshAdminStatsForSelectedPeriod().catch((error) => {
    state.stats.purchaseLoadError = `Statistics could not be loaded: ${error.message || error}`;
    state.chartRenderSignature = "";
    state.latestRenderedStatsSignature = "";
    applyAdminStatsView();
    setStatus(state.stats.purchaseLoadError);
  });
}

async function handleOpenLocker() {
  if (!requireContext({ locker: true })) return;
  return sendCommandAndDebouncedRefresh(
    COMMAND_IDS.OPEN_LOCKER,
    {},
    state.selectedLockerId,
    "Open locker",
    ["openLocker"],
    {
      verifyAfterRefresh: true,
      expected: true,
    }
  );
}

async function handleSetPrice() {
  if (!requireContext({ locker: true })) return;
  const lockerId = state.selectedLockerId;
  const price = Number(el.lockerPrice.value);
  if (!Number.isFinite(price) || price < 0 || price > 9999) {
    setStatus("Price must be a number between 0 and 9999.");
    return;
  }

  state.pendingLockerPriceById.set(lockerId, price);
  const selectedLocker = getSelectedLocker();
  if (selectedLocker && selectedLocker.locker_id === lockerId) {
    selectedLocker.price = price;
  }
  syncSelectedLockerFormFields();

  try {
    return await sendCommandAndDebouncedRefresh(
      COMMAND_IDS.SET_LOCKER_PRICE,
      { price },
      lockerId,
      "Set locker price",
      ["setPrice"],
      {
        verifyAfterRefresh: true,
        expected: price,
      }
    );
  } catch (error) {
    state.pendingLockerPriceById.delete(lockerId);
    throw error;
  }
}

async function handleSetColor() {
  if (!requireContext({ locker: true })) return;
  const lockerId = state.selectedLockerId;
  const color_r = Number(el.colorR.value);
  const color_g = Number(el.colorG.value);
  const color_b = Number(el.colorB.value);
  const all = [color_r, color_g, color_b];
  if (all.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
    setStatus("RGB values must be integers between 0 and 255.");
    return;
  }

  state.pendingLockerColorById.set(lockerId, { color_r, color_g, color_b });
  const selectedLocker = getSelectedLocker();
  if (selectedLocker && selectedLocker.locker_id === lockerId) {
    selectedLocker.color_r = color_r;
    selectedLocker.color_g = color_g;
    selectedLocker.color_b = color_b;
  }
  syncSelectedLockerFormFields();

  try {
    return await sendCommandAndDebouncedRefresh(
      COMMAND_IDS.SET_LOCKER_COLOR,
      { color_r, color_g, color_b },
      lockerId,
      "Set locker color",
      ["setColor"],
      {
        verifyAfterRefresh: true,
        expected: { color_r, color_g, color_b },
      }
    );
  } catch (error) {
    state.pendingLockerColorById.delete(lockerId);
    await loadDashboard({ quiet: true }).catch(() => {});
    throw error;
  }
}

async function handleSetColorAll() {
  if (!requireContext()) return;
  const color_r = Number(el.colorR.value);
  const color_g = Number(el.colorG.value);
  const color_b = Number(el.colorB.value);
  const all = [color_r, color_g, color_b];
  if (all.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
    setStatus("RGB values must be integers between 0 and 255.");
    return;
  }

  const lockerIds = state.lockers
    .map((locker) => Number(locker.locker_id))
    .filter((id) => Number.isInteger(id));

  lockerIds.forEach((lockerId) => {
    state.pendingLockerColorById.set(lockerId, { color_r, color_g, color_b });
  });
  state.lockers.forEach((locker) => {
    locker.color_r = color_r;
    locker.color_g = color_g;
    locker.color_b = color_b;
  });
  syncSelectedLockerFormFields();

  try {
    return await sendCommandAndDebouncedRefresh(
      COMMAND_IDS.SET_LOCKER_COLOR,
      {
        color_r,
        color_g,
        color_b,
        locker_number: 255,
      },
      null,
      "Set all locker colors",
      ["setColor"],
      {
        verifyAfterRefresh: false,
      }
    );
  } catch (error) {
    lockerIds.forEach((lockerId) => {
      state.pendingLockerColorById.delete(lockerId);
    });
    await loadDashboard({ quiet: true }).catch(() => {});
    throw error;
  }
}

async function handleSetLightingMode(modeValue) {
  if (!requireContext({ locker: true })) return;
  if (!Number.isInteger(modeValue) || modeValue < 1 || modeValue > 5) {
    setStatus("Lighting mode must be one of available modes.");
    return;
  }

  return sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_LIGHTING_MODE,
    { lighting_mode: modeValue },
    state.selectedLockerId,
    `Set lighting mode ${modeValue}`,
    ["lightingMode"],
    {
      verifyAfterRefresh: true,
      expected: modeValue,
    }
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
    ["fan"],
    {
      verifyAfterRefresh: true,
      expected: fan_mode,
    }
  );
}

async function handleSetFanAuto() {
  if (!requireContext()) return;
  await sendCommandAndDebouncedRefresh(
    COMMAND_IDS.SET_FANS,
    { fan_mode: 255 },
    null,
    "Set fans auto",
    ["fan"],
    {
      verifyAfterRefresh: true,
      expected: 255,
    }
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
    ["opMode"],
    {
      verifyAfterRefresh: true,
      expected: next,
    }
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
    ["headLights"],
    {
      verifyAfterRefresh: true,
      expected: modeValue,
    }
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
    ["setTemp"],
    {
      verifyAfterRefresh: true,
      expected: set_temperature,
    }
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
  if (state.auth.isAuthenticated && state.selectedUserId) {
    state.selectedMachineId = null;
    state.selectedCompanyId = null;
    state.selectedRole = null;
    state.membershipsByCompany.clear();

    el.machineSelect.value = "";
    populateMachines();
    resetDashboard();
    localStorage.removeItem(STORAGE_KEYS.selectedMachineId);
    setStatus("");
    updateTopMachineStrip();
    return;
  }

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
  updateTopMachineStrip();
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
  if (el.apiBaseUrl) {
    el.apiBaseUrl.value = state.apiBaseUrl;
  }

  window.addEventListener("resize", syncPlacedLockerHeights);

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

  if (el.apiBaseUrl) {
    el.apiBaseUrl.addEventListener("change", () => {
      state.apiBaseUrl = el.apiBaseUrl.value.trim().replace(/\/$/, "");
      if (state.apiBaseUrl) {
        localStorage.setItem(STORAGE_KEYS.apiBaseUrl, state.apiBaseUrl);
      }
    });
  }

  el.userSelect.addEventListener("change", () => {
    if (!state.auth.isAuthenticated) return;
    onUserSelected().catch((e) => setStatus(`Failed to load user machines: ${e.message}`));
  });

  el.machineSelect.addEventListener("change", onMachineSelected);
  el.loadBtn.addEventListener("click", () => loadDashboard().catch((e) => setStatus(`Failed to load dashboard: ${e.message}`)));
  if (el.clearBtn) {
    el.clearBtn.addEventListener("click", clearAll);
  }

  const wireLockerCommand = (button, handler, errorLabel) => {
    button.addEventListener("click", () => {
      handler()
        .then((response) => {
          if (response) closeLockerCommands();
        })
        .catch((e) => setStatus(`${errorLabel}: ${e.message}`));
    });
  };
  wireLockerCommand(el.openLockerBtn, handleOpenLocker, "Open locker failed");
  wireLockerCommand(el.setPriceBtn, handleSetPrice, "Set price failed");
  wireLockerCommand(el.setColorBtn, handleSetColor, "Set color failed");
  wireLockerCommand(el.setColorAllBtn, handleSetColorAll, "Set all colors failed");
  el.setTempBtn.addEventListener("click", () => handleSetTemperature().catch((e) => setStatus(`Set temperature failed: ${e.message}`)));
  el.toggleOpModeBtn.addEventListener("click", () => handleToggleOperationMode().catch((e) => setStatus(`Set operation mode failed: ${e.message}`)));

  if (el.colorPicker) {
    const syncPickerFromRgb = () => {
      const r = Number(el.colorR?.value);
      const g = Number(el.colorG?.value);
      const b = Number(el.colorB?.value);
      if ([r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
        el.colorPicker.value = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      }
    };
    el.colorPicker.addEventListener("pointerdown", syncPickerFromRgb);
    el.colorPicker.addEventListener("focus", syncPickerFromRgb);
    el.colorPicker.addEventListener("input", () => {
      setRgbFieldsFromHex(el.colorPicker.value || "#000000");
    });
  }

  if (el.lightingToggleBtn) {
    el.lightingToggleBtn.addEventListener("click", () => {
      state.ui.lightingCollapsed = !state.ui.lightingCollapsed;
      syncCollapsibleUi();
    });
  }

  if (el.machineCommandsToggleBtn) {
    el.machineCommandsToggleBtn.addEventListener("click", () => {
      state.ui.machineCommandsCollapsed = !state.ui.machineCommandsCollapsed;
      syncCollapsibleUi();
    });
  }

  if (el.toggleClimateDetailsBtn) {
    el.toggleClimateDetailsBtn.addEventListener("click", () => {
      state.ui.climateCollapsed = !state.ui.climateCollapsed;
      syncCollapsibleUi();
      if (!state.ui.climateCollapsed) {
        window.requestAnimationFrame(() => {
          state.chartRenderSignature = "";
          state.latestRenderedStatsSignature = "";
          applyAdminStatsView();
        });
      }
    });
  }

  if (el.climateSensorButtons) {
    el.climateSensorButtons.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-climate-sensor]");
      if (!button) return;
      const sensorId = Number(button.getAttribute("data-climate-sensor"));
      if (![1, 2, 3].includes(sensorId)) return;
      state.stats.climateSensorId = sensorId;
      state.chartRenderSignature = "";
      state.latestRenderedStatsSignature = "";
      applyAdminStatsView();
    });
  }

  if (el.statsPeriodSelect) {
    el.statsPeriodSelect.addEventListener("change", () => {
      const usingFlatpickr = Boolean(getStatsRangePickerInstance());
      if (el.statsCustomRange) {
        el.statsCustomRange.hidden = usingFlatpickr || el.statsPeriodSelect.value !== "custom";
      }
      syncStatsPeriodMenuActiveState();
      syncBusyUi();
      if (el.statsPeriodSelect.value === "custom") {
        syncStatsRangePickerFromInputs();
        const picker = getStatsRangePickerInstance();
        if (picker) {
          window.setTimeout(() => {
            picker.open();
          }, 0);
        }
      }
      refreshStatsForSelectedPeriod();
      if (el.statsPeriodSelect.value !== "custom") {
        closeStatsPeriodPanel();
      }
    });
  }

  if (el.statsPeriodMenu && el.statsPeriodSelect) {
    el.statsPeriodMenu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("[data-period-value]");
      if (!btn) return;

      const nextValue = String(btn.getAttribute("data-period-value") || "").trim();
      if (!nextValue) return;
      if (!Array.from(el.statsPeriodSelect.options).some((opt) => opt.value === nextValue)) return;

      if (el.statsPeriodSelect.value !== nextValue) {
        el.statsPeriodSelect.value = nextValue;
        el.statsPeriodSelect.dispatchEvent(new Event("change", { bubbles: true }));
        closeStatsPeriodPanel();
      } else {
        if (nextValue === "custom") {
          const picker = getStatsRangePickerInstance();
          if (picker) {
            closeStatsPeriodPanel();
            picker.open();
            return;
          }
        }
        closeStatsPeriodPanel();
      }
    });
  }

  if (el.statsCustomFrom) {
    el.statsCustomFrom.addEventListener("change", () => {
      syncStatsRangePickerFromInputs();
      refreshStatsForSelectedPeriod();
    });
  }

  if (el.statsCustomTo) {
    el.statsCustomTo.addEventListener("change", () => {
      syncStatsRangePickerFromInputs();
      refreshStatsForSelectedPeriod();
    });
  }

  if (el.statsPeriodToggleBtn && el.statsPeriodSelect) {
    el.statsPeriodToggleBtn.addEventListener("click", () => {
      if (el.statsPeriodSelect.value === "custom") {
        const picker = getStatsRangePickerInstance();
        if (picker) {
          const hasFrom = String(el.statsCustomFrom?.value || "").trim().length > 0;
          const hasTo = String(el.statsCustomTo?.value || "").trim().length > 0;
          const hasCompleteRange = hasFrom && hasTo;

          if (hasCompleteRange) {
            if (picker.isOpen) {
              picker.close();
            }
            const nextVisible = Boolean(el.statsPeriodMenu?.hidden);
            setStatsPeriodMenuVisible(nextVisible);
            return;
          }

          closeStatsPeriodPanel();
          picker.open();
          return;
        }
      }
      const nextVisible = Boolean(el.statsPeriodMenu?.hidden);
      setStatsPeriodMenuVisible(nextVisible);
    });
  }

  document.addEventListener("click", (event) => {
    if (!el.statsPeriodMenu || !el.statsPeriodToggleBtn) return;
    if (el.statsPeriodMenu.hidden) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    const inMenu = el.statsPeriodMenu.contains(target);
    const inButton = el.statsPeriodToggleBtn.contains(target);
    if (!inMenu && !inButton) {
      closeStatsPeriodPanel();
    }
  });

  if (el.downloadPurchasesCsvBtn) {
    el.downloadPurchasesCsvBtn.addEventListener("click", downloadPurchasesCsv);
  }
  if (el.downloadClimateCsvBtn) {
    el.downloadClimateCsvBtn.addEventListener("click", downloadClimateCsv);
  }

  [el.quickNavServiceBtn, el.quickNavSettingsBtn, el.quickNavStatsBtn].filter(Boolean).forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTarget || "service");
    });
  });

  if (el.closeLockerCommandsBtn) {
    el.closeLockerCommandsBtn.addEventListener("click", closeLockerCommands);
  }
  if (el.lockerSheetBackdrop) {
    el.lockerSheetBackdrop.addEventListener("click", closeLockerCommands);
  }
  if (el.topCurrentTemperature) {
    el.topCurrentTemperature.addEventListener("click", openTemperatureModal);
  }
  if (el.closeTemperatureModalBtn) {
    el.closeTemperatureModalBtn.addEventListener("click", closeTemperatureModal);
  }
  if (el.temperatureModal) {
    el.temperatureModal.addEventListener("click", (event) => {
      if (event.target === el.temperatureModal) closeTemperatureModal();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.ui.lockerCommandsOpen) {
      closeLockerCommands();
    }
    if (event.key === "Escape" && state.ui.temperatureModalOpen) {
      closeTemperatureModal();
    }
  });

  if (el.signInBtn) {
    el.signInBtn.addEventListener("click", () => {
      handleSignIn().catch((e) => {
        setAuthStatus(`Sign-in failed: ${e.message}`);
        setStatus(`Sign-in failed: ${e.message}`);
        syncBusyUi();
      });
    });
  }

  if (el.setNewPasswordBtn) {
    el.setNewPasswordBtn.addEventListener("click", () => {
      handleSetNewPassword().catch((e) => {
        setAuthStatus(`Set password failed: ${e.message}`);
        setStatus(`Set password failed: ${e.message}`);
        syncBusyUi();
      });
    });
  }

  if (el.signOutBtn) {
    el.signOutBtn.addEventListener("click", handleSignOut);
  }

  if (el.authPassword) {
    el.authPassword.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleSignIn().catch((e) => {
        setAuthStatus(`Sign-in failed: ${e.message}`);
        setStatus(`Sign-in failed: ${e.message}`);
        syncBusyUi();
      });
    });
  }

  if (el.newPasswordConfirm) {
    el.newPasswordConfirm.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleSetNewPassword().catch((e) => {
        setAuthStatus(`Set password failed: ${e.message}`);
        setStatus(`Set password failed: ${e.message}`);
        syncBusyUi();
      });
    });
  }
}

async function init() {
  wireEvents();
  renderLightingModes();
  renderFanButtons();
  renderHeadlightButtons();
  renderPurchaseLogs([]);
  applyOpModeButtonState(false);
  setAuthLayoutVisible(false);
  syncCollapsibleUi();
  updateStatsPeriodButtonLabel();
  closeStatsPeriodPanel();
  if (el.statsCustomRange && el.statsPeriodSelect) {
    const usingFlatpickr = typeof window.flatpickr === "function";
    el.statsCustomRange.hidden = usingFlatpickr || el.statsPeriodSelect.value !== "custom";
  }
  initStatsRangePicker();
  setChartVisibility("");
  updateTopMachineStrip();
  syncBusyUi();
  startAutoRefreshLoop();

  el.userSelect.disabled = true;
  el.machineSelect.disabled = true;
  if (el.authEmail) {
    el.authEmail.value = (localStorage.getItem(STORAGE_KEYS.authEmail) || "").trim();
  }
  if (el.authPassword) {
    el.authPassword.value = "";
  }
  localStorage.removeItem("authPassword");
  setNewPasswordChallengeVisible(false);
  blurActiveAuthFieldOnInit();

  if (location.protocol === "file:") {
    setStatus("You opened frontend as file://. Browser will often block API calls (CORS). Open it with an http server.");
  }

  try {
    await loadAuthConfig();
    const restored = await restoreAuthFromStorageAndRefreshIfNeeded();
    if (restored) {
      setAuthLayoutVisible(true);
      setAuthStatus("Restoring saved session...", true);
      setStatus("Restoring saved session...", true);
      try {
        await bootstrapAuthenticatedApp();
      } catch (e) {
        clearAuthStorage();
        resetAuthState();
        setNewPasswordChallengeVisible(false);
        setStatus("Stored session is invalid. Please sign in again.");
        setAuthStatus(`Session reset: ${e.message}`);
        setAuthLayoutVisible(false);
      }
    } else {
      setStatus("Sign in to continue.", true);
      setAuthStatus("Not signed in");
      setAuthLayoutVisible(false);
    }
  } catch (e) {
    setStatus(`Failed to initialize frontend: ${e.message}`);
    setAuthStatus(`Initialization failed: ${e.message}`);
    setAuthLayoutVisible(false);
  }

  syncBusyUi();
}

init();

