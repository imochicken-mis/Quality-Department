(() => {
  const permissions = [
    ['ccp', 'Slaughter Data'], ['birds', 'Birds Data'], ['ev', 'EV Data'],
    ['water', 'Water Plant Data'], ['packing', 'Packing Data'],
    ['birdsquality', 'Birds Quality'], ['returns', 'Sales Returns'],
    ['shopreturns', 'Shop Returns'], ['complaint', 'Complaint'], ['rejection', 'Rejection'], ['operationalinspection', 'Operational Inspection'],
    ['hygiene', 'Personal Hygiene'], ['shygiene', 'Personal Hygiene 2'], ['hygiene3', 'Personal Hygiene 3'], ['sampleparameters', 'Sample Parameters'], ['admin', 'Reports']
  ];
  const avatarOptions = [
    { key:'female', label:'Classic', file:'assets/images/avatars.png' },
    { key:'male', label:'Blue', file:'assets/images/MIS.png' },
    { key:'avatar3', label:'Haha', file:'assets/images/avatar-3.png' },
    { key:'avatar4', label:'Oops', file:'assets/images/avatar-4.png' },
    { key:'avatar5', label:'Cool', file:'assets/images/avatar-5.png' }
  ];
  document.addEventListener('DOMContentLoaded', () => {
    const current = getCurrentUser();
    if (!current || String(current.role || '').trim().toLowerCase() !== 'owner') {
      alert('Owner access required.'); location.replace('../index.html'); return;
    }
    const $ = id => document.getElementById(id);
    const message = $('ucMessage'), userRows = $('usersTableBody'), modal = $('userModal'), form = $('userForm');
    let users = [], selected = null, adding = false, selectedAvatarKey = '';
    function showMessage(text, type = 'success') { message.textContent = text; message.className = `uc-message show ${type}`; }
    function clearMessage() { message.className = 'uc-message'; message.textContent = ''; }
    function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    async function api(action, payload = null) {
      const token = localStorage.getItem('sessionToken');
      if (!token) throw new Error('Session expired. Please log in again.');

      const response = payload
        ? await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action, ...payload, token })
          })
        : await fetch(
            `${API_URL}?action=${encodeURIComponent(action)}&token=${encodeURIComponent(token)}`
          );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Request failed (${response.status})`);
      }
      return result;
    }
    function avatarOf(user) {
      const saved = String(user?.avatar || '').trim();
      if (avatarOptions.some(option => option.key === saved)) return saved;
      const gender = String(user?.gender || '').trim().toLowerCase();
      return gender === 'male' ? 'male' : gender === 'female' ? 'female' : '';
    }
    function avatarImage(key, className) {
      const option = avatarOptions.find(item => item.key === key);
      return option ? `<img class="${className}" src="${SITE_ROOT}${option.file}" alt="Profile picture">` : '<span class="uc-avatar-fallback">?</span>';
    }
    function renderAvatarChoices(key) {
      const choices = $('userAvatarChoices');
      choices.innerHTML = avatarOptions.map(option => `<button type="button" class="uc-avatar-choice ${option.key === key ? 'selected' : ''}" data-avatar="${option.key}" aria-label="${option.label}" aria-pressed="${option.key === key}"><img src="${SITE_ROOT}${option.file}" alt=""><span>${option.label}</span></button>`).join('');
      choices.querySelectorAll('.uc-avatar-choice').forEach(button => button.addEventListener('click', () => {
        selectedAvatarKey = button.dataset.avatar;
        choices.querySelectorAll('.uc-avatar-choice').forEach(item => { const active=item===button; item.classList.toggle('selected',active); item.setAttribute('aria-pressed',String(active)); });
        $('modalAvatar').innerHTML = avatarImage(selectedAvatarKey, 'uc-profile-image');
      }));
    }
    function renderUsers(filter = '') {
      const q = filter.trim().toLowerCase();
      const shown = users.filter(u => `${u.username} ${u.name} ${u.role}`.toLowerCase().includes(q));
      userRows.innerHTML = shown.map(u => `<tr>
        <td><div class="uc-user-details"><span class="uc-row-avatar">${avatarImage(avatarOf(u), 'uc-row-image')}</span><span><strong>${esc(u.name || u.username)}</strong><small>${esc(u.name || '')}</small></span></div></td>
        <td>${esc(u.username)}</td><td>${esc(u.role)}</td>
        <td><span class="uc-status ${u.active ? '' : 'inactive'}">${u.active ? 'Active' : 'Inactive'}</span></td>
        <td><button class="uc-edit-button" type="button" data-edit-user="${esc(u.username)}" aria-label="Edit ${esc(u.username)}" title="Edit user">✎</button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="uc-no-users">No users found.</td></tr>';
    }
    function openModal(user) {
      selected = user || null; adding = !user;
      $('modalTitle').textContent = adding ? 'Add New User' : 'Edit User';
      $('modalSubtitle').textContent = adding ? 'Create a user account' : `Account details for ${user.username}`;
      selectedAvatarKey = avatarOf(user) || 'female';
      $('modalAvatar').innerHTML = avatarImage(selectedAvatarKey, 'uc-profile-image');
      $('userUsername').value = user?.username || ''; $('userUsername').readOnly = !adding;
      $('userName').value = user?.name || ''; $('userRole').value = user?.role || '';
      $('userPassword').value = ''; renderAvatarChoices(selectedAvatarKey);
      $('newPasswordField').hidden = !adding; $('resetPasswordField').hidden = true;
      const owner = user?.role?.toLowerCase() === 'owner';
      $('userUsername').disabled = owner; $('userName').disabled = owner; $('userRole').disabled = owner;
      $('saveUserButton').hidden = owner; $('resetPasswordButton').hidden = adding || owner; $('toggleUserButton').hidden = adding || owner;
      $('toggleUserButton').textContent = user?.active ? 'Deactivate Account' : 'Activate Account';
      $('modalAvatar').classList.toggle('owner-avatar', owner);
      modal.hidden = false; document.body.classList.add('uc-modal-open');
      if (owner) $('modalSubtitle').textContent = 'Owner profile is protected';
    }
    function closeModal() { modal.hidden = true; document.body.classList.remove('uc-modal-open'); selected = null; adding = false; }
    async function loadUsers() {
      try { const result = await api('getUserControlData'); users = result.users || []; renderUsers($('userSearch').value); fillAccessUsers(); }
      catch (error) { showMessage(error.message, 'error'); }
    }
    function fillAccessUsers() {
      const select = $('accessUser'), previous = select.value;
      select.innerHTML = '<option value="">Select user</option>' + users.filter(u => u.role.toLowerCase() !== 'owner').map(u => `<option value="${esc(u.username)}">${esc(u.name || u.username)} (${esc(u.username)})</option>`).join('');
      if (users.some(u => u.username === previous)) select.value = previous; renderPermissions();
    }
    function renderPermissions() {
      const user = users.find(u => u.username === $('accessUser').value);
      $('permissionList').innerHTML = permissions.map(([key,label]) => `<label class="uc-permission"><input type="checkbox" value="${key}" ${user?.reports?.includes(key) ? 'checked' : ''} ${!user ? 'disabled' : ''}><span>${label}</span></label>`).join('');
      $('saveAccessButton').disabled = !user;
    }
        async function loadActivityReport() {
      const body = $('activityTableBody');
      const message = $('activityMessage');
      const userSelect = $('activityUserFilter');
      const previousUser = userSelect.value;

      userSelect.innerHTML = '<option value="">All users</option>' +
        users.map(user =>
          `<option value="${esc(user.username)}">${esc(user.username)}</option>`
        ).join('');

      if (users.some(user => user.username === previousUser)) {
        userSelect.value = previousUser;
      }

      body.innerHTML = '';
      message.textContent = 'Loading activity...';

      try {
        const token = localStorage.getItem('sessionToken');
        const params = new URLSearchParams({
          action: 'getUserActivityReport',
          token: token || '',
          fromDate: $('activityFromDate').value,
          toDate: $('activityToDate').value,
          user: userSelect.value,
          filterAction: $('activityActionFilter').value
        });

        const response = await fetch(`${API_URL}?${params.toString()}`, {
          cache: 'no-store'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Could not load activity report.');
        }

        const rows = result.rows || [];

        if (!rows.length) {
          message.textContent = 'No activity found for the selected filters.';
          return;
        }

        body.innerHTML = rows.map(row => `
          <tr>
            <td>${esc(row.dateTime)}</td>
            <td>${esc(row.user)}</td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.section)}</td>
            <td>${esc(row.affectedUser)}</td>
            <td>${esc(row.details)}</td>
          </tr>
        `).join('');

        message.textContent = `${rows.length} activity record(s) found.`;
      } catch (error) {
        message.textContent = error.message || 'Could not load activity report.';
      }
    }
    $('loadActivityButton').addEventListener('click', loadActivityReport);
    const tabButtons = {
      users: $('usersTabButton'),
      access: $('accessTabButton'),
      activity: $('activityTabButton')
    };

    const tabPanels = {
      users: $('usersPanel'),
      access: $('accessPanel'),
      activity: $('activityPanel')
    };

    function showTab(name) {
      Object.keys(tabPanels).forEach(key => {
        const active = key === name;
        tabPanels[key].hidden = !active;
        tabButtons[key].classList.toggle('active', active);
        tabButtons[key].setAttribute('aria-selected', String(active));
      });
    }

    tabButtons.users.addEventListener('click', () => showTab('users'));
    tabButtons.access.addEventListener('click', () => showTab('access'));
    tabButtons.activity.addEventListener('click', () => showTab('activity'));
    $('userSearch').addEventListener('input', e => renderUsers(e.target.value));
    userRows.addEventListener('click', e => { const btn=e.target.closest('[data-edit-user]'); if (!btn) return; openModal(users.find(u=>u.username===btn.dataset.editUser)); clearMessage(); });
    $('addUserButton').addEventListener('click', () => { openModal(null); clearMessage(); });
    $('closeUserModal').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target.hasAttribute('data-close-modal')) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key==='Escape' && !modal.hidden) closeModal(); });
    form.addEventListener('submit', async e => {
      e.preventDefault(); clearMessage();
      const data={ username:$('userUsername').value.trim(), name:$('userName').value.trim(), role:$('userRole').value.trim(), avatar:selectedAvatarKey };
      if (adding) data.password=$('userPassword').value;
      if (adding && data.password.length<6) { showMessage('Set an initial password with at least 6 characters.','error'); return; }
      try {
        await api(adding?'addManagedUser':'updateManagedUser',data);
        closeModal(); showMessage(adding?'User added.':'User details updated.'); await loadUsers();
      } catch(error) { showMessage(error.message,'error'); }
    });
    $('resetPasswordButton').addEventListener('click', () => { $('resetPasswordField').hidden=false; $('newPassword').value=''; $('newPassword').focus(); });
    $('cancelPasswordButton').addEventListener('click', () => { $('resetPasswordField').hidden=true; });
    $('confirmPasswordButton').addEventListener('click', async () => {
      const password=$('newPassword').value;
      if (!selected || password.length<6) { showMessage('New password must contain at least 6 characters.','error'); return; }
      try { await api('resetManagedUserPassword',{username:selected.username,password}); $('newPassword').value=''; $('resetPasswordField').hidden=true; showMessage('New password saved securely.','success'); }
      catch(error) { showMessage(error.message,'error'); }
    });
    $('toggleUserButton').addEventListener('click', async () => {
      if (!selected) return; const username=selected.username, next=!selected.active;
      if (!confirm(`${next?'Activate':'Deactivate'} ${username}?`)) return;
      try { await api('setManagedUserStatus',{username,active:next}); closeModal(); showMessage(`User ${next?'activated':'deactivated'}.`); await loadUsers(); }
      catch(error) { showMessage(error.message,'error'); }
    });
    $('accessUser').addEventListener('change',renderPermissions);
    $('saveAccessButton').addEventListener('click',async()=>{
      const username=$('accessUser').value, reports=[...$('permissionList').querySelectorAll('input:checked')].map(input=>input.value); if(!username)return;
      try { await api('updateManagedUserAccess',{username,reports}); showMessage(`Access updated for ${username}.`); await loadUsers(); $('accessUser').value=username; renderPermissions(); }
      catch(error) { showMessage(error.message,'error'); }
    });
    loadUsers();
  });
})();

