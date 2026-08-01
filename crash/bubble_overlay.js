/**
 * Dalio-Style Bubble Indicator Overlay
 *
 * Injects a "Bubble Indicator" section into the crash dashboard.
 * Reads dalio_bubble_indicator from crash_indicators_data.json and renders:
 *   1. A sidebar nav item
 *   2. Composite gauge + 6 sub-gauge bars
 *   3. A 100-year historical reference chart (Canvas)
 */
(function () {
  "use strict";

  // --- Historical data (approximate Dalio composite readings 1926-2026) ---
  var HISTORY = [
    [1926,30],[1927,55],[1928,80],[1929,100],[1930,40],[1931,15],[1932,5],
    [1933,20],[1934,18],[1935,22],[1936,35],[1937,45],[1938,15],[1939,20],
    [1940,15],[1941,10],[1942,8],[1943,12],[1944,15],[1945,20],[1946,30],
    [1947,22],[1948,18],[1949,12],[1950,18],[1951,20],[1952,22],[1953,18],
    [1954,20],[1955,28],[1956,30],[1957,25],[1958,20],[1959,28],[1960,25],
    [1961,30],[1962,28],[1963,25],[1964,30],[1965,35],[1966,55],[1967,40],
    [1968,50],[1969,42],[1970,25],[1971,28],[1972,40],[1973,60],[1974,15],
    [1975,18],[1976,22],[1977,18],[1978,15],[1979,18],[1980,25],[1981,20],
    [1982,12],[1983,20],[1984,22],[1985,28],[1986,35],[1987,50],[1988,25],
    [1989,30],[1990,22],[1991,25],[1992,22],[1993,25],[1994,28],[1995,35],
    [1996,45],[1997,60],[1998,72],[1999,92],[2000,100],[2001,50],[2002,20],
    [2003,25],[2004,30],[2005,42],[2006,55],[2007,70],[2008,15],[2009,10],
    [2010,25],[2011,28],[2012,30],[2013,38],[2014,42],[2015,40],[2016,35],
    [2017,50],[2018,45],[2019,48],[2020,35],[2021,73],[2022,25],[2023,40],
    [2024,55],[2025,65]
    // 2026 current is injected from live data
  ];

  function waitForData(cb) {
    fetch("crash_indicators_data.json")
      .then(function (r) { return r.json(); })
      .then(cb)
      .catch(function () { /* silently skip if no data */ });
  }

  function riskColor(score) {
    if (score >= 80) return "#ef4444";   // red
    if (score >= 60) return "#f97316";   // orange
    if (score >= 40) return "#eab308";   // yellow
    if (score >= 20) return "#22c55e";   // green
    return "#06b6d4";                     // cyan
  }

  function badgeBg(score) {
    if (score >= 80) return "rgba(239,68,68,0.15)";
    if (score >= 60) return "rgba(249,115,22,0.15)";
    if (score >= 40) return "rgba(234,179,8,0.15)";
    return "rgba(34,197,94,0.15)";
  }

  // --- Add sidebar nav item ---
  function addNavItem(onClick) {
    var nav = document.querySelector("aside nav");
    if (!nav) return;
    var btn = document.createElement("button");
    btn.className = nav.children[0]?.className || "";
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
      '<span style="margin-left:12px">Bubble</span>';
    btn.style.cssText =
      "width:100%;display:flex;align-items:center;padding:8px 12px;border-radius:8px;" +
      "background:transparent;border:none;color:hsl(215,20%,65%);cursor:pointer;font-size:14px;text-align:left;";
    btn.addEventListener("click", function () {
      onClick();
      // highlight
      nav.querySelectorAll("button").forEach(function (b) {
        b.style.background = "transparent";
        b.style.color = "hsl(215,20%,65%)";
      });
      btn.style.background = "hsl(215,28%,17%)";
      btn.style.color = "hsl(213,31%,91%)";
    });
    // Insert before Scenarios (second to last)
    var scenariosBtn = nav.children[nav.children.length - 2];
    if (scenariosBtn) nav.insertBefore(btn, scenariosBtn);
    else nav.appendChild(btn);
    return btn;
  }

  // --- Render gauge arc ---
  function drawGauge(canvas, score) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var cx = w / 2, cy = h * 0.65;
    var r = Math.min(w, h) * 0.4;

    ctx.clearRect(0, 0, w, h);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = "hsl(222,47%,15%)";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score arc
    var angle = Math.PI + (score / 100) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, angle);
    ctx.strokeStyle = riskColor(score);
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score text
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 32px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(score.toFixed(1), cx, cy - 8);
    ctx.fillStyle = "hsl(215,20%,65%)";
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillText("/ 100", cx, cy + 12);
  }

  // --- Render historical chart ---
  function drawHistoryChart(canvas, currentScore) {
    var data = HISTORY.slice();
    data.push([2026, currentScore]);

    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var pad = { top: 30, right: 20, bottom: 40, left: 45 };
    var cw = w - pad.left - pad.right;
    var ch = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    var minYear = data[0][0], maxYear = data[data.length - 1][0];
    var yearRange = maxYear - minYear;

    function xPos(year) { return pad.left + ((year - minYear) / yearRange) * cw; }
    function yPos(val) { return pad.top + (1 - val / 100) * ch; }

    // Grid lines
    ctx.strokeStyle = "hsl(222,47%,12%)";
    ctx.lineWidth = 1;
    [0, 20, 40, 60, 80, 100].forEach(function (v) {
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos(v));
      ctx.lineTo(w - pad.right, yPos(v));
      ctx.stroke();

      ctx.fillStyle = "hsl(215,20%,55%)";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(v.toString(), pad.left - 6, yPos(v) + 3);
    });

    // Year labels
    ctx.textAlign = "center";
    ctx.fillStyle = "hsl(215,20%,55%)";
    for (var y = 1930; y <= 2030; y += 10) {
      if (y >= minYear && y <= maxYear) {
        ctx.fillText(y.toString(), xPos(y), h - pad.bottom + 18);
      }
    }

    // Bubble zones
    ctx.fillStyle = "rgba(239,68,68,0.08)";
    ctx.fillRect(pad.left, yPos(100), cw, yPos(60) - yPos(100));
    ctx.fillStyle = "rgba(249,115,22,0.06)";
    ctx.fillRect(pad.left, yPos(60), cw, yPos(40) - yPos(60));

    // Zone labels
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(239,68,68,0.5)";
    ctx.fillText("BUBBLE", pad.left + 4, yPos(95));
    ctx.fillStyle = "rgba(249,115,22,0.4)";
    ctx.fillText("FROTHY", pad.left + 4, yPos(55));

    // Area fill
    ctx.beginPath();
    ctx.moveTo(xPos(data[0][0]), yPos(0));
    data.forEach(function (d) { ctx.lineTo(xPos(d[0]), yPos(d[1])); });
    ctx.lineTo(xPos(data[data.length - 1][0]), yPos(0));
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    grad.addColorStop(0, "rgba(249,115,22,0.25)");
    grad.addColorStop(1, "rgba(249,115,22,0.02)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach(function (d, i) {
      if (i === 0) ctx.moveTo(xPos(d[0]), yPos(d[1]));
      else ctx.lineTo(xPos(d[0]), yPos(d[1]));
    });
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Peak markers
    [[1929, 100, "1929", -18],[2000, 100, "2000", -10],[2021, 73, "2021", -10]].forEach(function (m) {
      var px = xPos(m[0]), py = yPos(m[1]);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(m[2], px, py + m[3]);
    });

    // Current marker
    var cx2 = xPos(2026), cy2 = yPos(currentScore);
    ctx.beginPath();
    ctx.arc(cx2, cy2, 6, 0, 2 * Math.PI);
    ctx.fillStyle = riskColor(currentScore);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOW " + currentScore.toFixed(1), cx2, cy2 - 12);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Bubble Indicator — 100-Year History", pad.left, 18);
  }

  // --- Build section HTML ---
  function buildSection(b) {
    var composite = b.composite_score;
    var reading = b.composite_reading;
    var gauges = b.gauges || {};
    var hist = b.historical_comparisons || {};

    var gaugeNames = {
      prices_vs_traditional_measures: "Prices vs Traditional",
      unsustainable_conditions: "Unsustainable Conditions",
      new_buyer_entry: "New Buyer Entry",
      bullish_sentiment: "Bullish Sentiment",
      leverage_purchases: "Leverage Purchases",
      forward_purchases: "Forward Purchases"
    };

    var sec = document.createElement("section");
    sec.id = "bubble-section";
    sec.style.cssText = "display:none;padding:24px;";

    var html = "";

    // Header
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="' + riskColor(composite) + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';
    html += '<div><h2 style="margin:0;font-size:20px;font-weight:700;color:#e2e8f0">Dalio Bubble Indicator</h2>';
    html += '<p style="margin:2px 0 0;font-size:13px;color:hsl(215,20%,65%)">Ray Dalio-style 6-gauge composite framework</p></div>';
    html += '<span style="margin-left:auto;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:' + riskColor(composite) + ';background:' + badgeBg(composite) + '">' + (b.risk_level || reading) + '</span>';
    html += '</div>';

    // Gauge + bars row
    html += '<div style="display:grid;grid-template-columns:280px 1fr;gap:24px;margin-bottom:24px">';

    // Left: composite gauge
    html += '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px;text-align:center">';
    html += '<canvas id="bubble-gauge" width="260" height="160"></canvas>';
    html += '<div style="font-size:16px;font-weight:700;color:' + riskColor(composite) + ';margin-top:4px">' + reading + '</div>';
    html += '<div style="font-size:11px;color:hsl(215,20%,55%);margin-top:4px">vs 1929 peak: ' + hist["1929_peak"] + ' · 2000 peak: ' + hist["2000_dot_com_peak"] + '</div>';
    html += '</div>';

    // Right: 6 gauge bars
    html += '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#e2e8f0">6-Gauge Breakdown</h3>';

    Object.keys(gaugeNames).forEach(function (key) {
      var g = gauges[key] || {};
      var score = g.score || 0;
      var label = gaugeNames[key];
      html += '<div style="margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
      html += '<span style="color:hsl(215,20%,75%)">' + label + '</span>';
      html += '<span style="color:' + riskColor(score) + ';font-weight:600">' + score.toFixed(1) + ' — ' + (g.reading || "") + '</span>';
      html += '</div>';
      html += '<div style="height:8px;background:hsl(222,47%,12%);border-radius:4px;overflow:hidden">';
      html += '<div style="height:100%;width:' + Math.min(score, 100) + '%;background:' + riskColor(score) + ';border-radius:4px;transition:width 0.5s"></div>';
      html += '</div></div>';
    });
    html += '</div></div>';

    // Historical chart
    html += '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px;margin-bottom:24px">';
    html += '<canvas id="bubble-history" width="900" height="320"></canvas>';
    html += '</div>';

    // Interpretation
    html += '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px">';
    html += '<h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#e2e8f0">Interpretation</h3>';
    html += '<p style="margin:0;font-size:13px;color:hsl(215,20%,65%);line-height:1.6">' + (b.interpretation || "") + '</p>';
    html += '<p style="margin:8px 0 0;font-size:11px;color:hsl(215,20%,45%);font-style:italic">' + (b.source_note || "") + '</p>';
    html += '</div>';

    sec.innerHTML = html;
    return sec;
  }

  // --- Main ---
  function init() {
    waitForData(function (data) {
      var b = data.dalio_bubble_indicator;
      if (!b) return;

      var mainEl = document.querySelector("main");
      if (!mainEl) return;

      // Build section
      var section = buildSection(b);
      mainEl.appendChild(section);

      // Wire up nav
      var navBtn = addNavItem(function () {
        // Hide all existing sections, show ours
        mainEl.querySelectorAll("section").forEach(function (s) {
          s.style.display = "none";
        });
        section.style.display = "block";
        // Also hide the overview header cards
        var cards = mainEl.querySelectorAll(":scope > div");
        cards.forEach(function (d) {
          if (!d.querySelector("section") && d !== section) {
            d.dataset.prevDisplay = d.style.display;
            d.style.display = "none";
          }
        });
        // Draw canvases
        setTimeout(function () {
          var gaugeCanvas = document.getElementById("bubble-gauge");
          if (gaugeCanvas) drawGauge(gaugeCanvas, b.composite_score);
          var histCanvas = document.getElementById("bubble-history");
          if (histCanvas) drawHistoryChart(histCanvas, b.composite_score);
        }, 50);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 1000); });
  } else {
    setTimeout(init, 1000);
  }
})();
