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

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyB3DS0hu-P7eEFESQGhTcuMURpO5rbhTTk",
  authDomain: "sienta-tracker2.firebaseapp.com",
  projectId: "sienta-tracker2",
  storageBucket: "sienta-tracker2.firebasestorage.app",
  messagingSenderId: "576622794850",
  appId: "1:576622794850:web:666ab766cd3f2d33fa593b"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;
let unsubscribeSnapshot = null;

// --- Auth Logic ---
document.getElementById('btn-login').addEventListener('click', () => {
  try {
    if (window.location.protocol === 'file:') {
      alert('【重要】パソコン内のファイル（file://）からはセキュリティの都合上ログインできません。\\n公開URL（ https://otti5426.github.io/sienta-tracker/ ）から開いてください。');
      return;
    }
    document.getElementById('login-loading').style.display = 'block';
    
    const provider = new firebase.auth.GoogleAuthProvider();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      auth.signInWithRedirect(provider).catch(err => {
        console.error(err);
        alert('ログインに失敗しました: ' + err.message);
        document.getElementById('login-loading').style.display = 'none';
      });
    } else {
      auth.signInWithPopup(provider).catch(err => {
        console.error(err);
        if (err.code === 'auth/popup-blocked') {
          alert('ブラウザのポップアップブロック機能によりログイン画面が開けませんでした。ブラウザの設定でポップアップを許可するか、URLバー右上のアイコンから許可してください。');
        } else {
          alert('ログインに失敗しました: ' + err.message);
        }
        document.getElementById('login-loading').style.display = 'none';
      });
    }
  } catch (e) {
    alert('予期せぬエラーが発生しました: ' + e.message);
    document.getElementById('login-loading').style.display = 'none';
  }
});

// Handle redirect result on load (for mobile)
auth.getRedirectResult().catch(err => {
  console.error(err);
  // Optional: alert('ログインエラーが発生しました');
});

document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('ログアウトしますか？')) auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    
    // Subscribe to Firestore
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = db.collection('users').doc(user.uid).onSnapshot(doc => {
      if (doc.exists) {
        state = doc.data();
        localStorage.setItem('sienta_app_state', JSON.stringify(state));
        updateUI();
      } else {
        // First login -> migrate existing local data to cloud
        saveState();
      }
    });
  } else {
    currentUser = null;
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-loading').style.display = 'none';
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }
});

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
        tankCapacity: 52,
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
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).set(state).catch(err => console.error('Error saving state:', err));
  }
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

// --- Initialization ---
lucide.createIcons();
updateUI();

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
  document.getElementById('setting-tank-capacity').value = vehicle.settings.tankCapacity || 52;
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

document.getElementById('fuel-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = getActiveVehicle();
  v.logs.push({
    id: Date.now().toString(),
    date: document.getElementById('input-date').value,
    odo: parseFloat(document.getElementById('input-odo').value),
    liters: parseFloat(document.getElementById('input-liters').value),
    price: parseInt(document.getElementById('input-price').value),
    isFull: document.getElementById('input-full').checked,
    isWinter: document.getElementById('input-winter').checked
  });
  v.logs.sort((a,b) => new Date(a.date) - new Date(b.date));
  saveState();
  document.getElementById('fuel-form').reset();
  document.getElementById('input-date').valueAsDate = new Date();
  alert('記録しました');
  document.querySelector('.sidebar-item[data-target="view-dashboard"]').click();
});

