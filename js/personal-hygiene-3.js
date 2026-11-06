const API_URL_HYGIENE =
  'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

const HYGIENE_CRITERIA = [
  'Uniform Cleanliness',
  'Apron',
  'Boots',
  'Gloves',
  'Masks',
  'T Shirts',
  'Trousers',
  'Head Cover',
  'Shortly cut nails',
  'No jewelries',
  'Open wound',
  'Disease symptoms'
];

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('hygieneForm');
  if (!form) return;

  const dateInput = document.getElementById('hygieneDate');
  const divisionInput = document.getElementById('hygieneDivision');
  const processInput = document.getElementById('hygieneProcess');
  const rowsBody = document.getElementById('hygieneFailedEmployees');
  const message = document.getElementById('formMessage');
  let messageTimer;
  const saveButton = document.getElementById('submitBtn');

  dateInput.value = getToday();
  processInput.value = 'Loading';
  divisionInput.value = 'Loading';
  

  document.querySelectorAll('.hygiene-process-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.hygiene-process-tab')
        .forEach(item => item.classList.remove('active'));

      tab.classList.add('active');
      processInput.value = tab.dataset.process;
      divisionInput.value = tab.dataset.process;
    });
  });

  ['companyPass', 'manpowerPass', 'companyFail', 'manpowerFail'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCounts);
  });

  form.addEventListener('submit', saveChecklist);
  updateCounts();

  function updateCounts() {
    const companyPass = numberValue('companyPass');
    const manpowerPass = numberValue('manpowerPass');
    const companyFail = numberValue('companyFail');
    const manpowerFail = numberValue('manpowerFail');

    document.getElementById('passTotal').value = companyPass + manpowerPass;
    document.getElementById('failTotal').value = companyFail + manpowerFail;

    const wantedRows = companyFail + manpowerFail;

    while (rowsBody.rows.length < wantedRows) {
      rowsBody.appendChild(createEmployeeRow());
    }

    while (rowsBody.rows.length > wantedRows) {
      rowsBody.deleteRow(rowsBody.rows.length - 1);
    }
  }

  function createEmployeeRow() {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td><input type="text" class="hygiene-id-name" required></td>
      <td><input type="text" class="hygiene-status" value="" readonly></td>
      ${HYGIENE_CRITERIA.map(criterion => `
        <td class="hygiene-check-cell">
          <input type="checkbox" class="hygiene-check" value="${criterion}" aria-label="${criterion}">
        </td>
      `).join('')}
    `;

    const nameInput = row.querySelector('.hygiene-id-name');
    const statusInput = row.querySelector('.hygiene-status');

    nameInput.addEventListener('input', () => {
      const value = nameInput.value.trim();
      statusInput.value = !value ? '' : (/^\d+$/.test(value) ? 'Company' : 'Manpower');
    });

    return row;
  }

  async function saveChecklist(event) {
    event.preventDefault();
    showMessage('');

    const companyFail = numberValue('companyFail');
    const manpowerFail = numberValue('manpowerFail');

    const employees = [...rowsBody.rows].map(row => ({
      name: row.querySelector('.hygiene-id-name').value.trim(),
      status: row.querySelector('.hygiene-status').value,
      failedCriteria: [...row.querySelectorAll('.hygiene-check:checked')]
        .map(input => input.value)
    }));

    if (employees.some(employee =>
      !employee.name || !employee.status || employee.failedCriteria.length === 0
    )) {
      showMessage('Please fill in all required fields.', 'error');
      return;
    }

    const companyActualFails = employees.filter(employee => employee.status === 'Company').length;
    const manpowerActualFails = employees.filter(employee => employee.status === 'Manpower').length;

    if (companyActualFails !== companyFail || manpowerActualFails !== manpowerFail) {
      showMessage('Please check whether the appropriate IDs and Names are assigned for the Company/Manpower fail counts.', 'error');
      return;
    }

    const division = divisionInput.value;
    if (!division) {
      showMessage('Please select a division (Loading or Unloading).', 'error');
      return;
    }

    const payload = {
      action: 'savePersonalHygiene3',
      date: dateInput.value,
      division: division,
      process: processInput.value,
      passCounts: {
        Company: numberValue('companyPass'),
        Manpower: numberValue('manpowerPass')
      },
      employees: employees
    };

    const confirmed = await confirmSave({
      title: 'Confirm Save — Personal Hygiene',
      subtitle: 'Please review the checklist before saving',
      meta: [
        { label: 'Date', value: dateInput.value },
        { label: 'Division', value: division },
        { label: 'Process', value: processInput.value }
      ],
      sections: [
        {
          title: 'Fail Counts',
          fields: [
            { label: 'Company', value: String(companyFail) },
            { label: 'Manpower', value: String(manpowerFail) }
          ]
        },
        {
          title: 'Employees',
          fields: employees.map(employee => ({
            label: employee.name,
            value: `${employee.status} — ${employee.failedCriteria.join(', ')}`
          }))
        }
      ]
    });
    if (!confirmed) return;
    saveButton.disabled = true;
    const oldText = saveButton.innerHTML;
    saveButton.innerHTML = '<span>Saving...</span>';

    try {
      const response = await fetch(API_URL_HYGIENE, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Save failed');

      InputFeedback.success('Checklist saved successfully.');
      form.reset();
      rowsBody.innerHTML = '';
      dateInput.value = getToday();
      divisionInput.value = 'Loading';
      processInput.value = 'Loading';

      document.querySelectorAll('.hygiene-process-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.process === 'Loading');
      });

      updateCounts();
    } catch (error) {
      showMessage(error.message || 'Save karanna bari una.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = oldText;
    }
  }

  function numberValue(id) {
    return Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
  }

  function getToday() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  }

function showMessage(text, type = '') {
  if (!message) {
    if (text) alert(text);
    return;
  }

  clearTimeout(messageTimer);
  message.textContent = text;
  message.className = 'form-message ' + type;

  if (text && type === 'success') {
    messageTimer = setTimeout(() => {
      message.textContent = '';
      message.className = 'form-message';
    }, 3000);
  }
}
});
