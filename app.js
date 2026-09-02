// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registered');
    }).catch(err => {
      console.log('SW registration failed');
    });
  });
}

// --- State Management ---
let state = JSON.parse(localStorage.getItem('sienta_app_state')) || {
  activeVehicleId: 'v1',
  vehicles: [
    {
      id: 'v1',
      name: 'SIENTA',
      sub: 'URBAN KHAKI',
      themeColor: '#7A8B76',
      settings: {
        baseMpg: 10.0,
        targetAmount: 350000,
        gasPrice: 160,
        tankCapacity: 36, // SIENTA ハイブリッドの燃料タンク容量
        oilInterval: 5000,
        lastOilChangeOdo: 0
      },
      logs: [],
      maintenance: []
    }
  ]
};

let mpgChart = null;

function saveState() {
  localStorage.setItem('sienta_app_state', JSON.stringify(state));
}

function getActiveVehicle() {
  return state.vehicles.find(v => v.id === state.activeVehicleId) || state.vehicles[0];
}

// --- Theme Management ---
function applyVehicleTheme(color) {
  const root = document.documentElement;
  const hex = color || '#7A8B76';
  root.style.setProperty('--color-khaki', hex);
  const rgb = hexToRgb(hex);
  if (rgb) {
    root.style.setProperty('--color-khaki-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
    root.style.setProperty('--color-khaki-dark', `rgb(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)})`);
  }
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

// --- Navigation ---
const allNavItems = document.querySelectorAll('.nav-item, .sidebar-item');
allNavItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetId = item.getAttribute('data-target');
    allNavItems.forEach(nav => nav.classList.toggle('active', nav.getAttribute('data-target') === targetId));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === targetId));
    if (targetId === 'view-dashboard') updateDashboard();
    if (targetId === 'view-history') renderHistory();
    if (targetId === 'view-maintenance') renderMaintenance();
  });
});

