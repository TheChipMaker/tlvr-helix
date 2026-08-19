/* simple.js — "Simple" mode: component selection only.
 *
 * DESIGN RULE: this view shows ONLY quantities that trace to a validated
 * equation. Anything the readme flags as unreliable is deliberately absent —
 * controller-response I_SAT (tresp default is ~10x wrong), per-phase L_trans
 * at M>1, and the slew-derived L_C ceiling. If you add a row here, it must
 * come with a source and a validation note.
 *
 * N_ON is not an input in this mode. It is forced to N (all channels firing),
 * which is the worst case and the only value that cannot be mis-entered.
 *
 * Shares the input elements with advanced mode, so Save/Open/Export all keep
 * working and the two views can never disagree.
 */
(function () {
  "use strict";

  var MAG_SHARE = 0.7;   // fraction of the per-stage ripple budget given to L_M
  var DIR = "fwd";       // "fwd" = check what is typed, "rev" = size the magnetics

  function $(id) { return document.getElementById(id); }
  function num(v, d) {
    return (typeof v === "number" && isFinite(v)) ? v.toFixed(d === undefined ? 1 : d) : "\u2014";
  }

  /* ---- forward: given magnetics + planned C_OUT, does it pass? ---------- */
  function forward(p) {
    var D = EQ.dutyCycle(p.vin, p.vout);
    var iMagPair = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: D });
    var iLc = EQ.iLcRipple({
      k: p.k, N: p.N, D: D, vin: p.vin, vout: p.vout,
      Lc: p.Lc, Lm: p.Lm, M: p.M, fsw: p.fsw
    });
    var st = EQ.stageSplit({ iPhDC: p.iTdc / p.N, iMagPair: iMagPair, iLc: iLc, k: p.k, M: p.M });
    var peak = st.iDC + st.iPh / 2;

    var iOut = EQ.iOutRipple({ k: p.k, N: p.N, D: D, fsw: p.fsw, iLc: iLc, iMag: iMagPair });
    var vRip = EQ.vOutRipple({ iOut: iOut, N: p.N, fsw: p.fsw, Cout: p.Cout });

    var nOn = p.N;                                   // worst case, all channels
    var slUp = EQ.slopeUpTlvr({
      nOn: nOn, N: p.N, vin: p.vin, vout: p.vout,
      Lm: p.Lm, Lc: p.Lc, k: p.k, M: p.M
    });
    var slDn = EQ.slopeDownTlvr({
      N: p.N, vout: p.vout, Lm: p.Lm, Lc: p.Lc, k: p.k, M: p.M
    });
    var cUp = EQ.coutRequired({ iStep: p.iStep, slope: slUp, dVac: p.dVac, rLL: p.rLL });
    var cDn = EQ.coutRequired({ iStep: p.iStep, slope: slDn, dVac: p.dVac, rLL: p.rLL });
    var cDly = EQ.coutMinDelay({ tDelay: p.tDelay, iStep: p.iStep, dVac: p.dVac, rLL: p.rLL });
    var cNeed = Math.max(cUp, cDn, cDly);
    var gov = (cNeed === cDly) ? "controller delay"
      : (cNeed === cDn) ? "load release" : "load step-up";

    // Physical units: every secondary is in series, each channel drives M stages.
    var vLc = EQ.vLcMax({ nOn: nOn * p.M, vin: p.vin, N: p.nPhys, vout: p.vout });

    return {
      D: D, iMagPair: iMagPair, iLc: iLc, st: st, peak: peak,
      iSatNeed: peak, vRip: vRip, slUp: slUp, slDn: slDn,
      cNeed: cNeed, gov: gov, vLc: vLc
    };
  }

  /* ---- reverse: given the load and the part ratings, what do I buy? ----
     Two independent ceilings on per-stage ripple:
       a) saturation headroom   dI <= 2*(I_sat - I_rated)      [IFX Eq. 18]
       b) rated-current headroom dI <= 2*(I_rated - I_DC)
     (b) is usually the binding one and is what catches an over-loaded stage.
     The budget is then split MAG_SHARE / (1-MAG_SHARE) between L_M and L_C.
     The split is a convention, not physics — it is stated in the UI.        */
  function reverse(p, f) {
    var D = f.D, out = { D: D };
    var iDC = p.iTdc / p.nPhys;

    var budSat = 2 * (p.mIsat - p.mIrated);
    var budRated = 2 * (p.mIrated - iDC);
    out.iDC = iDC;
    out.budSat = budSat;
    out.budRated = budRated;
    out.bud = Math.min(budSat, budRated);
    out.budBy = (budRated < budSat) ? "rated current" : "saturation";

    if (out.bud > 0) {
      // L_M so the magnetizing share lands on target. iMagRipple returns the
      // PAIR ripple, so the per-stage target is scaled by M before inverting.
      var magStage = MAG_SHARE * out.bud;
      out.LmReq = (p.vin * (1 - D) * D) / (magStage * p.M * p.fsw);   // model
      out.LmTyped = out.LmReq * p.M;

      // L_C so the coupled share lands on target, via L_CT then back out.
      var lcStage = (1 - MAG_SHARE) * out.bud / p.k;
      var nMax = EQ.nSimOnMax(p.N, D);
      var dhf = EQ.dHF(p.N, D), fhf = EQ.fHF(p.N, p.fsw);
      var lctReq = (p.k * (nMax * p.vin - p.N * p.vout) * dhf) / (lcStage * fhf);
      var leak = (1 - p.k * p.k) * out.LmReq * p.M * p.N;
      out.lctReq = lctReq;
      out.leak = leak;
      out.LcReq = lctReq - leak;                                       // model

      // The series leakage of all physical secondaries can on its own exceed
      // the loop inductance the ripple target needs — readme section 7 flags
      // this as a real high-phase-count outcome. The back-out then goes
      // negative. Report zero and say why, rather than printing a negative
      // inductance as a part to buy.
      out.lcFromLeakage = !(out.LcReq > 0);
      if (out.lcFromLeakage) out.LcReq = 0;
      out.LcTyped = out.LcReq * p.M;
    }

    // C_OUT at the recommended magnetics, if they exist; else at the current ones.
    var uLm = (out.LmReq > 0) ? out.LmReq : p.Lm;
    var uLc = (out.LcReq >= 0 && isFinite(out.LcReq)) ? out.LcReq : p.Lc;
    var sUp = EQ.slopeUpTlvr({
      nOn: p.N, N: p.N, vin: p.vin, vout: p.vout, Lm: uLm, Lc: uLc, k: p.k, M: p.M
    });
    var sDn = EQ.slopeDownTlvr({
      N: p.N, vout: p.vout, Lm: uLm, Lc: uLc, k: p.k, M: p.M
    });
    out.CoutReq = Math.max(
      EQ.coutRequired({ iStep: p.iStep, slope: sUp, dVac: p.dVac, rLL: p.rLL }),
      EQ.coutRequired({ iStep: p.iStep, slope: sDn, dVac: p.dVac, rLL: p.rLL }),
      EQ.coutMinDelay({ tDelay: p.tDelay, iStep: p.iStep, dVac: p.dVac, rLL: p.rLL })
    );

    // Cheapest lever when C_OUT is short: the load line that closes the gap.
    // From TI Eq. 1: dVac + Rll*Istep >= 0.5*Istep^2/Slope/Cout_planned
    var slowest = Math.min(Math.abs(f.slUp), Math.abs(f.slDn));
    var dvNeeded = (0.5 * p.iStep * p.iStep) / slowest / p.Cout;
    out.rLLmin = (dvNeeded - p.dVac) / p.iStep;

    out.vLcRating = f.vLc;
    return out;
  }

  /* ---- render ---------------------------------------------------------- */
  function row(label, value, unit, state, note) {
    var cls = state ? " s-" + state : "";
    return '<div class="srow' + cls + '">' +
      '<span class="sk">' + label + "</span>" +
      '<span class="sv">' + value + '<em>' + (unit || "") + "</em></span>" +
      (note ? '<span class="sn">' + note + "</span>" : "") +
      "</div>";
  }

  function render() {
    var p = window.TLVR.readInputs();

    // Same gate advanced mode uses. Without it a zero or inverted input
    // produces NaN, num() renders it as an em dash, and every pass/fail chip
    // reads as a failure — a broken input looks like a failed design.
    var errs = window.TLVR.validate ? window.TLVR.validate(p) : [];
    if (errs.length) {
      var m = '<div class="rows-error"><strong>Cannot compute this design.' +
        "</strong><ul>";
      for (var i = 0; i < errs.length; i++) m += "<li>" + errs[i] + "</li>";
      $("s-check").innerHTML = m + "</ul></div>";
      $("s-check").hidden = false;
      $("s-buy").hidden = true;
      $("s-buy").innerHTML = "";
      return;
    }

    var f = forward(p);
    var r = reverse(p, f);
    var h;

    /* --- left: does what I have pass? --- */
    h = "<h3>Check what you have</h3>";
    h += row("Duty cycle", num(f.D, 4), "", null, "");
    h += row("Per-stage peak", num(f.peak), "A",
      f.peak > p.mIrated ? "fail" : "pass",
      "rated " + num(p.mIrated, 0) + " A");
    h += row("Transformer I_sat needed", num(f.iSatNeed), "A",
      f.iSatNeed > p.mIsat ? "fail" : "pass",
      "device " + num(p.mIsat, 0) + " A");
    h += row("Output ripple", num(f.vRip * 1e3, 2), "mV", null, "");
    h += row("C_OUT required", num(f.cNeed * 1e6, 0), "\u00B5F",
      f.cNeed > p.Cout ? "fail" : "pass",
      "planned " + num(p.Cout * 1e6, 0) + " \u00B5F \u2014 set by " + f.gov);
    h += row("L_C voltage rating", num(f.vLc), "V", "info",
      "spec the part and the loop routing for this");
    $("s-check").innerHTML = h;
    $("s-check").hidden = (DIR !== "fwd");
    $("s-buy").hidden = (DIR !== "rev");
    if (DIR !== "rev") { $("s-buy").innerHTML = ""; return; }

    /* --- right: what should I buy? --- */
    h = "<h3>Sized for you</h3>";
    h += '<p class="snote">L_M and L_C are <em>outputs</em> here, so those two ' +
      'fields are disabled. These are the smallest values that keep per-stage ' +
      'peak under the rated current \u2014 nothing more. The ' +
      (MAG_SHARE * 100) + "/" + (100 - MAG_SHARE * 100) +
      " split between them is a convention, not physics; you can trade one " +
      "against the other.</p>";
    if (!(r.bud > 0)) {
      h += '<p class="sbad">No ripple budget left. The DC pedestal alone is ' +
        num(r.iDC) + " A against a " + num(p.mIrated, 0) +
        " A rated stage, so <em>no</em> value of L_M or L_C can pass. " +
        "Fix this first: raise the stage count, lower I_TDC, or use a " +
        "higher-rated part.</p>";
      h += row("Stages needed at rating", String(Math.ceil(p.iTdc / p.mIrated)), "",
        "info", "before any ripple allowance");
    } else {
      h += row("Per-stage ripple budget", num(r.bud, 1), "A", "info",
        "limited by " + r.budBy);
      h += row("L_M, minimum", num(r.LmTyped * 1e9, 0), "nH", "info",
        MAG_SHARE * 100 + "% of budget \u2014 enter as typed");
      h += row("L_C, minimum", num(r.LcTyped * 1e9, 0), "nH", "info",
        r.lcFromLeakage
          ? "winding leakage alone (" + num(r.leak * 1e9, 0) +
            " nH) already exceeds the " + num(r.lctReq * 1e9, 0) +
            " nH loop inductance the ripple target needs \u2014 no discrete " +
            "L_C is required for ripple, so size it for the transient instead"
          : (100 - MAG_SHARE * 100) + "% of budget \u2014 enter as typed");
    }
    h += row("C_OUT required", num(r.CoutReq * 1e6, 0), "\u00B5F",
      r.CoutReq > p.Cout ? "fail" : "pass",
      "at the sized magnetics \u2014 planned " + num(p.Cout * 1e6, 0) + " \u00B5F");
    if (r.CoutReq > f.cNeed) {
      h += row("Cost of sizing up", "+" + num((r.CoutReq - f.cNeed) * 1e6, 0), "\u00B5F",
        "info", "larger inductors cut ripple but slow the transient, so C_OUT rises");
    }

    if (f.cNeed > p.Cout) {
      if (r.rLLmin > 0 && r.rLLmin < 5e-3) {
        h += row("Load line to close the gap", num(r.rLLmin * 1e3, 3), "m\u03A9", "lever",
          "cheapest fix \u2014 costs " + num(r.rLLmin * p.iStep * 1e3, 0) +
          " mV of droop at full load");
      } else {
        h += row("Load line to close the gap", "\u2014", "", "lever",
          "load line alone cannot close it; add capacitance or steepen the slope");
      }
    }
    $("s-buy").innerHTML = h;
  }

  /* ---- mode toggle ----------------------------------------------------- */
  // L_M and L_C are outputs in reverse mode, so their inputs are disabled — but
  // ONLY while simple mode is on screen. Applying it unconditionally left the
  // two fields disabled and greyed in advanced mode whenever the last simple
  // session ended in reverse.
  function applyDirState() {
    var on = document.body.classList.contains("simple") && DIR === "rev";
    document.body.classList.toggle("rev", on);
    var lm = $("lm"), lc = $("lc");
    if (lm) lm.disabled = on;
    if (lc) lc.disabled = on;
  }

  function setDir(d) {
    DIR = d;
    $("dir-fwd").classList.toggle("on", d === "fwd");
    $("dir-rev").classList.toggle("on", d === "rev");
    applyDirState();
    try { localStorage.setItem("tlvr-dir", d); } catch (e) { }
    render();
  }

  function setMode(on) {
    document.body.classList.toggle("simple", on);
    $("mode").textContent = on ? "Advanced" : "Simple";
    applyDirState();
    try { localStorage.setItem("tlvr-mode", on ? "simple" : "adv"); } catch (e) { }
    if (on) render();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = $("mode");
    if (!btn) return;
    btn.addEventListener("click", function () {
      setMode(!document.body.classList.contains("simple"));
    });
    // Recompute on any input change while simple mode is showing.
    document.addEventListener("input", function () {
      if (document.body.classList.contains("simple")) render();
    });
    $("dir-fwd").addEventListener("click", function () { setDir("fwd"); });
    $("dir-rev").addEventListener("click", function () { setDir("rev"); });
    var saved = null, sd = null;
    try {
      saved = localStorage.getItem("tlvr-mode");
      sd = localStorage.getItem("tlvr-dir");
    } catch (e) { }
    DIR = (sd === "rev") ? "rev" : "fwd";
    if (saved === "simple") setMode(true);
    setDir(DIR);
  });

  window.TLVRSimple = { render: render, forward: forward, reverse: reverse };
})();
