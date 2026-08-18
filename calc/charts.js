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
  /* All three loop-resistance terms sum into the same path, so they share one
       chart plotted against total loop resistance. [IFX Eq. 57, TI Eq. 26] */
  function loopResistanceChart(note) {
    return {
      note: note,
      build: function (p) {
        var D = EQ.dutyCycle(p.vin, p.vout);
        var iLc = EQ.iLcRipple({
          k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
          Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
        });
        var iRms = EQ.iRmsLc(iLc);
        var Rtot = p.rLc + p.N * p.rSec + p.rRoute;
        var hi = Math.max(Rtot * 2.5, 6e-3);

        var a = sweep(0.2e-3, hi, 80, function (R) { return (p.Lc / R) * 1e6; });
        var b = sweep(0.2e-3, hi, 80, function (R) {
          return iRms * iRms * R + p.pCore;
        });
        return {
          x: {
            label: "Total loop resistance (m\u2126)", unit: "m\u2126",
            values: a.xs.map(function (v) { return v * 1e3; })
          },
          series: [
            { label: "Loop decay time", unit: "\u00B5s", values: a.ys, axis: "left" },
            { label: "Loop power loss", unit: "W", values: b.ys, axis: "right", dash: true }
          ],
          marker: { value: Rtot * 1e3, label: "current total" },
          leftLabel: "tau_Lc (\u00B5s)", rightLabel: "P_Lc (W)"
        };
      }
    };
  }

  var CHARTS = {
    coutgov: {
      note: "Three criteria, all of which must be met, so the highest line " +
        "governs. Watch where they cross: the two slope-based curves grow " +
        "with the square of step size while the controller-delay curve is " +
        "linear, so which one dominates depends on how large the step is. " +
        "The release curve sits far above the step-up curve because a load " +
        "release is driven only by N x V_OUT.",
      build: function (p) {
        var hi = Math.max(p.iStep * 2, 100);
        var su = EQ.slopeUpTlvr({
          nOn: p.nOn, N: p.N, vin: p.vin, vout: p.vout,
          Lm: p.Lm, Lc: p.Lc
        });
        var sd = EQ.slopeDownTlvr({ N: p.N, vout: p.vout, Lm: p.Lm, Lc: p.Lc });
        var a = sweep(1, hi, 80, function (i) {
          return EQ.coutRequired({ iStep: i, slope: su, dVac: p.dVac, rLL: p.rLL }) * 1e6;
        });
        var b = sweep(1, hi, 80, function (i) {
          return EQ.coutRequired({ iStep: i, slope: sd, dVac: p.dVac, rLL: p.rLL }) * 1e6;
        });
        var c = sweep(1, hi, 80, function (i) {
          return EQ.coutMinDelay({ tDelay: p.tDelay, iStep: i, dVout: p.dVac }) * 1e6;
        });
        return {
          x: { label: "Load step I_STEP (A)", unit: "A", values: a.xs },
          series: [
            { label: "Step up (TI Eq. 1)", unit: "\u00B5F", values: a.ys, axis: "left" },
            { label: "Release (TI Eq. 20 slope)", unit: "\u00B5F", values: b.ys, axis: "left" },
            { label: "Controller delay (IFX Eq. 32)", unit: "\u00B5F", values: c.ys, axis: "left", dash: true }
          ],
          marker: { value: p.iStep, label: "chosen" },
          limit: { value: NaN, label: "" },
          leftLabel: "Required C_OUT (\u00B5F)"
        };
      }
    },
    rlc: loopResistanceChart(
      "Lower resistance means lower loss but a longer decay time, so the two " +
      "curves oppose each other. Infineon warns that this decay is normally " +
      "far too slow to prevent overshoot on its own, and specifically advises " +
      "against non-linear control on load release: if the controller releases " +
      "tri-state before the loop current has decayed, excursions can compound " +
      "and destroy the power stage."),

    rsec: loopResistanceChart(
      "This term enters multiplied by phase count, since all N secondaries are " +
      "in series in the loop, so it usually dominates the total plotted here. " +
      "The primary winding is a different path and a different rule: it carries " +
      "the DC load current and Renesas puts it under 0.2 milliohm."),

    rroute: loopResistanceChart(
      "Routing is usually the easiest of the three terms to change. Infineon " +
      "recommends keeping the loop on the top layer with no vias and closing it " +
      "through second-layer ground, treating the whole loop as a noisy net " +
      "comparable to a switching node."),

    vin: {
      note: "Loop ripple and the peak L_C voltage both rise with V_IN, but not " +
        "smoothly: raising V_IN lowers the duty cycle, which shifts how many " +
        "phases overlap and produces the steps you see. The right axis is the " +
        "worst-case stress on the compensating inductor and its routing.",
      build: function (p) {
        var a = sweep(4.25, 16, 90, function (v) {
          return EQ.iLcRipple({
            k: p.k, N: p.N, D: EQ.dutyCycle(v, p.vout),
            vin: v, vout: p.vout, Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
          });
        });
        var b = sweep(4.25, 16, 90, function (v) {
          return EQ.vLcMax({ nOn: p.nOn, vin: v, N: p.N, vout: p.vout });
        });
        return {
          x: { label: "Input voltage V_IN (V)", unit: "V", values: a.xs },
          series: [
            { label: "L_C ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "Peak L_C voltage", unit: "V", values: b.ys, axis: "right", dash: true }
          ],
          marker: { value: p.vin, label: "chosen" },
          leftLabel: "Ripple (A)", rightLabel: "Peak V_LC (V)"
        };
      }
    },

    vout: {
      note: "The cusps are real, not artefacts. Wherever N x D reaches a whole " +
        "number the phases overlap perfectly and the loop ripple falls to " +
        "zero. Your rail sits between cusps, so it does not benefit from that " +
        "cancellation, and V_OUT is fixed by the load in any case. Read this " +
        "as diagnosis rather than as something to tune.",
      build: function (p) {
        var hi = Math.max(p.vout * 4, p.vin * 0.4);
        var a = sweep(0.2, hi, 160, function (v) {
          return EQ.iLcRipple({
            k: p.k, N: p.N, D: EQ.dutyCycle(p.vin, v),
            vin: p.vin, vout: v, Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
          });
        });
        var b = sweep(0.2, hi, 160, function (v) {
          var D = EQ.dutyCycle(p.vin, v);
          var iLc = EQ.iLcRipple({
            k: p.k, N: p.N, D: D, vin: p.vin, vout: v,
            Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
          });
          var iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: D });
          return EQ.iOutRipple({ k: p.k, N: p.N, D: D, fsw: p.fsw, iLc: iLc, iMag: iMag });
        });
        return {
          x: { label: "Output voltage V_OUT (V)", unit: "V", values: a.xs },
          series: [
            { label: "L_C ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "Summed output ripple", unit: "A", values: b.ys, axis: "left", dash: true }
          ],
          marker: { value: p.vout, label: "chosen" },
          leftLabel: "Ripple (A)"
        };
      }
    },

    nph: {
      note: "The slew advantage on the right axis climbs steadily with phase " +
        "count, which is the case for going wide. The ripple on the left is " +
        "cusped, because phase count and duty cycle interact through N x D. " +
        "TI reserves this topology for designs above six phases, marked in " +
        "red, since the un-cancelled loop contribution grows as N falls.",
      build: function (p) {
        var xs = [], rip = [], gain = [], n, D, iLc, iMag;
        for (n = 2; n <= 16; n++) {
          D = EQ.dutyCycle(p.vin, p.vout);
          iLc = EQ.iLcRipple({
            k: p.k, N: n, D: D, vin: p.vin, vout: p.vout,
            Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
          });
          iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: D });
          xs.push(n);
          rip.push(EQ.iOutRipple({ k: p.k, N: n, D: D, fsw: p.fsw, iLc: iLc, iMag: iMag }));
          gain.push(EQ.slewGainVsBuck({ Lm: p.Lm, Lc: p.Lc, N: n }));
        }
        return {
          x: { label: "Phase count N_TOTAL", unit: "phases", values: xs },
          series: [
            { label: "Summed output ripple", unit: "A", values: rip, axis: "left" },
            { label: "Slew gain vs buck", unit: "x", values: gain, axis: "right", dash: true }
          ],
          marker: { value: p.N, label: "chosen" },
          limit: { value: 6, label: "TI guidance" },
          leftLabel: "Ripple (A)", rightLabel: "Slew gain (x)"
        };
      }
    },

    itdc: {
      note: "Ripple is independent of load, so these lines are straight and the " +
        "gap between DC and peak stays constant. The red line is the device " +
        "absolute maximum average current times phase count, not a usable " +
        "continuous rating. Real headroom comes from the datasheet thermal " +
        "derating curve at your ambient and airflow.",
      build: function (p) {
        var hi = Math.max(p.iTdc * 2, p.N * 90 * 1.15);
        var D = EQ.dutyCycle(p.vin, p.vout);
        var iLc = EQ.iLcRipple({
          k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
          Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
        });
        var iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: D });
        var iPh = EQ.iPhaseRipple(iMag, p.k, iLc);

        var a = sweep(0, hi, 80, function (i) { return i / p.N; });
        var b = sweep(0, hi, 80, function (i) {
          return EQ.iSatTlvr({ iOutMax: i, N: p.N, dIph: iPh });
        });
        var c = sweep(0, hi, 80, function (i) {
          var dc = i / p.N;
          return dc > 0 ? EQ.iRmsLowSide({ iPhDC: dc, D: D, dIph: iPh }) : 0;
        });
        return {
          x: { label: "Thermal design current I_TDC (A)", unit: "A", values: a.xs },
          series: [
            { label: "Per-phase DC", unit: "A", values: a.ys, axis: "left" },
            { label: "Transformer I_sat needed", unit: "A", values: b.ys, axis: "left" },
            { label: "Low-side FET RMS", unit: "A", values: c.ys, axis: "left", dash: true }
          ],
          marker: { value: p.iTdc, label: "chosen" },
          limit: { value: p.N * 90, label: "device abs max" },
          leftLabel: "Current (A)"
        };
      }
    },

    k: {
      note: "Tighter coupling lowers the effective loop inductance L_CT, which " +
        "speeds the transient response but raises loop ripple. Coupling is " +
        "therefore not simply better when tighter, it slides the same " +
        "trade-off that L_C does. Results are sensitive across this range, so " +
        "take k from the transformer datasheet or measure it.",
      build: function (p) {
        var D = EQ.dutyCycle(p.vin, p.vout);
        var a = sweep(0.85, 0.999, 90, function (kk) {
          return EQ.iLcRipple({
            k: kk, N: p.N, D: D, vin: p.vin, vout: p.vout,
            Lc: p.Lc, Lm: p.Lm, fsw: p.fsw
          });
        });
        var b = sweep(0.85, 0.999, 90, function (kk) {
          return EQ.lct({ k: kk, N: p.N, Lm: p.Lm, Lc: p.Lc }) * 1e9;
        });
        return {
          x: { label: "Coupling coefficient k", unit: "", values: a.xs },
          series: [
            { label: "L_C ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "Effective loop L_CT", unit: "nH", values: b.ys, axis: "right", dash: true }
          ],
          marker: { value: p.k, label: "chosen" },
          leftLabel: "Ripple (A)", rightLabel: "L_CT (nH)"
        };
      }
    },

    lm: {
      note: "Phase ripple falls as L_M rises, which is the buck-converter part " +
        "of the picture. The right axis shows the opposing effect specific " +
        "to TLVR: leakage scales with L_M, so a larger magnetizing " +
        "inductance also raises the effective loop inductance L_CT and " +
        "slows the loop. Choose L_M for steady-state ripple first, then " +
        "solve for L_C.",
      build: function (p) {
                var lo = 40e-9, hi = Math.max(p.LmRaw * 3, 400e-9);
        var D = EQ.dutyCycle(p.vin, p.vout);
        var a = sweep(lo, hi, 80, function (Lm) {
          var iMag = EQ.iMagRipple({ vin: p.vin, Lm: Lm, fsw: p.fsw, D: D });
          var iLc = EQ.iLcRipple({
            k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
            Lc: p.Lc, Lm: Lm, fsw: p.fsw
          });
          return EQ.iPhaseRipple(iMag, p.k, iLc);
        });
        var b = sweep(lo, hi, 80, function (Lm) {
          return EQ.lct({ k: p.k, N: p.N, Lm: Lm, Lc: p.Lc }) * 1e9;
        });
        return {
          x: {
            label: "Magnetizing inductance L_M (nH)", unit: "nH",
            values: a.xs.map(function (v) { return v * 1e9; })
          },
          series: [
            { label: "Total phase ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "Effective loop L_CT", unit: "nH", values: b.ys, axis: "right", dash: true }
          ],
                    marker: { value: p.LmRaw * 1e9, label: "chosen" },
          leftLabel: "Ripple (A)", rightLabel: "L_CT (nH)"
        };
      }
    },

    lc: {
      note: "Both curves move against each other, which is the whole L_C " +
        "trade-off. Lower L_C ramps current faster and cuts the " +
        "capacitance you need, but drives loop ripple and RMS loss up. " +
        "The red line is the ceiling from the slew requirement — any " +
        "L_C to the right of it cannot track the load step at all.",
      build: function (p) {
                var lo = 40e-9, hi = Math.max(p.LcRaw * 3, 400e-9);
        var D = EQ.dutyCycle(p.vin, p.vout);
        var iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: D });

        var a = sweep(lo, hi, 80, function (Lc) {
          return EQ.iLcRipple({
            k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
            Lc: Lc, Lm: p.Lm, fsw: p.fsw
          });
        });
        var b = sweep(lo, hi, 80, function (Lc) {
          var s = EQ.slopeUpTlvr({
            nOn: p.nOn, N: p.N, vin: p.vin,
            vout: p.vout, Lm: p.Lm, Lc: Lc
          });
          return EQ.coutRequired({
            iStep: p.iStep, slope: s,
            dVac: p.dVac, rLL: p.rLL
          }) * 1e6;
        });
        var lcMax = EQ.lcMaxFromSlew({
          k: p.k, N: p.N, iStep: p.iStep,
          tStep: p.tStep, dRamp: p.dRamp,
          vin: p.vin, vout: p.vout, Lm: p.Lm
        });

        return {
          x: {
            label: "Compensating inductance L_C (nH)", unit: "nH",
            values: a.xs.map(function (v) { return v * 1e9; })
          },
          series: [
            { label: "L_C ripple", unit: "A", values: a.ys, axis: "left" },
            { label: "C_OUT needed", unit: "\u00B5F", values: b.ys, axis: "right", dash: true }
          ],
                    marker: { value: p.LcRaw * 1e9, label: "chosen" },
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
          return EQ.iLcRipple({
            k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
            Lc: p.Lc, Lm: p.Lm, fsw: f
          });
        });
        var b = sweep(lo, hi, 80, function (f) {
          return EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: f, D: D });
        });
        var c = sweep(lo, hi, 80, function (f) { return (p.N * f) / 1e6; });

        return {
          x: {
            label: "Switching frequency per phase (kHz)", unit: "kHz",
            values: a.xs.map(function (v) { return v / 1e3; })
          },
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

    var paras = t.long || [t.d];
    paras.forEach(function (txt, i) {
      var p = document.createElement("p");
      p.className = i === 0 ? "lead" : "para";
      p.textContent = txt;
      body.appendChild(p);
    });

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

  /* Render a chart inline into an arbitrary container, for the live panels.
     Safe to call on every input change — it rebuilds from current inputs. */
  function renderInto(term, container) {
    var c = CHARTS[term];
    container.innerHTML = "";
    if (!c) return false;
    var spec = c.build(window.TLVR.readInputs());
    var wrap = document.createElement("div");
    wrap.className = "chart-wrap";
    wrap.appendChild(draw(spec));
    container.appendChild(wrap);
    container.appendChild(legend(spec));
    return true;
  }

  window.TLVRDetail = {
    open: open,
    has: function (t) { return !!CHARTS[t]; },
    renderInto: renderInto,
    terms: function () { return Object.keys(CHARTS); }
  };
})();
