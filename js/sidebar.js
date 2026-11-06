// ============================================
// COMMON SIDEBAR LOADER + USER INFO
// ============================================

// Site root (folder that contains /js, /css, /partials ...).
// Must be read at top level: document.currentScript is null inside callbacks.
// Works from any page depth (dashboard/, reports/xyz/, ...).
const SITE_ROOT = new URL('../', document.currentScript.src).href;
const OWNER_EXTRA_PAGES = new Set([
  'operational-inspection.html',
  'operational-inspection-report.html',
  'sample-parameters.html',
  'sample-parameters-report.html'
]);

document.addEventListener('DOMContentLoaded', () => {

  console.info('[sidebar] script v8 (owner pages) running');

  // ===== 1. Auth check =====
  const user = getStoredUser();
  if (!user) {
    window.location.href = getLoginPath();
    return;
  }

  // ===== 1b. Page access check (user must have this page's report) =====
  if (!enforcePageAccess(user)) return;

  // ===== 2. Sidebar container =====
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) {
    console.warn('sidebar-container element not found');
    return;
  }

  // ===== 3. Fetch + load sidebar =====
  // Sidebar HTML is kept for the session so page changes do not wait for the network
  let cachedSidebar = null;
  try { cachedSidebar = sessionStorage.getItem('sidebarHtml_v1'); } catch (e) {}

  const sidebarSource = cachedSidebar
    ? Promise.resolve(cachedSidebar)
    : fetch(SITE_ROOT + 'partials/sidebar.html')
        .then(res => {
          if (!res.ok) throw new Error('Sidebar load failed: ' + res.status);
          return res.text();
        })
        .then(text => {
          try { sessionStorage.setItem('sidebarHtml_v1', text); } catch (e) {}
          return text;
        });

  sidebarSource
    .then(html => {
      // sidebar.html is written with "../" paths - point them at the site root
      // so images/links work from every page depth.
      html = html.replace(/(href|src)="\.\.\//g, `$1="${SITE_ROOT}`);
      if (String(user.role || '').trim().toLowerCase() === 'owner') {
      html = html.replace(
        '<nav class="sidebar-nav">',
        '<nav class="sidebar-nav">'
      );
    }
      sidebarContainer.innerHTML = html;


      setUserInfo(user);
      buildNavLinks(user);   // links come from JS, not from sidebar.html
      ensureLinkLabels();
      filterNavLinks(user);
      setActiveLink();
      ensureLogoutButton();
      ensureThemeToggle();
      ensureNotificationButton(user);
      setupAdminNotifications();
      setupLogout();
      setupHeaderDateTime();
      normalizeHeaderActionOrder();
      setupMobileToggle();
      setupSidebarToggle();
      showWelcomeOnce(user);
      setupThemeToggle();
      setupProfileModal();
    })
    .catch(err => {
      console.error('Sidebar error:', err);
      if (window.location.protocol === 'file:') {
        console.warn('Pages opened via file:// cannot fetch partials. Use a local server (e.g. VS Code Live Server).');
      }
    });
});


// ===== Helper: Stored user (safe parse) =====
function getStoredUser() {
  try {
    const data = localStorage.getItem('currentUser');
    if (!data) return null;
    const user = JSON.parse(data);
    return user && typeof user === 'object' ? user : null;
  } catch (err) {
    localStorage.removeItem('currentUser');
    return null;
  }
}

// ===== Helper: Login Path =====
function getLoginPath() {
  return SITE_ROOT + 'index.html';
}

// ===== Helper: User Info =====
function setUserInfo(user) {
  const avatar = document.getElementById('sidebarAvatar');
  const name = document.getElementById('sidebarUserName');
  const role = document.getElementById('sidebarUserRole');

  if (avatar) {
    avatar.textContent = (user.name || user.username || 'U').charAt(0).toUpperCase();
    applyAvatarImage(avatar, user);
  }
  if (name) {
    name.textContent = user.name || user.username || 'User';
  }
  if (role) {
    const roleText = String(user.role || 'user').replace(/-/g, ' ');
    role.textContent = roleText.charAt(0).toUpperCase() + roleText.slice(1);
  }
}

function filterNavLinks(user) {
  // "reports" comes from the Google Sheet at login time (string "birds,ccp,ev"
  // or an array). Match ignoring case / spaces so small typos don't hide a link.
  const userReports = parseReports(user);
  const isOwner = String(user.role || '').trim().toLowerCase() === 'owner';

  const shown = [];
  const hidden = [];

  // Links WITHOUT data-report are visible to everyone.
  document.querySelectorAll('.sidebar-link[data-report]').forEach(link => {
    const key = link.getAttribute('data-report').trim().toLowerCase();
    const page = (link.getAttribute('href') || '').split('/').pop().split('?')[0].toLowerCase();
    if (userReports.includes(key) || (isOwner && (key === 'usercontrol' || OWNER_EXTRA_PAGES.has(page)))) {
      link.style.display = 'flex';
      shown.push(key);
    } else {
      link.style.display = 'none';
      hidden.push(key);
    }
  });

  console.info('[sidebar] user reports =', userReports,
    '| shown =', shown, '| hidden (user has no access) =', hidden);
}

// ===== Helper: make sure every nav link has a text label =====
// If a link only has an icon (old/cached sidebar.html), add the name
// using data-report, or the page file name in href as a fallback.
const REPORT_LABELS = {
  birds: 'Birds Data',
  ccp: 'Slaughter Data',
  ev: 'EV Data',
  water: 'Water Plant Data',
  packing: 'Packing Data', 
  birdsquality: 'Birds Quality',
  returns: 'Sales Returns',
  shopreturns: 'Shop Returns',
  admin: 'Quality Report',
  lab: 'Lab Reports',
  compliance: 'Compliance'
};
const HREF_LABELS = {
  'birds.html': 'Birds Data',
  'index.html': 'Slaughter Data',
  'ev.html': 'EV Data',
  'water.html': 'Water Plant Data',
  'packing.html': 'Packing Data',
  'birds-quality.html': 'Birds Quality',
};

function ensureLinkLabels() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    if (link.textContent.trim()) return;
    const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
    const label = REPORT_LABELS[link.getAttribute('data-report')] || HREF_LABELS[href];
    if (!label) return;
    const span = document.createElement('span');
    span.textContent = label;
    link.appendChild(span);
  });
}

// ===== Helper: Active Link =====
function setActiveLink() {
  const normalize = (url) => {
    let p = new URL(url, window.location.href).pathname;
    if (p.endsWith('/')) p += 'index.html';
    return p;
  };
  const currentPath = normalize(window.location.href);

  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    link.classList.toggle('active', normalize(link.href) === currentPath);
  });
}

// ===== Profile Modal (click user card to edit name/password) =====
function setupProfileModal() {
  const userCard = document.querySelector('.sidebar-user');
  if (!userCard || userCard.dataset.profileBound) return;
  userCard.dataset.profileBound = '1';
  userCard.style.cursor = 'pointer';
  userCard.title = 'Click to edit your profile';
  userCard.addEventListener('click', openProfileModal);
}

function openProfileModal() {
  if (document.getElementById('profileModal')) return;
  const user = getStoredUser();
  if (!user) return;

  if (!document.getElementById('profile-modal-style')) {
    const style = document.createElement('style');
    style.id = 'profile-modal-style';
    style.textContent = `
      .profile-overlay {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
        background: rgba(8, 15, 40, 0.55);
        backdrop-filter: blur(3px);
        animation: profileFade 0.18s ease;
      }
      .profile-modal {
        width: 100%; max-width: 380px;
        max-height: calc(100vh - 2rem); overflow-y: auto;
        padding: 1.6rem 1.5rem 1.4rem;
        background: #ffffff; color: #0f172a;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        font-family: 'Inter', system-ui, sans-serif;
        animation: profilePop 0.2s ease;
      }
      .profile-modal h3 { margin: 0 0 0.2rem; font-size: 1.1rem; font-weight: 700; }
      .profile-modal .profile-sub { margin: 0 0 1.2rem; font-size: 0.8rem; color: #64748b; }
      .profile-field { margin-bottom: 0.9rem; }
      .profile-field label {
        display: block; margin-bottom: 0.3rem;
        font-size: 0.75rem; font-weight: 600; color: #475569;
        text-transform: uppercase; letter-spacing: 0.4px;
      }
      .profile-field input {
        width: 100%; padding: 0.6rem 0.8rem;
        border: 1.5px solid #e2e8f0; border-radius: 10px;
        font: inherit; font-size: 0.9rem; color: #0f172a;
        background: #f8fafc;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        box-sizing: border-box;
      }
      .profile-field input:focus {
        outline: none; border-color: #3b82f6; background: #fff;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      .profile-hint { font-size: 0.72rem; color: #94a3b8; margin-top: 0.25rem; }
      .profile-avatar-choices { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.4rem; }
      .profile-avatar-choice {
        min-width: 0; padding: 0.35rem 0.15rem; border: 2px solid #e2e8f0;
        border-radius: 11px; background: #f8fafc; color: #475569; cursor: pointer;
        font: inherit; font-size: 0.64rem; font-weight: 600;
      }
      .profile-avatar-choice img { display: block; width: 42px; height: 42px; margin: 0 auto 0.2rem; border-radius: 50%; object-fit: cover; }
      .profile-avatar-choice.selected { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; box-shadow: 0 0 0 2px rgba(59,130,246,.12); }
      .profile-msg { font-size: 0.82rem; font-weight: 600; margin: 0 0 0.8rem; display: none; padding: 0.55rem 0.8rem; border-radius: 8px; }
      .profile-msg.err { display: block; background: rgba(239,68,68,0.1); color: #dc2626; }
      .profile-msg.ok  { display: block; background: rgba(16,185,129,0.12); color: #059669; }
      .profile-actions { display: flex; gap: 0.7rem; margin-top: 1.2rem; }
      .profile-actions button {
        flex: 1; padding: 0.7rem 1rem; border: 0; border-radius: 10px;
        font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer;
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .profile-actions button:hover { filter: brightness(0.95); transform: translateY(-1px); }
      .profile-actions button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .profile-actions .btn-cancel { background: #e2e8f0; color: #334155; }
      .profile-actions .btn-save { background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; }
      @keyframes profileFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes profilePop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      body.dark-mode .profile-modal { background: #1e293b; color: #f1f5f9; }
      body.dark-mode .profile-field input {
        background: #0f172a; border-color: #334155; color: #e2e8f0;
      }
      body.dark-mode .profile-field label { color: #cbd5e1; }
      body.dark-mode .profile-avatar-choice { background: #0f172a; border-color: #334155; color: #cbd5e1; }
      body.dark-mode .profile-avatar-choice.selected { background: #172554; border-color: #60a5fa; color: #bfdbfe; }
      body.dark-mode .profile-actions .btn-cancel { background: #334155; color: #cbd5e1; }`;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay';
  overlay.id = 'profileModal';
  overlay.innerHTML = `
    <div class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
      <h3 id="profileTitle">Edit Profile</h3>
      <p class="profile-sub"></p>
      <div class="profile-msg" id="profileMsg"></div>
      <div class="profile-field">
        <label>Profile Picture</label>
        <div class="profile-avatar-choices" id="profileAvatarChoices"></div>
      </div>
      <div class="profile-field">
        <label for="pfCurrentPw">Current Password *</label>
        <input type="password" id="pfCurrentPw" autocomplete="current-password" required />
      </div>
      <div class="profile-field">
        <label for="pfName">Full Name</label>
        <input type="text" id="pfName" autocomplete="name" />
        <div class="profile-hint">Leave empty to keep your current name</div>
      </div>
      <div class="profile-field">
        <label for="pfNewPw">New Password</label>
        <input type="password" id="pfNewPw" autocomplete="new-password" />
        <div class="profile-hint">Leave empty to keep your current password</div>
      </div>
      <div class="profile-field">
        <label for="pfConfirmPw">Confirm New Password</label>
        <input type="password" id="pfConfirmPw" autocomplete="new-password" />
      </div>
      <div class="profile-actions">
        <button type="button" class="btn-cancel" id="pfCancel">Cancel</button>
        <button type="button" class="btn-save" id="pfSave">Save Changes</button>
      </div>
    </div>`;

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.querySelector('.profile-sub').textContent = '@' + (user.username || '');
  overlay.querySelector('#pfName').value = user.name || user.username || '';

  const selectedAvatar = getUserAvatarKey(user);
  const avatarChoices = overlay.querySelector('#profileAvatarChoices');
  AVATAR_OPTIONS.forEach(option => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'profile-avatar-choice' + (option.key === selectedAvatar ? ' selected' : '');
    choice.dataset.avatar = option.key;
    choice.setAttribute('aria-label', option.label);
    choice.setAttribute('aria-pressed', String(option.key === selectedAvatar));
    choice.innerHTML = `<img src="${SITE_ROOT}${option.file}" alt=""><span>${option.label}</span>`;
    choice.addEventListener('click', () => {
      avatarChoices.querySelectorAll('.profile-avatar-choice').forEach(item => {
        const active = item === choice;
        item.classList.toggle('selected', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
    avatarChoices.appendChild(choice);
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#pfCancel').addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  overlay.querySelector('#pfSave').addEventListener('click', async () => {
    const currentPw = overlay.querySelector('#pfCurrentPw').value;
    const newName = overlay.querySelector('#pfName').value.trim();
    const newPw = overlay.querySelector('#pfNewPw').value;
    const confirmPw = overlay.querySelector('#pfConfirmPw').value;
    const newAvatar = avatarChoices.querySelector('.profile-avatar-choice.selected')?.dataset.avatar || selectedAvatar;
    const msg = overlay.querySelector('#profileMsg');
    const saveBtn = overlay.querySelector('#pfSave');

    msg.className = 'profile-msg';
    msg.textContent = '';

    if (!currentPw) {
      msg.className = 'profile-msg err';
      msg.textContent = 'Please enter your current password.';
      return;
    }

    const changingName = newName && newName !== (user.name || user.username || '');
    const changingPw = newPw.length > 0;
    const changingAvatar = newAvatar !== selectedAvatar;

    if (!changingName && !changingPw && !changingAvatar) {
      msg.className = 'profile-msg err';
      msg.textContent = 'Choose a profile picture or change your name or password before saving.';
      return;
    }

    if (changingPw && newPw.length < 4) {
      msg.className = 'profile-msg err';
      msg.textContent = 'The new password must be at least 4 characters long.';
      return;
    }

    if (changingPw && newPw !== confirmPw) {
      msg.className = 'profile-msg err';
      msg.textContent = 'Please verify that the two new passwords do not match.';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const result = await updateUserProfile({
      username: user.username,
      currentPassword: currentPw,
      newName: changingName ? newName : '',
      newPassword: newPw,
      newAvatar: changingAvatar ? newAvatar : ''
    });      if (result.success) {
        // localStorage eke user info update karanna
      if (changingName) {
        user.name = newName;
        localStorage.setItem('currentUser', JSON.stringify(user));
        const nameEl = document.getElementById('sidebarUserName');
        if (nameEl) nameEl.textContent = newName;
        const avatar = document.getElementById('sidebarAvatar');
        if (avatar && !avatar.classList.contains('has-img')) avatar.textContent = (newName || 'U').charAt(0).toUpperCase();
      }

      if (changingAvatar) {
        user.avatar = newAvatar;
        localStorage.setItem('currentUser', JSON.stringify(user));
        applyAvatarImage(document.getElementById('sidebarAvatar'), user);
      }

      msg.className = 'profile-msg ok';
      msg.textContent = changingPw
        ? '✅ Profile updated! Aluth password eken login wennà next time.'
        : '✅ Profile updated!';
      setTimeout(close, 1500);
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
      msg.className = 'profile-msg err';
      msg.textContent = result.error || 'Update failed. Try again.';
    }
  });

  document.body.appendChild(overlay);
  overlay.querySelector('#pfCurrentPw').focus();
}

// Keep every page header in the same visual order.
function normalizeHeaderActionOrder() {
  const actions = document.querySelector('.header-actions');
  if (!actions) return;
  const dateTime = actions.querySelector('.header-datetime');
  const notification = actions.querySelector('#adminNotifications');
  const theme = actions.querySelector('#themeToggle')?.closest('label');
  const logout = actions.querySelector('#sidebarLogout');
  [dateTime, notification, theme, logout].filter(Boolean).forEach(node => actions.appendChild(node));
}
// ===== Helper: make sure the date/time pill exists =====
function ensureDateTimePill() {
  if (document.querySelector('.header-datetime')) return;
  const actions = document.querySelector('.header-actions');
  if (!actions) return;
  actions.insertAdjacentHTML('afterbegin', `
    <div class="header-datetime">
      <div class="header-date">—</div>
      <div class="header-sep"></div>
      <div class="header-time">—</div>
    </div>`);
}

// ===== Header Date & Time =====
// Compact pill in the header actions row (left of theme/logout).
function setupHeaderDateTime() {
  ensureDateTimePill();
  const dateEl = document.getElementById('headerDate') || document.querySelector('.header-date');
  const timeEl = document.getElementById('headerTime') || document.querySelector('.header-time');

  if (!dateEl || !timeEl) return;

  function updateDateTime() {
    const now = new Date();

    // Date — "29 Sep 2026" format
    const dateOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    dateEl.textContent = now.toLocaleDateString('en-GB', dateOptions);

    // Time — "08:30:45 AM" format
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    timeEl.textContent = now.toLocaleTimeString('en-US', timeOptions);
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);
}
// Pages put the logout button in the header (.header-actions).
// If the loaded page has none (old/cached copy), add it there.
function ensureLogoutButton() {
  if (document.getElementById('sidebarLogout')) return;
  const header = document.querySelector('.page-header');
  if (!header) return;

  let actions = header.querySelector('.header-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'header-actions';
    header.appendChild(actions);
  }

  actions.insertAdjacentHTML('beforeend', `
    <button class="Btn" id="sidebarLogout" type="button">
      <div class="sign"><svg viewBox="0 0 512 512"><path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path></svg></div>
      <div class="text">Logout</div>
    </button>`);
}

// ===== Helper: make sure the Theme toggle exists =====
// Pages have the toggle + logout in their header (.header-actions).
// If the page doesn't have them (old copy), inject into the header.
function ensureThemeToggle() {
  if (document.getElementById('themeToggle')) return;
  const header = document.querySelector('.page-header');
  if (!header) return;

  let actions = header.querySelector('.header-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'header-actions';
    header.appendChild(actions);
  }

  actions.insertAdjacentHTML('afterbegin', `
    <label class="switch" title="Theme">
      <input type="checkbox" id="themeToggle" />
      <span class="slider">
        <div class="star star_1"></div>
        <div class="star star_2"></div>
        <div class="star star_3"></div>
        <svg viewBox="0 0 16 16" class="cloud_1 cloud">
          <path
            transform="matrix(.77976 0 0 .78395-299.99-418.63)"
            fill="#fff"
            d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925"
          ></path>
        </svg>
      </span>
    </label>`);
}

function ensureNotificationButton(user) {
  if (document.body.classList.contains('kpi-detail-page')) return;
const role = String(user?.role || '').trim().toLowerCase();
const reports = String(user?.reports || '')
  .trim()
  .toLowerCase()
  .split(/[,\s]+/);

const isAdmin =
  role === 'admin' ||
  role === 'administrator' ||
  reports.includes('admin');

if (!isAdmin) return;

  const header = document.querySelector('.page-header');
  if (!header || document.getElementById('adminNotifications')) return;

  let actions = header.querySelector('.header-actions');

  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'header-actions';
    header.appendChild(actions);
  }

  const button = document.createElement('button');
  button.className = 'admin-notification-btn';
  button.id = 'adminNotifications';
  button.type = 'button';
  button.setAttribute('aria-label', 'Notifications');
  button.title = 'Notifications';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
      <path d="M10 21h4"/>
    </svg>
    <span class="notification-count" id="notificationCount" hidden>0</span>
  `;

  const theme = actions.querySelector('#themeToggle');
  const themeLabel = theme?.closest('label');

  if (themeLabel) {
    actions.insertBefore(button, themeLabel);
  } else {
    actions.prepend(button);
  }
}

// ===== Helper: Logout =====
function setupLogout() {
  const logoutBtn = document.getElementById('sidebarLogout');
  if (!logoutBtn) {
    console.warn('Logout button not found');
    return;
  }

  logoutBtn.addEventListener('click', () => {
    showLogoutConfirm(() => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('sessionToken');
      try { sessionStorage.removeItem('welcomeShown'); } catch (e) {}
      window.location.href = getLoginPath();
    });
  });
}

// ===== Logout confirmation popup =====
function showLogoutConfirm(onYes) {
  if (document.getElementById('logoutModal')) return;

  if (!document.getElementById('logout-modal-style')) {
    const style = document.createElement('style');
    style.id = 'logout-modal-style';
    style.textContent = `
      .logout-modal-overlay {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
        background: rgba(8, 15, 40, 0.55);
        backdrop-filter: blur(3px);
        animation: logoutFade 0.18s ease;
      }
      .logout-modal {
        width: 100%; max-width: 360px;
        padding: 1.6rem 1.5rem 1.3rem;
        background: #ffffff; color: #0f172a;
        border-radius: 16px; text-align: center;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        font-family: 'Inter', system-ui, sans-serif;
        animation: logoutPop 0.2s ease;
      }
      .logout-modal-icon {
        width: 52px; height: 52px; margin: 0 auto 0.9rem;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50%; background: rgba(239, 68, 68, 0.12); color: #dc2626;
      }
      .logout-modal h3 { margin: 0 0 0.35rem; font-size: 1.1rem; font-weight: 700; }
      .logout-modal p { margin: 0 0 1.3rem; font-size: 0.9rem; color: #64748b; }
      .logout-modal-actions { display: flex; gap: 0.7rem; }
      .logout-modal-actions button {
        flex: 1; padding: 0.7rem 1rem; border: 0; border-radius: 10px;
        font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer;
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .logout-modal-actions button:hover { filter: brightness(0.95); transform: translateY(-1px); }
      .logout-modal-actions .btn-no { background: #e2e8f0; color: #334155; }
      .logout-modal-actions .btn-yes { background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; }
      @keyframes logoutFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes logoutPop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }`;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.className = 'logout-modal-overlay';
  overlay.id = 'logoutModal';
  overlay.innerHTML = `
    <div class="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">
      <div class="logout-modal-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </div>
      <h3 id="logoutTitle">Are you sure you want to logout?</h3>
      <p>You will need to login again to continue.</p>
      <div class="logout-modal-actions">
        <button type="button" class="btn-no" id="logoutNo">No</button>
        <button type="button" class="btn-yes" id="logoutYes">Yes, Logout</button>
      </div>
    </div>`;

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#logoutNo').addEventListener('click', close);
  overlay.querySelector('#logoutYes').addEventListener('click', () => { close(); onYes(); });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  overlay.querySelector('#logoutNo').focus();
}

// ===== Helper: Mobile hamburger + overlay =====
function setupMobileToggle() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || document.querySelector('.sidebar-toggle')) return;

  const toggle = document.createElement('button');
  toggle.className = 'sidebar-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle menu');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';

  const close = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  };

  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    overlay.classList.toggle('show', open);
  });
  overlay.addEventListener('click', close);
  sidebar.querySelectorAll('.sidebar-link').forEach(l => l.addEventListener('click', close));

  document.body.appendChild(toggle);
  document.body.appendChild(overlay);
}

// ===== Helper: block pages the user has no access to =====
// Returns true if the user may stay on this page.
function enforcePageAccess(user) {
  const fileName = window.location.pathname.split('/').pop().toLowerCase();
  if (fileName === 'user-control.html') {
    if (String(user.role || '').trim().toLowerCase() === 'owner') return true;
    alert('Owner access required.');
    window.location.replace(SITE_ROOT + 'dashboard/index.html');
    return false;
  }
  if (String(user.role || '').trim().toLowerCase() === 'owner') return true;
  const PAGE_KEYS = { 'index.html': 'ccp', 'personal-hygiene.html': 'hygiene', 'personal-hygiene-3.html': 'hygiene3',  'birds.html': 'birds', 'ev.html': 'ev', 'water.html': 'water','packing.html': 'packing',  'birds-quality.html': 'birdsquality', 'birds-quality-report.html': 'admin', 'water-report.html': 'admin', 'rejection-report.html': 'admin', 'coolroom-rejection-report.html': 'admin', 'sales-rejection-report.html': 'admin', 'shop-rejection-report.html': 'admin', 'returns.html': 'returns', 'shop-returns.html': 'shopreturns', 'customer-complaint.html': 'complaint','customer-complaint-report.html': 'admin', 'rejection.html': 'rejection', 'coolroom-rejection.html': 'rejection', 'master-report.html': 'admin', 'birds-data-report.html': 'admin', 'kpi-overview.html': 'admin', 'kpi-01.html': 'admin', 'kpi-02.html': 'admin','returns-report.html': 'admin', 'returns-summary.html': 'admin', 'shop-returns-report.html': 'admin','staff-hygiene.html': 'shygiene','hygiene-fail-report.html': 'admin', 'sample-parameters.html': 'sampleparameters', 'sample-parameters-report.html': 'admin', 'operational-inspection.html': 'operationalinspection',};
  let file = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
  const key = PAGE_KEYS[file];
  if (!key) return true;                       // not a report page
  if (parseReports(user).includes(key)) return true;

  const next = getFirstAllowedPage(user);
  if (next) {
    window.location.replace(SITE_ROOT + 'dashboard/' + next);
  } else {
    alert('You do not have access to this page. Please contact your administrator.');
    localStorage.removeItem('currentUser');
    window.location.replace(getLoginPath());
  }
  return false;
}

// ===== Helper: User ට පළවෙනි allowed page එක =====
function getFirstAllowedPage(user) {
  const allowed = parseReports(user);
  
  // Priority order of pages to redirect to if the user has access to multiple pages.
  const priority = ['ccp', 'birds', 'ev', 'water', 'packing', 'birdsquality', 'returns', 'shopreturns', 'complaint', 'admin', 'operationalinspection'];
  
  for (const key of priority) {
    if (allowed.includes(key)) {
      // Key → filename
      const pageMap = {
        ccp: 'index.html',
        birds: 'birds.html',
        ev: 'ev.html',
        water: 'water.html',
        packing: 'packing.html',
        birdsquality: 'birds-quality.html',
        returns: 'returns.html',
        shopreturns: 'shop-returns.html',
        complaint: 'customer-complaint.html',
        operationalinspection: 'operational-inspection.html'
      };
      return pageMap[key];
    }
  }
  
  return null;
}


// ===== Nav links (defined here so an old/cached sidebar.html can never hide them) =====
// group: items with the same group name are shown inside one collapsible dropdown.
// group: null  -> normal top-level link.
const NAV_GROUPS = {
  'Rejection Report': {
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>'
  },
  'Rejection': {
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
  },
  'Sales Returns': {
    icon: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>'
  },
    'Personal Hygiene': {
    icon: '<polyline points="20 6 9 17 4 12"></polyline>'
  },
  'CCP Control': {
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>'
  }
};

const NAV_ITEMS = [
  { key: 'admin', page: 'kpi-overview.html', label: 'KPI Overview', group: 'KPI',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M7 15l3-3 3 2 4-5"></path><path d="M7 19h10"></path>' },
  { key: 'admin', page: 'master-report.html', label: 'CCP Control ', group: 'Reports',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line>' },
  { key: 'admin', page: 'birds-data-report.html', label: 'Birds Hanging Time', group: 'Reports',
    icon: '<circle cx="12" cy="12" r="9"></circle><path d="M8 12h8M12 8v8"></path>' },
  { key: 'birds', page: 'birds.html', label: 'Birds Hanging Time', group: 'CCP Control',
    icon: '<path d="M16 7h.01"></path><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"></path><path d="m20 7 2 .5-2 .5"></path><path d="M10 18v3"></path><path d="M14 17.75V21"></path><path d="M7 18a6 6 0 0 0 3.84-10.61"></path>' },
  { key: 'ccp', page: 'index.html', label: 'Slaughter Data', group: 'CCP Control',
    icon: '<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>' },
  { key: 'ev', page: 'ev.html', label: 'EV Data', group: 'CCP Control',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>' },
  { key: 'water', page: 'water.html', label: 'Waste Water Plant', group: null,
    icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>' },
  { key: 'packing', page: 'packing.html', label: 'Packing Data', group: null,
    icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>' },
  { key: 'birdsquality', page: 'birds-quality.html', label: 'Birds Quality Data', group: null,
    icon: '<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>' },
  { key: 'returns', page: 'returns.html', label: 'Sales Returns', group: null,
    icon: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>' },
  { key: 'shopreturns', page: 'shop-returns.html', label: 'Shop Returns', group: null,
    icon: '<path d="M3 9l1-5h16l1 5"></path><path d="M4 9v11h16V9"></path><path d="M9 20v-6h6v6"></path>' },
  { key: 'complaint', page: 'customer-complaint.html', label: 'Customer Complaint', group: null,
    icon: '<path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="14" y2="14"></line>' },
  { key: 'operationalinspection', page: 'operational-inspection.html', label: 'Operational Inspection', group: null,
    icon: '<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M8 2v4M16 2v4M3 10h18"></path><path d="m8 15 2 2 5-5"></path>' },
  { key: 'sampleparameters', page: 'sample-parameters.html', label: 'Sample Parameters', group: null,
    icon: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5H8z"></path><path d="M14 3v5h5"></path><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line>' },  

  { key: 'rejection', page: 'rejection.html', label: 'In-Process Rejection', group: 'Rejection',
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' },
  { key: 'rejection', page: 'coolroom-rejection.html', label: 'Cool Room Rejection', group: 'Rejection',
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' },
  { key: 'hygiene', page: 'personal-hygiene.html', label: 'Personal Hygiene', group: null,
    icon: '<polyline points="20 6 9 17 4 12"></polyline>' },
  { key: 'hygiene3', page: 'personal-hygiene-3.html', label: 'Personal Hygiene 3', group: null,
    icon: '<polyline points="20 6 9 17 4 12"></polyline>' },
    


  { key: 'admin', page: 'birds-quality-report.html', label: 'Birds Quality Data', group: 'Reports',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>' },
  { key: 'admin', page: 'water-report.html', label: 'Waste Water Plant', group: 'Reports',
    icon: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>' },
  { key: 'admin', page: 'returns-report.html', label: 'Sales Returns', group: 'Reports',
    icon: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>' },
  { key: 'admin', page: 'returns-summary.html', label: 'Sales Return Summary', group: 'Reports',
    icon: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>' },
  { key: 'admin', page: 'shop-returns-report.html', label: 'Shop Returns', group: 'Reports',
    icon: '<path d="M3 9l1-5h16l1 5"></path><path d="M4 9v11h16V9"></path><path d="M9 20v-6h6v6"></path>' },
  { key: 'admin', page: 'rejection-report.html', label: 'In-Process Rejection', group: 'Reports',
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>' },
  { key: 'admin', page: 'coolroom-rejection-report.html', label: 'Cool Room Rejection', group: 'Reports',
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>' },
  { key: 'admin', page: 'sales-rejection-report.html', label: 'Sales Return Rejection', group: 'Reports',
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>' },
  { key: 'admin', page: 'shop-rejection-report.html', label: 'Shop Return Rejection', group: 'Reports',
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"></line>' },
  {key: 'shygiene',page: 'staff-hygiene.html',label: 'Personal Hygiene 2',group: null,
    icon: '<path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle>'
  },
    { key: 'admin', page: 'hygiene-fail-report.html', label: 'Hygiene Fail Report', group: 'Reports',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line>' },
    {key: 'admin',page: 'customer-complaint-report.html',label: 'Customer Complaint',group: 'Reports',
    icon: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>'}, 
  { key: 'admin', page: 'sample-parameters-report.html', label: 'Sample Parameters', group: 'Reports',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M8 12h8M8 16h8M8 8h3"></path>' },  { key: 'admin', page: 'operational-inspection-report.html', label: 'Operational Inspection', group: 'Reports',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 11l2 2 4-4"></path><path d="M8 17h8"></path>' },
  { key: 'admin', page: 'internal-nonconformance-report.html', label: 'INC', group: 'Reports',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M8 8h8M8 12h5M8 16h8"></path>' },
  { key: 'usercontrol', page: 'user-control.html', label: 'User Control', group: null,
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
  },
    
];  


// Dropdown styles (injected here so only sidebar.js needs to change)
function injectNavGroupStyle() {
  if (document.getElementById('sidebar-group-style')) return;
  const style = document.createElement('style');
  style.id = 'sidebar-group-style';
  style.textContent = `
    .sidebar-group { flex-shrink: 0; display: flex; flex-direction: column; }
    .sidebar-group-toggle {
      display: flex; align-items: center; gap: 0.9rem;
      width: 100%; padding: 0.75rem 1rem;
      background: transparent; border: 0; border-radius: 10px;
      color: rgba(255, 255, 255, 0.85);
      font: inherit; font-size: 0.88rem; font-weight: 600;
      text-align: left; cursor: pointer;
      transition: background 0.25s ease, color 0.25s ease;
    }
    .sidebar-group-toggle:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
    .sidebar-group-toggle .group-label { flex: 1; }
    .sidebar-group-toggle .chevron { transition: transform 0.25s ease; flex-shrink: 0; }
    .sidebar-group.collapsed .chevron { transform: rotate(-90deg); }

    .sidebar-sub-wrap {
      display: grid; grid-template-rows: 1fr;
      transition: grid-template-rows 0.25s ease;
    }
    .sidebar-group.collapsed .sidebar-sub-wrap { grid-template-rows: 0fr; }
    .sidebar-sub-links {
      overflow: hidden; min-height: 0;
      display: flex; flex-direction: column; gap: 0.2rem;
      padding-left: 1.6rem;
    }
    .sidebar-sublink { padding: 0.6rem 1rem !important; gap: 0.8rem !important; }
    .sidebar-sublink .dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor; opacity: 0.8; flex-shrink: 0;
    }
    .sidebar-sublink.active::before { left: -1.4rem !important; }`;
  document.head.appendChild(style);
}

const NAV_SVG_OPEN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';

function navLinkHtml(item) {
  return `
      <a href="${SITE_ROOT}dashboard/${item.page}" class="sidebar-link" data-report="${item.key}">
        ${NAV_SVG_OPEN}${item.icon}</svg>
        <span>${item.label}</span>
      </a>`;
}

function navSubLinkHtml(item) {
  return `
        <a href="${SITE_ROOT}dashboard/${item.page}" class="sidebar-link sidebar-sublink" data-report="${item.key}">
          ${NAV_SVG_OPEN}${item.icon}</svg>
          <span>${item.label}</span>
        </a>`;
}

function navGroupHtml(name, items) {
const cfg = NAV_GROUPS[name] || {
  icon: name === 'Reports'
    ? '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M7 14l3-3 3 3 4-5"></path>'
    : '<circle cx="12" cy="8" r="4"></circle><path d="M5 21v-2a7 7 0 0 1 14 0v2"></path>'
};
  return `
      <div class="sidebar-group" data-group="${name}">
        <button type="button" class="sidebar-group-toggle" aria-expanded="true">
          ${NAV_SVG_OPEN}${cfg.icon}</svg>
          <span class="group-label">${name}</span>
          ${NAV_SVG_OPEN.replace('width="18" height="18"', 'width="16" height="16" class="chevron"')}<polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="sidebar-sub-wrap"><div class="sidebar-sub-links">
${items.map(navSubLinkHtml).join('')}
        </div></div>
      </div>`;
}

function buildNavLinks(user) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  let nav = sidebar.querySelector('.sidebar-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.className = 'sidebar-nav';
    const footer = sidebar.querySelector('.sidebar-footer');
    footer ? sidebar.insertBefore(nav, footer) : sidebar.appendChild(nav);
  }

  injectNavGroupStyle();

  const allowed = parseReports(user);
  const isOwner = String(user.role || '').trim().toLowerCase() === 'owner';

  // Owner sidebar groups are assigned manually here.
  const ownerGroupByKey = {
    birds: 'User1',
    ccp: 'User1',
    ev: 'User1',
    water: 'User1',
    birdsquality: 'User1',
    hygiene: 'User1',
    packing: 'User2',
    returns: 'User3',
    shopreturns: 'User3',
    rejection: 'User3',
    shygiene: 'User4',
    hygiene3: 'User6',
    operationalinspection: 'User1',
    complaint: 'User5',
    // Sample Parameters input belongs to User 5, like the other User 5 input.
    sampleparameters: 'User5',
    admin: 'Reports'
  };

  let items = NAV_ITEMS
    .filter(item => allowed.includes(item.key) || (isOwner && (item.key === 'usercontrol' || OWNER_EXTRA_PAGES.has(String(item.page).toLowerCase()))))
    .map(item => isOwner
      ? { ...item, group: item.key === 'usercontrol' ? null : (item.group === 'KPI' ? 'KPI' : (ownerGroupByKey[String(item.key).toLowerCase()] || 'Other')) }
      : item
    );

  // Operational Inspection is shared by User 1, User 2 and User 6.
  // Keep the same input page available inside each owner user group.
  if (isOwner) {
    const operationalItem = NAV_ITEMS.find(item => item.page === 'operational-inspection.html');
    if (operationalItem) {
      items = items.concat(
        { ...operationalItem, group: 'User2' },
        { ...operationalItem, group: 'User6' }
      );
    }
  }
  const seen = new Set();
  let html = '';

  items.forEach(item => {
    if (!item.group) {
      html += navLinkHtml(item);
      return;
    }

    if (seen.has(item.group)) return;
    seen.add(item.group);
    html += navGroupHtml(
      item.group,
      items.filter(link => link.group === item.group)
    );
  });

  nav.innerHTML = html;
  nav.style.visibility = 'visible';
  setupNavGroups(nav);
}
// ===== Dropdown open/close (state is remembered per group) =====
function setupNavGroups(nav, ownerMode) {
  nav.querySelectorAll('.sidebar-group').forEach(group => {
    const name = group.getAttribute('data-group');
    const toggle = group.querySelector('.sidebar-group-toggle');
    const storeKey = 'sidebarGroupOpen:' + name;

    let open = false;   // every group starts collapsed; the active page's group still opens below
    try { if (localStorage.getItem(storeKey) === '1') open = true; } catch (e) {}

    // Always open the group that contains the page we are on
    const here = window.location.pathname.split('/').pop().toLowerCase() || 'index.html';
    if (group.querySelector('.sidebar-sublink[href$="/' + here + '"]')) open = true;

    const apply = () => {
      group.classList.toggle('collapsed', !open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    apply();

    toggle.addEventListener('click', () => {
      open = !open;
      apply();
      try { localStorage.setItem(storeKey, open ? '1' : '0'); } catch (e) {}
    });
  });
}


// ===== Welcome popup (shown once after login) =====
function showWelcomeOnce(user) {
  try {
    if (sessionStorage.getItem('welcomeShown')) return;
    sessionStorage.setItem('welcomeShown', '1');
  } catch (e) { /* storage blocked: just show it */ }
  showWelcomePopup(user);
}

function showWelcomePopup(user) {
  if (document.getElementById('welcomeModal')) return;

  if (!document.getElementById('welcome-modal-style')) {
    const style = document.createElement('style');
    style.id = 'welcome-modal-style';
    style.textContent = `
      .welcome-overlay {
        position: fixed; inset: 0; z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
        background: rgba(8, 15, 40, 0.5);
        backdrop-filter: blur(10px) saturate(115%);
        -webkit-backdrop-filter: blur(10px) saturate(115%);
        animation: welcomeFade 0.2s ease;
      }
      .welcome-modal {
        position: relative; overflow: hidden;
        width: 100%; max-width: 360px;
        padding: 1.8rem 1.5rem 1.5rem;
        color: #10224a;
        background: linear-gradient(135deg, rgba(255,255,255,.9), rgba(239,246,255,.78));
        border: 1px solid rgba(255,255,255,.72);
        border-radius: 18px; text-align: center;
        box-shadow: 0 24px 60px rgba(5, 18, 52, .38), inset 0 1px 0 rgba(255,255,255,.78);
        backdrop-filter: blur(22px) saturate(135%);
        -webkit-backdrop-filter: blur(22px) saturate(135%);
        font-family: 'Inter', system-ui, sans-serif;
        animation: welcomePop 0.25s ease;
      }
      .welcome-avatar {
        width: 62px; height: 62px; margin: 0 auto 0.9rem;
        display: flex; align-items: center; justify-content: center;
        overflow: hidden; border-radius: 50%; color: #fff;
        background: linear-gradient(135deg, #4d88f5, #2864dc);
        border: 2px solid rgba(255,255,255,.85);
        box-shadow: 0 8px 22px rgba(45, 101, 217, .28), inset 0 1px 0 rgba(255,255,255,.28);
      }
      .welcome-avatar.has-img { background: #f4f8ff; }
      .welcome-avatar .sidebar-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
      .welcome-modal h3 { margin: 0 0 0.35rem; font-size: 1.25rem; font-weight: 700; word-break: break-word; }
      .welcome-modal p { margin: 0 0 1.3rem; font-size: 0.9rem; color: #5d7399; }
      .welcome-modal button {
        width: 100%; padding: 0.7rem 1rem; border: 1px solid rgba(255,255,255,.75); border-radius: 10px;
        font: inherit; font-size: 0.9rem; font-weight: 650; cursor: pointer; color: #fff;
        background: linear-gradient(135deg, #467ff0, #2f67dd);
        box-shadow: 0 5px 14px rgba(44, 99, 210, .2), inset 0 1px 0 rgba(255,255,255,.22);
        transition: transform 0.15s ease, filter 0.15s ease;
      }
      .welcome-modal button:hover { filter: brightness(0.96); transform: translateY(-1px); }
      .welcome-bar {
        position: absolute; left: 0; bottom: 0; height: 3px; width: 100%;
        background: linear-gradient(90deg, #77a7ff, #376de1);
        transform-origin: left; animation: welcomeBar 3.5s linear forwards;
      }
      @keyframes welcomeBar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
      @keyframes welcomeFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes welcomePop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }`;
    style.textContent += `
      .welcome-overlay { background: rgba(8, 15, 40, .5); backdrop-filter: blur(10px) saturate(115%); -webkit-backdrop-filter: blur(10px) saturate(115%); }
      .welcome-modal { color: #10224a; background: #f2f4f7; border: 1px solid #e1e6ed; border-radius: 18px; box-shadow: 0 24px 60px rgba(5,18,52,.32), inset 0 1px 0 rgba(255,255,255,.9); }
      .welcome-avatar { width: 62px; height: 62px; margin: 0 auto .9rem; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; color: #fff; background: linear-gradient(135deg, #4d88f5, #2864dc); border: 2px solid rgba(255,255,255,.85); box-shadow: 0 8px 22px rgba(45,101,217,.28), inset 0 1px 0 rgba(255,255,255,.28); }
      .welcome-avatar.has-img { background: #f4f8ff; }
      .welcome-avatar .sidebar-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
      .welcome-modal p { color: #5d7399; }
      .welcome-modal button { border: 1px solid rgba(255,255,255,.75); background: linear-gradient(135deg, #467ff0, #2f67dd); box-shadow: 0 5px 14px rgba(44,99,210,.2), inset 0 1px 0 rgba(255,255,255,.22); }
      .welcome-bar { height: 3px; background: linear-gradient(90deg, #77a7ff, #376de1); }`;    document.head.appendChild(style);
  }

  const rawName = String(user.name || user.username || 'User').trim();
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const roleText = String(user.role || '').replace(/-/g, ' ').trim();
  const roleLabel = roleText ? roleText.charAt(0).toUpperCase() + roleText.slice(1) : '';

  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.id = 'welcomeModal';
  overlay.innerHTML = `
    <div class="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">      <div class="welcome-avatar" id="welcomeAvatar" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <polyline points="16 11 18 13 22 9"></polyline>
        </svg>
      </div>
      <h3 id="welcomeTitle"></h3>
      <p></p>
      <button type="button" id="welcomeOk">Continue</button>
      <div class="welcome-bar"></div>
    </div>`;

  applyAvatarImage(overlay.querySelector('#welcomeAvatar'), user);

  // textContent (not innerHTML) so a name from the Sheet can never inject HTML
  overlay.querySelector('#welcomeTitle').textContent = 'Welcome, ' + name + '!';
  overlay.querySelector('p').textContent = roleLabel
    ? 'Logged in as ' + roleLabel + '. Have a great day!'
    : 'Have a great day!';

  let timer;
  const close = () => {
    clearTimeout(timer);
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(); };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#welcomeOk').addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  overlay.querySelector('#welcomeOk').focus();
  timer = setTimeout(close, 3500);   // auto-close
}
// ===== Sidebar Toggle (Hide/Show Arrow) =====
function setupSidebarToggle() {
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (!sidebar || !mainContent) {
    console.warn('Sidebar or main-content not found');
    return;
  }

  // ===== Create Arrow Button =====
  const arrowBtn = document.createElement('button');
  arrowBtn.className = 'sidebar-toggle-arrow';
  arrowBtn.type = 'button';
  arrowBtn.setAttribute('aria-label', 'Toggle sidebar');
  arrowBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `;
  
  document.body.appendChild(arrowBtn);

  // ===== Load Previous State =====
  const isHidden = localStorage.getItem('sidebarHidden') === 'true';
  
  if (isHidden) {
    sidebar.classList.add('sidebar-hidden');
    mainContent.classList.add('main-content-expanded');
    arrowBtn.classList.add('sidebar-hidden');
  }

  // ===== Click Toggle =====
  arrowBtn.addEventListener('click', () => {
    const currentlyHidden = sidebar.classList.toggle('sidebar-hidden');
    mainContent.classList.toggle('main-content-expanded', currentlyHidden);
    arrowBtn.classList.toggle('sidebar-hidden', currentlyHidden);
    
    localStorage.setItem('sidebarHidden', currentlyHidden);
  });

  console.log('🔴 Sidebar arrow toggle setup ✅');
}
// ===== Header Date & Time =====
// Removed from pages — date/time no longer shown.
// ===== Theme Toggle (Dark/Light Mode) =====
function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  
  if (!themeToggle) {
    console.warn('Theme toggle not found');
    return;
  }

  // ===== Load Previous Theme =====
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.checked = true;
  } else {
    document.body.classList.remove('dark-mode');
    themeToggle.checked = false;
  }

  // ===== Toggle Click =====
  themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
      console.log('🌙 Dark mode ON');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
      console.log('☀️ Light mode ON');
    }
  });

  console.log('🔴 Theme toggle setup ✅');
}
// ===== Profile avatar choices =====
const AVATAR_OPTIONS = [
  { key: 'female', label: 'Classic', file: 'assets/images/avatars.png' },
  { key: 'male', label: 'Blue', file: 'assets/images/MIS.png' },
  { key: 'avatar3', label: 'Haha', file: 'assets/images/avatar-3.png' },
  { key: 'avatar4', label: 'Oops', file: 'assets/images/avatar-4.png' },
  { key: 'avatar5', label: 'Cool', file: 'assets/images/avatar-5.png' }
];

function getUserAvatarKey(user) {
  const saved = String(user?.avatar || '').trim();
  if (AVATAR_OPTIONS.some(option => option.key === saved)) return saved;
  const gender = String(user?.gender || '').trim().toLowerCase();
  return gender === 'male' ? 'male' : gender === 'female' ? 'female' : '';
}

function applyAvatarImage(avatarEl, user) {
  if (!avatarEl) return;
  const option = AVATAR_OPTIONS.find(item => item.key === getUserAvatarKey(user));
  if (!option) return;

  const img = new Image();
  img.className = 'sidebar-avatar-img';
  img.alt = '';
  img.onload = () => {
    avatarEl.textContent = '';
    avatarEl.appendChild(img);
    avatarEl.classList.add('has-img');
  };
  img.src = SITE_ROOT + option.file;
}

function setupAdminNotifications() {
  const button = document.getElementById('adminNotifications');
  const actions = button?.closest('.header-actions');
  if (!button || !actions || button.dataset.ready) return;

  button.dataset.ready = 'true';

  const panel = document.createElement('div');
  panel.className = 'notification-panel';
  panel.id = 'notificationPanel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="notification-panel-header">
      <div class="notification-panel-title">Notifications</div>
      <button class="notification-read-all" id="markAllNotificationsRead" type="button" hidden>Read all</button>
    </div>
    <div class="notification-list" id="notificationList">Loading...</div>
  `;
  actions.appendChild(panel);

  const countBadge = document.getElementById('notificationCount');
  const list = document.getElementById('notificationList');
  const readAllButton = document.getElementById('markAllNotificationsRead');
  let unreadCount = 0;

  async function loadNotifications() {
    try {
      const response = await fetch(
        API_URL + '?action=getNotifications&t=' + Date.now(),
        { cache: 'no-store' }
      );
      const data = await response.json();

      if (!data.success) {
        list.textContent = data.error || 'Could not load notifications.';
        return;
      }

      const items = (data.notifications || []).filter(item => !item.isRead);
      unreadCount = Number(data.unreadCount ?? items.length);

      if (countBadge) {
        countBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        countBadge.hidden = unreadCount === 0;
      }

      list.replaceChildren();

      if (readAllButton) readAllButton.hidden = items.length === 0;

      if (!items.length) {
        list.textContent = 'No unread notifications.';
        return;
      }

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'notification-item is-unread';

        const heading = document.createElement('strong');
        heading.textContent = item.action || 'Update';

        const detail = document.createElement('span');
        detail.textContent =
          [item.username, item.page, item.details].filter(Boolean).join(' · ');

        const time = document.createElement('small');
        time.textContent = item.createdAt
          ? new Date(item.createdAt).toLocaleString()
          : '';

        const readButton = document.createElement('button');
        readButton.type = 'button';
        readButton.className = 'notification-mark-read';
        readButton.title = 'Mark as read';
        readButton.setAttribute('aria-label', 'Mark as read');
        readButton.textContent = '✓';


        readButton.addEventListener('click', async event => {
          event.stopPropagation();
          readButton.disabled = true;

          try {
            const resultResponse = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({
                action: 'markNotificationsRead',
                id: item.id
              })
            });
            const result = await resultResponse.json();

            if (!result.success) {
              readButton.disabled = false;
              console.error('Could not mark notification as read:', result.error);
              return;
            }

            row.remove();
            unreadCount = Math.max(0, unreadCount - 1);

            if (countBadge) {
              countBadge.textContent =
                unreadCount > 99 ? '99+' : String(unreadCount);
              countBadge.hidden = unreadCount === 0;
            }

            if (!list.querySelector('.notification-item')) {
              list.textContent = 'No unread notifications.';
            }
          } catch (error) {
            readButton.disabled = false;
            console.error('Mark notification as read failed:', error);
          }
        });

        row.append(readButton, heading, detail, time);
        list.appendChild(row);
      });
    } catch (error) {
      list.textContent = 'Could not load notifications.';
      console.error('Notifications error:', error);
    }
  }

  readAllButton?.addEventListener('click', async event => {
    event.stopPropagation();
    readAllButton.disabled = true;
    const oldText = readAllButton.textContent;
    readAllButton.textContent = 'Marking...';
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'markNotificationsRead', all: true })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Could not mark notifications as read.');
      await loadNotifications();
    } catch (error) {
      console.error('Mark all notifications read failed:', error);
    } finally {
      readAllButton.disabled = false;
      readAllButton.textContent = oldText;
    }
  });
  button.addEventListener('click', async () => {
    panel.hidden = !panel.hidden;

    // Panel eka open karaddi okkoma read karanne na.
    if (!panel.hidden) await loadNotifications();
  });

  document.addEventListener('click', event => {
    if (!actions.contains(event.target)) panel.hidden = true;
  });

  loadNotifications();
  setInterval(loadNotifications, 60000);
}



