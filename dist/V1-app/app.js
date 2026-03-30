const state = {
  apiBaseUrl: "",
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
  lightingMode: document.getElementById("lightingMode"),
  openLockerBtn: document.getElementById("openLockerBtn"),
  checkClosedBtn: document.getElementById("checkClosedBtn"),
  setPriceBtn: document.getElementById("setPriceBtn"),
  setColorBtn: document.getElementById("setColorBtn"),
  setLightingBtn: document.getElementById("setLightingBtn"),
  toggleSoldBtn: document.getElementById("toggleSoldBtn"),
  setTemp: document.getElementById("setTemp"),
  fanMode: document.getElementById("fanMode"),
  opMode: document.getElementById("opMode"),
  setTempBtn: document.getElementById("setTempBtn"),
  setFansBtn: document.getElementById("setFansBtn"),
  setOpModeBtn: document.getElementById("setOpModeBtn"),
  refreshStatusBtn: document.getElementById("refreshStatusBtn"),
  clearErrorBtn: document.getElementById("clearErrorBtn"),
  rebootRpiBtn: document.getElementById("rebootRpiBtn"),
  rebootStmBtn: document.getElementById("rebootStmBtn"),
  adminStats: document.getElementById("adminStats"),
  activityLogs: document.getElementById("activityLogs"),
  commandList: document.getElementById("commandList"),
};

function setStatus(message, ok = false) {
  el.statusBar.textContent = message;
  el.statusBar.classList.remove("ok", "error");
  if (message) {
    el.statusBar.classList.add(ok ? "ok" : "error");
  }
}

function toDisplay(v) {
  return v === null || v === undefined ? "-" : String(v);
}

function jsonPretty(obj) {
  return JSON.stringify(obj, null, 2);
}

