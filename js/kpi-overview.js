// Shows the selected month's KPI value, standard and criteria figures on each overview tile
(function () {
  const monthInput = document.getElementById('overviewMonth');
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
  const DAILY_ACTIONS = {
    2: 'getKpi2Daily',
    3: 'getKpi3Daily',
    4: 'getKpi4Daily',
    5: 'getKpi5Daily',
    6: 'getKpi6Daily'
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

  function ensureMiniDonuts() {
    document.querySelectorAll('.kpi-tile').forEach((card) => {
      const value = card.querySelector('.kpi-tile-value[data-kpi]');
      if (!value || card.querySelector('.kpi-mini-donut')) return;
      const n = value.dataset.kpi;
      if (!DAILY_ACTIONS[n]) return;
      const donut = document.createElement('span');
      donut.className = 'kpi-mini-donut';
      donut.dataset.kpiDonut = n;
      donut.innerHTML = '<strong>–</strong><small>Pass / Fail</small>';
      card.appendChild(donut);
    });
  }

  async function updateMiniDonut(n, month) {
    const donut = document.querySelector(`.kpi-mini-donut[data-kpi-donut="${n}"]`);
    if (!donut) return;
    try {
      const response = await fetch(`${API_URL}?action=${DAILY_ACTIONS[n]}&month=${month}&_r=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json();
      let pass = 0;
      let fail = 0;
      (data.days || []).forEach((day) => {
        const value = parseFloat(String(day.kpi || '').replace('%', '').trim());
        if (!Number.isFinite(value)) return;
        if (statusOf(n, value + '%')) pass++;
        else fail++;
      });
      const total = pass + fail;
      const pct = total ? pass / total * 100 : 0;
      donut.style.setProperty('--kpi-donut-pct', pct + '%');
      donut.innerHTML = total
        ? `<strong>${pass}</strong><small>Pass / ${fail} Fail</small>`
        : '<strong>–</strong><small>No day data</small>';
    } catch (_) {
      donut.innerHTML = '<strong>–</strong><small>No day data</small>';
      donut.style.setProperty('--kpi-donut-pct', '0%');
    }
  }

  async function loadValues() {
    const month = monthInput.value;
if (!month) return;

ensureMiniDonuts();


document.querySelectorAll('.kpi-tile').forEach((card) => {
  card.classList.add('is-loading');
});

document.querySelectorAll('.kpi-tile-value[data-kpi]').forEach(async (el) => {
      const n = el.dataset.kpi;
      const detail = document.querySelector(`.kpi-tile-detail[data-kpi="${n}"]`);
      el.textContent = '…';
      try {
        const response = await fetch(`${API_URL}?action=getKpi${n}&month=${month}&_r=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        const ok = data.success && data.kpi;
        el.textContent = ok ? data.kpi : '-';
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
        await updateMiniDonut(n, month);
        el.closest('.kpi-tile')?.classList.remove('is-loading');
      } catch (error) {
        el.textContent = '-';
        if (detail) detail.textContent = '';
        const status = document.querySelector(`.kpi-tile-status[data-kpi-status="${n}"]`);
        if (status) { status.textContent = ''; status.className = 'kpi-tile-status'; }
        el.closest('.kpi-tile')?.classList.remove('is-loading');
      }
    });
  }

  monthInput.addEventListener('change', loadValues);
  loadValues();
})();
