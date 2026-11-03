// ============================================
// IMO CHICKEN & AGRO - QUALITY DEPARTMENT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userMenu = userMenuBtn ? userMenuBtn.closest('.user-menu') : null;

  if (userMenuBtn && userMenu) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('open');
      }
    });
  }
});

// ============================================
// CUSTOM CURSOR
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const cursor = document.querySelector('.custom-cursor');
  const cursorDot = document.querySelector('.custom-cursor-dot');

  if (!cursor || !cursorDot) return;

  // Mouse move
  document.addEventListener('mousemove', (e) => {
    cursorDot.style.left = e.clientX + 'px';
    cursorDot.style.top = e.clientY + 'px';
    
    // Smooth follow (delay)
    setTimeout(() => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    }, 50);
  });

  // Hover on clickable elements
  const clickables = document.querySelectorAll('a, button, .service-card, .feature-item');
  clickables.forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
  });

  // Click
  document.addEventListener('mousedown', () => cursor.classList.add('click'));
  document.addEventListener('mouseup', () => cursor.classList.remove('click'));

  // Mouse leave page
  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    cursorDot.style.opacity = '0';
  });
  document.addEventListener('mouseenter', () => {
    cursor.style.opacity = '1';
    cursorDot.style.opacity = '1';
  });
});