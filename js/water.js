// ============================================
// WATER PLANT DATA FORM
// ============================================

const API_URL_WATER = 'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('waterForm');
  const submitBtn = document.getElementById('submitBtn');
  const messageEl = document.getElementById('formMessage');
  const dateInput = document.getElementById('date');
  const phInput = document.getElementById('ph');
  const clInput = document.getElementById('cl');
  const phStatus = document.getElementById('phStatus');
  const clStatus = document.getElementById('clStatus');
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');

  if (!form) return;

  // Default date
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  let imageBase64 = '';
  let imageName = '';

  // ===== Image Upload =====
  imageUpload?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size 5MB ට වඩා අඩු වෙන්න ඕන');
      imageUpload.value = '';
      return;
    }
    
    imageName = file.name;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      imageBase64 = event.target.result;
      
      // Show preview
      imagePreview.innerHTML = `
        <img src="${imageBase64}" alt="Preview" />
        <button type="button" class="remove-image" id="removeImage">×</button>
      `;
      imagePreview.classList.add('show');
      
      // Remove button
      document.getElementById('removeImage').addEventListener('click', () => {
        imageBase64 = '';
        imageName = '';
        imageUpload.value = '';
        imagePreview.innerHTML = '';
        imagePreview.classList.remove('show');
      });
    };
    reader.readAsDataURL(file);
  });

  // ===== pH Validation =====
  phInput.addEventListener('input', () => {
    const value = parseFloat(phInput.value);
    
    if (isNaN(value)) {
      phStatus.textContent = '';
      phStatus.className = 'status-badge';
      return;
    }
    
    if (value >= 6.0 && value <= 8.5) {
      phStatus.textContent = '✓ Accept';
      phStatus.className = 'status-badge accept';
    } else {
      phStatus.textContent = '✗ Not Accept (' + value + ')';
      phStatus.className = 'status-badge not-accept';
    }
  });

  // ===== Cl Validation =====
  clInput.addEventListener('input', () => {
    const value = parseFloat(clInput.value);
    
    if (isNaN(value)) {
      clStatus.textContent = '';
      clStatus.className = 'status-badge';
      return;
    }
    
    if (value <= 0.1) {
      clStatus.textContent = '✓ Accept';
      clStatus.className = 'status-badge accept';
    } else {
      clStatus.textContent = '✗ Not Accept (' + value + ')';
      clStatus.className = 'status-badge not-accept';
    }
  });

  // ===== Form Submit — Show Preview First =====
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = JSON.parse(localStorage.getItem('currentUser')) || {};

    // pH + Cl status
    const phValue = parseFloat(phInput.value);
    const phResult = (phValue >= 6.0 && phValue <= 8.5) ? 'Accept' : 'Not Accept';

    const clValue = parseFloat(clInput.value);
    const clResult = (clValue <= 0.1) ? 'Accept' : 'Not Accept';

    // Form data
    const formData = {
      action: 'saveWaterDataWithImage',
      date: dateInput.value,
      ph: phInput.value,
      phStatus: phResult,
      cl: clInput.value,
      clStatus: clResult,
      parabolicScreen: document.getElementById('parabolicScreen').value,
      colour: document.getElementById('colour').value,
      smell: document.getElementById('smell').value,
      solidWaste: document.getElementById('solidWaste').value,
      chemicalDosing: document.getElementById('chemicalDosing').value,
      leakageM1: document.getElementById('leakageM1').value,
      leakageM2: document.getElementById('leakageM2').value,
      backwashSandBed: document.getElementById('backwashSandBed').value,
      backwashClarifier: document.getElementById('backwashClarifier').value,
      remarks: document.getElementById('remarks').value,
      imageData: imageBase64,
      imageName: imageName,
      user: user.username || 'unknown'
    };

    // Colour + Smell text
    const colourText = getColourText(formData.colour);
    const smellText = getSmellText(formData.smell);

    // Preview Modal
    showPreviewModal({
      title: 'Confirm Save — Water Plant Data',
      subtitle: imageBase64 ? 'Includes image attachment' : 'Please review before saving',
      meta: [
        { label: '📅 Date', value: formatPreviewDate(formData.date) }
      ],
      sections: [
        {
          title: 'Water Quality',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>',
          fields: [
            { label: 'pH (6.0-8.5)', value: `${formData.ph} — ${phResult}`, type: 'badge-accept' },
            { label: 'Cl (≤ 0.1)', value: `${formData.cl} — ${clResult}`, type: 'badge-accept' },
            { label: 'Parabolic Screen Cleanness', value: formData.parabolicScreen, type: 'badge-yes' },
            { label: 'Colour', value: colourText },
            { label: 'Smell', value: smellText }
          ]
        },
        {
          title: 'Operations',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle></svg>',
          fields: [
            { label: 'Solid Waste Bucket (ps)', value: formData.solidWaste },
            { label: 'Chemical Adding C/L Dosing', value: formData.chemicalDosing, type: 'badge-yes' }
          ]
        },
        {
          title: 'Leakage Check',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>',
          fields: [
            { label: 'Leakage - M1', value: formData.leakageM1, type: 'badge-yes' },
            { label: 'Leakage - M2', value: formData.leakageM2, type: 'badge-yes' }
          ]
        },
        {
          title: 'Backwash Frequency',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
          fields: [
            { label: 'Sand Bed', value: formData.backwashSandBed },
            { label: 'Clarifier Tank', value: formData.backwashClarifier }
          ]
        },
        {
          title: 'Additional Notes',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>',
          fields: [
            { label: 'Remarks', value: formData.remarks },
            { label: 'Image', value: imageBase64 ? '📷 Attached' : '' }
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
    submitBtn.innerHTML = imageBase64 ? 'Uploading...' : 'Saving...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(API_URL_WATER, {
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
        
        // Clear status badges
        phStatus.textContent = '';
        phStatus.className = 'status-badge';
        clStatus.textContent = '';
        clStatus.className = 'status-badge';
        
        // Clear image
        imageBase64 = '';
        imageName = '';
        imagePreview.innerHTML = '';
        imagePreview.classList.remove('show');
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

  // ===== Helpers =====
  function formatPreviewDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return dateStr;
  }

  function getColourText(value) {
    const map = {
      '1': 'Light Yellow',
      '2': 'Yellow',
      '3': 'Off / Brown'
    };
    return map[value] || value || '—';
  }

  function getSmellText(value) {
    const map = {
      '1': 'Slightly Off Smell',
      '2': 'Off Smell',
      '3': 'Badly Smell'
    };
    return map[value] || value || '—';
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