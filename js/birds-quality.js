// ============================================
// BIRDS QUALITY DATA
// ============================================

const API_URL_BQ = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('birdDate');
  const birdsEmpty = document.getElementById('birdsEmpty');
  const birdsLoading = document.getElementById('birdsLoading');
  const birdsTableWrap = document.getElementById('birdsTableWrap');
  const birdsTableBody = document.getElementById('birdsTableBody');
  const saveBirdsBtn = document.getElementById('saveBirdsBtn');

  if (!dateInput) return;

  // 👇 Page load වෙද්දීම — table wrap + loading හංගන්න
  birdsTableWrap.style.setProperty('display', 'none', 'important');
  birdsLoading.style.display = 'none';
  birdsEmpty.style.display = 'flex';

    let editMode = false;

  dateInput.addEventListener('change', loadBatches);

  if (dateInput.value) loadBatches();

  // ===== Load Batches =====
    async function loadBatches() {
    editMode = false;
    const date = dateInput.value;
    

    if (!date) {
      showEmpty();
      return;
    }

    birdsTableBody.innerHTML = '';
    
    const existingAlert = document.getElementById('alreadySavedAlert');
    if (existingAlert) existingAlert.remove();
    
    birdsEmpty.style.display = 'none';
    birdsTableWrap.style.setProperty('display', 'none', 'important');
    birdsLoading.style.display = 'flex';

    try {
      const response = await fetch(
        `${API_URL_BQ}?action=getBirdsQualityByDate&date=${encodeURIComponent(date)}&_t=${Date.now()}`
      );
      const data = await response.json();

      if (data.success && data.batches && data.batches.length > 0) {
        renderTable(data.batches);
        birdsLoading.style.display = 'none';
        birdsTableWrap.style.setProperty('display', 'flex', 'important');
      } else {
        birdsLoading.style.display = 'none';
        showEmpty('No batches found for this date');
      }
    } catch (error) {
      console.error('Load error:', error);
      birdsLoading.style.display = 'none';
      showEmpty('Error loading batches');
    }
  }

  // ===== Show Empty =====
  function showEmpty(message) {
    birdsEmpty.style.display = 'flex';
    birdsTableWrap.style.setProperty('display', 'none', 'important');
    birdsEmpty.querySelector('p').textContent =
      message || 'Select a date above to load quality data';
  }

  // ===== Render Table =====
  function renderTable(batches) {
    // 👇 Check කරන්න — already saved data තියෙනවා ද
    const isAlreadySaved = batches.some(batch => 
      batch.cleanliness || batch.damage || batch.skin || 
      batch.gizzard || batch.crop || batch.flesh || 
      batch.bayMortality || batch.remark
    );
    
    // 👇 Alert එක පෙන්නන්න
    if (isAlreadySaved) {
      showAlreadySavedAlert();
    }
    
    // 👇 Table render කරන්න (disabled state එක්ක)
    birdsTableBody.innerHTML = batches.map((batch, index) => `
      <tr>
        <td>${toRomanNumber_(index + 1)}</td>
        <td>${formatDate(batch.date)}</td>
        <td>${escapeHtml(batch.batchNo) || '-'}</td>
        <td>${escapeHtml(batch.farm) || '-'}</td>
        <td>${escapeHtml(batch.birds) || '-'}</td>
        <td>${escapeHtml(batch.avgWt) || '-'}</td>
        <td>
          <select class="quality-select" data-row-index="${batch.rowIndex}" 
            data-field="cleanliness" ${isAlreadySaved ? 'disabled' : ''}>
            ${qualityOptions(batch.cleanliness)}
          </select>
        </td>
        <td>
          <select class="quality-select" data-row-index="${batch.rowIndex}" 
            data-field="damage" ${isAlreadySaved ? 'disabled' : ''}>
            ${qualityOptions(batch.damage)}
          </select>
        </td>
        <td>
          <select class="quality-select" data-row-index="${batch.rowIndex}" 
            data-field="skin" ${isAlreadySaved ? 'disabled' : ''}>
            ${qualityOptions(batch.skin)}
          </select>
        </td>
        <td>
          <select class="quality-select" data-row-index="${batch.rowIndex}" 
            data-field="gizzard" ${isAlreadySaved ? 'disabled' : ''}>
            ${qualityOptions(batch.gizzard)}
          </select>
        </td>
        <td>
          <select class="quality-select" data-row-index="${batch.rowIndex}" 
            data-field="crop" ${isAlreadySaved ? 'disabled' : ''}>
            ${qualityOptions(batch.crop)}
          </select>
        </td>
        <td>
          <input type="text" class="flesh-input" data-row-index="${batch.rowIndex}"
            value="${escapeHtml(batch.flesh) || 'Pink'}" placeholder="Pink"
            ${isAlreadySaved ? 'disabled' : ''} />
        </td>
        <td class="doa-cell">${escapeHtml(batch.doa) || '-'}</td>
        <td>
          <input type="number" class="bay-mortality-input" 
            data-row-index="${batch.rowIndex}" 
            placeholder="0" step="1" min="0" 
            value="${escapeHtml(batch.bayMortality) || ''}" 
            ${isAlreadySaved ? 'disabled' : ''} />
                </td>
        <td>
          <input type="text" class="remark-input" data-row-index="${batch.rowIndex}"
            value="${escapeHtml(batch.remark) || ''}"
            ${isAlreadySaved ? 'disabled' : ''} />
        </td>
      </tr>
    `).join('');
    
    // 👇 Save button — disable කරන්න
    if (isAlreadySaved) {
      saveBirdsBtn.disabled = true;
      saveBirdsBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Already Saved
      `;
      saveBirdsBtn.style.background = 'linear-gradient(180deg, #94a3b8 0%, #64748b 100%)';
      saveBirdsBtn.style.cursor = 'not-allowed';
    } else {
      saveBirdsBtn.disabled = false;
      saveBirdsBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Save
      `;
      saveBirdsBtn.style.background = '';
      saveBirdsBtn.style.cursor = '';
    }
  }
  
  function showAlreadySavedAlert() {
    const old = document.getElementById('alreadySavedAlert');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'alreadySavedAlert';
    box.className = 'already-saved-alert';
    box.innerHTML = `
      <div class="already-saved-content">
        <div class="already-saved-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="already-saved-text">
          <h4>Already Saved</h4>
          <p>Data for this date is already saved. If you want to change it, click the Edit button, edit the data and save again. The new data will replace the old data.</p>
        </div>
        <button class="already-saved-edit" type="button">&#9998; Edit</button>
      </div>`;
    box.querySelector('.already-saved-edit').addEventListener('click', enableEdit);
    const tableWrap = document.getElementById('birdsTableWrap');
    if (tableWrap && tableWrap.parentElement) {
      tableWrap.parentElement.insertBefore(box, tableWrap);
    }
  }

    function enableEdit() {
    editMode = true;
    document.querySelectorAll('.quality-select, .flesh-input, .bay-mortality-input, .remark-input').forEach(el => {
      el.disabled = false;
    });
    saveBirdsBtn.disabled = false;
    saveBirdsBtn.style.background = '';
    saveBirdsBtn.style.cursor = '';
    saveBirdsBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Save
    `;
    const box = document.getElementById('alreadySavedAlert');
    if (box) box.remove();
  }

  // ===== Quality Options =====
  function qualityOptions(selected) {
    const opts = ['', 'Accept', 'Not Accept'];
    return opts.map(o => {
      const sel = (o === selected) ? 'selected' : '';
      const label = o === '' ? '--' : o;
      return `<option value="${o}" ${sel}>${label}</option>`;
    }).join('');
  }

  // ===== Format Date =====
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0].slice(-2);
    }
    return dateStr;
  }

  // ===== Save All =====
  saveBirdsBtn?.addEventListener('click', async () => {
    const selects = document.querySelectorAll('.quality-select');
    const bayInputs = document.querySelectorAll('.bay-mortality-input');
    
    // Group by rowIndex
    const updatesMap = {};

    selects.forEach(select => {
      const rowIndex = parseInt(select.getAttribute('data-row-index'));
      const field = select.getAttribute('data-field');
      const value = select.value;
      
      if (!updatesMap[rowIndex]) updatesMap[rowIndex] = {};
      updatesMap[rowIndex][field] = value;
    });

    document.querySelectorAll('.flesh-input').forEach(input => {
      const rowIndex = parseInt(input.getAttribute('data-row-index'));
      if (!updatesMap[rowIndex]) updatesMap[rowIndex] = {};
      updatesMap[rowIndex].flesh = input.value.trim() || 'Pink';
    });

    bayInputs.forEach(input => {
      const rowIndex = parseInt(input.getAttribute('data-row-index'));
      const value = input.value;
      
      if (!updatesMap[rowIndex]) updatesMap[rowIndex] = {};
      updatesMap[rowIndex].bayMortality = value;
    });

    document.querySelectorAll('.remark-input').forEach(input => {
      const rowIndex = parseInt(input.getAttribute('data-row-index'));
      if (!updatesMap[rowIndex]) updatesMap[rowIndex] = {};
      updatesMap[rowIndex].remark = input.value.trim();
    });
    const updates = Object.keys(updatesMap).map(rowIndex => ({
      rowIndex: parseInt(rowIndex),
      ...updatesMap[rowIndex]
    }));

    if (updates.length === 0) {
      alert('Please fill in quality data');
      return;
    }

        const pvSections = updates.map((u, i) => {
      const c = document.querySelector(`.bay-mortality-input[data-row-index="${u.rowIndex}"]`).closest('tr').children;
      return {
        title: escapeHtml(`${i + 1}. Batch ${c[2].textContent.trim()} — ${c[3].textContent.trim()}`),
        fields: [
          { label: 'Cleanliness', value: u.cleanliness, type: 'badge-accept' },
          { label: 'Damage', value: u.damage, type: 'badge-accept' },
          { label: 'Skin', value: u.skin, type: 'badge-accept' },
          { label: 'Gizzard', value: u.gizzard, type: 'badge-accept' },
          { label: 'Crop', value: u.crop, type: 'badge-accept' },
          { label: 'Flesh', value: u.flesh },
          { label: 'Bay Mortality', value: u.bayMortality },
          { label: 'Remark', value: u.remark }
        ]
      };
    });
    if (!(await confirmSave({
      title: 'Confirm Save — Birds Quality',
      subtitle: editMode ? 'The saved data for this date will be replaced with this new data' : 'Please review before saving',
      meta: [{ label: '📅 Date', value: dateInput.value.split('-').reverse().join('-') }],
      sections: pvSections
    }))) return;

    const user = JSON.parse(localStorage.getItem('currentUser')) || {};

    const originalHTML = saveBirdsBtn.innerHTML;
    saveBirdsBtn.innerHTML = 'Saving...';
    saveBirdsBtn.disabled = true;

    try {
      const response = await fetch(API_URL_BQ, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveBirdsQuality',
          date: dateInput.value,
          updates: updates,
          user: user.username || 'unknown'
        })
      });

      const result = await response.json();
      console.log('Save response:', result);

      if (result.success) {
        showSaveSuccessMessage(saveBirdsBtn);
        
        setTimeout(() => {
          saveBirdsBtn.innerHTML = originalHTML;
          saveBirdsBtn.disabled = false;
          
          // 👇 Form clear කරන්න
          loadBatches();
        }, 2500);
      } else {
        throw new Error(result.error || 'Save failed');
      }

    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving. Please try again.');
      saveBirdsBtn.innerHTML = originalHTML;
      saveBirdsBtn.disabled = false;
    }
  });

  // ===== Clear Form =====
  function clearForm() {
    // 1. සියලු quality selects — reset (-- select)
    document.querySelectorAll('.quality-select').forEach(select => {
      select.value = '';
    });
    
    // 2. සියලු bay mortality inputs — clear
    document.querySelectorAll('.bay-mortality-input, .remark-input').forEach(input => {
      input.value = '';
    });
    
    // 3. Date input — clear (optional)
    // dateInput.value = '';
    
    // 4. Table එක හංගන්න
    birdsTableWrap.style.display = 'none';
    
    // 5. Empty state පෙන්නන්න
    birdsEmpty.style.display = 'flex';
    birdsEmpty.querySelector('p').textContent = 'Select a date above to load quality data';
    
    // 6. Date input — අද දිනය (optional)
    if (dateInput) {
      dateInput.value = '';
    }
  }  

  // ===== Helper: Escape HTML =====
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});









