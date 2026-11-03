const API_URL_SAMPLE_PARAMETERS =
  'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sampleParametersForm');
  if (!form) return;

  const monthInput = document.getElementById('sampleMonth');
  const today = new Date();
  monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const rowsBody = document.getElementById('sampleParameterRows');
  const message = document.getElementById('sampleParametersMessage');
  const saveButton = document.getElementById('saveSampleParametersBtn');
  const rows = Array.from(rowsBody.querySelectorAll('tr'));

  let messageTimer;

  function showMessage(text, type) {
    clearTimeout(messageTimer);

    message.textContent = text;
    message.className = `form-message ${type}`;

    messageTimer = setTimeout(() => {
      message.textContent = '';
      message.className = 'form-message';
    }, 5000);
  }

  function updateRow(row) {
    const testedInput = row.querySelector('.sample-tested');
    const compliantInput = row.querySelector('.sample-compliant');
    const nonCompliantOutput = row.querySelector('.sample-non-compliant');

    const testedText = testedInput.value.trim();
    const compliantText = compliantInput.value.trim();
    const tested = Number(testedText || 0);
    const compliant = Number(compliantText || 0);

    compliantInput.setCustomValidity(
      compliant > tested
        ? 'Compliant parameters cannot exceed tested parameters.'
        : ''
    );

    nonCompliantOutput.textContent = String(
      Math.max(0, tested - compliant)
    );
  }

  rows.forEach(row => {
    row.querySelector('.sample-tested')
      .addEventListener('input', () => updateRow(row));

    row.querySelector('.sample-compliant')
      .addEventListener('input', () => updateRow(row));

    updateRow(row);
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const entries = rows.map(row => ({
      criteria: row.dataset.criteria,
      tested: row.querySelector('.sample-tested').value,
      compliant: row.querySelector('.sample-compliant').value
    }));

    const currentUser =
      typeof getCurrentUser === 'function' ? getCurrentUser() : null;

    const data = {
      action: 'saveSampleParameters',
      month: monthInput.value,
      entries,
      user: currentUser?.username || 'unknown'
    };

    const confirmed = await confirmSave({
      title: 'Confirm Save — Sample Parameters',
      subtitle: 'Please review the month and parameter totals before saving',
      meta: [{ label: 'Month', value: monthInput.value }],
      sections: [{
        title: 'Parameter Summary',
        fields: entries.map(entry => ({
          label: entry.criteria,
          value: `Tested: ${entry.tested || 0} | Compliant: ${entry.compliant || 0}`
        }))
      }]
    });
    if (!confirmed) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    message.textContent = '';

    try {
      const response = await fetch(API_URL_SAMPLE_PARAMETERS, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Save failed.');
      }

      const savedMonth = monthInput.value;
      form.reset();
      monthInput.value = savedMonth;

      rows.forEach(row => updateRow(row));
      InputFeedback.success('Data saved successfully.');
    } catch (error) {
      showMessage(error.message || 'Save failed. Please try again.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  });
});