// ============================================
// AUTH - Login Form Logic
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');

  // ===== Password Toggle =====
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      this.classList.toggle('show');
      this.setAttribute('aria-label',
        type === 'password' ? 'Show password' : 'Hide password'
      );
    });
  }

  // ===== Login Submit =====
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = usernameInput.value.trim();
      const password = passwordInput.value; // don't trim - spaces can be part of a password

      // Validation
      if (!username || !password) {
        showError('Username සහ Password දෙකම දාන්න');
        return;
      }

      // Loading state
      const submitBtn = loginForm.querySelector('.full-width');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Logging in...';
      submitBtn.disabled = true;

      try {
        // API call
        const result = await loginUser(username, password);

        if (result.success) {
          // User info save
          localStorage.setItem('currentUser', JSON.stringify(result.user));
          
          // Success message
          submitBtn.textContent = 'Success! ✓';
          submitBtn.style.background = 'linear-gradient(180deg, #10b981, #059669)';
          
          // Dashboard එකට redirect
          setTimeout(() => {
            window.location.href = 'dashboard/' + (getFirstAllowedPage(result.user) || 'index.html');
          }, 800);
          
        } else {
          // Error shown on the login button itself, then it returns to "Login"
          showButtonError(submitBtn, result.error || 'Invalid username or password', originalText);
        }

      } catch (error) {
        console.error('Login error:', error);
        showButtonError(submitBtn, 'Network error. Try again', originalText);
      }
    });
  }

  // ===== Error on the login button (red for a moment, then back to the normal label) =====
  function showButtonError(button, message, originalText) {
    button.textContent = message;
    button.style.background = 'linear-gradient(120deg, #dc2626, #b91c1c)';
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
      button.disabled = false;
    }, 2500);
  }

  // ===== Show Error Message =====
  function showError(message) {
    // කලින් තිබ්බ error එක අයින් කරන්න
    const existingError = document.querySelector('.login-error');
    if (existingError) existingError.remove();

    // අලුත් error එකක් හදන්න
    const errorDiv = document.createElement('div');
    errorDiv.className = 'login-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 1rem;
      border-left: 3px solid #dc2626;
      animation: shake 0.4s ease;
    `;

    // Form එකට උඩින් දාන්න
    loginForm.insertBefore(errorDiv, loginForm.firstChild);

    // 4 seconds පස්සේ අයින් කරන්න
    setTimeout(() => errorDiv.remove(), 4000);
  }

  // ===== Shake Animation (CSS එකට inject කරන්න) =====
  if (!document.getElementById('shake-animation')) {
    const style = document.createElement('style');
    style.id = 'shake-animation';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
  }

});