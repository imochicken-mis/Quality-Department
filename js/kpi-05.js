// KPI 05 config. Page logic is in js/kpi-page.js
KpiPage.init({
  prefix: 'kpi5',
  action: 'getKpi5',
  dailyAction: 'getKpi5Daily',
  numLabel: 'Exceeding Weight (Kg)',
  denLabel: 'Dress Weight (Kg)',
  detailDecimals: 2,
  standardLabel: 'Standard <1%',
  target: 1,
  better: 'lower',
  scaleMax: 1.5,
  bands: [[0.6, '#16a34a'], [0.7, '#facc15'], [1, '#dc2626']]
});
