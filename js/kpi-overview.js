// Shows the selected month's KPI value, standard and criteria figures on each overview tile
(function () {
const monthInput = document.getElementById('overviewMonth');
const now = new Date();
const currentMonth =
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

monthInput.value =
  localStorage.getItem('kpiOverviewMonth') || currentMonth;

  // Name of each KPI's two figures, and the field names each route returns for them
  const FIGURES = {
    1: { label: 'Compliant / Tested', top: (d) => d.totalCompliance, bottom: (d) => d.totalTested },
    2: { label: 'Complaints / Sold', top: (d) => d.complaints, bottom: (d) => d.sold },
    3: { label: 'Rejection / Prd Qty', top: (d) => d.numerator, bottom: (d) => d.denominator },
    4: { label: 'Out / Criteria', top: (d) => d.numerator, bottom: (d) => d.denominator },
    5: { label: 'Kilo / Dress Weight', top: (d) => d.numerator, bottom: (d) => d.denominator },
    6: { label: 'Compliant / Total', top: (d) => d.numerator, bottom: (d) => d.denominator },
    7: { label: 'Compliant / Total', top: (d) => d.numerator, bottom: (d) => d.denominator }
  };
  // Standard of each KPI (same figures as the KPI pages): lower = at or below, higher = at or above
  const TARGETS = {
    1: { target: 95, better: 'higher' },
    2: { target: 1, better: 'lower' },
    3: { target: 0.5, better: 'lower' },
    4: { target: 98, better: 'higher' },
    5: { target: 1, better: 'lower' },
    6: { target: 95, better: 'higher' },
    7: { target: 95, better: 'higher' }
  };
  const statusOf = (n, kpiText) => {
    const value = parseFloat(String(kpiText).replace('%', '').trim());
    if (!Number.isFinite(value)) return null;
    const t = TARGETS[n];
    return t.better === 'lower' ? value <= t.target : value >= t.target;
  };

  const figuresOf = (n, data) => {
    const f = FIGURES[n];
    return `${f.label}: ${f.top(data) ?? '-'} / ${f.bottom(data) ?? '-'}`;
  };

  // ===== Donut chart =====
  // KPI 1 (no daily data): the ring fills to the KPI value.
  // KPI 2-7: the ring is split into Achieved days (green) and Not Achieved days (red),
  //          counted over the dates that have data in the selected month.
  const RING_R = 48;
  const RING_LEN = 2 * Math.PI * RING_R;
  const arc = (len, offset) =>
    `stroke-dasharray="${len.toFixed(2)} ${(RING_LEN - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"`;

  function ensureDonuts() {
    document.querySelectorAll('.kpi-tile').forEach((card) => {
      const value = card.querySelector('.kpi-tile-value[data-kpi]');
      if (!value || card.querySelector('.kpi-donut')) return;
      const n = value.dataset.kpi;
      const donut = document.createElement('div');
      donut.className = 'kpi-donut is-no-data';
      donut.dataset.kpiDonut = n;
      donut.innerHTML = `
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="kpi-donut-track" cx="60" cy="60" r="${RING_R}"></circle>
          <circle class="kpi-donut-fill" cx="60" cy="60" r="${RING_R}" stroke-dasharray="0 ${RING_LEN}"></circle>
          <circle class="kpi-donut-ach" cx="60" cy="60" r="${RING_R}" stroke-dasharray="0 ${RING_LEN}"></circle>
          <circle class="kpi-donut-not" cx="60" cy="60" r="${RING_R}" stroke-dasharray="0 ${RING_LEN}"></circle>
        </svg>
        <b class="kpi-donut-value">–</b>`;
      card.appendChild(donut);
      const legend = document.createElement('div');
      legend.className = 'kpi-donut-legend';
      legend.dataset.kpiLegend = n;
      card.appendChild(legend);
    });
  }

  const donutOf = (n) => document.querySelector(`.kpi-donut[data-kpi-donut="${n}"]`);
  const legendOf = (n) => document.querySelector(`.kpi-donut-legend[data-kpi-legend="${n}"]`);

  // KPI 1: single value ring. text = "95.19%" or null; achieved = true / false / null
  function setDonut(n, text, achieved) {
    const donut = donutOf(n);
    if (!donut) return;
    const num = text == null ? NaN : parseFloat(String(text).replace('%', '').trim());
    const has = Number.isFinite(num);
    const pct = has ? Math.min(Math.max(num, 0), 100) : 0;
    donut.classList.remove('is-days');
    donut.querySelector('.kpi-donut-fill').setAttribute(
      'stroke-dasharray', `${(pct / 100 * RING_LEN).toFixed(2)} ${RING_LEN.toFixed(2)}`);
    donut.querySelector('.kpi-donut-value').textContent = has ? String(text).trim() : '–';
    donut.classList.toggle('is-achieved', has && achieved === true);
    donut.classList.toggle('is-below-target', has && achieved === false);
    donut.classList.toggle('is-no-data', !has);
    const legend = legendOf(n);
    if (legend) legend.innerHTML = '';
  }

  // KPI 2-7: Achieved days vs Not Achieved days
  function setDonutDays(n, achievedDays, notDays, unit = 'days', aLabel = 'Achieved', nLabel = 'Not achieved') {
    const donut = donutOf(n);
    if (!donut) return;
    const total = achievedDays + notDays;
    if (!total) { setDonut(n, null, null); return; }
    const a = achievedDays / total * RING_LEN;
    const b = notDays / total * RING_LEN;
    donut.classList.add('is-days');
    donut.classList.remove('is-no-data', 'is-achieved', 'is-below-target');
    donut.querySelector('.kpi-donut-ach').setAttribute('stroke-dasharray', `${a.toFixed(2)} ${(RING_LEN - a).toFixed(2)}`);
    donut.querySelector('.kpi-donut-ach').setAttribute('stroke-dashoffset', '0');
    donut.querySelector('.kpi-donut-not').setAttribute('stroke-dasharray', `${b.toFixed(2)} ${(RING_LEN - b).toFixed(2)}`);
    donut.querySelector('.kpi-donut-not').setAttribute('stroke-dashoffset', (-a).toFixed(2));
    donut.querySelector('.kpi-donut-value').innerHTML =
      `<span class="d-num">${total.toLocaleString('en-US')}</span><span class="d-lbl">${unit}</span>`;
    const legend = legendOf(n);
    if (legend) legend.innerHTML = `
      <span class="lg lg-ach"><i></i>${aLabel}: <b>${achievedDays.toLocaleString('en-US')}</b></span>
      <span class="lg lg-not"><i></i>${nLabel}: <b>${notDays.toLocaleString('en-US')}</b></span>`;
  }

  async function loadDays(n, month) {
    try {
      const response = await fetch(`${API_URL}?action=getKpi${n}Daily&month=${month}&_r=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!data.success || !Array.isArray(data.days)) { setDonut(n, null, null); return; }
      let achievedDays = 0;
      let notDays = 0;
      data.days.forEach((day) => {
        const r = statusOf(n, day.kpi);
        if (r === true) achievedDays++;
        else if (r === false) notDays++;
      });
      setDonutDays(n, achievedDays, notDays);
    } catch (error) {
      setDonut(n, null, null);
    }
  }

  // ===== Active / Inactive toggle on each card (saved in the "KPI Status" sheet) =====
  let kpiToggleReady = false;

  function applyKpiActive(n, active) {
    const card = document.querySelector(`.kpi-tile-value[data-kpi="${n}"]`)?.closest('.kpi-tile');
    if (!card) return;

    const sw = card.querySelector('.kpi-switch');
    if (sw) {
      sw.setAttribute('aria-checked', active ? 'true' : 'false');
      sw.title = active ? 'Active - click to deactivate' : 'Inactive - click to activate';
    }
  }

  function initKpiToggles() {
    if (kpiToggleReady) return;
    kpiToggleReady = true;

    document.querySelectorAll('.kpi-tile-value[data-kpi]').forEach((el) => {
      const card = el.closest('.kpi-tile');
      if (!card || card.querySelector('.kpi-switch')) return;
      const n = el.dataset.kpi;

      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'kpi-switch';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', 'true');
      sw.title = 'Active - click to deactivate';
      sw.innerHTML = '<span class="kpi-switch-knob"></span>';

      sw.addEventListener('click', async (ev) => {
        ev.preventDefault();      // the card is a link: do not open the KPI page
        ev.stopPropagation();
        const next = sw.getAttribute('aria-checked') !== 'true';
        applyKpiActive(n, next);
        sw.disabled = true;
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'setKpiStatus', kpi: Number(n), active: next })
          });
          const data = await response.json();
          if (!data.success) throw new Error(data.error || 'Save failed');
        } catch (error) {
          applyKpiActive(n, !next);   // put it back if the save failed
          alert('Could not save KPI status: ' + (error.message || error));
        } finally {
          sw.disabled = false;
        }
      });

      card.appendChild(sw);
    });

    fetch(`${API_URL}?action=getKpiStatus&_r=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.statuses) {
          Object.keys(data.statuses).forEach((n) => applyKpiActive(n, data.statuses[n]));
        }
      })
      .catch(() => {});
  }

  // Counts from 0 up to the value (e.g. 95.19%), keeping the same decimals and the % sign
  function countUp(el, text) {
    const match = String(text).match(/^(-?[\d.,]+)(.*)$/);
    const target = match ? parseFloat(match[1].replace(/,/g, '')) : NaN;
    if (!Number.isFinite(target)) { el.textContent = text; return; }
    const decimals = (match[1].split('.')[1] || '').length;
    const suffix = match[2] || '';
    const start = performance.now();
    const duration = 900;
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function loadValues() {
    initKpiToggles();
    const month = monthInput.value;
if (!month) return;

ensureDonuts();


// One loading animation for the whole grid; every tile shows together once all of them (values and donuts) are ready
const grid = document.querySelector('.kpi-grid');
grid?.classList.add('is-loading-all');

const countQueue = [];   // count-up runs after the grid is revealed, so the 0 -> value animation is visible
const jobs = [...document.querySelectorAll('.kpi-tile-value[data-kpi]')].map(async (el) => {
      const n = el.dataset.kpi;
      const detail = document.querySelector(`.kpi-tile-detail[data-kpi="${n}"]`);
      el.textContent = '…';
      try {
        const response = await fetch(`${API_URL}?action=getKpi${n}&month=${month}&_r=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        const ok = data.success && data.kpi;
        countQueue.push({ el, text: ok ? data.kpi : '-' });
if (detail) {
  const f = FIGURES[n];
  const [firstLabel, secondLabel] = f.label.split(' / ');
  const fmt = (v) =>
    v == null ? '-' : Number(v).toLocaleString('en-US');

  detail.innerHTML = ok ? `
    <span class="kpi-figure">
      <strong>${fmt(f.top(data))}</strong>
      <small>${firstLabel}</small>
    </span>
    <span class="kpi-figure">
      <strong>${fmt(f.bottom(data))}</strong>
      <small>${secondLabel}</small>
    </span>
  ` : '';
}
        const status = document.querySelector(`.kpi-tile-status[data-kpi-status="${n}"]`);
        const achieved = ok ? statusOf(n, data.kpi) : null;
        el.classList.toggle('is-achieved', achieved === true);
        el.classList.toggle('is-below-target', achieved === false);
        if (status) {
          if (!ok || achieved === null) {
            status.textContent = 'No Data';
            status.className = 'kpi-tile-status is-no-data';
          } else {
            status.textContent = achieved ? 'Achieved' : 'Not Achieved';
            status.className =
              'kpi-tile-status ' +
              (achieved ? 'is-achieved' : 'is-below-target');
          }
        }
        if (n === '1') {
          // KPI 1 has no daily log: split the tested parameters into compliant / non-compliant
          const tested = Number(String(data.totalTested ?? '').replace(/,/g, ''));
          const comp = Number(String(data.totalCompliance ?? '').replace(/,/g, ''));
          if (ok && tested > 0 && comp >= 0 && comp <= tested) {
            setDonutDays(n, comp, tested - comp, 'tested', 'Compliant', 'Non-compliant');
          } else {
            setDonut(n, null, null);
          }
        }
        else await loadDays(n, month);
        el.closest('.kpi-tile')?.classList.remove('is-loading');
      } catch (error) {
        el.textContent = '-';
        setDonut(n, null, null);
        if (detail) detail.textContent = '';
        const status = document.querySelector(`.kpi-tile-status[data-kpi-status="${n}"]`);
        if (status) { status.textContent = ''; status.className = 'kpi-tile-status'; }
        el.closest('.kpi-tile')?.classList.remove('is-loading');
      }
    });

    await Promise.all(jobs);
    grid?.classList.remove('is-loading-all');
    countQueue.forEach(item => countUp(item.el, item.text));
  }

  monthInput.addEventListener('change', () => {
  localStorage.setItem('kpiOverviewMonth', monthInput.value);
  loadValues();
});
  loadValues();
})();