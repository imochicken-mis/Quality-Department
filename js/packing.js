// ============================================
// PACKING DATA FORM
// ============================================

const API_URL_PACKING = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

// Chlorine thresholds (ppm)
const CHLORINE_MIN = 30;   

document.addEventListener('DOMContentLoaded', () => {
  const labCompany = document.getElementById('labourCompany');
  const labManpower = document.getElementById('labourManpower');
  const labTotal = document.getElementById('labourTotal');
  function updateLabourTotal() {
    if (!labTotal) return;
    const a = parseFloat(labCompany.value), b = parseFloat(labManpower.value);
    labTotal.value = (isNaN(a) ? 0 : a) + (isNaN(b) ? 0 : b);
  }
  if (labCompany && labManpower && labTotal) {
    labCompany.addEventListener('input', updateLabourTotal);
    labManpower.addEventListener('input', updateLabourTotal);
    if (labCompany.form) labCompany.form.addEventListener('reset', () => setTimeout(updateLabourTotal, 0));
    updateLabourTotal();
  }

  const form = document.getElementById('packingForm');
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('formMessage');
  const dateInput = document.getElementById('date');

  if (!form) return;

  let masterItems = [];

  // Default date
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // ===== Load Masterdata =====
  async function loadMasterData() {
    try {
      const res = await fetch(`${API_URL_PACKING}?action=getMasterData&_t=${Date.now()}`);
      const data = await res.json();
      
      if (data.success && data.items) {
        masterItems = data.items;
        populateAllSelects();
      }
    } catch (err) {
      console.error('Master data load error:', err);
    }
  }

  function populateAllSelects() {
    document.querySelectorAll('.item-select').forEach(select => {
      const currentValue = select.value;
      select.innerHTML = '<option value="">-- Select Item --</option>' +
        masterItems.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
      select.value = currentValue;
    });
  }

  // ===== Add Item Row =====
  document.querySelectorAll('.btn-add-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const container = document.getElementById(targetId);
      addItemRow(container);
      populateAllSelects();
    });
  });

  function addItemRow(container) {
    const row = document.createElement('div');
    row.className = 'dynamic-item-row';
    row.innerHTML = `
      <div class="item-select-wrap">
        <select class="item-select">
          <option value="">-- Select Item --</option>
          ${masterItems.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}
        </select>
      </div>
      <div class="item-kilos-wrap">
        <input type="number" class="item-kilos" placeholder="Kilos" step="0.1" />
      </div>
      <button type="button" class="btn-remove-item" title="Remove">×</button>
    `;
    container.appendChild(row);
    
    row.querySelector('.btn-remove-item').addEventListener('click', () => {
      if (container.children.length > 1) {
        row.remove();
      } else {
        row.querySelector('.item-select').value = '';
        row.querySelector('.item-kilos').value = '';
      }
    });
  }

  // Remove button for existing rows
  document.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.dynamic-item-row');
      const container = row.parentElement;
      if (container.children.length > 1) {
        row.remove();
      } else {
        row.querySelector('.item-select').value = '';
        row.querySelector('.item-kilos').value = '';
      }
    });
  });

  // ===== Chlorine Warning System =====
  function setupChlorineWarning(inputId, remarkId, label) {
    const input = document.getElementById(inputId);
    const remark = document.getElementById(remarkId);
    
    if (!input || !remark) return;

    const defaultPlaceholder = remark.getAttribute('placeholder') || 'Reason / Action taken';

    // Warning messages — time එකට අනුව
    const warningMessages = {
      '7 AM': '⚠️ Kindly make a note that the chlorine level is low at 7 AM',
      '1 PM': '⚠️ Kindly make a note that the chlorine level is low at 1 PM'
    };

    input.addEventListener('input', () => {
      const value = parseFloat(input.value);
      const isEmpty = input.value === '';
      
      if (isEmpty || isNaN(value)) {
        // Empty — normal state
        input.classList.remove('input-warning');
        remark.classList.remove('remark-highlight');
        remark.placeholder = defaultPlaceholder;
        return;
      }
      
      if (value < CHLORINE_MIN) {
        // 👇 Warning state
        input.classList.add('input-warning');
        remark.classList.add('remark-highlight');
        remark.placeholder = warningMessages[label] || `⚠️ Chlorine ${value} අඩුයි - Remark දාන්න`;
        
      } else {
        // Normal
        input.classList.remove('input-warning');
        remark.classList.remove('remark-highlight');
        remark.placeholder = defaultPlaceholder;
      }
    });

    // Blur කරාම — value අඩු නම් + remark empty නම් — focus
    input.addEventListener('blur', () => {
      const value = parseFloat(input.value);
      if (!isNaN(value) && value < CHLORINE_MIN && !remark.value.trim()) {
        remark.focus();
      }
    });
  }

  // Setup both 7AM + 1PM
  setupChlorineWarning('chlorine7am', 'chlorine7amRemark', '7 AM');
  setupChlorineWarning('chlorine1pm', 'chlorine1pmRemark', '1 PM');

  // ===== Collect Items =====
  function collectItems(containerId) {
    const container = document.getElementById(containerId);
    const items = [];
    
    container.querySelectorAll('.dynamic-item-row').forEach(row => {
      const item = row.querySelector('.item-select').value;
      const kilos = row.querySelector('.item-kilos').value;
      
      if (item && kilos) {
        items.push({ item: item, kilos: parseFloat(kilos) });
      }
    });
    
    return items;
  }

  // ===== Form Submit — Show Preview First =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem('currentUser')) || {};

    // Validation — chlorine අඩු නම් remark අනිවාර්යයි
    const ch7 = parseFloat(document.getElementById('chlorine7am').value);
    const ch1 = parseFloat(document.getElementById('chlorine1pm').value);
    const remark7 = document.getElementById('chlorine7amRemark').value.trim();
    const remark1 = document.getElementById('chlorine1pmRemark').value.trim();

    if (!isNaN(ch7) && ch7 < CHLORINE_MIN && !remark7) {
      showMessage(`❌ Chlorine Level 7 AM (${ch7} ppm) Low — Kindly add a Remark`, 'error');
      document.getElementById('chlorine7amRemark').focus();
      return;
    }
    
    if (!isNaN(ch1) && ch1 < CHLORINE_MIN && !remark1) {
      showMessage(`❌ Chlorine Level 1 PM (${ch1} ppm) Low — Kindly add a Remark`, 'error');
      document.getElementById('chlorine1pmRemark').focus();
      return;
    }

    const delayedItems = collectItems('delayedItems');

    // Form data
    const formData = {
      action: 'savePackingData',
      date: dateInput.value,
      chlorine7am: document.getElementById('chlorine7am').value,
      chlorine7amRemark: remark7,
      chlorine1pm: document.getElementById('chlorine1pm').value,
      chlorine1pmRemark: remark1,
      liverTemp: document.getElementById('liverTemp').value,
      productionFinishTime: document.getElementById('productionFinishTime').value,
      blastFreezerNo: '',
      blastFreezerTime: '',
      delayedLots: JSON.stringify(delayedItems),
      chillRoom: '[]',
      remarks: document.getElementById('remarks').value,
      user: user.username || 'unknown'
    };

    // 👇 Preview Modal
    showPreviewModal({
      title: 'Confirm Save — Packing Data',
      subtitle: 'Please review before saving',
      meta: [
        { label: '📅 Date', value: formatPreviewDate(formData.date) }
      ],
      sections: [
        {
          title: 'Chlorine Levels',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path></svg>',
          fields: [
            { 
              label: '7 AM (ppm)', 
              value: `${formData.chlorine7am}${formData.chlorine7amRemark ? ' — ' + formData.chlorine7amRemark : ''}` 
            },
            { 
              label: '1 PM (ppm)', 
              value: `${formData.chlorine1pm}${formData.chlorine1pmRemark ? ' — ' + formData.chlorine1pmRemark : ''}` 
            }
          ]
        },
        {
          title: 'Production Parameters',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"></path><path d="M8 6h8"></path></svg>',
          fields: [
            { label: 'Liver Temp (°C)', value: formData.liverTemp },
            { label: 'Production Finish Time', value: formData.productionFinishTime }
          ]
        },
        {
          title: `Delayed Process Time Lots (${delayedItems.length})`,
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
          items: delayedItems.map(item => ({ name: item.item, kilos: item.kilos }))
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
      const response = await fetch(API_URL_PACKING, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      console.log('Response:', result);

      if (result.duplicate) {
        InputFeedback.duplicate(result.error || 'This date is already saved.');
      } else if (result.success) {
        InputFeedback.success('Data saved successfully.');
        form.reset();
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        
        // Reset dynamic items
        document.getElementById('delayedItems').innerHTML = '';
        addItemRow(document.getElementById('delayedItems'));
        populateAllSelects();
        
        // Reset warnings
        document.getElementById('chlorine7am').classList.remove('input-warning');
        document.getElementById('chlorine1pm').classList.remove('input-warning');
        document.getElementById('chlorine7amRemark').classList.remove('remark-highlight');
        document.getElementById('chlorine1pmRemark').classList.remove('remark-highlight');
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Load master data on start
  loadMasterData();
});