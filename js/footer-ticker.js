// Moving copyright ticker along the bottom of every dashboard page (inputs and reports)
(() => {
  if (document.getElementById('siteTicker')) return;
  const style = document.createElement('style');
  style.textContent = `
    #siteTicker { position: fixed; left: 0; right: 0; bottom: 0; height: 22px; overflow: hidden; z-index: 900;
      background: transparent; color: #6b7280; font: 500 12px Inter, sans-serif; pointer-events: none; }
    #siteTicker span { position: absolute; top: 50%; left: 0; white-space: nowrap; transform: translateY(-50%);
      animation: siteTickerMove 26s linear infinite; }
    @keyframes siteTickerMove { from { transform: translate(-100%, -50%); } to { transform: translate(100vw, -50%); } }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'siteTicker';
  bar.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = '© 2026 Imo Chicken & Agro (Pvt) Ltd. MIS Department. All rights reserved.';
  bar.appendChild(text);
  document.body.appendChild(bar);
})();
