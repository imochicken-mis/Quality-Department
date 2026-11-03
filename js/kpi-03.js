// KPI 03 config. Page logic is in js/kpi-page.js
KpiPage.init({
  prefix: 'kpi3',
  action: 'getKpi3',
  dailyAction: 'getKpi3Daily',
  numLabel: 'Rejection Qty (Kg)',
  denLabel: 'Dress Weight (Kg)',
  standardLabel: 'Standard <0.5%',
  target: 0.5,
  better: 'lower',
  scaleMax: 1,
  bands: [[0.2, '#16a34a'], [0.4, '#facc15'], [0.5, '#dc2626']]
});
