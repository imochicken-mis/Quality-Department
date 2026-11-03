// KPI 02 config. Page logic is in js/kpi-page.js
KpiPage.init({
  prefix: 'kpi2',
  action: 'getKpi2',
  dailyAction: 'getKpi2Daily',
  numLabel: 'Customer Complaints',
  denLabel: 'Sold units',
  standardLabel: 'Standard ≤1%',
  target: 1,
  better: 'lower',
  scaleMax: 1,
  numField: 'complaints',
  denField: 'sold',
  bands: [[0.5, '#16a34a'], [0.6, '#facc15'], [1, '#dc2626']]
});
