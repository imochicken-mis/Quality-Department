// ============================================
// REPORT CACHE (sessionStorage) - shared by all report pages
// - API responses cache wenawa (TTL 15 min)
// - kalin select karapu date/month eka mathaka thiyaganna
// ============================================
window.ReportCache = (function () {
  const PREFIX = 'rc:';
  const TTL = 15 * 60 * 1000;

  function get(url) {
    try {
      const o = JSON.parse(sessionStorage.getItem(PREFIX + url) || 'null');
      if (o && Date.now() - o.t < TTL) return o.d;
    } catch (e) { /* ignore */ }
    return null;
  }

  function set(url, data) {
    if (!data || !data.success || /getWaterImages/.test(url)) return;   // images wadi, cache karanne na
    try { sessionStorage.setItem(PREFIX + url, JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* quota */ }
  }

  function clear() {
    Object.keys(sessionStorage)
      .filter(k => k.indexOf(PREFIX) === 0)
      .forEach(k => sessionStorage.removeItem(k));
  }

  // Input ekata kalin select karapu value eka danawa, aluth wenas kamath save karanawa
  // Returns true nam kalin value ekak restore una
  function restoreInput(input, key) {
    const k = 'rcLast:' + key;
    let restored = false;
    try {
      const v = sessionStorage.getItem(k);
      if (v && !input.value) { input.value = v; restored = true; }
    } catch (e) { /* ignore */ }
    input.addEventListener('change', () => {
      try { sessionStorage.setItem(k, input.value); } catch (e) { /* ignore */ }
    });
    return restored;
  }

  return { get, set, clear, restoreInput };
})();