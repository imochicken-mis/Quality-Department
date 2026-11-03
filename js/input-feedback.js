/* Shared input-page feedback: success toast + duplicate-entry dialog */
(function () {
  function closeDuplicate() {
    document.getElementById('inputDuplicateOverlay')?.remove();
  }

  window.InputFeedback = {
    success(text) {
      document.querySelector('.input-save-toast')?.remove();
      const toast = document.createElement('div');
      toast.className = 'input-save-toast';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<span class="input-feedback-check">✓</span><span></span>';
      toast.lastElementChild.textContent = text || 'Data saved successfully.';
      document.body.appendChild(toast);
      window.setTimeout(() => toast.remove(), 3200);
    },

    duplicate(text) {
      closeDuplicate();
      const overlay = document.createElement('div');
      overlay.id = 'inputDuplicateOverlay';
      overlay.className = 'input-duplicate-overlay';
      overlay.innerHTML = '<section class="input-duplicate-modal" role="alertdialog" aria-modal="true" aria-labelledby="duplicateTitle"><span class="input-duplicate-icon">!</span><h3 id="duplicateTitle">Already saved</h3><p></p><button type="button">Okay</button></section>';
      overlay.querySelector('p').textContent = text || 'Data for this date is already saved.';
      const close = () => closeDuplicate();
      overlay.querySelector('button').addEventListener('click', close);
      overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
      document.body.appendChild(overlay);
      overlay.querySelector('button').focus();
    }
  };
}());