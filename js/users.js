// ============================================
// USERS API - Google Apps Script
// ============================================

// ===== Auto-attach session token to every Apps Script call =====
(function () {
  const GAS = 'https://script.google.com/macros/';
  const origFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : '';
    if (url.indexOf(GAS) !== 0) return origFetch(input, init);

    const token = localStorage.getItem('sessionToken');
    const method = ((init && init.method) || 'GET').toUpperCase();

    if (token) {
      if (method === 'POST' && init && typeof init.body === 'string') {
        try {
          const b = JSON.parse(init.body);
          b.token = token;
          init = Object.assign({}, init, { body: JSON.stringify(b) });
        } catch (e) {}
      } else if (method === 'GET') {
        input = url + (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(token);
      }
    }

    let res = await origFetch(input, init);

    // Apps Script redirect eke transient 404 - GET witharai retry (POST retry karanne na, duplicate save wenna epa)
    for (let i = 0; i < 2 && res.status === 404 && method === 'GET'; i++) {
      await new Promise(resolve => setTimeout(resolve, 600 * (i + 1)));
      res = await origFetch(input, init);
    }

    // Session expire / invalid -> login page ekata
    try {
      const j = await res.clone().json();
      if (j && j.unauthorized && !/login\.html$/.test(location.pathname)) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('sessionToken');
        location.href = (location.pathname.indexOf('/dashboard/') !== -1 ? '../' : '') + 'index.html';
      }
    } catch (e) { /* no-cors / non-json */ }

    return res;
  };
})();

const API_URL = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

// ===== Get All Users =====
async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}?action=getUsers`);
    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error('loadUsers error:', error);
    return [];
  }
}

// ===== Login User =====
async function loginUser(username, password) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'login', username: username, password: password })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    if (data.success && data.token) localStorage.setItem('sessionToken', data.token);
    return data;
  } catch (error) {
    console.error('loginUser error:', error);
    return { success: false, error: 'Network error' };
  }
}

// ===== Update Profile (name + password) =====
// Calls the Apps Script updateProfile action.
// Sheet eke currentPassword eka verify wela, name/password update wenawa.
async function updateUserProfile({ username, currentPassword, newName, newPassword, newAvatar }) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'updateProfile',
        username: username,
        currentPassword: currentPassword,
        newName: newName || '',
        newPassword: newPassword || '',
        newAvatar: newAvatar || ''
      })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (error) {
    console.error('updateUserProfile error:', error);
    return { success: false, error: 'Network error' };
  }
}

// ===== Get Current User (from localStorage) =====
function getCurrentUser() {
  try {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    localStorage.removeItem('currentUser');
    return null;
  }
}

// ===== Logout =====
function logoutUser() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('sessionToken');
}
// ============================================
// ACCESS HELPERS (shared by login, sidebar, pages)
// ============================================
// Report key -> dashboard page. Keys must match the "reports" column in the Users sheet.
const REPORT_PAGES = {
  ccp:   'index.html',   // Slaughter Data
  birds: 'birds.html',
  ev:    'ev.html',
  water: 'water.html',
  packing: 'packing.html',
  birdsquality: 'birds-quality.html',
  returns: 'returns.html',
  shopreturns: 'shop-returns.html',
  complaint: 'customer-complaint.html',
  rejection: 'rejection.html',
  admin: 'master-report.html',
  shygiene: 'staff-hygiene.html',
  hygiene3: 'personal-hygiene-3.html',
  sampleparameters: 'sample-parameters.html',
  operationalinspection: 'operational-inspection.html'
};

// "ccp, Birds ; ev" or ["ccp","birds"] -> ["ccp","birds","ev"]
function parseReports(user) {
  let r = (user && user.reports) || [];
  if (typeof r === 'string') r = r.split(/[,;|]/);
  return r.map(x => String(x).trim().toLowerCase()).filter(Boolean);
}

// First page this user is allowed to open (or null if none)
function getFirstAllowedPage(user) {
  const reports = parseReports(user);
  const username = String(user && (user.username || user.userName || user.name) || '').trim().toLowerCase();
  const role = String(user && user.role || '').trim().toLowerCase();

  // User1's default workspace is Birds Data when that page is assigned.
  if ((username === 'user1' || role === 'user1') && reports.includes('birds')) {
    return 'birds.html';
  }

  // Admin accounts should open the CCP Control Report first.
  if (reports.includes('admin')) return 'master-report.html';

  const key = Object.keys(REPORT_PAGES).find(k => reports.includes(k));
  return key ? REPORT_PAGES[key] : null;
}
// ===== Re-save confirm popup (centre of screen) =====
function confirmResave() {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'resave-overlay';
    ov.innerHTML = `
      <div class="resave-box">
        <div class="resave-icon">!</div>
        <h4>Replace saved data?</h4>
        <p>The data already saved for this date will be replaced with your new data. Do you want to continue?</p>
        <div class="resave-actions">
          <button type="button" class="resave-cancel">Cancel</button>
          <button type="button" class="resave-ok">Yes, Replace</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const done = v => { ov.remove(); resolve(v); };
    ov.querySelector('.resave-ok').addEventListener('click', () => done(true));
    ov.querySelector('.resave-cancel').addEventListener('click', () => done(false));
    ov.addEventListener('click', e => { if (e.target === ov) done(false); });
  });
}
function toRomanNumber_(number) {
  number = Number(number);

  if (!Number.isInteger(number) || number < 1 || number > 3999) {
    return String(number);
  }

  const numerals = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];

  let result = '';

  for (const [value, symbol] of numerals) {
    while (number >= value) {
      result += symbol;
      number -= value;
    }
  }

  return result;
}
// Add Clear Form button inside the data-entry box
document.addEventListener('DOMContentLoaded', () => {
  const box = document.querySelector('.form-section');
  if (!box || document.getElementById('clearFormBtn')) return;

  box.style.position = 'relative';

  const button = document.createElement('button');
  button.id = 'clearFormBtn';
  button.type = 'button';
  button.textContent = 'Clear Form';
  button.className = 'clear-form-btn';

button.addEventListener('click', () => {
  const overlay = document.createElement('div');
  overlay.className = 'clear-confirm-overlay';

  overlay.innerHTML = `
    <div class="clear-confirm-box" role="dialog" aria-modal="true">
      <h3>Clear this form?</h3>
      <p>Unsaved changes will be cleared.</p>
      <div class="clear-confirm-actions">
        <button type="button" class="clear-cancel">Cancel</button>
        <button type="button" class="clear-confirm">Clear</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.clear-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('.clear-confirm').addEventListener('click', () => {
    window.location.reload();
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.remove();
  });
});

  box.prepend(button);
});
function showSaveSuccessMessage(button) {
  if (window.InputFeedback) {
    window.InputFeedback.success('Data saved successfully.');
    return;
  }
  const actions = button.closest('.birds-actions');
  if (!actions) return;

  let message = actions.nextElementSibling;
  if (!message || !message.classList.contains('save-success-message')) {
    message = document.createElement('div');
    message.className = 'save-success-message';
    actions.insertAdjacentElement('afterend', message);
  }

  message.textContent = '✅ Data saved successfully!';
  message.classList.add('show');

  clearTimeout(message.hideTimer);
  message.hideTimer = setTimeout(() => {
    message.classList.remove('show');
  }, 5000);
}

