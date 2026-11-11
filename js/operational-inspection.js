(() => {
  const API_URL_INSPECTION = API_URL;
  const USER_DIVISIONS = {
    user1: { divisions: ['Live Bird', 'Slaughter', 'EV'], operationalGroup: 'LIVE_BIRD_SLAUGHTER_EV' },
    user2: { divisions: ['Packing', 'Easy'], operationalGroup: 'PACKING_EASY' },
    user6: { divisions: ['Cold Storage', 'Finished Good'], operationalGroup: '' },
    owner: { divisions: ['Live Bird', 'Slaughter', 'EV', 'Packing', 'Easy', 'Cold Storage', 'Finished Good'], operationalGroup: 'OWNER' }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const user = getCurrentUser();
    const divisionSelect = $('inspectionDivision');
    const dateInput = $('inspectionDate');
    const preTab = $('preTab');
    const operationalTab = $('operationalTab');
    const postTab = $('postTab');
    const prePanel = $('prePanel');
    const operationalPanel = $('operationalPanel');
    const postPanel = $('postPanel');
    const empty = $('inspectionEmpty');
    const footer = $('inspectionFooter');
    const identities = [user?.username, user?.role].map(value => String(value || '').trim().toLowerCase());
    const userKey = Object.keys(USER_DIVISIONS).find(key =>
      identities.some(identity => identity === key || identity.includes(key))
    );
    const config = userKey ? USER_DIVISIONS[userKey] : null;
    let activeDivision = '';
    let currentStage = 'Pre-Operational';
    let criteria = { preOperational: [], operational: [], postOperational: [] };

    if (!config) {
      empty.hidden = false;
      empty.textContent = 'This user is not assigned to Operational Inspection.';
      prePanel.hidden = true;
      operationalTab.hidden = true;
      postTab.hidden = true;
      return;
    }

    // Keep all checklist panels hidden until a division is selected.
    prePanel.hidden = true;
    operationalPanel.hidden = true;
    postPanel.hidden = true;
    empty.hidden = false;
    empty.textContent = 'Select a division to load its checklist.';
    footer.hidden = true;

    const localDate = new Date();
    dateInput.value = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    divisionSelect.innerHTML = '<option value="">Select division</option>' +
      config.divisions.map(division => `<option value="${escapeHtml(division)}">${escapeHtml(division)}</option>`).join('');

    if (!config.operationalGroup) {
      operationalTab.hidden = true;
      operationalTab.setAttribute('aria-hidden', 'true');
      $('operationalDescription').textContent = 'Operational checklist is not applicable to this division.';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[char]));
    }

    // Tab key -> its button, panel and the sheet stage name it saves under
    const STAGES = {
      preOperational: { tab: () => preTab, panel: () => prePanel, name: 'Pre-Operational' },
      operational: { tab: () => operationalTab, panel: () => operationalPanel, name: 'Operational' },
      postOperational: { tab: () => postTab, panel: () => postPanel, name: 'Post-Operational' }
    };

    function showTab(key) {
      Object.keys(STAGES).forEach(k => {
        const tab = STAGES[k].tab();
        const panel = STAGES[k].panel();
        const active = k === key;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        const hasRows = (criteria[k] || []).length > 0;
        panel.hidden = !activeDivision || !hasRows || !active;
      });
      currentStage = STAGES[key].name;
    }

    function renderRows(target, items, stage) {
      const body = $(target);
      if (!items.length) {
        body.innerHTML = '<tr><td colspan="5">No checklist criteria were returned.</td></tr>';
        return;
      }
      body.innerHTML = items.map((item, index) => {
        const id = `${stage}-${index}`;
        const statusOptions = `
            <li role="option" class="status-opt ok" data-value="✓">✓ Acceptable</li>
            <li role="option" class="status-opt bad" data-value="✗">✗ Not Acceptable</li>
            `;
        return `<tr data-stage-row data-item-no="${escapeHtml(item.itemNo)}" data-checkpoint="${escapeHtml(item.checkPoint)}" data-acceptance="${escapeHtml(item.acceptanceCriteria || '')}">
          <td>${escapeHtml(item.itemNo)}</td>
          <td>${escapeHtml(item.checkPoint)}</td>
          ${stage !== 'operational' ? `<td>${escapeHtml(item.acceptanceCriteria || '')}</td>` : ''}
          <td>
            <div class="status-pick" id="${id}-status" data-status="">
              <button type="button" class="status-btn" aria-haspopup="listbox" aria-label="Status for item ${escapeHtml(item.itemNo)}">Select</button>
              <ul class="status-menu" role="listbox" hidden>${statusOptions}</ul>
            </div>
          </td>
          <td><input id="${id}-action" type="text" maxlength="500" aria-label="Action taken for item ${escapeHtml(item.itemNo)}" /></td>
        </tr>`;
      }).join('');
    }

    async function loadCriteria(division) {
      if (!division) {
        activeDivision = '';
        criteria = { preOperational: [], operational: [], postOperational: [] };
        $('preRows').replaceChildren();
        $('operationalRows').replaceChildren();
        $('postRows').replaceChildren();
        empty.classList.remove('is-loading');
        empty.hidden = false;
        empty.textContent = 'Select a division to load its checklist.';
        prePanel.hidden = true;
        operationalPanel.hidden = true;
        postPanel.hidden = true;
        footer.hidden = true;
        return;
      }

      activeDivision = division;
      empty.classList.add('is-loading');
      empty.hidden = false;
      empty.textContent = 'Loading checklist...';
      prePanel.hidden = true;
      operationalPanel.hidden = true;
      postPanel.hidden = true;
      footer.hidden = true;
      try {
        const params = new URLSearchParams({
          action: 'getOperationalInspectionCriteria',
          division
        });
        const response = await fetch(`${API_URL_INSPECTION}?${params}`, { cache: 'no-store' });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Could not load checklist.');
        if (division !== activeDivision) return;
        criteria = {
          preOperational: [],
          operational: [],
          postOperational: [],
          ...(result.criteria || {})
        };
        renderRows('preRows', criteria.preOperational || [], 'preOperational');
        renderRows('postRows', criteria.postOperational || [], 'postOperational');
        if (config.operationalGroup && (criteria.operational || []).length) {
          renderRows('operationalRows', criteria.operational, 'operational');
          $('operationalDescription').textContent = `${division} operational checklist`;
          operationalTab.hidden = false;
          operationalTab.removeAttribute('aria-hidden');
        } else {
          $('operationalRows').replaceChildren();
          operationalTab.hidden = true;
          operationalTab.setAttribute('aria-hidden', 'true');
        }
        empty.classList.remove('is-loading');
        empty.hidden = true;
        // Keep the stage the user was on if it is still available, otherwise open Pre-Operational
        const keyOf = Object.keys(STAGES).find(k => STAGES[k].name === currentStage);
        const available = keyOf && (keyOf === 'operational' ? !operationalTab.hidden : (criteria[keyOf] || []).length > 0);
        showTab(available ? keyOf : 'preOperational');
        footer.hidden = false;
      } catch (error) {
        empty.classList.remove('is-loading');
        empty.hidden = false;
        empty.textContent = error.message || 'Could not load checklist.';
        footer.hidden = true;
      }
    }

    function collectRows(target) {
      return [...$(target).querySelectorAll('[data-stage-row]')].map(row => ({
        itemNo: row.dataset.itemNo,
        checkPoint: row.dataset.checkpoint,
        acceptanceCriteria: row.dataset.acceptance,
        status: row.querySelector('.status-pick').dataset.status,
        actionTaken: row.querySelector('input').value.trim()
      }));
    }

    // After a successful save: reset every status and remark in this stage (date and division stay)
    function clearStage(target) {
      $(target).querySelectorAll('[data-stage-row]').forEach(row => {
        setStatus(row.querySelector('.status-pick'), '');
        row.querySelector('input').value = '';
      });
    }

    async function saveStage(stage) {
      const targetOf = { 'Pre-Operational': 'preRows', 'Operational': 'operationalRows', 'Post-Operational': 'postRows' };
      const target = targetOf[stage];
      const button = $('saveInspectionBtn');
      const message = $('inspectionMessage');
      const responses = collectRows(target);
      message.textContent = '';
      message.className = 'inspection-message';

      if (!dateInput.value || !divisionSelect.value) {
        message.textContent = 'Select date and division first.';
        message.classList.add('error');
        return;
      }
      if (!responses.length || responses.some(row => !row.status)) {
        message.textContent = 'Select a status for every checklist item before saving.';
        message.classList.add('error');
        return;
      }
      if (responses.some(row => row.status === '✗' && !row.actionTaken)) {
        message.textContent = 'Add the action taken for every ✗ item.';
        message.classList.add('error');
        return;
      }

      const username = String(user.username || '').trim();
      const divisionSlug = divisionSelect.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const inspectionId = `${username.toLowerCase()}_${dateInput.value}_${divisionSlug}`;
      const confirmed = await confirmSave({
        title: `Confirm Save — ${stage}`,
        subtitle: 'Please review the inspection responses before saving',
        meta: [
          { label: 'Date', value: dateInput.value },
          { label: 'Division', value: divisionSelect.value }
        ],
        sections: [{
          title: stage,
          fields: responses.map(row => ({
            label: `${row.itemNo}. ${row.checkPoint}`,
            value: row.actionTaken ? `${row.status} — ${row.actionTaken}` : row.status,
            type: 'badge-inspection'
          }))
        }]
      });
      if (!confirmed) return;
      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = 'Saving...';
      try {
        const response = await fetch(API_URL_INSPECTION, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'saveOperationalInspectionStage',
            inspectionId,
            date: dateInput.value,
            division: divisionSelect.value,
            stage,
            responses
          })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Save failed.');
        InputFeedback.success(`${stage} inspection saved successfully.`);
        // Success is shown by the shared bottom-center toast.
        clearStage(target);
      } catch (error) {
        message.textContent = error.message || 'Save failed. Please try again.';
        message.classList.add('error');
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    }

    function setStatus(picker, value) {
      picker.dataset.status = value;
      const button = picker.querySelector('.status-btn');
      button.textContent = value || 'Select';
      picker.classList.toggle('ok', value === '✓');
      picker.classList.toggle('bad', value === '✗');
      picker.classList.toggle('na', value === 'NA');
    }

    // Custom status dropdown: closed box shows only the icon, list shows full text
    document.addEventListener('click', event => {
      const button = event.target.closest('.status-btn');
      const option = event.target.closest('.status-opt');
      document.querySelectorAll('.status-menu').forEach(menu => {
        if (!button || menu !== button.nextElementSibling) menu.hidden = true;
      });
      if (button) {
        button.nextElementSibling.hidden = !button.nextElementSibling.hidden;
      } else if (option) {
        const picker = option.closest('.status-pick');
        setStatus(picker, option.dataset.value);
        option.closest('.status-menu').hidden = true;
      }
    });

    preTab.addEventListener('click', () => showTab('preOperational'));
    operationalTab.addEventListener('click', () => {
      if (!operationalTab.hidden) showTab('operational');
    });
    postTab.addEventListener('click', () => {
      if (!postTab.hidden) showTab('postOperational');
    });
    divisionSelect.addEventListener('change', () => loadCriteria(divisionSelect.value));
    $('saveInspectionBtn').addEventListener('click', () => saveStage(currentStage));
  });
})();
