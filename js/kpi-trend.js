/* ============================================================
   KPI TREND (shared)  -  js/kpi-trend.js
   Line chart + table + glass hover card for ANY KPI page.
   Day-wise and month-wise use the same call, only `rows` differ.
   Uses the CSS that already exists in kpi-common.css.

   KpiTrend.mount({
     chart:  element,            // <div class="kpi-monthly-chart" hidden>
     table:  element,            // <div class="kpi-monthly-table" hidden>
     rows:   [{ label:'05', title:'2026-10-05', value:0.046, ...anyFields }],
     target: 1,                  // KPI standard
     better: 'lower' | 'higher', // lower = complaint rate, higher = compliance rate
     decimals: 2,                // decimals for every % value
     standardLabel: 'Standard ≤1.0%',
     cornerLabel: 'Date',        // top-left cell of the table ('Date' / 'Month')
     kpiLabel: 'KPI (%)',        // name of the KPI row in the table
     yMin: 0, yMax: 100,         // optional. Default: 0..100 (higher) or 0..max(1.5*target, data) (lower)
     details: [                  // extra rows in table + hover card (in this order)
       { label:'Sold units', get: r => r.sold,       color:'#60a5fa' },
       { label:'Complaints', get: r => r.complaints, color:'#ef4444' }
     ]
   });
   KpiTrend.clear(chart, table);  // hide + empty (use on error)
   ============================================================ */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmtNum(v, dec) {
    var n = Number(v);
    if (v === '' || v === null || v === undefined || !isFinite(n)) return '-';
    if (dec == null) return n.toLocaleString();
    return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function prepare(opt) {
    var dec = opt.decimals == null ? 2 : opt.decimals;
    var lower = opt.better === 'lower';
    var rows = (opt.rows || []).map(function (r, i) {
      var v = Number(r.value);
      var o = {};
      for (var k in r) o[k] = r[k];
      o.index = i;
      o.value = (r.value === '' || r.value === null || r.value === undefined || !isFinite(v)) ? null : v;
      return o;
    });
    return {
      opt: opt, rows: rows, dec: dec, lower: lower,
      ok: function (v) { return lower ? v <= opt.target : v >= opt.target; },
      pct: function (v) { return v.toFixed(dec) + '%'; }
    };
  }

  function getTip() {
    var tip = document.getElementById('kpiColTip');
    if (!tip) {
      tip = el('div', 'kpi-col-tip');
      tip.id = 'kpiColTip';
      document.body.appendChild(tip);
    }
    return tip;
  }

  function tipRow(label, value, color) {
    var row = el('div', 'kpi-col-tip-row');
    if (color) {
      var dot = document.createElement('i');
      dot.style.background = color;
      row.appendChild(dot);
    }
    row.append(el('span', '', label), el('b', '', value));
    return row;
  }

  function drawChart(S, animate) {
    var opt = S.opt, chart = opt.chart, rows = S.rows;
    chart.hidden = false;
    var width = Math.max(320, Math.round(chart.clientWidth) || 900);
    var height = 280, left = 52, right = 24, top = 20, bottom = 45;
    var cw = width - left - right, ch = height - top - bottom;
    S.width = width;

    var vals = rows.filter(function (r) { return r.value !== null; }).map(function (r) { return r.value; });
    var yMin = opt.yMin != null ? opt.yMin : 0;
    var yMax = opt.yMax != null ? opt.yMax
      : S.lower ? Math.max(opt.target * 1.5, Math.max.apply(null, vals.concat([0])))
      : 100;
    if (yMax <= yMin) yMax = yMin + 1;
    // Y axis labels: whole numbers on a 0-100 scale, 2 decimals on a 0-1 style scale (or set yDecimals)
    var yDec = opt.yDecimals != null ? opt.yDecimals : (yMax >= 10 ? 0 : S.dec);

    var x = function (i) { return left + i * cw / Math.max(rows.length - 1, 1); };
    var y = function (v) {
      var c = Math.max(yMin, Math.min(yMax, v));
      return top + ch - (c - yMin) / (yMax - yMin) * ch;
    };
    var yT = y(opt.target);

    var valid = rows.filter(function (r) { return r.value !== null; });

    // Smooth curve through the points (monotone cubic: no overshoot above/below the data)
    var smoothPath = function (p) {
      var n = p.length;
      if (!n) return '';
      if (n === 1) return 'M' + p[0].x + ',' + p[0].y;
      var dx = [], m = [], t = [];
      for (var i = 0; i < n - 1; i++) {
        dx[i] = p[i + 1].x - p[i].x;
        m[i] = (p[i + 1].y - p[i].y) / (dx[i] || 1);
      }
      t[0] = m[0];
      t[n - 1] = m[n - 2];
      for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
      for (i = 0; i < n - 1; i++) {
        if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
        var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
        if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
      }
      var d = 'M' + p[0].x + ',' + p[0].y;
      for (i = 0; i < n - 1; i++) {
        var h = dx[i] / 3;
        d += ' C' + (p[i].x + h) + ',' + (p[i].y + t[i] * h) + ' ' +
          (p[i + 1].x - h) + ',' + (p[i + 1].y - t[i + 1] * h) + ' ' + p[i + 1].x + ',' + p[i + 1].y;
      }
      return d;
    };
    var curve = smoothPath(valid.map(function (r) { return { x: x(r.index), y: y(r.value) }; }));
    var pts = valid.map(function (r) { return x(r.index) + ',' + y(r.value); }).join(' ');
    var area = valid.length
      ? curve + ' L' + x(valid[valid.length - 1].index) + ',' + (top + ch) + ' L' + x(valid[0].index) + ',' + (top + ch) + ' Z'
      : '';

    // zones: green = good side of the standard line, red = bad side
    var upClass = S.lower ? 'zone-below' : 'zone-above';
    var downClass = S.lower ? 'zone-above' : 'zone-below';

    var grid = [0, 1, 2, 3, 4].map(function (g) {
      var v = yMin + (yMax - yMin) * g / 4;
      return '<line class="grid-line" x1="' + left + '" x2="' + (width - right) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line>' +
        '<text x="' + (left - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v.toFixed(yDec) + '%' + '</text>';
    }).join('');

    var dots = valid.map(function (r) {
      return '<circle class="trend-dot ' + (S.ok(r.value) ? 'is-achieved' : 'is-below-target') + '" cx="' + x(r.index) + '" cy="' + y(r.value) + '" r="5"></circle>' +
        '<circle class="trend-hit" data-i="' + r.index + '" cx="' + x(r.index) + '" cy="' + y(r.value) + '" r="16"></circle>';
    }).join('');

    // keep labels readable when there are many points (31 days)
    var step = Math.max(1, Math.ceil(rows.length * 22 / cw));
    var labels = rows.map(function (r) {
      if (r.index % step) return '';
      return '<text x="' + x(r.index) + '" y="' + (height - 15) + '" text-anchor="middle">' + r.label + '</text>';
    }).join('');

    chart.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="KPI trend chart">' +
      '<rect class="' + upClass + '" x="' + left + '" y="' + top + '" width="' + cw + '" height="' + (yT - top) + '"></rect>' +
      '<rect class="' + downClass + '" x="' + left + '" y="' + yT + '" width="' + cw + '" height="' + (top + ch - yT) + '"></rect>' +
      grid +
      '<line class="target-line" x1="' + left + '" x2="' + (width - right) + '" y1="' + yT + '" y2="' + yT + '"></line>' +
      '<path class="trend-area" d="' + area + '"></path>' +
      '<path class="trend-line" d="' + curve + '"></path>' +
      '<text class="target-label" x="' + (width - right) + '" y="' + (yT - 8) + '" text-anchor="end">' + (opt.standardLabel || '') + '</text>' +
      dots + labels + '</svg>';
    if (animate) animateChart(chart);

    // glass hover card
    var tip = getTip();
    chart.querySelectorAll('.trend-hit').forEach(function (hit) {
      var r = rows[Number(hit.dataset.i)];
      hit.addEventListener('mouseenter', function () {
        var parts = [el('div', 'kpi-col-tip-title', r.title || r.label)];
        (opt.details || []).forEach(function (d) { parts.push(tipRow(d.label, fmtNum(d.get(r), opt.detailDecimals), d.color)); });
        parts.push(tipRow(opt.kpiLabel || 'KPI (%)', S.pct(r.value), S.ok(r.value) ? '#22a06b' : '#e5484d'));
        tip.replaceChildren.apply(tip, parts);
        tip.classList.add('is-visible');
      });
      hit.addEventListener('mousemove', function (e) {
        var fitsRight = e.clientX + 16 + 210 < window.innerWidth;
        tip.style.left = (fitsRight ? e.clientX + 16 : e.clientX - 226) + 'px';
        tip.style.top = (e.clientY + 16) + 'px';
      });
      hit.addEventListener('mouseleave', function () { tip.classList.remove('is-visible'); });
    });
  }

  function drawTable(S) {
    var opt = S.opt, box = opt.table, rows = S.rows;
    if (!box) return;
    box.replaceChildren();

    var table = el('table', 'kpi-criteria-table');
    table.style.minWidth = (170 + rows.length * 70) + 'px';

    var isDaily = (opt.cornerLabel || '') === 'Date';
    function weekendClass(r) {
      if (!isDaily || !r.title) return '';
      var day = new Date(r.title + 'T00:00:00').getDay();
      return day === 6 ? 'is-saturday' : day === 0 ? 'is-sunday' : '';
    }
    function markWeekend(cell, r) {
      var cls = weekendClass(r);
      if (cls) cell.classList.add(cls);
      return cell;
    }

    var head = table.createTHead().insertRow();
    head.appendChild(el('th', '', opt.cornerLabel || ''));
    rows.forEach(function (r) { head.appendChild(markWeekend(el('th', '', r.label), r)); });

    var body = table.createTBody();
    (opt.details || []).forEach(function (d) {
      var tr = body.insertRow();
      tr.appendChild(el('th', '', d.label));
      rows.forEach(function (r) {
        var cell = markWeekend(tr.insertCell(), r);
        cell.textContent = fmtNum(d.get(r), opt.detailDecimals);
      });
    });
    var kr = body.insertRow();
    kr.appendChild(el('th', '', opt.kpiLabel || 'KPI (%)'));
    rows.forEach(function (r) {
      var c = markWeekend(kr.insertCell(), r);
      if (r.value === null) { c.textContent = '-'; return; }
      c.textContent = S.pct(r.value);
      c.className = S.ok(r.value) ? 'is-achieved' : 'is-below-target';
    });

    // row names stay visible while the table scrolls sideways
    table.querySelectorAll('tr > :first-child').forEach(function (c) {
      c.style.position = 'sticky';
      c.style.left = '0';
      c.style.zIndex = '1';
    });

    var wrap = el('div', 'kpi-criteria-table-wrap');
    wrap.style.marginTop = '2rem';
    wrap.appendChild(table);
    box.appendChild(wrap);
    box.hidden = false;
  }

  // The line draws itself from left to right, then the points fade in
  function animateChart(chart) {
    var line = chart.querySelector('.trend-line');
    if (line && line.getTotalLength) {
      var len = line.getTotalLength();
      line.style.transition = 'none';
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.2s ease-in-out';
      line.style.strokeDashoffset = '0';
    }
    chart.querySelectorAll('.trend-dot').forEach(function (dot, i) {
      dot.style.opacity = '0';
      dot.style.transition = 'opacity .4s ease ' + (0.9 + i * 0.05) + 's';
      requestAnimationFrame(function () { dot.style.opacity = '1'; });
    });
  }

  function mount(opt) {
    var chart = opt.chart;
    if (!chart) return;
    var S = prepare(opt);
    chart._kpiTrend = S;
    drawChart(S, true);
    drawTable(S);

    // redraw when the chart box changes width (sidebar hide / show, window resize)
    if (!chart._kpiTrendObserver && window.ResizeObserver) {
      chart._kpiTrendObserver = new ResizeObserver(function () {
        var cur = chart._kpiTrend;
        if (!cur || chart.hidden) return;
        if (Math.abs(chart.clientWidth - cur.width) > 8) { drawChart(cur); }
      });
      chart._kpiTrendObserver.observe(chart);
    }
  }

  function clear(chart, table) {
    if (chart) { chart._kpiTrend = null; chart.hidden = true; chart.replaceChildren(); }
    if (table) { table.hidden = true; table.replaceChildren(); }
  }

  window.KpiTrend = { mount: mount, clear: clear };
})();
