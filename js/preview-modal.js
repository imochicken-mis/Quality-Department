// ============================================
// PREVIEW MODAL — COMMON LOGIC
// ============================================

/**
 * Show preview modal
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.subtitle - Modal subtitle
 * @param {Array} options.sections - Array of sections
 *   Each section: { icon: SVG, title: 'SECTION NAME', fields: [...], items: [...] }
 *   Each field: { label: 'Date', value: '2026-09-29', type: 'text|badge-accept|badge-yes' }
 * @param {Function} options.onConfirm - Confirm callback
 */
function showPreviewModal(options) {
  // කලින් modal එක තියෙනවා නම් අයින් කරන්න
  const existing = document.getElementById('previewModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'previewModal';
  modal.className = 'preview-modal-overlay';

  // Build sections HTML
  let sectionsHtml = '';
  options.sections.forEach(section => {
    let fieldsHtml = '';
    
    // Fields
    if (section.fields && section.fields.length > 0) {
      fieldsHtml = section.fields.map(field => {
        const valueHtml = formatFieldValue(field);
        return `
          <div class="preview-field">
            <span class="preview-field-label">${field.label}</span>
            <span class="preview-field-value">${valueHtml}</span>
          </div>
        `;
      }).join('');
    }
    
    // Items (Packing)
    if (section.items && section.items.length > 0) {
      fieldsHtml += `
        <div class="preview-items-list">
          ${section.items.map(item => `
            <div class="preview-item-row">
              <span class="item-name">${escapeHtml(item.name)}</span>
              <span class="item-kilos">${item.kilos} kg</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    // Empty
    if ((!section.fields || section.fields.length === 0) && 
        (!section.items || section.items.length === 0)) {
      fieldsHtml = '<div class="preview-empty">No items added</div>';
    }
    
    sectionsHtml += `
      <div class="preview-section">
        <div class="preview-section-title">
          ${section.icon || ''}
          <span>${section.title}</span>
        </div>
        <div class="preview-section-content">
          ${fieldsHtml}
        </div>
      </div>
    `;
  });

  // Meta section
  const metaHtml = options.meta ? `
    <div class="preview-meta">
      ${options.meta.map(item => `
        <div class="preview-meta-item">
          <span class="label">${item.label}:</span>
          <span class="value">${item.value}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  modal.innerHTML = `
    <div class="preview-modal">
      <div class="preview-header">
        <div class="preview-header-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="preview-header-text">
          <h3>${options.title || 'Confirm Save'}</h3>
          <p>${options.subtitle || 'Please review before saving'}</p>
        </div>
        <button type="button" class="preview-close" id="previewClose">×</button>
      </div>
      <div class="preview-body">
        ${metaHtml}
        ${sectionsHtml}
      </div>
      <div class="preview-footer">
        <button type="button" class="preview-btn cancel" id="previewCancel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Cancel & Edit
        </button>
        <button type="button" class="preview-btn confirm" id="previewConfirm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Confirm Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ===== Close handlers =====
    let confirmed = false;
  const close = () => {
    modal.remove();
    if (!confirmed && options.onCancel) options.onCancel();
  };
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEsc);
    }
  };

  document.getElementById('previewClose').addEventListener('click', close);
  document.getElementById('previewCancel').addEventListener('click', close);
  
  document.getElementById('previewConfirm').addEventListener('click', () => {
    if (confirmed) return;
    confirmed = true;
    playSaveChime();
    close();
    if (options.onConfirm) options.onConfirm();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', onEsc);
}

// ===== Format Field Value =====
function formatFieldValue(field) {
  const value = field.value;
  
  if (!value || value === '') return '<span style="color:#94a3b8;">—</span>';
  
  // Badge types
  if (field.type === 'badge-accept') {
    const isAccept = value === 'Accept' || value === 'A';
    const cls = isAccept ? 'accept' : 'not-accept';
    const icon = isAccept ? '✓' : '✗';
    return `<span class="preview-badge ${cls}">${icon} ${escapeHtml(value)}</span>`;
  }
  
  if (field.type === 'badge-yes') {
    const isYes = value === 'Yes';
    const cls = isYes ? 'yes' : 'no';
    const icon = isYes ? '✓' : '✗';
    return `<span class="preview-badge ${cls}">${icon} ${escapeHtml(value)}</span>`;
  }
  
  if (field.type === 'badge-inspection') {
    const text = String(value || '').trim();
    const status = text.startsWith('✓') ? '✓' : text.startsWith('✗') ? '✗' : 'NA';
    const note = text
      .replace(/^[✓✗]/, '')
      .replace(/^\s*—\s*/, '')
      .trim();
    const style = status === '✓' ? 'accept' : status === '✗' ? 'not-accept' : 'na';
    const badge = `<span class="preview-badge ${style}">${status}</span>`;
    return note ? `${badge}<span class="preview-badge-note">— ${escapeHtml(note)}</span>` : badge;
  }

  // Default text
  return escapeHtml(value);
}

// ===== Escape HTML =====
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// ===== Promise version: const ok = await confirmSave({...}); =====
function confirmSave(options) {
  return new Promise(resolve => {
    showPreviewModal(Object.assign({}, options, {
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    }));
  });
}
// Soft confirmation chime, played only after the user confirms a save.
function playSaveChime() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const audio = new AudioContextClass();
    const now = audio.currentTime;
    [
      { frequency: 659.25, start: 0, duration: 0.09 },
      { frequency: 783.99, start: 0.095, duration: 0.16 }
    ].forEach(note => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.055, now + note.start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.02);
    });
  } catch (error) {
    // Sound support is optional; saving must continue even if it is unavailable.
  }
}