// KPI 06 config. Page logic is in js/kpi-page.js
KpiPage.init({
  prefix: 'kpi6',
  action: 'getKpi6',
  dailyAction: 'getKpi6Daily',
  numLabel: 'Compliant points',
  denLabel: 'Total inspection points',
  standardLabel: 'Standard ≥95%',
  target: 95,
  better: 'higher',
  scaleMax: 100,
  bands: [[40, '#dc2626'], [60, '#facc15'], [95, '#16a34a']]
});