async function api(path, options = {}) {
  const url = `${state.apiBaseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (e) {
    const reason = location.protocol === "file:"
      ? "Browser blocked request from file:// (CORS). Open frontend via http:// or enable CORS on API."
      : "Network/CORS error while calling API.";
    throw new Error(`${reason} URL=${url}`);
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
    throw new Error(msg);
  }
  return data;
}

function getSelectedUser() {
  return state.users.find((u) => u.user_id === state.selectedUserId) || null;
}

function getSelectedMachine() {
  return state.machines.find((m) => m.machine_id === state.selectedMachineId) || null;
}

function getSelectedLocker() {
  return state.lockers.find((l) => l.locker_id === state.selectedLockerId) || null;
}

function resetDashboard() {
  el.userInfo.textContent = "Select a user and machine.";
  el.machineInfo.textContent = "-";
  el.machineStatus.textContent = "-";
  el.adminStats.textContent = "Only shown for admin users.";
  el.activityLogs.textContent = "-";
  el.lockerGrid.innerHTML = "";
  state.lockers = [];
  state.selectedLockerId = null;
  state.machineStatus = null;
  setSelectedLockerText();
}

function setSelectedLockerText() {
  const locker = getSelectedLocker();
  if (!locker) {
    el.selectedLockerText.textContent = "No locker selected";
    return;
  }
  el.selectedLockerText.textContent = `Locker ${locker.locker_number} selected (id=${locker.locker_id})`;
}

function lockerColorClass(locker) {
  if (locker.is_open) return "orange";
  if (locker.sold) return "red";
  return "green";
}

function lockerStateLabel(locker) {
  if (locker.is_open) return "OPEN";
  if (locker.sold) return "SOLD";
  return "FREE";
}

function renderLockers() {
  el.lockerGrid.innerHTML = "";
  if (!state.lockers.length) {
    el.lockerGrid.innerHTML = "<p class='subtle'>No lockers found for this machine.</p>";
    return;
  }

  state.lockers.forEach((locker) => {
    const button = document.createElement("button");
    button.className = `locker-btn ${lockerColorClass(locker)}${locker.locker_id === state.selectedLockerId ? " active" : ""}`;
    button.innerHTML = `<span>L${locker.locker_number}</span><small>${lockerStateLabel(locker)}</small>`;
    button.addEventListener("click", () => {
      state.selectedLockerId = locker.locker_id;
      setSelectedLockerText();
      el.lockerPrice.value = locker.price ?? "";
      el.colorR.value = locker.color_r ?? "";
      el.colorG.value = locker.color_g ?? "";
      el.colorB.value = locker.color_b ?? "";
      el.lightingMode.value = locker.lighting_mode ?? "";
      renderLockers();
    });
    el.lockerGrid.appendChild(button);
  });
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

async function loadInitial() {
  state.apiBaseUrl = el.apiBaseUrl.value.trim().replace(/\/$/, "");
  if (!state.apiBaseUrl) {
    throw new Error("API URL is empty. Paste the ApiUrl output from DevApplicationStack (execute-api URL).");
  }
  const [users, machines, commands] = await Promise.all([
    api("/users"),
    api("/machines"),
    api("/command_definitions"),
  ]);

  state.users = users;
  state.machines = machines;
  populateUsers();
  renderCommandDefinitions(commands);
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

  if (!state.selectedUserId) return;

  const allowed = [];
  for (const machine of state.machines) {
    const actors = await api(`/machines/${machine.machine_id}/actors`).catch(() => []);
    const isAllowedForMachine = actors.some((x) => x.user_id === state.selectedUserId);
    if (!isAllowedForMachine) {
      continue;
    }

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
    return;
  }
  setStatus(`Loaded ${allowed.length} allowed machines for selected user.`, true);
}

function onMachineSelected() {
  resetDashboard();
  state.selectedMachineId = el.machineSelect.value ? Number(el.machineSelect.value) : null;
  if (!state.selectedMachineId) {
    state.selectedCompanyId = null;
    state.selectedRole = null;
    return;
  }

  const selected = state.allowedMachines.find((x) => x.machine.machine_id === state.selectedMachineId);
  state.selectedCompanyId = selected ? selected.companyId : null;
  state.selectedRole = selected ? selected.role : null;
}

async function loadDashboard() {
  if (!state.selectedUserId) {
    setStatus("Choose a user.");
    return;
  }
  if (!state.selectedMachineId) {
    setStatus("Choose a machine.");
    return;
  }

  const machineId = state.selectedMachineId;
  const [user, machine, status, lockers, activityLogs] = await Promise.all([
    api(`/users/${state.selectedUserId}`),
    api(`/machines/${machineId}`),
    api(`/machine_status/${machineId}`).catch(() => null),
    api(`/lockers?machine_id=${machineId}`),
    api(`/activity_logs?machine_id=${machineId}&limit=20`).catch(() => []),
  ]);

  state.machineStatus = status;
  state.lockers = lockers;

  const userInfo = {
    user_id: user.user_id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    is_active: user.is_active,
    role: state.selectedRole,
    company_id: state.selectedCompanyId,
  };

  el.userInfo.textContent = jsonPretty(userInfo);
  el.machineInfo.textContent = jsonPretty(machine);
  el.machineStatus.textContent = status ? jsonPretty(status) : "No machine status found.";
  el.activityLogs.textContent = activityLogs.length ? jsonPretty(activityLogs) : "No activity logs found.";

  renderLockers();

  if (state.selectedRole === "admin") {
    await loadAdminStats(machineId);
  } else {
    el.adminStats.textContent = "Only shown for admin users.";
  }

  setStatus("Dashboard loaded successfully.", true);
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

  const summary = {
    purchases: {
      total_purchases: purchases.length,
      total_revenue_eur: Number(totalRevenue.toFixed(2)),
      average_purchase_eur: Number(avgPurchase.toFixed(2)),
    },
    climate: {
      total_logs: climate.length,
      avg_temperature: Number(avg(temps).toFixed(2)),
      min_temperature: Number(min(temps).toFixed(2)),
      max_temperature: Number(max(temps).toFixed(2)),
      avg_humidity: Number(avg(hums).toFixed(2)),
      min_humidity: Number(min(hums).toFixed(2)),
      max_humidity: Number(max(hums).toFixed(2)),
      last_5: climate.slice(0, 5),
    },
  };

  el.adminStats.textContent = jsonPretty(summary);
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

async function createActivity(commandId, payload, successful = true) {
  await api("/activity_logs", {
    method: "POST",
    body: JSON.stringify({
      user_id: state.selectedUserId,
      machine_id: state.selectedMachineId,
      locker_id: state.selectedLockerId,
      command_id: commandId,
      activity_data: JSON.stringify(payload || {}),
      successful,
    }),
  });
}

async function createAlert(alertId) {
  const locker = getSelectedLocker();
  await api("/alert_logs", {
    method: "POST",
    body: JSON.stringify({
      machine_id: state.selectedMachineId,
      locker_id: locker ? locker.locker_id : null,
      locker_number: locker ? locker.locker_number : null,
      alert_id: alertId,
    }),
  });
}

async function updateLocker(patch, commandId, alertId = null) {
  if (!requireContext({ locker: true })) return;

  await api(`/lockers/${state.selectedLockerId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });

  await createActivity(commandId, patch, true);
  if (alertId) {
    await createAlert(alertId);
  }

  await loadDashboard();
}

