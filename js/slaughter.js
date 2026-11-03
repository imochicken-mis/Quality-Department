// ============================================
// ACCESS CHECK - CCP Control
// ============================================
(function checkAccess() {
  // Real access check + redirect is done in sidebar.js (enforcePageAccess).
  // This only stops the form from running for users without 'ccp'.
  const userData = localStorage.getItem('currentUser');
  if (!userData) return;
  try {
    if (!parseReports(JSON.parse(userData)).includes('ccp')) return;
  } catch (e) {}
})();

// ============================================
// SLAUGHTER DATA INPUT FORM
// ============================================

const API_URL_SLAUGHTER = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('slaughterForm');
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('formMessage');

  if (!form) return;

  // No of Labours: below 17 -> red text
  const labours = document.getElementById('noLabours');
  function markLabours() {
    if (!labours) return;
    const v = parseFloat(labours.value);
    labours.classList.toggle('value-low', labours.value !== '' && !isNaN(v) && v < 17);
  }
  if (labours) {
    labours.addEventListener('input', markLabours);
    form.addEventListener('reset', () => setTimeout(markLabours, 0));
  }

  // අද දිනය default විදිහට දාන්න
  const dateInput = document.getElementById('date');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  // ===== Form Submit — Show Preview First =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem('currentUser')) || {};

    // Form data එකතු කරන්න
    const formData = {
      action: 'saveSlaughterData',
      date: document.getElementById('date').value,
      scalderTemp: document.getElementById('scalderTemp').value,
      scalderTime: document.getElementById('scalderTime').value,
      waterSupply: document.getElementById('waterSupply').value,
      labourGap: document.getElementById('labourGap').value,
      noLabours: '',
      remarks: document.getElementById('remarks').value,
      user: user.username || 'unknown'
    };

    // 👇 Preview Modal 
    showPreviewModal({
      title: 'Confirm Save — Slaughter Data',
      subtitle: 'Please review before saving',
      meta: [
        { label: '📅 Date', value: formatPreviewDate(formData.date) }
      ],
      sections: [
        {
          title: 'Equipment Parameters',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
          fields: [
            { label: 'Scalder Tank Temp (°C)', value: formData.scalderTemp },
            { label: 'Scalder Time Taken', value: formData.scalderTime },
            { label: 'Water Supply', value: formData.waterSupply, type: 'badge-yes' },
            { label: 'Labour Gap', value: formData.labourGap }
          ]
        },
        {
          title: 'Additional Notes',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>',
          fields: [
            { label: 'Remarks', value: formData.remarks }
          ]
        }
      ],
      onConfirm: () => {
        // 👇 Confirm කරාම — Actual Save
        actualSave(formData);
      }
    });
  });

  // ===== Actual Save Function =====
  async function actualSave(formData) {
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Saving...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(API_URL_SLAUGHTER, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        showSaveToast('Data saved successfully.');
        form.reset();
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      } else if (result.duplicate) {
        // Same date already saved — server eken error eka awa
        showDuplicateModal(result.error || 'Data for this date is already saved.');
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

  // ===== Format Date for Preview =====
  function formatPreviewDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return dateStr;
  }

  // Show message function
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'form-message ' + type;
    
    setTimeout(() => {
      messageEl.textContent = '';
      messageEl.className = 'form-message';
    }, 5000);
  }
  function showSaveToast(text) {
    const existing = document.querySelector('.slaughter-save-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'slaughter-save-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span class="slaughter-toast-icon">✓</span><span></span>';
    toast.querySelector('span:last-child').textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function showDuplicateModal(text) {
    const existing = document.getElementById('slaughterDuplicateModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'slaughterDuplicateModal';
    overlay.className = 'slaughter-duplicate-overlay';
    overlay.innerHTML = `
      <div class="slaughter-duplicate-modal" role="dialog" aria-modal="true" aria-labelledby="duplicateTitle">
        <div class="slaughter-duplicate-icon">!</div>
        <h3 id="duplicateTitle">Data already saved</h3>
        <p></p>
        <button type="button">Okay</button>
      </div>`;
    overlay.querySelector('p').textContent = text;

    const close = () => overlay.remove();
    overlay.querySelector('button').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
    overlay.querySelector('button').focus();
  }
});