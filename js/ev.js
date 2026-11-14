// ============================================
// Ev Data FORM
// ============================================

const API_URL_EV = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('evForm');
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('formMessage');

  if (!form) return;

  // Red text when the value is below the limit
  const LOW_LIMITS = { washingPoints: 11,gizzardTemp: 4,};
  function markLow(input, limit) {
    const v = parseFloat(input.value);
    input.classList.toggle('value-low', input.value !== '' && !isNaN(v) && v < limit);
  }
  Object.keys(LOW_LIMITS).forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => markLow(input, LOW_LIMITS[id]));
    form.addEventListener('reset', () => setTimeout(() => markLow(input, LOW_LIMITS[id]), 0));
  });

  // Default date
  const dateInput = document.getElementById('date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // ===== Form Submit — Show Preview First =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem('currentUser')) || {};

    // Form data එකතු කරන්න
    const formData = {
      action: 'saveEVData',
      date: document.getElementById('date').value,
      ventCutting: document.getElementById('ventCutting').value,
      cavityRemoval: document.getElementById('cavityRemoval').value,
      washingPoints: document.getElementById('washingPoints').value,
      labourPositioning: document.getElementById('labourGap').value,
      noLabours: '',
      gizzardTemp: document.getElementById('gizzardTemp').value,
      user: user.username || 'unknown'
    };

    // 👇 Preview Modal
    showPreviewModal({
      title: 'Confirm Save — EV Data',
      subtitle: 'Please review before saving',
      meta: [
        { label: '📅 Date', value: formatPreviewDate(formData.date) }
      ],
      sections: [
        {
          title: 'Process Checks',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
          fields: [
            { label: 'Continues Vent Cutting', value: formData.ventCutting, type: 'badge-yes' },
            { label: 'Ensure Cavity Removal', value: formData.cavityRemoval, type: 'badge-yes' }
          ]
        },
        {
          title: 'Equipment Parameters',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
          fields: [
            { label: 'Number of Washing Points', value: formData.washingPoints },
            { label: 'Temperature Of Gizzard (°C)', value: formData.gizzardTemp },
            { label: 'Labour Gap', value: formData.labourPositioning }
          ]
        }
      ],
      onConfirm: () => {
        actualSave(formData);
      }
    });
  });

  // ===== Actual Save =====
  async function actualSave(formData) {
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Saving...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(API_URL_EV, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        InputFeedback.success('Data saved successfully.');
        form.reset();
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      } else if (result.duplicate) {
        InputFeedback.duplicate(result.error || 'This date is already saved.');
      } else {
        throw new Error(result.error || 'Save failed');
      }

    } catch (error) {
      console.error('Submit error:', error);
      showMessage('❌ Error saving data. Please try again.', 'error');
    } finally {
      submitBtn.innerHTML = originalHTML;
      submitBtn.disabled = false;
    }
  }

  // ===== Format Date =====
  function formatPreviewDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return dateStr;
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'form-message ' + type;
    setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'form-message';
    }, 5000);
  }
});