async function updateMachineStatusPatch(patch, commandId) {
  if (!requireContext()) return;

  const current = state.machineStatus || await api(`/machine_status/${state.selectedMachineId}`).catch(() => null);
  const merged = {
    current_temperature: current?.current_temperature ?? 0,
    current_humidity: current?.current_humidity ?? 0,
    set_temperature: current?.set_temperature ?? 0,
    op_mode: current?.op_mode ?? true,
    fan_mode: current?.fan_mode ?? 0,
    water_status: current?.water_status ?? true,
    internet_connected: current?.internet_connected ?? true,
    rpi_alive: current?.rpi_alive ?? true,
    stm32_alive: current?.stm32_alive ?? true,
    ...patch,
  };

  await api(`/machine_status/${state.selectedMachineId}`, {
    method: "POST",
    body: JSON.stringify(merged),
  });
  await createActivity(commandId, patch, true);
  await loadDashboard();
}

function renderCommandDefinitions(commands) {
  el.commandList.innerHTML = "";
  commands.forEach((cmd) => {
    const li = document.createElement("li");
    li.textContent = `${cmd.command_id}. ${cmd.command_name} (${cmd.command_key}) — ${cmd.command_description}`;
    el.commandList.appendChild(li);
  });
}

async function handleOpenLocker() {
  await updateLocker({ is_open: true }, 1, 2);
  setStatus("Locker opened command sent.", true);
}

async function handleCheckClosed() {
  if (!requireContext({ locker: true })) return;
  const locker = await api(`/lockers/${state.selectedLockerId}`);
  const isOpen = Boolean(locker.is_open);
  await createActivity(5, { check_result_open: isOpen }, !isOpen);

  if (isOpen) {
    await api("/error_logs", {
      method: "POST",
      body: JSON.stringify({
        machine_id: state.selectedMachineId,
        locker_id: locker.locker_id,
        locker_number: locker.locker_number,
        error_id: 1,
      }),
    });
    setStatus("Locker still open. Error log created.");
  } else {
    setStatus("Locker is closed.", true);
  }
  await loadDashboard();
}

async function handleSetPrice() {
  const price = Number(el.lockerPrice.value);
  if (!Number.isFinite(price) || price < 0) {
    setStatus("Price must be a number >= 0.");
    return;
  }
  await updateLocker({ price }, 2, 4);
  setStatus("Locker price updated.", true);
}

async function handleSetColor() {
  const color_r = Number(el.colorR.value);
  const color_g = Number(el.colorG.value);
  const color_b = Number(el.colorB.value);
  const all = [color_r, color_g, color_b];
  if (all.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) {
    setStatus("RGB values must be integers between 0 and 255.");
    return;
  }
  await updateLocker({ color_r, color_g, color_b }, 3, 5);
  setStatus("Locker color updated.", true);
}

async function handleSetLighting() {
  const lighting_mode = Number(el.lightingMode.value);
  if (!Number.isInteger(lighting_mode) || lighting_mode < 0 || lighting_mode > 10) {
    setStatus("Lighting mode must be integer 0..10.");
    return;
  }
  await updateLocker({ lighting_mode }, 4, 5);
  setStatus("Lighting mode updated.", true);
}

async function handleToggleSold() {
  if (!requireContext({ locker: true })) return;
  const locker = getSelectedLocker();
  await updateLocker({ sold: !locker.sold }, 2, 4);
  setStatus(`Locker sold state changed to ${!locker.sold}.`, true);
}

async function handleSetTemperature() {
  const set_temperature = Number(el.setTemp.value);
  if (!Number.isFinite(set_temperature)) {
    setStatus("Set temperature must be numeric.");
    return;
  }
  await updateMachineStatusPatch({ set_temperature }, 6);
  await createAlert(6);
  setStatus("Temperature updated.", true);
}

