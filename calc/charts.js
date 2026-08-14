/* ===========================================================================
   charts.js — the "Learn more" detail panel: extended explanation, live
   formula, and an interactive SVG chart plotting the current design.

   Hand-rolled SVG. No charting library, because the tool must run offline
   from file:// with no CDN.

   Colour discipline follows the brand guide: Signal blue carries the data
   series (it is information), neutrals carry structure and the "you are here"
   marker, and Fault red marks a limit beyond which the design fails.
   Green is never used here — it means ready/pass only.
   =========================================================================== */

(function () {
  "use strict";

  var W = 640, H = 300;
  var M = { t: 18, r: 62, b: 44, l: 62 };

  /* ---------- small helpers ---------- */
  function el(tag, attrs, text) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var a in attrs) n.setAttribute(a, attrs[a]);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function nice(v) {
    var a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 1000) return v.toFixed(0);
    if (a >= 100) return v.toFixed(0);
    if (a >= 10) return v.toFixed(1);
    if (a >= 1) return v.toFixed(2);
    if (a >= 0.01) return v.toFixed(3);
    return v.toExponential(1);
  }
  function extent(arr) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (lo === hi) { hi = lo + 1; }
    return [lo, hi];
  }

  /* ---------- the renderer ----------
     spec = {
       x:      { label, values[] },
       series: [ { label, values[], axis:'left'|'right', dash:bool } ],
       marker: { value, label },        // vertical "you are here" line
       limit:  { value, label },        // optional vertical limit line
       leftLabel, rightLabel
     }                                                                    */
  function draw(spec) {
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H,
      class: "chart",
      role: "img",
      "aria-label": spec.x.label + " sweep"
    });

    var pw = W - M.l - M.r, ph = H - M.t - M.b;
    var xe = extent(spec.x.values);

    var left = [], right = [];
    spec.series.forEach(function (s) {
      (s.axis === "right" ? right : left).push.apply(
        s.axis === "right" ? right : left, s.values);
    });
    var le = extent(left), re = extent(right);
    le[0] = Math.min(0, le[0]); re[0] = Math.min(0, re[0]);

    var X = function (v) { return M.l + ((v - xe[0]) / (xe[1] - xe[0])) * pw; };
    var YL = function (v) { return M.t + ph - ((v - le[0]) / (le[1] - le[0])) * ph; };
    var YR = function (v) { return M.t + ph - ((v - re[0]) / (re[1] - re[0])) * ph; };

    /* gridlines + axis ticks */
    var i, gx, gy;
    for (i = 0; i <= 4; i++) {
      gy = M.t + (ph / 4) * i;
      svg.appendChild(el("line", {
        x1: M.l, y1: gy, x2: M.l + pw, y2: gy, class: "grid"
      }));
      svg.appendChild(el("text", {
        x: M.l - 8, y: gy + 4, class: "tick tick-l"
      }, nice(le[1] - ((le[1] - le[0]) / 4) * i)));
      if (right.length) {
        svg.appendChild(el("text", {
          x: M.l + pw + 8, y: gy + 4, class: "tick tick-r"
        }, nice(re[1] - ((re[1] - re[0]) / 4) * i)));
      }
    }
    for (i = 0; i <= 5; i++) {
      gx = M.l + (pw / 5) * i;
      svg.appendChild(el("text", {
        x: gx, y: M.t + ph + 18, class: "tick tick-x"
      }, nice(xe[0] + ((xe[1] - xe[0]) / 5) * i)));
    }

    /* axis titles */
    svg.appendChild(el("text", {
      x: M.l + pw / 2, y: H - 6, class: "axis-title"
    }, spec.x.label));
    if (spec.leftLabel) {
      svg.appendChild(el("text", {
        x: 12, y: M.t + ph / 2, class: "axis-title",
        transform: "rotate(-90 12 " + (M.t + ph / 2) + ")"
      }, spec.leftLabel));
    }
    if (spec.rightLabel) {
      svg.appendChild(el("text", {
        x: W - 12, y: M.t + ph / 2, class: "axis-title",
        transform: "rotate(90 " + (W - 12) + " " + (M.t + ph / 2) + ")"
      }, spec.rightLabel));
    }

    /* limit line — red, because past it the design fails */
    if (spec.limit && isFinite(spec.limit.value) &&
        spec.limit.value >= xe[0] && spec.limit.value <= xe[1]) {
      svg.appendChild(el("line", {
        x1: X(spec.limit.value), y1: M.t,
        x2: X(spec.limit.value), y2: M.t + ph, class: "limit"
      }));
      svg.appendChild(el("text", {
        x: X(spec.limit.value) - 5, y: M.t + 12, class: "limit-lbl"
      }, spec.limit.label));
    }

    /* marker — where the design currently sits */
    if (spec.marker && isFinite(spec.marker.value)) {
      svg.appendChild(el("line", {
        x1: X(spec.marker.value), y1: M.t,
        x2: X(spec.marker.value), y2: M.t + ph, class: "marker"
      }));
      svg.appendChild(el("text", {
        x: X(spec.marker.value) + 5, y: M.t + 12, class: "marker-lbl"
      }, spec.marker.label));
    }

    /* series */
    spec.series.forEach(function (s) {
      var Y = s.axis === "right" ? YR : YL;
      var d = "";
      for (var j = 0; j < s.values.length; j++) {
        if (!isFinite(s.values[j])) continue;
        d += (d ? "L" : "M") + X(spec.x.values[j]).toFixed(1) + " " +
             Y(s.values[j]).toFixed(1) + " ";
      }
      svg.appendChild(el("path", {
        d: d, class: "series" + (s.dash ? " dashed" : "")
      }));
    });

    /* crosshair readout */
    var cross = el("line", { class: "cross", x1: 0, y1: M.t, x2: 0, y2: M.t + ph });
    cross.style.display = "none";
    svg.appendChild(cross);
    var read = el("text", { class: "readout", x: 0, y: M.t + ph - 6 });
    svg.appendChild(read);

    svg.addEventListener("mousemove", function (ev) {
      var r = svg.getBoundingClientRect();
      var px = ((ev.clientX - r.left) / r.width) * W;
      if (px < M.l || px > M.l + pw) { cross.style.display = "none"; read.textContent = ""; return; }
      var xv = xe[0] + ((px - M.l) / pw) * (xe[1] - xe[0]);
      var k = Math.round(((xv - xe[0]) / (xe[1] - xe[0])) * (spec.x.values.length - 1));
      cross.style.display = "";
      cross.setAttribute("x1", X(spec.x.values[k]));
      cross.setAttribute("x2", X(spec.x.values[k]));
      var parts = [nice(spec.x.values[k]) + " " + spec.x.unit];
      spec.series.forEach(function (s) {
        parts.push(s.label + " " + nice(s.values[k]) + " " + s.unit);
      });
      read.textContent = parts.join("   ");
      read.setAttribute("x", px < M.l + pw / 2 ? M.l + 6 : M.l + 6);
    });
    svg.addEventListener("mouseleave", function () {
      cross.style.display = "none"; read.textContent = "";
    });

    return svg;
  }

  function legend(spec) {
    var d = document.createElement("div");
    d.className = "chart-legend";
    spec.series.forEach(function (s) {
      var i = document.createElement("span");
      i.className = "lg" + (s.dash ? " dash" : "");
      i.textContent = s.label + " (" + s.unit + ", " +
                      (s.axis === "right" ? "right" : "left") + ")";
      d.appendChild(i);
    });
    return d;
  }

  /* ---------- sweep helper ---------- */
  function sweep(lo, hi, n, fn) {
    var xs = [], ys = [], i, v;
    for (i = 0; i <= n; i++) {
      v = lo + ((hi - lo) / n) * i;
      xs.push(v); ys.push(fn(v));
    }
    return { xs: xs, ys: ys };
  }

  /* ===========================================================================
     Chart registry. Keyed by the same term ids used in terms.js.
     Each entry: { note, build(p) -> spec }   where p is the SI input set.
     Terms absent from this registry simply get no chart — the detail panel
     shows the extended text and formula only. Never a placeholder.
     =========================================================================== */
  var CHARTS = {

    lc: {
      note: "Both curves move against each other, which is the whole L_C " +
            "trade-off. Lower L_C ramps current faster and cuts the " +
            "capacitance you need, but drives loop ripple and RMS loss up. " +
            "The red line is the ceiling from the slew requirement — any " +
            "L_C to the right of it cannot track the load step at all.",
      build: function (p) {
        var lo = 40e-9, hi = Math.max(p.Lc * 3, 400e-9);
        var D = EQ.dutyCycle(p.vin, p.vout);
        var iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: D });

        var a = sweep(lo, hi, 80, function (Lc) {
          return EQ.iLcRipple({ k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
                                Lc: Lc, Lm: p.Lm, fsw: p.fsw });
        });
        var b = sweep(lo, hi, 80, function (Lc) {
          var s = EQ.slopeUpTlvr({ nOn: p.nOn, N: p.N, vin: p.vin,
                                   vout: p.vout, Lm: p.Lm, Lc: Lc });
          return EQ.coutRequired({ iStep: p.iStep, slope: s,
                                   dVac: p.dVac, rLL: p.rLL }) * 1e6;
        });
        var lcMax = EQ.lcMaxFromSlew({ k: p.k, N: p.N, iStep: p.iStep,
                                       tStep: p.tStep, dRamp: p.dRamp,
                                       vin: p.vin, vout: p.vout, Lm: p.Lm });

        return {
          x: { label: "Compensating inductance L_C (nH)", unit: "nH",
               values: a.xs.map(function (v) { return v * 1e9; }) },
          series: [
            { label: "L_C ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "C_OUT needed", unit: "\u00B5F", values: b.ys, axis: "right", dash: true }
          ],
          marker: { value: p.Lc * 1e9, label: "chosen" },
          limit: { value: lcMax * 1e9, label: "slew limit" },
          leftLabel: "Ripple (A)",
          rightLabel: "C_OUT (\u00B5F)",
          _iMag: iMag
        };
      }
    },

    fsw: {
      note: "Raising the switching frequency shrinks every ripple term, which " +
            "is why it looks like a free win on this plot. It is not: the " +
            "compensating inductor is excited at N x f_SW, shown on the right " +
            "axis, and ferrite core loss climbs steeply with frequency. Read " +
            "this chart alongside your L_C vendor's core-loss curve at that " +
            "right-hand value, not on its own.",
      build: function (p) {
        var lo = 200e3, hi = 1600e3;
        var D = EQ.dutyCycle(p.vin, p.vout);

        var a = sweep(lo, hi, 80, function (f) {
          return EQ.iLcRipple({ k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
                                Lc: p.Lc, Lm: p.Lm, fsw: f });
        });
        var b = sweep(lo, hi, 80, function (f) {
          return EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: f, D: D });
        });
        var c = sweep(lo, hi, 80, function (f) { return (p.N * f) / 1e6; });

        return {
          x: { label: "Switching frequency per phase (kHz)", unit: "kHz",
               values: a.xs.map(function (v) { return v / 1e3; }) },
          series: [
            { label: "L_C ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "Magnetizing ripple", unit: "A", values: b.ys, axis: "left", dash: true },
            { label: "L_C excitation", unit: "MHz", values: c.ys, axis: "right" }
          ],
          marker: { value: p.fsw / 1e3, label: "chosen" },
          leftLabel: "Ripple (A)",
          rightLabel: "f_HF (MHz)"
        };
      }
    }
  };

  /* ===========================================================================
     Detail panel
     =========================================================================== */
  var overlay, panel, lastFocus;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pnl-h">' +
        '<header><h3 id="pnl-h"></h3>' +
        '<button class="close" type="button" aria-label="Close">\u00D7</button></header>' +
        '<div class="panel-body"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    panel = overlay.querySelector(".panel");

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "Tab") trap(e);
    });
  }

  function trap(e) {
    var f = panel.querySelectorAll("button, [href], input, select, [tabindex]");
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open(term) {
    var t = TERMS[term];
    if (!t) return;
    lastFocus = document.activeElement;

    panel.querySelector("h3").textContent = t.t;
    var body = panel.querySelector(".panel-body");
    body.innerHTML = "";

    var p = document.createElement("p");
    p.className = "lead";
    p.textContent = t.d;
    body.appendChild(p);

    var c = CHARTS[term];
    if (c) {
      var spec = c.build(window.TLVR.readInputs());
      var wrap = document.createElement("div");
      wrap.className = "chart-wrap";
      wrap.appendChild(draw(spec));
      body.appendChild(wrap);
      body.appendChild(legend(spec));
      var n = document.createElement("p");
      n.className = "chart-note";
      n.textContent = c.note;
      body.appendChild(n);
    }

    var s = document.createElement("p");
    s.className = "panel-src";
    s.textContent = "Source: " + t.src;
    body.appendChild(s);

    overlay.hidden = false;
    panel.querySelector(".close").focus();
  }

  function close() {
    overlay.hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  build();

  window.TLVRDetail = { open: open, has: function (t) { return !!CHARTS[t]; } };
})();