document.getElementById('maintenance-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = getActiveVehicle();
  v.maintenance.push({
    id: Date.now().toString(),
    category: document.getElementById('maint-category').value,
    date: document.getElementById('maint-date').value,
    note: document.getElementById('maint-note').value
  });
  v.maintenance.sort((a,b) => new Date(b.date) - new Date(a.date));
  saveState();
  document.getElementById('maintenance-form').reset();
  document.getElementById('maint-date').valueAsDate = new Date();
  alert('メンテナンスを記録しました');
  renderMaintenance();
  updateDashboard();
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if(confirm('初期化しますか？')) { localStorage.clear(); location.reload(); }
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

// --- Dashboard Logic ---
function updateDashboard() {
  const v = getActiveVehicle();
  const logs = v.logs;
  const s = v.settings;
  const color = v.themeColor || '#7A8B76';

  document.getElementById('latest-mpg').textContent = '--.-';
  document.getElementById('avg-mpg').textContent = '--.-';
  document.getElementById('avg-mpg-summary').textContent = '--.-';
  document.getElementById('total-distance').textContent = '0';
  document.getElementById('predicted-range').textContent = '--';
  document.getElementById('last-wash-days').textContent = '--';
  document.getElementById('reward-banner-container').innerHTML = '';
  document.getElementById('maintenance-alert-container').innerHTML = '';

  if (logs.length === 0) { if (mpgChart) mpgChart.destroy(); return; }

  const processed = logs.map((l, i) => {
    let mpg = null;
    if (i > 0 && l.isFull) mpg = (l.odo - logs[i-1].odo) / l.liters;
    return { ...l, mpg };
  });

  const last = processed[processed.length - 1];
  document.getElementById('latest-mpg').textContent = last.mpg ? last.mpg.toFixed(1) : '--.-';
  document.getElementById('total-distance').textContent = last.odo.toLocaleString();

  if (logs.length > 1) {
    const totalDist = last.odo - logs[0].odo;
    let totalL = 0; let totalP = 0;
    for(let i=1; i<logs.length; i++) { totalL += logs[i].liters; totalP += logs[i].price; }
    const avgMpg = totalDist / totalL;
    document.getElementById('avg-mpg').textContent = avgMpg.toFixed(1);
    document.getElementById('avg-mpg-summary').textContent = avgMpg.toFixed(1);
    document.getElementById('predicted-range').textContent = Math.round(avgMpg * (s.tankCapacity || 52));
    
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

  // Last Wash
  const lastWash = v.maintenance?.find(m => m.category === 'wash');
  if (lastWash) {
    const diff = Math.floor((new Date() - new Date(lastWash.date)) / (1000 * 60 * 60 * 24));
    document.getElementById('last-wash-days').textContent = diff;
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
  const v = getActiveVehicle();
  const container = document.getElementById('history-list');
  if (v.logs.length === 0) { container.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">記録なし</p>'; return; }
  let html = '';
  for (let i = v.logs.length - 1; i >= 0; i--) {
    const l = v.logs[i];
    let mpg = '--.- km/L';
    if (i > 0 && l.isFull) mpg = ((l.odo - v.logs[i-1].odo) / l.liters).toFixed(1) + ' km/L';
    html += `<div class="history-item"><div style="flex:1;"><div style="display:flex;align-items:center;gap:8px;"><span class="history-date">${new Date(l.date).toLocaleDateString('ja-JP')}</span>${l.isWinter ? '<span class="badge-winter"><i data-lucide="snowflake" style="width:12px"></i>冬タイヤ</span>' : ''}</div><div class="history-details">${l.odo.toLocaleString()} km | ${l.liters} L | ¥${l.price.toLocaleString()}</div></div><div class="history-mpg">${mpg}</div></div>`;
  }
  container.innerHTML = html;
  lucide.createIcons();
}

function renderMaintenance() {
  const v = getActiveVehicle();
  const container = document.getElementById('maintenance-list');
  if (!v.maintenance || v.maintenance.length === 0) { container.innerHTML = '<p style="text-align:center;padding:20px;color:#999;">記録なし</p>'; return; }
  let html = '';
  const catNames = { wash: '洗車', tire: 'タイヤ', inspection: '点検', other: 'その他' };
  v.maintenance.forEach(m => {
    html += `<div style="padding:12px; border-bottom:1px solid #eee;"><div style="font-weight:700;">${catNames[m.category]} <span style="font-size:0.75rem; font-weight:400; color:#999;">- ${m.date}</span></div><div style="font-size:0.875rem; color:#666;">${m.note || ''}</div></div>`;
  });
  container.innerHTML = html;
}

document.getElementById('input-date').valueAsDate = new Date();
document.getElementById('maint-date').valueAsDate = new Date();