// --- UI Sync ---
function updateUI() {
  const vehicle = getActiveVehicle();
  if (!vehicle.maintenance) vehicle.maintenance = []; // Migration
  applyVehicleTheme(vehicle.themeColor);
  
  document.getElementById('display-car-name').textContent = vehicle.name;
  document.getElementById('display-car-sub').textContent = vehicle.sub;
  
  const switcher = document.getElementById('vehicle-switcher');
  switcher.innerHTML = state.vehicles.map(v => 
    `<option value="${v.id}" ${v.id === state.activeVehicleId ? 'selected' : ''}>${v.name}</option>`
  ).join('');

  // Settings
  document.getElementById('setting-car-name').value = vehicle.name;
  document.getElementById('setting-car-sub').value = vehicle.sub;
  document.getElementById('setting-theme-color').value = vehicle.themeColor || '#7A8B76';
  document.getElementById('setting-base-mpg').value = vehicle.settings.baseMpg;
  document.getElementById('setting-target').value = vehicle.settings.targetAmount;
  document.getElementById('setting-gas-price').value = vehicle.settings.gasPrice;
  document.getElementById('setting-tank-capacity').value = vehicle.settings.tankCapacity || 36;
  document.getElementById('setting-oil-interval').value = vehicle.settings.oilInterval;
  document.getElementById('setting-last-oil').value = vehicle.settings.lastOilChangeOdo;

  const garageList = document.getElementById('garage-list');
  garageList.innerHTML = state.vehicles.map(v => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--color-bg); border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${v.themeColor || '#7A8B76'};">
      <div>
        <div style="font-weight: 700;">${v.name}</div>
        <div style="font-size: 0.75rem; color: var(--color-text-light);">${v.sub}</div>
      </div>
      ${state.vehicles.length > 1 ? `<button onclick="deleteVehicle('${v.id}')" style="background:none;border:none;color:var(--color-danger);cursor:pointer;"><i data-lucide="trash-2" style="width:18px"></i></button>` : ''}
    </div>
  `).join('');
  
  lucide.createIcons();
  updateDashboard();
}

// --- Events ---
document.getElementById('vehicle-switcher').addEventListener('change', (e) => {
  state.activeVehicleId = e.target.value;
  saveState();
  updateUI();
});

document.getElementById('add-vehicle-btn').addEventListener('click', () => {
  const name = prompt('車両名を入力してください', '新しい車');
  if (name) {
    const id = 'v' + Date.now();
    state.vehicles.push({ id, name, sub: 'Grade', themeColor: '#7A8B76', settings: { ...state.vehicles[0].settings }, logs: [], maintenance: [] });
    state.activeVehicleId = id;
    saveState();
    updateUI();
  }
});

window.deleteVehicle = (id) => {
  if (confirm('削除しますか？')) {
    state.vehicles = state.vehicles.filter(v => v.id !== id);
    if (state.activeVehicleId === id) state.activeVehicleId = state.vehicles[0].id;
    saveState();
    updateUI();
  }
};

document.getElementById('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = getActiveVehicle();
  v.name = document.getElementById('setting-car-name').value;
  v.sub = document.getElementById('setting-car-sub').value;
  v.themeColor = document.getElementById('setting-theme-color').value;
  v.settings = {
    baseMpg: parseFloat(document.getElementById('setting-base-mpg').value),
    targetAmount: parseInt(document.getElementById('setting-target').value),
    gasPrice: parseInt(document.getElementById('setting-gas-price').value),
    tankCapacity: parseInt(document.getElementById('setting-tank-capacity').value),
    oilInterval: parseInt(document.getElementById('setting-oil-interval').value),
    lastOilChangeOdo: parseFloat(document.getElementById('setting-last-oil').value)
  };
  saveState();
  updateUI();
  alert('保存しました');
});

document.getElementById('setting-theme-color').addEventListener('input', (e) => {
  applyVehicleTheme(e.target.value);
});

document.querySelectorAll('.color-preset').forEach(preset => {
  preset.addEventListener('click', () => {
    const color = preset.getAttribute('data-color');
    document.getElementById('setting-theme-color').value = color;
    applyVehicleTheme(color);
  });
});

// --- Fuel Log Edit/Delete ---
let editingLogId = null;

function startEditLog(id) {
  const v = getActiveVehicle();
  const log = v.logs.find(l => l.id === id);
  if (!log) return;
  editingLogId = id;
  document.getElementById('input-date').value = log.date;
  document.getElementById('input-odo').value = log.odo;
  document.getElementById('input-liters').value = log.liters;
  document.getElementById('input-price').value = log.price;
  document.getElementById('input-full').checked = log.isFull;
  document.getElementById('input-winter').checked = log.isWinter;
  document.getElementById('fuel-form-title').textContent = '給油記録を編集';
  document.getElementById('fuel-submit-btn').textContent = '更新する';
  document.getElementById('fuel-edit-banner').style.display = 'flex';
  document.querySelector('.sidebar-item[data-target="view-add"]').click();
}

function cancelEditLog() {
  editingLogId = null;
  document.getElementById('fuel-form').reset();
  document.getElementById('input-date').valueAsDate = new Date();
  document.getElementById('input-full').checked = true;
  document.getElementById('fuel-form-title').textContent = '給油記録を入力';
  document.getElementById('fuel-submit-btn').textContent = '記録を保存';
  document.getElementById('fuel-edit-banner').style.display = 'none';
}
document.getElementById('fuel-edit-cancel').addEventListener('click', cancelEditLog);

window.editLog = (id) => startEditLog(id);
window.deleteLog = (id) => {
  if (confirm('この給油記録を削除しますか？')) {
    const v = getActiveVehicle();
    v.logs = v.logs.filter(l => l.id !== id);
    saveState();
    renderHistory();
    updateDashboard();
  }
};

document.getElementById('fuel-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = getActiveVehicle();
  const entry = {
    date: document.getElementById('input-date').value,
    odo: parseFloat(document.getElementById('input-odo').value),
    liters: parseFloat(document.getElementById('input-liters').value),
    price: parseInt(document.getElementById('input-price').value),
    isFull: document.getElementById('input-full').checked,
    isWinter: document.getElementById('input-winter').checked
  };
  const wasEditing = !!editingLogId;
  if (wasEditing) {
    const idx = v.logs.findIndex(l => l.id === editingLogId);
    if (idx !== -1) v.logs[idx] = { ...v.logs[idx], ...entry };
  } else {
    v.logs.push({ id: Date.now().toString(), ...entry });
  }
  v.logs.sort((a,b) => new Date(a.date) - new Date(b.date));
  saveState();
  cancelEditLog();
  alert(wasEditing ? '更新しました' : '記録しました');
  document.querySelector('.sidebar-item[data-target="view-dashboard"]').click();
});

// --- Maintenance Edit/Delete ---
let editingMaintId = null;

function startEditMaint(id) {
  const v = getActiveVehicle();
  const m = v.maintenance.find(x => x.id === id);
  if (!m) return;
  editingMaintId = id;
  document.getElementById('maint-category').value = m.category;
  document.getElementById('maint-date').value = m.date;
  document.getElementById('maint-price').value = m.price || '';
  document.getElementById('maint-note').value = m.note || '';
  document.getElementById('maint-form-title').textContent = 'メンテナンス記録を編集';
  document.getElementById('maint-submit-btn').textContent = '更新する';
  document.getElementById('maint-edit-banner').style.display = 'flex';
  document.querySelector('.sidebar-item[data-target="view-maintenance"]').click();
}

function cancelEditMaint() {
  editingMaintId = null;
  document.getElementById('maintenance-form').reset();
  document.getElementById('maint-date').valueAsDate = new Date();
  document.getElementById('maint-form-title').textContent = 'メンテナンス記録';
  document.getElementById('maint-submit-btn').textContent = 'メンテナンスを記録';
  document.getElementById('maint-edit-banner').style.display = 'none';
}
document.getElementById('maint-edit-cancel').addEventListener('click', cancelEditMaint);

window.editMaint = (id) => startEditMaint(id);
window.deleteMaint = (id) => {
  if (confirm('この記録を削除しますか？')) {
    const v = getActiveVehicle();
    v.maintenance = v.maintenance.filter(m => m.id !== id);
    saveState();
    renderMaintenance();
    updateDashboard();
  }
};

document.getElementById('maintenance-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = getActiveVehicle();
  const entry = {
    category: document.getElementById('maint-category').value,
    date: document.getElementById('maint-date').value,
    price: parseInt(document.getElementById('maint-price').value) || 0,
    note: document.getElementById('maint-note').value
  };
  const wasEditing = !!editingMaintId;
  if (wasEditing) {
    const idx = v.maintenance.findIndex(m => m.id === editingMaintId);
    if (idx !== -1) v.maintenance[idx] = { ...v.maintenance[idx], ...entry };
  } else {
    v.maintenance.push({ id: Date.now().toString(), ...entry });
  }
  v.maintenance.sort((a,b) => new Date(b.date) - new Date(a.date));
  saveState();
  cancelEditMaint();
  alert(wasEditing ? '更新しました' : 'メンテナンスを記録しました');
  renderMaintenance();
  updateDashboard();
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if(confirm('初期化しますか？')) { localStorage.clear(); location.reload(); }
});

// --- Full State Backup (for moving data between devices, no cloud) ---
document.getElementById('export-backup-btn').addEventListener('click', () => {
  const json = JSON.stringify(state, null, 2);
  const today = new Date().toISOString().slice(0, 10);
  downloadFile(json, `SIENTA_Tracker_バックアップ_${today}.json`, 'application/json');
});
document.getElementById('import-backup-trigger').addEventListener('click', () => { document.getElementById('import-backup-file').click(); });
document.getElementById('import-backup-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    let data;
    try {
      data = JSON.parse(event.target.result);
    } catch (err) {
      alert('ファイルを読み込めませんでした（JSON形式ではありません）');
      return;
    }
    if (!data || !Array.isArray(data.vehicles) || data.vehicles.length === 0) {
      alert('バックアップファイルの形式が正しくありません');
      return;
    }
    if (confirm('この端末の現在のデータは上書きされます。読み込みますか？')) {
      state = data;
      saveState();
      updateUI();
      alert('復元しました');
    }
  };
  reader.readAsText(file);
});

// --- CSV Features ---
const CSV_HEADER_JP = "日付,走行距離(km),給油量(L),金額(円),満タンフラグ(1:はい/0:いいえ),冬タイヤフラグ(1:はい/0:いいえ)";
document.getElementById('export-csv-btn').addEventListener('click', () => {
  const v = getActiveVehicle();
  let csv = "\uFEFF" + CSV_HEADER_JP + "\n";
  v.logs.forEach(l => { csv += `${l.date},${l.odo},${l.liters},${l.price},${l.isFull?1:0},${l.isWinter?1:0}\n`; });
  downloadFile(csv, `${v.name}_給油ログ.csv`, 'text/csv');
});
document.getElementById('import-csv-trigger').addEventListener('click', () => { document.getElementById('import-csv-file').click(); });
document.getElementById('import-csv-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target.result;
    const lines = text.split('\n');
    const v = getActiveVehicle();
    const newLogs = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim(); if (!line) continue;
      const cols = line.split(','); if (cols.length < 4) continue;
      newLogs.push({ id: (Date.now() + i).toString(), date: cols[0].replace("\uFEFF", ""), odo: parseFloat(cols[1]), liters: parseFloat(cols[2]), price: parseInt(cols[3]), isFull: cols[4] === "1", isWinter: cols[5] === "1" });
    }
    if (newLogs.length > 0 && confirm('追加しますか？')) {
      v.logs = [...v.logs, ...newLogs]; v.logs.sort((a,b) => new Date(a.date) - new Date(b.date));
      saveState(); updateUI(); alert('完了');
    }
  };
  reader.readAsText(file);
});
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

// Minimal RFC4180-style parser: handles "quoted, with commas" fields (メモ欄用)
function parseCsvLine(line) {
  const result = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { result.push(cur); cur = ''; }
      else cur += c;
    }
  }
  result.push(cur);
  return result;
}

// --- Maintenance CSV Features ---
const MAINT_CAT_JP = { wash: '洗車', tire: 'タイヤ', inspection: '点検', other: 'その他' };
const MAINT_CAT_FROM_JP = { '洗車': 'wash', 'タイヤ': 'tire', '点検': 'inspection', 'その他': 'other' };
const MAINT_CSV_HEADER = "日付,区分,金額(円),メモ";

document.getElementById('maint-export-csv-btn').addEventListener('click', () => {
  const v = getActiveVehicle();
  let csv = "\uFEFF" + MAINT_CSV_HEADER + "\n";
  v.maintenance.forEach(m => {
    const note = (m.note || '').replace(/"/g, '""');
    csv += `${m.date},${MAINT_CAT_JP[m.category] || m.category},${m.price || 0},"${note}"\n`;
  });
  downloadFile(csv, `${v.name}_メンテナンス記録.csv`, 'text/csv');
});
document.getElementById('maint-import-csv-trigger').addEventListener('click', () => { document.getElementById('maint-import-csv-file').click(); });
document.getElementById('maint-import-csv-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const lines = event.target.result.split('\n');
    const v = getActiveVehicle();
    const newRecords = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim().replace(/^\uFEFF/, ''); if (!line) continue;
      const cols = parseCsvLine(line); if (cols.length < 2) continue;
      newRecords.push({
        id: (Date.now() + i).toString(),
        date: cols[0],
        category: MAINT_CAT_FROM_JP[cols[1]] || 'other',
        price: parseInt(cols[2]) || 0,
        note: cols[3] || ''
      });
    }
    if (newRecords.length > 0 && confirm(`${newRecords.length}件を追加しますか？`)) {
      v.maintenance = [...v.maintenance, ...newRecords];
      v.maintenance.sort((a,b) => new Date(b.date) - new Date(a.date));
      saveState(); renderMaintenance(); updateDashboard(); alert('完了');
    }
  };
  reader.readAsText(file);
});

// --- Fuel Economy Calculation ---
// 区間燃費は満タン給油から次の満タン給油まででしか出せない。途中の継ぎ足し給油の
// 給油量も足し込まないと、その区間の燃費が実際より良く出てしまうため、
// 前回満タン以降の給油量を累計して距離を割る。
function computeMpg(logs) {
  let lastFullIdx = -1;
  let litersSinceFull = 0;
  return logs.map((l, i) => {
    litersSinceFull += l.liters;
    let mpg = null;
    if (l.isFull) {
      if (lastFullIdx >= 0 && litersSinceFull > 0) {
        mpg = (l.odo - logs[lastFullIdx].odo) / litersSinceFull;
      }
      lastFullIdx = i;
      litersSinceFull = 0;
    }
    return { ...l, mpg };
  });
}

// --- Yearly Summary ---
// 走行距離・平均燃費は、給油記録の区間(前回オド〜今回オド)を「今回の給油日の年」に
// 丸ごと計上する（年をまたぐ区間の厳密な日割りはしない）。ただし最初の給油はオド
// メーターの基準点なので区間には含まれない一方、その時払った金額は実際の出費なので
// ガソリン代の集計には別途含める。
function computeYearlySummary(logs, maintenance) {
  const years = {};
  const get = (y) => (years[y] || (years[y] = { dist: 0, intervalLiters: 0, gasCost: 0, maintCost: 0 }));
  for (let i = 1; i < logs.length; i++) {
    const y = get(logs[i].date.slice(0, 4));
    y.dist += logs[i].odo - logs[i - 1].odo;
    y.intervalLiters += logs[i].liters;
  }
  logs.forEach(l => { get(l.date.slice(0, 4)).gasCost += l.price; });
  (maintenance || []).forEach(m => {
    get(m.date.slice(0, 4)).maintCost += (m.price || 0);
  });
  return Object.keys(years).sort().reverse().map(y => {
    const d = years[y];
    return {
      year: y, dist: d.dist, gasCost: d.gasCost, maintCost: d.maintCost,
      avgMpg: d.intervalLiters > 0 ? d.dist / d.intervalLiters : null,
      total: d.gasCost + d.maintCost,
      _intervalLiters: d.intervalLiters,
    };
  });
}

function renderYearlySummary() {
  const v = getActiveVehicle();
  const container = document.getElementById('yearly-summary');
  const rows = computeYearlySummary(v.logs, v.maintenance);
  if (rows.length === 0) { container.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">記録なし</p>'; return; }
  let html = '<table class="summary-table"><thead><tr><th>年</th><th>走行距離</th><th>平均燃費</th><th>ガソリン代</th><th>整備費</th><th>合計</th></tr></thead><tbody>';
  let sumDist = 0, sumLiters = 0, sumGas = 0, sumMaint = 0;
  rows.forEach(r => {
    sumDist += r.dist; sumLiters += r._intervalLiters; sumGas += r.gasCost; sumMaint += r.maintCost;
    html += `<tr class="summary-year-row">
      <td>${r.year}</td>
      <td>${r.dist.toLocaleString()} km</td>
      <td>${r.avgMpg !== null ? r.avgMpg.toFixed(1) + ' km/L' : '--'}</td>
      <td>¥${r.gasCost.toLocaleString()}</td>
      <td>${r.maintCost > 0 ? '¥' + r.maintCost.toLocaleString() : '-'}</td>
      <td>¥${r.total.toLocaleString()}</td>
    </tr>`;
  });
  html += `</tbody><tfoot><tr>
    <td>合計</td>
    <td>${sumDist.toLocaleString()} km</td>
    <td>${sumLiters > 0 ? (sumDist / sumLiters).toFixed(1) + ' km/L' : '--'}</td>
    <td>¥${sumGas.toLocaleString()}</td>
    <td>${sumMaint > 0 ? '¥' + sumMaint.toLocaleString() : '-'}</td>
    <td>¥${(sumGas + sumMaint).toLocaleString()}</td>
  </tr></tfoot></table>`;
  container.innerHTML = html;
}

// --- Seasonal / Tire Analysis ---
// 区間燃費(computeMpgのmpg)を、その区間を締めた給油の冬タイヤフラグで振り分ける。
function computeSeasonalComparison(logs) {
  const processed = computeMpg(logs);
  const winter = [], summer = [];
  processed.forEach(p => {
    if (p.mpg === null) return;
    (p.isWinter ? winter : summer).push(p.mpg);
  });
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    winterAvg: avg(winter), winterCount: winter.length,
    summerAvg: avg(summer), summerCount: summer.length,
  };
}

// 区間燃費を、その区間を締めた給油の月(1〜12月、年をまたいで集約)ごとに平均する。
function computeMonthlyAverage(logs) {
  const processed = computeMpg(logs);
  const months = Array.from({ length: 12 }, () => []);
  processed.forEach(p => {
    if (p.mpg === null) return;
    months[parseInt(p.date.slice(5, 7), 10) - 1].push(p.mpg);
  });
  return months.map((arr, i) => ({
    month: i + 1,
    avg: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
    count: arr.length,
  }));
}

let monthlyChart = null;
function renderSeasonalAnalysis() {
  const v = getActiveVehicle();
  const seasonal = computeSeasonalComparison(v.logs);
  const hasData = seasonal.winterCount + seasonal.summerCount > 0;
  document.getElementById('seasonal-empty').style.display = hasData ? 'none' : 'block';
  document.getElementById('seasonal-content').style.display = hasData ? 'block' : 'none';
  if (!hasData) { if (monthlyChart) { monthlyChart.destroy(); monthlyChart = null; } return; }

  document.getElementById('winter-avg-mpg').textContent = seasonal.winterAvg !== null ? seasonal.winterAvg.toFixed(1) : '--.-';
  document.getElementById('winter-count').textContent = seasonal.winterCount;
  document.getElementById('summer-avg-mpg').textContent = seasonal.summerAvg !== null ? seasonal.summerAvg.toFixed(1) : '--.-';
  document.getElementById('summer-count').textContent = seasonal.summerCount;

  const monthly = computeMonthlyAverage(v.logs);
  const ctx = document.getElementById('monthlyChart').getContext('2d');
  if (monthlyChart) monthlyChart.destroy();
  const color = v.themeColor || '#7A8B76';
  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthly.map(m => m.month + '月'),
      datasets: [{
        label: '平均燃費 (km/L)',
        data: monthly.map(m => m.avg),
        backgroundColor: monthly.map(m => m.avg !== null ? color : '#e0e5df'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.parsed.y !== null ? ctx.parsed.y.toFixed(1) + ' km/L' : 'データなし' } }
      },
      scales: { y: { display: false, beginAtZero: true }, x: { grid: { display: false } } }
    }
  });
}

// --- Eco Rank Logic ---
const ECO_RANKS = [
  { threshold: 0, name: "ECO BEGINNER", icon: "🌱", color: "#6b726a" },
  { threshold: 15, name: "ECO DRIVER", icon: "🍃", color: "#7A8B76" },
  { threshold: 20, name: "ECO EXPERT", icon: "🌿", color: "#4caf50" },
  { threshold: 25, name: "ECO KING", icon: "👑", color: "#e6b86a" }
];

function calculateEcoRank(avgMpg) {
  return ECO_RANKS.filter(r => avgMpg >= r.threshold).pop();
}

// --- Tire Change Prediction ---
// 冬タイヤ/夏タイヤの組み替えはだいたい半年おき（12月頃と4月頃）なので、
// 最後の「タイヤ」区分の記録から6ヶ月後を次回の目安として出す。
function predictNextTireChange(maintenance) {
  const tireRecords = (maintenance || []).filter(m => m.category === 'tire');
  if (tireRecords.length === 0) return null;
  const lastDate = tireRecords.map(m => m.date).sort().pop();
  const next = new Date(lastDate);
  next.setMonth(next.getMonth() + 6);
  return next;
}

// --- Dashboard Logic ---
function updateDashboard() {
  const v = getActiveVehicle();
  const logs = v.logs;
  const s = v.settings;
  const color = v.themeColor || '#7A8B76';

  document.getElementById('latest-mpg').textContent = '--.-';
  document.getElementById('mpg-diff').textContent = '--';
  document.getElementById('avg-mpg').textContent = '--.-';
  document.getElementById('avg-mpg-summary').textContent = '--.-';
  document.getElementById('total-distance').textContent = '0';
  document.getElementById('predicted-range').textContent = '--';
  document.getElementById('last-wash-days').textContent = '--';
  document.getElementById('target-amount').textContent = '¥' + s.targetAmount.toLocaleString();
  document.getElementById('recovered-amount').textContent = '¥0';
  document.getElementById('recovery-percent').textContent = '0%';
  document.getElementById('recovery-progress').style.width = '0%';
  document.getElementById('recovery-progress').classList.remove('shimmer');
  document.getElementById('eco-rank-icon').textContent = ECO_RANKS[0].icon;
  document.getElementById('eco-rank-name').textContent = ECO_RANKS[0].name;
  document.getElementById('eco-rank-name').style.color = ECO_RANKS[0].color;
  document.getElementById('reward-banner-container').innerHTML = '';
  document.getElementById('maintenance-alert-container').innerHTML = '';
  document.getElementById('next-tire-date').textContent = '--';
  document.getElementById('next-tire-sub').textContent = '記録がありません';

  // Last Wash / Next Tire Change: based on maintenance records only, so these must
  // run even when there are zero fuel logs yet (i.e. before the early return below).
  const lastWash = v.maintenance?.find(m => m.category === 'wash');
  if (lastWash) {
    const diff = Math.floor((new Date() - new Date(lastWash.date)) / (1000 * 60 * 60 * 24));
    document.getElementById('last-wash-days').textContent = diff;
  }
  const nextTire = predictNextTireChange(v.maintenance);
  if (nextTire) {
    document.getElementById('next-tire-date').textContent = nextTire.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    const daysUntil = Math.ceil((nextTire - new Date()) / (1000 * 60 * 60 * 24));
    document.getElementById('next-tire-sub').textContent = daysUntil > 0 ? `あと約${daysUntil}日` : '時期を過ぎています';
  }

  if (logs.length === 0) { if (mpgChart) mpgChart.destroy(); return; }

  const processed = computeMpg(logs);

  const last = processed[processed.length - 1];
  const lastWithMpg = [...processed].reverse().find(p => p.mpg !== null);
  document.getElementById('latest-mpg').textContent = lastWithMpg ? lastWithMpg.mpg.toFixed(1) : '--.-';
  document.getElementById('total-distance').textContent = last.odo.toLocaleString();

  const validMpgs = processed.filter(d => d.mpg !== null);
  if (validMpgs.length > 1) {
    const diff = validMpgs[validMpgs.length - 1].mpg - validMpgs[validMpgs.length - 2].mpg;
    document.getElementById('mpg-diff').textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' km/L';
  }

  if (logs.length > 1) {
    const totalDist = last.odo - logs[0].odo;
    let totalL = 0; let totalP = 0;
    for(let i=1; i<logs.length; i++) { totalL += logs[i].liters; totalP += logs[i].price; }
    const avgMpg = totalDist / totalL;
    document.getElementById('avg-mpg').textContent = avgMpg.toFixed(1);
    document.getElementById('avg-mpg-summary').textContent = avgMpg.toFixed(1);
    document.getElementById('predicted-range').textContent = Math.round(avgMpg * (s.tankCapacity || 36));
    
    // Eco Rank
    const rank = calculateEcoRank(avgMpg);
    document.getElementById('eco-rank-icon').textContent = rank.icon;
    document.getElementById('eco-rank-name').textContent = rank.name;
    document.getElementById('eco-rank-name').style.color = rank.color;

    const baseCost = (totalDist / s.baseMpg) * s.gasPrice;
    const recovered = Math.max(0, baseCost - totalP);
    document.getElementById('recovered-amount').textContent = '¥' + Math.floor(recovered).toLocaleString();
    const pct = (recovered / s.targetAmount) * 100;
    document.getElementById('recovery-percent').textContent = pct.toFixed(1) + '%';
    document.getElementById('recovery-progress').style.width = Math.min(100, pct) + '%';
    document.getElementById('recovery-progress').classList.toggle('shimmer', pct >= 100);
    renderRewards(recovered, s.targetAmount);
  }

  // Oil Change
  const nextOil = s.lastOilChangeOdo + s.oilInterval;
  const rem = nextOil - last.odo;
  document.getElementById('next-oil-change').textContent = nextOil.toLocaleString();
  document.getElementById('oil-remaining').textContent = Math.max(0, rem).toLocaleString();
  if (rem < 500) {
    document.getElementById('maintenance-alert-container').innerHTML = `<div class="alert-maintenance"><i data-lucide="alert-triangle"></i><span>オイル交換時期です</span></div>`;
    lucide.createIcons();
  }

  updateCharts(processed, color);
}

function updateCharts(data, color) {
  const ctx = document.getElementById('mpgChart').getContext('2d');
  const chartData = data.filter(d => d.mpg !== null).slice(-10);
  if (mpgChart) mpgChart.destroy();
  mpgChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.map(d => new Date(d.date).toLocaleDateString('ja-JP', {month:'short', day:'numeric'})),
      datasets: [{
        label: '燃費 (km/L)', data: chartData.map(d => d.mpg), borderColor: color, backgroundColor: color + '1a', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4, pointBackgroundColor: color
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false } } } }
  });
}

function renderRewards(recovered, target) {
  const container = document.getElementById('reward-banner-container');
  const rewards = [
    { threshold: 5000, msg: "ちょっと豪華なランチに行けそうです！", icon: "🍱" },
    { threshold: 15000, msg: "家族で美味しいお寿司が食べられます！", icon: "🍣" },
    { threshold: 50000, msg: "一泊旅行の資金が貯まりました！", icon: "🏨" },
    { threshold: 100000, msg: "大物家電が買えそうな節約額です！", icon: "📺" },
    { threshold: target, msg: "ハイブリッド代完済！おめでとう！", icon: "🎉" }
  ];
  const achieved = rewards.filter(r => recovered >= r.threshold).pop();
  if (achieved) container.innerHTML = `<div class="reward-banner"><span class="reward-icon">${achieved.icon}</span><div class="reward-text">${achieved.msg}</div></div>`;
}

function renderHistory() {
  renderYearlySummary();
  renderSeasonalAnalysis();
  const v = getActiveVehicle();
  const container = document.getElementById('history-list');
  if (v.logs.length === 0) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">記録なし</p>'; return; }
  const processed = computeMpg(v.logs);
  let html = '';
  let lastYear = null;
  for (let i = processed.length - 1; i >= 0; i--) {
    const l = processed[i];
    const year = l.date.slice(0, 4);
    if (year !== lastYear) {
      html += `<div class="history-year-header">${year}年</div>`;
      lastYear = year;
    }
    const mpgHtml = l.mpg !== null
      ? `<div class="history-mpg">${l.mpg.toFixed(1)} <small>km/L</small></div>`
      : `<div class="history-mpg partial">${l.isFull ? '--.-' : '継ぎ足し'}</div>`;
    const dateStr = new Date(l.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
    html += `<div class="history-item" onclick="editLog('${l.id}')">
      <div class="history-main">
        <div class="history-date">${dateStr}<span class="history-odo">(${l.odo.toLocaleString()}km)</span>${l.isWinter ? ' <span class="badge-winter"><i data-lucide="snowflake" style="width:11px"></i>冬</span>' : ''}</div>
        <div class="history-details">${l.liters.toFixed(2)}L・¥${l.price.toLocaleString()}${!l.isFull ? '・継ぎ足し' : ''}</div>
      </div>
      <div class="history-mpg-col">${mpgHtml}</div>
      <button class="history-delete" onclick="event.stopPropagation(); deleteLog('${l.id}')" title="削除"><i data-lucide="trash-2" style="width:16px"></i></button>
    </div>`;
  }
  container.innerHTML = html;
  lucide.createIcons();
}

function renderMaintenance() {
  const v = getActiveVehicle();
  const container = document.getElementById('maintenance-list');
  if (!v.maintenance || v.maintenance.length === 0) { container.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">記録なし</p>'; return; }
  let html = '';
  v.maintenance.forEach(m => {
    html += `<div class="maint-item" onclick="editMaint('${m.id}')">
      <div class="maint-main">
        <div class="maint-title">${MAINT_CAT_JP[m.category] || m.category} <span class="maint-date">${m.date}</span></div>
        ${m.note ? `<div class="maint-note">${m.note}</div>` : ''}
      </div>
      ${m.price ? `<div class="maint-price">¥${m.price.toLocaleString()}</div>` : ''}
      <button class="history-delete" onclick="event.stopPropagation(); deleteMaint('${m.id}')" title="削除"><i data-lucide="trash-2" style="width:16px"></i></button>
    </div>`;
  });
  const totalCost = v.maintenance.reduce((sum, m) => sum + (m.price || 0), 0);
  if (totalCost > 0) {
    html += `<div class="maint-total"><span>累計整備費</span><span>¥${totalCost.toLocaleString()}</span></div>`;
  }
  container.innerHTML = html;
  lucide.createIcons();
}

document.getElementById('input-date').valueAsDate = new Date();
document.getElementById('maint-date').valueAsDate = new Date();

// --- 自動同期（PCの取込フォルダ → data.json → アプリ）---
// PC側で 取込/ にCSVを入れて「取り込む.bat」を実行すると data.json が更新され
// GitHubへpushされる。アプリはそれを起動時に読み、差分だけ足し込む。
// 端末側で直接入れた記録は消さない（追加のみ／削除は同期しない）。
const SYNC_URL = 'data-05873f399d42.json';  // 公開リポジトリなので推測されにくい名前にしている
const SYNC_STAMP_KEY = 'sienta_sync_last';

function syncLogKey(l) { return `${l.date}|${Number(l.odo)}|${Number(l.liters)}`; }
function syncMaintKey(m) { return `${m.date}|${m.category}|${Number(m.price) || 0}|${(m.note || '').trim()}`; }

function mergeVehicleData(local, remote) {
  let added = 0;
  if (!local.logs) local.logs = [];
  const seenLogs = new Set(local.logs.map(syncLogKey));
  (remote.logs || []).forEach(l => {
    const k = syncLogKey(l);
    if (seenLogs.has(k)) return;
    seenLogs.add(k);
    local.logs.push({ ...l, id: l.id || (Date.now() + Math.floor(Math.random() * 100000)).toString() });
    added++;
  });
  local.logs.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!local.maintenance) local.maintenance = [];
  const seenMaint = new Set(local.maintenance.map(syncMaintKey));
  (remote.maintenance || []).forEach(m => {
    const k = syncMaintKey(m);
    if (seenMaint.has(k)) return;
    seenMaint.add(k);
    local.maintenance.push({ ...m, id: m.id || (Date.now() + Math.floor(Math.random() * 100000)).toString() });
    added++;
  });
  local.maintenance.sort((a, b) => new Date(b.date) - new Date(a.date));
  return added;
}

function setSyncStatus(text) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = text;
}

async function syncFromCloud(manual) {
  setSyncStatus('同期中…');
  try {
    const res = await fetch(`${SYNC_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const remote = await res.json();
    if (!remote || !Array.isArray(remote.vehicles)) throw new Error('data.json の形式が不正');

    let added = 0;
    remote.vehicles.forEach(rv => {
      const lv = state.vehicles.find(v => v.id === rv.id) || state.vehicles.find(v => v.name === rv.name);
      if (!lv) {
        state.vehicles.push(JSON.parse(JSON.stringify(rv)));
        added += (rv.logs || []).length + (rv.maintenance || []).length;
        return;
      }
      added += mergeVehicleData(lv, rv);
    });

    if (added > 0) {
      saveState();
      updateUI();
      renderHistory();
      renderMaintenance();
    }
    const stamp = new Date().toLocaleString('ja-JP');
    localStorage.setItem(SYNC_STAMP_KEY, stamp);
    setSyncStatus(added > 0 ? `${stamp}　新しい記録 ${added}件を取り込みました` : `${stamp}　最新の状態です`);
    if (manual) alert(added > 0 ? `${added}件を取り込みました` : '新しい記録はありませんでした');
  } catch (err) {
    const last = localStorage.getItem(SYNC_STAMP_KEY);
    setSyncStatus(`同期できませんでした（${err.message}）${last ? '／前回: ' + last : ''}`);
    if (manual) alert('同期できませんでした: ' + err.message);
  }
}

const syncNowBtn = document.getElementById('sync-now-btn');
if (syncNowBtn) syncNowBtn.addEventListener('click', () => syncFromCloud(true));

// --- Initialization ---
// Must run last: relies on ECO_RANKS/calculateEcoRank/updateDashboard etc.
// being fully declared, and on all event listeners above being attached first.
lucide.createIcons();
updateUI();
syncFromCloud(false);
