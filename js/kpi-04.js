// KPI 04 config. Page logic is in js/kpi-page.js
KpiPage.init({
  prefix: 'kpi4',
  action: 'getKpi4',
  dailyAction: 'getKpi4Daily',
  numLabel: 'Compliant Inspection',
  denLabel: 'Total Inspection',
  standardLabel: 'Standard ≥98%',
  target: 98,
  better: 'higher',
  scaleMax: 100,
  bands: [[40, '#dc2626'], [70, '#facc15'], [98, '#16a34a']]
});
