// Shared report export menu UI. Export actions are attached separately per report.
document.addEventListener('DOMContentLoaded', () => {
  const wraps = Array.from(document.querySelectorAll('.report-export-wrap'));
  if (!wraps.length) return;
  const closeAll = (except) => wraps.forEach((wrap) => {
    if (wrap !== except) {
      const menu = wrap.querySelector('.report-export-menu');
      const trigger = wrap.querySelector('.report-export-trigger');
      if (menu) menu.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
  });
  wraps.forEach((wrap) => {
    const trigger = wrap.querySelector('.report-export-trigger');
    const menu = wrap.querySelector('.report-export-menu');
    if (!trigger || !menu) return;
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      closeAll(wrap);
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', () => closeAll(null));
});