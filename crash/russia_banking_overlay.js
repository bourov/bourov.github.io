/**
 * Russian Banking Sector Crash Risk Overlay
 *
 * Injects a "RU Banks" section into the crash dashboard.
 * Reads russian_banking_sector from crash_indicators_data.json and renders:
 *   1. A sidebar nav item
 *   2. 1-month / 3-month crash probability cards with key drivers
 *   3. Indicator stress bars
 *   4. Structural vs mitigating factors
 */
(function () {
  "use strict";

  function waitForData(cb) {
    fetch("crash_indicators_data.json")
      .then(function (r) { return r.json(); })
      .then(cb)
      .catch(function () { /* silently skip if no data */ });
  }

  // Color scale for monthly/quarterly crash probabilities (not 0-100 scores)
  function probColor(pct) {
    if (pct >= 15) return "#ef4444";   // red
    if (pct >= 8) return "#f97316";    // orange
    if (pct >= 4) return "#eab308";    // yellow
    return "#22c55e";                   // green
  }

  function stressColor(score) {
    if (score >= 75) return "#ef4444";
    if (score >= 50) return "#f97316";
    if (score >= 25) return "#eab308";
    return "#22c55e";
  }

  function riskBadge(level) {
    var colors = { High: "#ef4444", Elevated: "#f97316", Moderate: "#eab308", Low: "#22c55e" };
    var c = colors[level] || "#eab308";
    return '<span style="padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;color:' + c + ';background:' + c + '26">' + level + "</span>";
  }

  // --- Add sidebar nav item ---
  function addNavItem(onClick) {
    var nav = document.querySelector("aside nav");
    if (!nav) return;
    var btn = document.createElement("button");
    btn.className = nav.children[0]?.className || "";
    btn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>' +
      '<span style="margin-left:12px">RU Banks</span>';
    btn.style.cssText =
      "width:100%;display:flex;align-items:center;padding:8px 12px;border-radius:8px;" +
      "background:transparent;border:none;color:hsl(215,20%,65%);cursor:pointer;font-size:14px;text-align:left;";
    btn.addEventListener("click", function () {
      onClick();
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

  function probCard(label, p) {
    var pct = p.probability_pct;
    var html = '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px">';
    html += '<div style="font-size:13px;color:hsl(215,20%,65%);margin-bottom:8px">' + label + " Crash Probability</div>";
    html += '<div style="font-size:40px;font-weight:700;color:' + probColor(pct) + '">' + pct.toFixed(1) + "%</div>";
    html += '<div style="font-size:11px;color:hsl(215,20%,55%);margin:4px 0 12px">confidence ' + p.confidence + "/10</div>";
    html += '<div style="font-size:12px;color:hsl(215,20%,75%);line-height:1.5;margin-bottom:10px">' + p.interpretation + "</div>";
    if (p.key_drivers && p.key_drivers.length) {
      html += '<div style="font-size:11px;font-weight:600;color:#e2e8f0;margin-bottom:6px">KEY DRIVERS</div>';
      html += '<ul style="margin:0;padding-left:16px">';
      p.key_drivers.forEach(function (d) {
        html += '<li style="font-size:12px;color:hsl(215,20%,65%);margin-bottom:4px">' + d + "</li>";
      });
      html += "</ul>";
    }
    html += "</div>";
    return html;
  }

  function factorList(title, items, color) {
    var html = '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px">';
    html += '<h3 style="margin:0 0 12px;font-size:14px;font-weight:600;color:' + color + '">' + title + "</h3>";
    html += '<ul style="margin:0;padding-left:16px">';
    (items || []).forEach(function (f) {
      html += '<li style="font-size:12px;color:hsl(215,20%,65%);margin-bottom:8px;line-height:1.5">' + f + "</li>";
    });
    html += "</ul></div>";
    return html;
  }

  // --- Build section HTML ---
  function buildSection(rb) {
    var sec = document.createElement("section");
    sec.id = "ru-banking-section";
    sec.style.cssText = "display:none;padding:24px;";

    var html = "";

    // Header
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>';
    html += '<div><h2 style="margin:0;font-size:20px;font-weight:700;color:#e2e8f0">Russian Banking Sector</h2>';
    html += '<p style="margin:2px 0 0;font-size:13px;color:hsl(215,20%,65%)">Systemic crisis probability — rules-based model</p></div>';
    html += '<span style="margin-left:auto">' + riskBadge(rb.overall_risk_level) + "</span>";
    html += "</div>";

    // Definition
    html += '<p style="margin:0 0 24px;font-size:12px;color:hsl(215,20%,55%);font-style:italic">"Crash" here means: ' + rb.definition + "</p>";

    // Probability cards
    var cp = rb.crash_probability || {};
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">';
    if (cp["1_month"]) html += probCard("1-Month", cp["1_month"]);
    if (cp["3_month"]) html += probCard("3-Month", cp["3_month"]);
    html += "</div>";

    // Indicator stress bars
    html += '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px;margin-bottom:24px">';
    html += '<h3 style="margin:0 0 16px;font-size:14px;font-weight:600;color:#e2e8f0">Stress Indicators</h3>';
    var inds = rb.indicators || {};
    Object.keys(inds).forEach(function (key) {
      var ind = inds[key];
      var score = ind.stress_score || 0;
      html += '<div style="margin-bottom:14px">';
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
      html += '<span style="color:hsl(215,20%,75%)">' + ind.name + " — " + ind.current_value + (ind.unit || "") + "</span>";
      html += '<span style="color:' + stressColor(score) + ';font-weight:600">' + ind.risk_level + "</span>";
      html += "</div>";
      html += '<div style="height:8px;background:hsl(222,47%,12%);border-radius:4px;overflow:hidden">';
      html += '<div style="height:100%;width:' + Math.min(score, 100) + '%;background:' + stressColor(score) + ';border-radius:4px;transition:width 0.5s"></div>';
      html += "</div>";
      html += '<div style="font-size:11px;color:hsl(215,20%,55%);margin-top:4px;line-height:1.5">' + ind.interpretation + "</div>";
      html += "</div>";
    });
    html += "</div>";

    // Structural vs mitigating factors
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">';
    html += factorList("Structural Risk Factors", rb.structural_factors, "#f97316");
    html += factorList("Mitigating Factors", rb.mitigating_factors, "#22c55e");
    html += "</div>";

    // Methodology + caveat
    html += '<div style="background:hsl(222,47%,8%);border-radius:12px;padding:20px">';
    html += '<h3 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#e2e8f0">Methodology</h3>';
    html += '<p style="margin:0;font-size:13px;color:hsl(215,20%,65%);line-height:1.6">' + (cp.methodology || "") + "</p>";
    html += '<p style="margin:8px 0 0;font-size:11px;color:hsl(215,20%,45%);font-style:italic">' + (rb.data_caveat || "") + "</p>";
    html += "</div>";

    sec.innerHTML = html;
    return sec;
  }

  // --- Main ---
  function init() {
    waitForData(function (data) {
      var rb = data.russian_banking_sector;
      if (!rb) return;

      var mainEl = document.querySelector("main");
      if (!mainEl) return;

      var section = buildSection(rb);
      mainEl.appendChild(section);

      addNavItem(function () {
        mainEl.querySelectorAll("section").forEach(function (s) {
          s.style.display = "none";
        });
        section.style.display = "block";
        var cards = mainEl.querySelectorAll(":scope > div");
        cards.forEach(function (d) {
          if (!d.querySelector("section") && d !== section) {
            d.dataset.prevDisplay = d.style.display;
            d.style.display = "none";
          }
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 1000); });
  } else {
    setTimeout(init, 1000);
  }
})();