async function handleSetFans() {
  const fan_mode = Number(el.fanMode.value);
  if (!Number.isInteger(fan_mode) || fan_mode < 0 || fan_mode > 10) {
    setStatus("Fan mode must be integer 0..10.");
    return;
  }
  await updateMachineStatusPatch({ fan_mode }, 7);
  setStatus("Fan mode updated.", true);
}

async function handleSetOperationMode() {
  const op_mode = el.opMode.value === "true";
  await updateMachineStatusPatch({ op_mode }, 8);
  await createAlert(7);
  setStatus("Operation mode updated.", true);
}

async function handleRefreshStatus() {
  if (!requireContext()) return;
  await createActivity(9, { action: "refresh_dashboard" }, true);
  await loadDashboard();
  setStatus("Status refreshed.", true);
}

async function handleClearError() {
  if (!requireContext()) return;
  await createActivity(10, { action: "clear_error" }, true);
  setStatus("Clear error command logged.", true);
  await loadDashboard();
}

async function handleRebootRpi() {
  if (!requireContext()) return;
  await createActivity(11, { action: "reboot_rpi" }, true);
  setStatus("Reboot RPI command logged.", true);
  await loadDashboard();
}

async function handleRebootStm32() {
  if (!requireContext()) return;
  await createActivity(12, { action: "reboot_stm32" }, true);
  setStatus("Reboot STM32 command logged.", true);
  await loadDashboard();
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
  setStatus("");
}

function wireEvents() {
  el.apiBaseUrl.addEventListener("change", () => {
    state.apiBaseUrl = el.apiBaseUrl.value.trim().replace(/\/$/, "");
  });

  el.userSelect.addEventListener("change", () => {
    onUserSelected().catch((e) => setStatus(`Failed to load user machines: ${e.message}`));
  });

  el.machineSelect.addEventListener("change", onMachineSelected);
  el.loadBtn.addEventListener("click", () => loadDashboard().catch((e) => setStatus(`Failed to load dashboard: ${e.message}`)));
  el.clearBtn.addEventListener("click", clearAll);

  el.openLockerBtn.addEventListener("click", () => handleOpenLocker().catch((e) => setStatus(`Open locker failed: ${e.message}`)));
  el.checkClosedBtn.addEventListener("click", () => handleCheckClosed().catch((e) => setStatus(`Check closed failed: ${e.message}`)));
  el.setPriceBtn.addEventListener("click", () => handleSetPrice().catch((e) => setStatus(`Set price failed: ${e.message}`)));
  el.setColorBtn.addEventListener("click", () => handleSetColor().catch((e) => setStatus(`Set color failed: ${e.message}`)));
  el.setLightingBtn.addEventListener("click", () => handleSetLighting().catch((e) => setStatus(`Set lighting failed: ${e.message}`)));
  el.toggleSoldBtn.addEventListener("click", () => handleToggleSold().catch((e) => setStatus(`Toggle sold failed: ${e.message}`)));

  el.setTempBtn.addEventListener("click", () => handleSetTemperature().catch((e) => setStatus(`Set temperature failed: ${e.message}`)));
  el.setFansBtn.addEventListener("click", () => handleSetFans().catch((e) => setStatus(`Set fans failed: ${e.message}`)));
  el.setOpModeBtn.addEventListener("click", () => handleSetOperationMode().catch((e) => setStatus(`Set operation mode failed: ${e.message}`)));
  el.refreshStatusBtn.addEventListener("click", () => handleRefreshStatus().catch((e) => setStatus(`Refresh failed: ${e.message}`)));
  el.clearErrorBtn.addEventListener("click", () => handleClearError().catch((e) => setStatus(`Clear error failed: ${e.message}`)));
  el.rebootRpiBtn.addEventListener("click", () => handleRebootRpi().catch((e) => setStatus(`Reboot RPI failed: ${e.message}`)));
  el.rebootStmBtn.addEventListener("click", () => handleRebootStm32().catch((e) => setStatus(`Reboot STM32 failed: ${e.message}`)));
}

async function init() {
  wireEvents();

  if (location.protocol === "file:") {
    setStatus("You opened frontend as file://. Browser will often block API calls (CORS). Open it with an http server.");
  }

  try {
    await loadInitial();
  } catch (e) {
    setStatus(`Failed to initialize frontend: ${e.message}`);
  }
}

init();
