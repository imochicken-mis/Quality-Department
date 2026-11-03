(() => {
  const API_URL_INSPECTION_REPORT = API_URL;

  document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const dateInput = $('reportDate');
    const divisionSelect = $('reportDivision');
    const preTab = $('reportPreTab');
    const operationalTab = $('reportOperationalTab');
    const postTab = $('reportPostTab');
    const tabs = { 'Pre-Operational': preTab, 'Operational': operationalTab, 'Post-Operational': postTab };
    const loadBtn = $('loadInspectionReportBtn');
    const empty = $('reportEmpty');
    const body = $('reportBody');
    const meta = $('reportMeta');
    const rowsBody = $('reportRows');
    let stage = 'Pre-Operational';

    const localDate = new Date();
    dateInput.value = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));

    // Sheet values: new text ("Acceptable") and older icon values ("✓") both map to the same colour
    function statusClass(status) {
      const value = String(status || '').trim();
      if (value === 'Acceptable' || value === '✓') return 'ok';
      if (value === 'Not Acceptable' || value === '✗') return 'bad';
      return 'na';
    }

    function showEmpty(text) {
      body.hidden = true;
      empty.hidden = false;
      empty.textContent = text;
    }

    function setStage(next) {
      stage = next;
      Object.entries(tabs).forEach(([name, tab]) => {
        const active = name === next;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      // Acceptance Criteria column is used by Pre-Operational and Post-Operational (not Operational)
      const hasCriteria = next !== 'Operational';
      rowsBody.closest('table').querySelectorAll('.report-criteria-col').forEach(th => {
        th.hidden = !hasCriteria;
      });
      if (!body.hidden) loadReport();
    }

    async function loadReport() {
      const date = dateInput.value;
      const division = divisionSelect.value;
      if (!date || !division) return showEmpty('Select a date and division first.');

      const originalText = loadBtn.textContent;
      loadBtn.disabled = true;
      loadBtn.textContent = 'Loading...';
      empty.hidden = false;
      empty.innerHTML = '<div class="loading-spinner" aria-hidden="true"></div><p>Loading report...</p>';
      body.hidden = true;

      try {
        const params = new URLSearchParams({
          action: 'getOperationalInspectionReport',
          date,
          division,
          stage
        });
        const response = await fetch(`${API_URL_INSPECTION_REPORT}?${params}`, { cache: 'no-store' });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Could not load report.');

        const rows = result.rows || [];
        if (!rows.length) return showEmpty(`No ${stage} inspection saved for ${division} on ${date}.`);

        const hasCriteria = stage !== 'Operational';
        rowsBody.innerHTML = rows.map(row => `
          <tr>
            <td>${escapeHtml(row.itemNo)}</td>
            <td>${escapeHtml(row.checkPoint)}</td>
            ${hasCriteria ? `<td>${escapeHtml(row.acceptanceCriteria)}</td>` : ''}
            <td><span class="report-status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
            <td>${escapeHtml(row.actionTaken)}</td>
          </tr>`).join('');

        meta.hidden = true;
        meta.textContent = '';
        empty.hidden = true;
        body.hidden = false;
      } catch (error) {
        showEmpty(error.message || 'Could not load report.');
      } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = originalText;
      }
    }

    preTab.addEventListener('click', () => setStage('Pre-Operational'));
    operationalTab.addEventListener('click', () => setStage('Operational'));
    postTab.addEventListener('click', () => setStage('Post-Operational'));
    loadBtn.addEventListener('click', loadReport);
    setStage('Pre-Operational');
  });
})();
