// ============================================
// BIRDS DATA PAGE - Logic
// ============================================

const API_URL_BIRDS = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('birdDate');
  const birdsEmpty = document.getElementById('birdsEmpty');
  const birdsLoading = document.getElementById('birdsLoading');
  const birdsTableWrap = document.getElementById('birdsTableWrap');
  const birdsTableBody = document.getElementById('birdsTableBody');
  const saveBirdsBtn = document.getElementById('saveBirdsBtn');

  if (!dateInput) return;

    let editMode = false;

  dateInput.addEventListener('change', loadBatches);

  if (dateInput.value) loadBatches();

  async function loadBatches() {
    editMode = false;
    const date = dateInput.value;

    if (!date) {
      showEmpty();
      return;
    }

    birdsEmpty.style.display = 'none';
    birdsTableWrap.style.display = 'none';
    birdsLoading.style.display = 'flex';

    const oldAlert = document.getElementById('alreadySavedAlert');
    if (oldAlert) oldAlert.remove();

    try {
      const response = await fetch(
        `${API_URL_BIRDS}?action=getLivebirdByDate&date=${encodeURIComponent(date)}&_t=${Date.now()}`
      );
      const data = await response.json();

      if (data.success && data.batches && data.batches.length > 0) {
        renderTable(data.batches);
        applySavedState(data.batches);
        birdsLoading.style.display = 'none';
        birdsTableWrap.style.display = 'flex';
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
    birdsTableWrap.style.display = 'none';
    birdsEmpty.querySelector('p').textContent =
      message || 'Select a date above to load batch data';
  }

// ===== Render Table =====
function renderTable(batches) {
  birdsTableBody.innerHTML = batches.map((batch, index) => `
    <tr>
      <td>${toRomanNumber_(index + 1)}</td>
      <td>${escapeHtml(batch.loadNo) || '-'}</td>
      <td>${escapeHtml(batch.farmer) || '-'}</td>
      <td>${escapeHtml(batch.batchNo) || '-'}</td>
      <td>${escapeHtml(batch.birdQty) || '-'}</td>
      <td>
        <input 
          type="time" 
          step="60"
          class="hanging-time-input${batch.hangingTime ? ' saved-locked' : ''}"
          data-row-index="${batch.rowIndex}"
          value="${escapeHtml(batch.hangingTime) || ''}" ${batch.hangingTime ? 'disabled' : ''}
        />
      </td>
    </tr>
  `).join('');
}

  // ===== Save All =====
  saveBirdsBtn?.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.hanging-time-input');
    const updates = [];

    inputs.forEach(input => {
      if (input.disabled) return;   // already saved -> skip
      const rowIndex = parseInt(input.getAttribute('data-row-index'));
      const hangingTime = input.value;

      if (rowIndex && hangingTime) {
        updates.push({ rowIndex, hangingTime });
      }
    });

    if (updates.length === 0) {
      alert('Please enter at least one hanging time');
      return;
    }

        const pvFields = updates.map(u => {
      const c = document.querySelector(`.hanging-time-input[data-row-index="${u.rowIndex}"]`).closest('tr').children;
      return {
        label: escapeHtml(`${c[3].textContent.trim()} · ${c[2].textContent.trim()} (Load ${c[1].textContent.trim()})`),
        value: u.hangingTime
      };
    });
    if (!(await confirmSave({
      title: 'Confirm Save — Hanging Times',
      subtitle: editMode ? 'The saved data for this date will be replaced with this new data' : 'Please review before saving',
      meta: [{ label: '📅 Date', value: dateInput.value.split('-').reverse().join('-') }],
      sections: [{ title: 'Hanging Time', fields: pvFields }]
    }))) return;

    const originalHTML = saveBirdsBtn.innerHTML;
    saveBirdsBtn.innerHTML = 'Saving...';
    saveBirdsBtn.disabled = true;

    try {
      await fetch(API_URL_BIRDS, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveHangingTimes',
          updates: updates
        })
      });

      showSaveSuccessMessage(saveBirdsBtn);

      // Clear time inputs (Farmer/Batch No/Bird Qty රැඳෙනවා)
      setTimeout(loadBatches, 1600);   // reload -> saved times turn gray

      setTimeout(() => {
        saveBirdsBtn.innerHTML = originalHTML;
        saveBirdsBtn.disabled = false;
      }, 1500);

    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving. Please try again.');
      saveBirdsBtn.innerHTML = originalHTML;
      saveBirdsBtn.disabled = false;
    }
  });

  // ===== Already saved: gray inputs + warning =====
  const saveBtnDefaultHTML = saveBirdsBtn ? saveBirdsBtn.innerHTML : '';

  function applySavedState(batches) {
    const savedCount = batches.filter(b => b.hangingTime).length;
    if (savedCount > 0) showAlreadySavedAlert();

    if (savedCount === batches.length) {            // every batch saved -> lock the button
      saveBirdsBtn.disabled = true;
      saveBirdsBtn.innerHTML = 'Already Saved';
    } else {
      saveBirdsBtn.disabled = false;
      saveBirdsBtn.innerHTML = saveBtnDefaultHTML;
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
    birdsTableWrap.parentElement.insertBefore(box, birdsTableWrap);
  }

    function enableEdit() {
    editMode = true;
    document.querySelectorAll('.hanging-time-input').forEach(input => {
      input.disabled = false;
      input.classList.remove('saved-locked');
    });
    saveBirdsBtn.disabled = false;
    saveBirdsBtn.innerHTML = saveBtnDefaultHTML;
    const box = document.getElementById('alreadySavedAlert');
    if (box) box.remove();
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