/* ===========================================================================
   calc.js — wiring: reads inputs, runs equations.js, renders results,
   drives the "?" tooltips. Plain script (no modules) so file:// works.
   =========================================================================== */

(function () {
  "use strict";

  var IDS = ["vin", "vout", "fsw", "nph", "itdc", "k", "lm", "lc", "rlc", "rsec",
    "rroute", "pcore", "istep", "tstep", "dvac", "rll", "tresp", "non",
    "dramp", "tdelay", "cout", "esr", "esl",
    "m_stages", "m_pwm", "m_count", "m_isat", "m_irated", "m_rpri"];

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { return parseFloat($(id).value); };

  /* ---- formatting helpers ---- */
  function eng(v, unit, dp) {
    if (!isFinite(v)) return "\u2014";
    dp = dp === undefined ? 2 : dp;
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    if (a === 0) return "0 " + unit;
    var t = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"],
    [1e-6, "\u00B5"], [1e-9, "n"], [1e-12, "p"]];
    for (var i = 0; i < t.length; i++) {
      if (a >= t[i][0]) return s + (a / t[i][0]).toFixed(dp) + " " + t[i][1] + unit;
    }
    return s + (a / 1e-12).toFixed(dp) + " p" + unit;
  }
  function fx(v, dp) { return isFinite(v) ? v.toFixed(dp === undefined ? 3 : dp) : "\u2014"; }

  /* ---- read the form, converting display units to SI ---- */
  function readInputs() {
    return {
      vin: num("vin"),
      vout: num("vout"),
      fsw: num("fsw") * 1e3,     // kHz -> Hz
      // N is derived from the module definition, not typed. See applyDualPhase.
      nStages: num("m_stages") * num("m_count"),
      nPwm: num("m_pwm") * num("m_count"),
      mIsat: num("m_isat"),
      mIrated: num("m_irated"),
      rPri: num("m_rpri") * 1e-3,
      iTdc: num("itdc"),
      k: num("k"),
      Lm: num("lm") * 1e-9,    // nH -> H
      Lc: num("lc") * 1e-9,
      rLc: num("rlc") * 1e-3,    // mohm -> ohm
      rSec: num("rsec") * 1e-3,
      rRoute: num("rroute") * 1e-3,
      pCore: num("pcore"),
      iStep: num("istep"),
      tStep: num("tstep") * 1e-9,    // ns -> s
      dVac: num("dvac") * 1e-3,    // mV -> V
      rLL: num("rll") * 1e-3,
      tResp: num("tresp") * 1e-6,    // us -> s
      nOn: num("non"),
      dRamp: num("dramp"),
      tDelay: num("tdelay") * 1e-9,
      Cout: num("cout") * 1e-6,    // uF -> F
      esr: num("esr") * 1e-3,    // mohm -> ohm
      esl: num("esl") * 1e-12    // pH -> H
    };
  }

  /* ---- collapse stages onto PWM channels (Infineon dual-phase mode) ----
   Mutates p in place: N becomes the PWM count, Lm and Lc are divided by M,
   and LmRaw / LcRaw carry the as-typed values for chart markers and axes.
   M = 1 leaves every downstream number bit-identical to the single-stage
   path, which is what the Renesas 213 nH validation exercises.            */
  function applyDualPhase(p) {
    p.M = p.nStages / p.nPwm;
    if (!isFinite(p.M) || p.M < 1) p.M = 1;
    var s = EQ.dualPhase({ Lm: p.Lm, Lc: p.Lc, nStages: p.nStages, M: p.M });
    p.N = s.N;
    p.Lm = s.Lm;
    p.Lc = s.Lc;
    p.LmRaw = s.LmRaw;      // as typed — for chart markers and axis ranges
    p.LcRaw = s.LcRaw;
    p.nPhys = s.nPhys;
    // derived display — leave the field alone rather than writing NaN into it
    // while the module definition is mid-edit
    if (isFinite(p.N)) $("nph").value = p.N;

    // N_ON counts PWM CHANNELS fired in the step, so it cannot exceed the
    // channel count. Unclamped it inflates the transient slope and the peak
    // L_C voltage with no warning: on the Helix cell, entering 4 for "all four
    // chips firing" gave 93.0 V and 1533 A/us against the true 45.0 V and
    // 742 A/us. Correct the field visibly when it is over, but leave a blank
    // or mid-edit value alone so the input stays usable.
    p.nOn = Math.round(p.nOn);
    if (!(p.nOn >= 1)) p.nOn = 1;
    if (isFinite(p.N) && p.nOn > p.N) {
      p.nOn = p.N;
      $("non").value = p.N;
    }
    return p;
  }

  /* ---- input validation ----
     Everything downstream assumes a physically realisable operating point. Left
     ungated, a zero or inverted input produces NaN or Infinity, eng()/fx()
     render that as an em dash, and the pass/fail chips read it as a failure —
     so a broken input looks exactly like a failed design. Report the input
     instead of computing on it. Returns [] when the design is solvable.      */
  function validate(p) {
    var e = [];
    function bad(cond, msg) { if (cond) e.push(msg); }

    bad(!(p.vin > 0), "Input voltage must be above 0 V.");
    bad(!(p.vout > 0), "Output voltage must be above 0 V.");
    bad(p.vin > 0 && p.vout > 0 && p.vout >= p.vin,
      "Output voltage must be below input voltage — this is a buck converter.");
    bad(!(p.fsw > 0), "Switching frequency must be above 0.");
    bad(!(p.Lm > 0), "Magnetizing inductance L_M must be above 0.");
    bad(!(p.Lc > 0), "Compensating inductance L_C must be above 0.");
    bad(!(p.k > 0 && p.k <= 1), "Coupling coefficient k must be above 0 and at most 1.");
    bad(!(p.Cout > 0), "Planned C_OUT must be above 0.");
    bad(!(p.dVac > 0), "Allowed AC deviation must be above 0.");
    bad(!(p.tStep > 0), "Step duration must be above 0.");
    bad(!(p.dRamp > 0 && p.dRamp <= 1), "Ramp duty cycle must be above 0 and at most 1.");

    // Module definition. M = stages / PWM channels must be a whole number of
    // stages sharing each channel, or Infineon's dual-phase collapse is
    // meaningless. applyDualPhase silently forces M = 1 otherwise.
    bad(!(p.nStages >= 1), "Power stages per module x modules chained must be at least 1.");
    bad(!(p.nPwm >= 1), "PWM channels per module x modules chained must be at least 1.");
    bad(p.nStages >= 1 && p.nPwm >= 1 && p.nPwm > p.nStages,
      "PWM channels cannot exceed power stages — each channel drives at least one stage.");
    bad(p.nStages >= 1 && p.nPwm >= 1 && p.nPwm <= p.nStages &&
      Math.abs(p.nStages / p.nPwm - Math.round(p.nStages / p.nPwm)) > 1e-9,
      "Power stages must divide evenly among PWM channels — " + p.nStages +
      " stages on " + p.nPwm + " channels gives a fractional M.");
    return e;
  }

  /* ---- run every equation ---- */
  function solve(p) {
    var o = {};
    o.D = EQ.dutyCycle(p.vin, p.vout);
    o.tOn = EQ.tOn(o.D, p.fsw);
    o.nMax = EQ.nSimOnMax(p.N, o.D);
    o.nMin = EQ.nSimOnMin(p.N, o.D);
    o.dHF = EQ.dHF(p.N, o.D);
    o.fHF = EQ.fHF(p.N, p.fsw);
    o.tOv = EQ.tOverlap(p.N, o.D, p.fsw);

    o.Lct = EQ.lct({ k: p.k, N: p.N, Lm: p.Lm, Lc: p.Lc, M: p.M });
    o.iLc = EQ.iLcRipple({
      k: p.k, N: p.N, D: o.D, vin: p.vin, vout: p.vout,
      Lc: p.Lc, Lm: p.Lm, M: p.M, fsw: p.fsw
    });
    o.iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: o.D });
    o.iPh = EQ.iPhaseRipple(o.iMag, p.k, o.iLc);
    o.iOut = EQ.iOutRipple({ k: p.k, N: p.N, D: o.D, fsw: p.fsw, iLc: o.iLc, iMag: o.iMag });
    o.iRms = EQ.iRmsLc(o.iLc);
    o.vRipC = EQ.vOutRipple({ iOut: o.iOut, N: p.N, fsw: p.fsw, Cout: p.Cout });
    o.vRip = EQ.vOutRippleFull({
      dIout: o.iOut, Cout: p.Cout, N: p.N, fsw: p.fsw,
      esr: p.esr, esl: p.esl
    });

    o.iPhDC = EQ.iPhaseDC(p.iTdc, p.N);
    o.iPhPk = EQ.iPhasePeak(o.iPhDC, o.iPh);
    o.iPhRms = EQ.iPhaseRms(o.iPhDC, o.iPh);

    // per-transformer figures — the ones component ratings are judged against
    o.st = EQ.stageSplit({ iPhDC: o.iPhDC, iMagPair: o.iMag, iLc: o.iLc, k: p.k, M: p.M });
    o.stPk = EQ.iPhasePeak(o.st.iDC, o.st.iPh);
    o.stRms = EQ.iPhaseRms(o.st.iDC, o.st.iPh);
    o.iSatNeed = EQ.iSatTlvr({ iOutMax: p.iTdc, N: p.nPhys, dIph: o.st.iPh });
    o.budget = EQ.rippleBudget({ iSat: p.mIsat, iRated: p.mIrated, iMagStage: o.st.iMag, k: p.k });
    o.vSecPeak = EQ.vLcMax({ nOn: p.nPhys, vin: p.vin, N: p.nPhys, vout: p.vout });
    o.rImon = EQ.imonResistor({ M: p.M });
    o.pPri = o.stRms * o.stRms * p.rPri;

    o.lTrans = EQ.lTrans({ Lm: p.Lm, Lc: p.Lc, k: p.k, N: p.N, M: p.M });
    o.lTransPh = EQ.lTransPhase({ Lm: p.Lm, Lc: p.Lc, k: p.k, N: p.N, M: p.M });
    o.slUpBuck = EQ.slopeUpBuck({ nOn: p.nOn, N: p.N, vin: p.vin, vout: p.vout, Lm: p.Lm });
    o.slUp = EQ.slopeUpTlvr({ nOn: p.nOn, N: p.N, vin: p.vin, vout: p.vout, Lm: p.Lm, Lc: p.Lc, k: p.k, M: p.M });
    o.slDnBuck = EQ.slopeDownBuck({ N: p.N, vout: p.vout, Lm: p.Lm });
    o.slDn = EQ.slopeDownTlvr({ N: p.N, vout: p.vout, Lm: p.Lm, Lc: p.Lc, k: p.k, M: p.M });

    o.coutUp = EQ.coutRequired({ iStep: p.iStep, slope: o.slUp, dVac: p.dVac, rLL: p.rLL });
    o.coutDn = EQ.coutRequired({ iStep: p.iStep, slope: o.slDn, dVac: p.dVac, rLL: p.rLL });
    o.coutDly = EQ.coutMinDelay({ tDelay: p.tDelay, iStep: p.iStep, dVac: p.dVac, rLL: p.rLL });
    o.coutNeed = Math.max(o.coutUp, o.coutDn, o.coutDly);
    o.lcMax = EQ.lcMaxFromSlew({
      k: p.k, N: p.N, iStep: p.iStep, tStep: p.tStep,
      dRamp: p.dRamp, vin: p.vin, vout: p.vout, Lm: p.Lm
    });

    // L_C saturation floor. IFX Eq. 50 supersedes TI Eq. 22: same quantity,
    // higher-priority source, and it carries k and the transient duty cycle.
    // M cancels through (N/M against Lc/M), so the collapsed values are correct.
    o.iSat = EQ.iLcTransOn({
      k: p.k, tTransOn: p.tResp, dTrans: p.dRamp,
      N: p.N, vin: p.vin, vout: p.vout, Lc: p.Lc
    });
    // Physical stress, not the M-collapsed model value. All nPhys secondaries
    // sit in series in the loop and nOn PWM channels drive M stages each, so
    // the real voltage is M times what the collapsed N would report.
    o.vLc = EQ.vLcMax({
      nOn: p.nOn * p.M, vin: p.vin, N: p.nPhys, vout: p.vout
    });
    o.tau = EQ.tauLc({ Lc: p.Lc, rLc: p.rLc, rSec: p.rSec, N: p.N, rRoute: p.rRoute });
    o.pLc = EQ.pLcLoop({
      iRms: o.iRms, rLc: p.rLc, rSec: p.rSec, N: p.N,
      rRoute: p.rRoute, pCore: p.pCore
    });
    return o;
  }

  /* ---- rendering ----
     row(term, name, value, ref, verdict)
     verdict: undefined | {ok:bool, label:string} | {na:true, label:string}
     na is not a verdict but a caution: the equation is sourced, but one of its
     inputs or its M-scaling is unconfirmed, so the number is not authoritative
     and must not be shown as if it were.                                 */
  function row(term, name, value, ref, verdict) {
    var chip = "";
    var cls = "";
    if (verdict) {
      cls = verdict.na ? " na" : (verdict.ok ? " ok" : " no");
      chip = '<span class="chip' + cls + '">' + verdict.label + "</span>";
    }
    return '<div class="row">' +
      '<span class="name">' + name + qmark(term) + "</span>" +
      '<span class="val' + cls + '">' + value + chip + "</span>" +
      '<span class="ref">' + ref + "</span>" +
      "</div>";
  }
  function qmark(term) {
    return term ? '<span class="q" tabindex="0" data-term="' + term + '">?</span>' : "";
  }

  function render(p, o) {
    $("r-op").innerHTML =
      row("duty", "Duty cycle D", (o.D * 100).toFixed(2) + " %", "D = V_OUT / V_IN") +
      row("ton", "On-time", eng(o.tOn, "s"), "t_ON = D / f_SW") +
      row("nmax", "Max phases on together", o.nMax + " of " + p.N, "IFX Eq. 7") +
      row("dhf", "Overlap duty D_HF", fx(o.dHF, 3), "IFX Eq. 9") +
      row("fhf", "L_C excitation freq", eng(o.fHF, "Hz", 2), "f_HF = N x f_SW") +
      row("iphdc", "Per-phase DC current", fx(o.iPhDC, 1) + " A", "I_TDC / N");

    $("r-ripple").innerHTML =
      row("imagrip", "Magnetizing ripple", fx(o.iMag, 2) + " A", "IFX Eq. 13") +
      row("lct", "Effective loop L (L_CT)", eng(o.Lct, "H", 1), "REN, (1-k^2)xL_MxN + L_C") +
      row("ilcrip", "L_C ripple", fx(o.iLc, 2) + " A", "IFX Eq. 11 on L_CT") +
      row("iphrip", "Total phase ripple", fx(o.iPh, 2) + " A", "IFX Eq. 12") +
      row("ioutrip", "Summed output ripple", fx(o.iOut, 2) + " A", "IFX Eq. 17") +
      row("irmslc", "L_C RMS current", fx(o.iRms, 2) + " A", "TI Eq. 21") +
      row("vrip", "Output voltage ripple", eng(o.vRip, "V", 2), "IFX Eq. 19 (C + ESR + ESL)") +
      row("vripc", "\u2514 capacitive term only", eng(o.vRipC, "V", 2), "dI / (8 x f_HF x C_OUT)") +
      row("iphpk", "Per-phase peak current", fx(o.iPhPk, 1) + " A", "I_DC + dI_ph / 2") +
      row("iphrms", "Per-phase RMS current", fx(o.iPhRms, 1) + " A", "sqrt(I_DC^2 + dI^2/12)") +
      (p.M > 1
        ? row("stagerip", "\u2514 per stage (M = " + p.M + ")",
              fx(o.st.iPh, 2) + " A ripple, " + fx(o.stPk, 1) + " A peak",
              "pair figures divided by M; dI_Lc undivided")
        : "");

    var gainUp = o.slUp / o.slUpBuck;
    var gainDn = o.slDn / o.slDnBuck;
    var coutOk = p.Cout >= o.coutNeed;
    var lcOk = p.Lc <= o.lcMax;
    // Infinity is a real answer here, not missing data: L_M alone already meets
    // the slew target, so no value of L_C violates it. Say that rather than
    // printing an em dash beside a pass chip. See AUDIT-math.md section 4.2.
    var lcFree = !isFinite(o.lcMax);

    $("r-trans").innerHTML =
      row("ltrans", "Transient L (regulator)", eng(o.lTrans, "H", 1), "IFX Eq. 29 on L_CT") +
      row("ltransph", "Transient L (per phase)", eng(o.lTransPh, "H", 1), "REN, L_CT\u00B7L_M/(L_C+N\u00B7L_M)",
        p.M > 1 ? { na: true, label: "extrapolated at M = " + p.M } : undefined) +
      row("slopeup", "Rising I_SUM slope", eng(o.slUp, "A/s", 2), "TI Eq. 18",
        { ok: gainUp > 1, label: fx(gainUp, 2) + "x buck" }) +
      row("slopedn", "Falling I_SUM slope", eng(o.slDn, "A/s", 2), "TI Eq. 20",
        { ok: gainDn > 1, label: fx(gainDn, 2) + "x buck" }) +
      row("coutreq", "C_OUT required (step up)", eng(o.coutUp, "F", 2), "TI Eq. 4 \u2014 no IFX/REN equivalent") +
      row("coutrel", "C_OUT required (release)", eng(o.coutDn, "F", 2), "TI Eq. 5, Eq. 20 slope") +
      row("coutdelay", "C_OUT for controller delay", eng(o.coutDly, "F", 2), "IFX Eq. 32, on the TI Eq. 4 budget") +
      row("coutgov", "C_OUT governing value", eng(o.coutNeed, "F", 2), "max of the three",
        { ok: coutOk, label: coutOk ? "planned OK" : "short" }) +
      // lcMaxFromSlew returns the M-scaled value; L_C is typed unscaled, so
      // report it in the same units the input box uses.
      row("lcmax", "Max L_C for slew target",
        lcFree ? "no upper limit" : eng(o.lcMax * p.M, "H", 1),
        lcFree ? "IFX Eq. 31 — L_M alone meets the slew target" : "IFX Eq. 31",
        { ok: lcOk, label: lcFree ? "unconstrained" : (lcOk ? "L_C OK" : "L_C too large") });

    $("r-limits").innerHTML =
      row("isatlc", "L_C saturation floor", fx(o.iSat, 1) + " A", "IFX Eq. 50 — scales with t_RESP",
        { na: true, label: "t_RESP unconfirmed" }) +
      row("vlcmax", "Peak L_C voltage", fx(o.vLc, 1) + " V", "TI Eq. 24",
        { ok: o.vLc <= p.vin, label: o.vLc > p.vin ? "exceeds V_IN" : "under V_IN" }) +
      row("taulc", "L_C loop time constant", eng(o.tau, "s", 2), "IFX Eq. 57 (= TI Eq. 23)") +
      row("plc", "L_C loop power loss", fx(o.pLc, 2) + " W", "TI Eq. 26");

    var satOk = o.iSatNeed <= p.mIsat;
    var budgetOk = o.iLc <= o.budget.dILcAllowed;
    $("r-module").innerHTML =
      row("m_stages", "Stages / PWM / modules",
          p.nPhys + " stages, " + p.N + " PWM, M = " + p.M,
          "M = stages / PWM channels") +
      row("m_istage", "Per-stage DC current", fx(o.st.iDC, 1) + " A",
          "I_TDC / stage count") +
      row("m_isat", "Transformer I_sat required", fx(o.iSatNeed, 1) + " A",
          "IFX Eq. 18 on per-stage ripple",
          { ok: satOk, label: satOk ? fx(p.mIsat - o.iSatNeed, 1) + " A margin" : "saturates" }) +
      row("m_budget", "Loop ripple budget \u0394I_Lc", fx(o.budget.dILcAllowed, 1) + " A",
          "IFX Eq. 18 rearranged \u2014 headline module spec",
          { ok: budgetOk, label: budgetOk ? "actual " + fx(o.iLc, 1) + " A" : "over budget" }) +
      row("m_vsec", "Secondary interconnect voltage", fx(o.vSecPeak, 0) + " V",
          "TI Eq. 24, all stages on \u2014 worst case",
          { ok: o.vSecPeak <= 100, label: o.vSecPeak > 100 ? "check rating" : "under 100 V" }) +
      row("m_imon", "IMON summing resistor", fx(o.rImon, 0) + " \u2126",
          "1 k\u2126 / M \u2014 TDA22594A sources 5 \u00B5A/A",
          p.M > 1 ? { na: true, label: "scaling not vendor-specified" } : undefined) +
      row("m_ppri", "Primary loss per stage", fx(o.pPri, 2) + " W",
          "I_rms\u00B2 \u00D7 R_pri");
  }

  /* ---- live charts: one plot per tab, sweep variable chosen by the select ---- */
  var LIVE = {
    op: { terms: ["vout", "vin", "nph", "fsw"], sel: "pick-op", plot: "plot-op" },
    ripple: { terms: ["lc", "lm", "k", "fsw", "nph"], sel: "pick-ripple", plot: "plot-ripple" },
    trans: { terms: ["coutgov", "lc", "lm", "k"], sel: "pick-trans", plot: "plot-trans" },
    limits: { terms: ["itdc", "rlc", "rsec", "rroute"], sel: "pick-limits", plot: "plot-limits" },
    module: { terms: ["lc", "lm", "itdc"], sel: "pick-module", plot: "plot-module" }
  };

  function initLive() {
    if (!window.TLVRDetail) {
      console.warn("TLVRLive: charts.js must load before calc.js — skipping live charts");
      return;
    }
    Object.keys(LIVE).forEach(function (key) {
      var cfg = LIVE[key], sel = $(cfg.sel);
      if (!sel) return;
      cfg.terms.forEach(function (t) {
        if (!window.TLVRDetail.has(t)) {
          console.warn("TLVRLive: no chart registered for term '" + t + "'");
          return;
        }
        var o = document.createElement("option");
        o.value = t;
        o.textContent = "Sweep " + ((TERMS[t] && TERMS[t].t) || t);
        sel.appendChild(o);
      });
      if (!sel.options.length) { sel.parentNode.hidden = true; return; }
      sel.addEventListener("change", drawLive);
    });
  }

  function drawLive() {
    if (!window.TLVRDetail) return;
    Object.keys(LIVE).forEach(function (key) {
      var cfg = LIVE[key], sel = $(cfg.sel), plot = $(cfg.plot);
      if (!sel || !plot || !sel.value) return;
      var panel = plot.closest(".tabpanel");
      if (panel && panel.hidden) return;       // skip hidden tabs — cheap
      window.TLVRDetail.renderInto(sel.value, plot);
    });
  }

  /* Replace every results panel with the reason the design cannot be solved,
     and blank the charts, so nothing stale or fabricated stays on screen. */
  function renderErrors(errs) {
    var h = '<div class="rows-error"><strong>Cannot compute this design.</strong><ul>';
    for (var i = 0; i < errs.length; i++) h += "<li>" + errs[i] + "</li>";
    h += "</ul></div>";
    ["r-op", "r-ripple", "r-trans", "r-limits", "r-module"].forEach(function (id) {
      if ($(id)) $(id).innerHTML = h;
    });
    Object.keys(LIVE).forEach(function (key) {
      var plot = $(LIVE[key].plot);
      if (plot) plot.innerHTML = "";
    });
  }

  function update() {
    var p = applyDualPhase(readInputs());
    var errs = validate(p);
    if (errs.length) { renderErrors(errs); return; }
    render(p, solve(p));
    drawLive();
  }

  window.TLVRLive = { draw: drawLive, init: initLive };

  window.TLVR = {
    readInputs: function () { return applyDualPhase(readInputs()); },
    solve: solve,
    validate: validate
  };

  /* ---- tooltips ----
       The tooltip stays open while the pointer is over it, so the "Learn more"
       button inside is reachable. A short dismiss delay plus a CSS bridge across
       the gap covers the travel from the ? to the panel.                       */
  var tip = $("tip");
  var tipTimer = null, tipTerm = null;

  function showTip(el) {
    var term = el.getAttribute("data-term");
    var t = TERMS[term];
    if (!t) return;
    clearTimeout(tipTimer);
    tipTerm = term;

    var more = window.TLVRDetail
      ? '<button type="button" class="more">Learn more</button>' : "";
    tip.innerHTML = "<h4>" + t.t + "</h4><p>" + t.d +
      '</p><span class="src">Source: ' + t.src + "</span>" + more;
    tip.hidden = false;

    var r = el.getBoundingClientRect();
    var x = r.left;
    var y = r.bottom + 8;

    if (x + tip.offsetWidth > window.innerWidth - 12) {
      x = window.innerWidth - tip.offsetWidth - 12;
    }
    // flip above the marker if it would run off the bottom of the viewport,
    // and mirror the hover bridge so pointer travel still works
    var flip = y + tip.offsetHeight > window.innerHeight - 12;
    if (flip) y = r.top - tip.offsetHeight - 8;
    tip.classList.toggle("flip", flip);
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function queueHide() {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.hidden = true; }, 220);
  }
  function hideTip() { clearTimeout(tipTimer); tip.hidden = true; }

  document.addEventListener("mouseover", function (e) {
    if (e.target.classList && e.target.classList.contains("q")) showTip(e.target);
  });
  document.addEventListener("mouseout", function (e) {
    if (e.target.classList && e.target.classList.contains("q")) queueHide();
  });
  tip.addEventListener("mouseenter", function () { clearTimeout(tipTimer); });
  tip.addEventListener("mouseleave", queueHide);

  // capture phase already catches .results and any nested scroller
  window.addEventListener("scroll", hideTip, true);

  tip.addEventListener("click", function (e) {
    if (e.target.classList.contains("more") && tipTerm) {
      hideTip();
      window.TLVRDetail.open(tipTerm);
    }
  });

  document.addEventListener("focusin", function (e) {
    if (e.target.classList && e.target.classList.contains("q")) showTip(e.target);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(); });

  /* clicking the ? itself opens the detail panel directly */
  document.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("q")) {
      hideTip();
      window.TLVRDetail.open(e.target.getAttribute("data-term"));
    }
  });

  /* attach a "?" to every input label that declares a term */
  function decorateInputs() {
    var labels = document.querySelectorAll(".grid label[data-term]");
    for (var i = 0; i < labels.length; i++) {
      var l = labels[i];
      var q = document.createElement("span");
      q.className = "q";
      q.tabIndex = 0;
      q.textContent = "?";
      q.setAttribute("data-term", l.getAttribute("data-term"));
      l.insertBefore(q, l.querySelector(".u"));
    }
  }

  /* ---- presets ---- */
  var PRESETS = {
    // This design. TI Table 2 is 12V/0.8V 4ph 600k Lm150n Lc180n — near identical,
    // so those magnetics are a validated starting point.
    helix: {
            vin: 12, vout: 0.75, fsw: 600, m_stages: 4, m_pwm: 2, m_count: 1,
      m_isat: 80, m_irated: 60, m_rpri: 0.18, itdc: 240, k: 0.98, lm: 150, lc: 180,
      rlc: 0.4, rsec: 0.3, rroute: 0.5, pcore: 0.2, istep: 200, tstep: 500,
      // non = 2: four stages on two PWM channels, so two channels is all there
      // is to fire. This preset previously shipped non = 4 against N = 2.
      dvac: 30, rll: 0, tresp: 1, non: 2, dramp: 0.9, tdelay: 200, cout: 5000
    },
    ti: {
            vin: 12, vout: 0.8, fsw: 600, m_stages: 4, m_pwm: 4, m_count: 1,
      m_isat: 80, m_irated: 60, m_rpri: 0.18, itdc: 325, k: 0.98, lm: 150, lc: 180,
      rlc: 0.4, rsec: 0.3, rroute: 0.5, pcore: 0.2, istep: 300, tstep: 500,
      dvac: 30, rll: 0, tresp: 1, non: 4, dramp: 0.9, tdelay: 200, cout: 5000
    },
    ren: {
            vin: 12, vout: 1.8, fsw: 600, m_stages: 8, m_pwm: 8, m_count: 1,
      m_isat: 80, m_irated: 60, m_rpri: 0.18, itdc: 400, k: 0.98, lm: 200, lc: 150,
      rlc: 0.4, rsec: 0.3, rroute: 0.5, pcore: 0.2, istep: 200, tstep: 500,
      dvac: 30, rll: 0, tresp: 1, non: 8, dramp: 0.9, tdelay: 200, cout: 5000
    }
  };

  function applySet(v) {
    for (var i = 0; i < IDS.length; i++) {
      if (v[IDS[i]] !== undefined) $(IDS[i]).value = v[IDS[i]];
    }
    update();
    // Assigning .value does not fire an input event, and simple mode listens
    // for one. Without this, loading a preset or a JSON design while simple
    // mode is showing leaves the previous design's numbers on screen.
    if (window.TLVRSimple && document.body.classList.contains("simple")) {
      window.TLVRSimple.render();
    }
  }

  $("preset").addEventListener("change", function () {
    if (PRESETS[this.value]) applySet(PRESETS[this.value]);
    this.value = "";
  });

  /* ---- save / open ---- */
  $("save").addEventListener("click", function () {
    var v = {};
    for (var i = 0; i < IDS.length; i++) v[IDS[i]] = $(IDS[i]).value;
    var blob = new Blob([JSON.stringify(v, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tlvr-design.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---- export inputs + computed results as readable text ---- */
  $("exportBtn").addEventListener("click", function () {
    var p = window.TLVR.readInputs(), o = solve(p), L = [];
    function f(v, d) {
      return (typeof v === "number" && isFinite(v)) ? v.toFixed(d === undefined ? 3 : d) : String(v);
    }

    L.push("TLVR design report");
    L.push("Generated " + new Date().toISOString());
    L.push("");
    L.push("== INPUTS (as typed) ==");
    for (var i = 0; i < IDS.length; i++) L.push("  " + IDS[i] + " = " + $(IDS[i]).value);

    L.push("");
    L.push("== TOPOLOGY ==");
    L.push("  physical stages  " + p.nPhys);
    L.push("  PWM channels N   " + p.N);
    L.push("  M (stages/PWM)   " + p.M);
    L.push("  L_M as typed     " + f(p.LmRaw * 1e9, 1) + " nH  -> model " + f(p.Lm * 1e9, 1) + " nH");
    L.push("  L_C as typed     " + f(p.LcRaw * 1e9, 1) + " nH  -> model " + f(p.Lc * 1e9, 1) + " nH");
    L.push("  duty cycle D     " + f(o.D, 4));
    L.push("  L_CT loop        " + f(EQ.lct({ k: p.k, N: p.N, Lm: p.Lm, Lc: p.Lc, M: p.M }) * 1e9, 1) + " nH");
    L.push("  L_trans, whole   " + f(o.lTrans * 1e9, 1) + " nH");
    L.push("  L_trans, /phase  " + f(o.lTransPh * 1e9, 2) + " nH");

    L.push("");
    L.push("== STEADY-STATE RIPPLE ==");
    L.push("  magnetizing      " + f(o.iMag, 2) + " A");
    L.push("  loop I_LC        " + f(o.iLc, 2) + " A   (RMS " + f(o.iRms, 2) + " A)");
    L.push("  per-phase        " + f(o.iPh, 2) + " A");
    L.push("  summed output    " + f(o.iOut, 2) + " A");
    L.push("  V_OUT ripple     " + f(o.vRip * 1e3, 2) + " mV");

    L.push("");
    L.push("== PER-STAGE CURRENTS ==");
    L.push("  DC pedestal      " + f(o.st.iDC, 1) + " A");
    L.push("  ripple           " + f(o.st.iPh, 2) + " A");
    L.push("  peak             " + f(o.stPk, 1) + " A   (rated " + p.mIrated + " A)");
    L.push("  RMS              " + f(o.stRms, 1) + " A");
    L.push("  I_SAT needed     " + f(o.iSatNeed, 1) + " A   (device " + p.mIsat + " A)");

    L.push("");
    L.push("== TRANSIENT ==");
    L.push("  slope up         " + f(o.slUp / 1e6, 2) + " A/us   (buck " + f(o.slUpBuck / 1e6, 2) + ")");
    L.push("  slope down       " + f(Math.abs(o.slDn) / 1e6, 2) + " A/us   (buck " + f(Math.abs(o.slDnBuck) / 1e6, 2) + ")");
    L.push("  C_OUT step up    " + f(o.coutUp * 1e6, 0) + " uF");
    L.push("  C_OUT release    " + f(o.coutDn * 1e6, 0) + " uF");
    L.push("  C_OUT delay      " + f(o.coutDly * 1e6, 0) + " uF");
    L.push("  C_OUT GOVERNING  " + f(o.coutNeed * 1e6, 0) + " uF   (planned " + f(p.Cout * 1e6, 0) + " uF)"
      + (o.coutNeed > p.Cout ? "   *** SHORT ***" : "   ok"));
    L.push("  L_C max (slew)   " + f(o.lcMax * p.M * 1e9, 1) + " nH");

    L.push("");
    L.push("== L_C LOOP ==");
    L.push("  peak voltage     " + f(o.vLc, 1) + " V   (V_IN " + p.vin + " V)   [TI Eq. 24]");
    L.push("  I_SAT needed     " + f(o.iSat, 1) + " A   [IFX Eq. 50 — scales with t_RESP,");
    L.push("                                       which is an unconfirmed placeholder]");
    L.push("  decay tau        " + f(o.tau * 1e6, 2) + " us");
    L.push("  loop loss        " + f(o.pLc, 2) + " W");

    var blob = new Blob([L.join("\n")], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tlvr-report.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("loadBtn").addEventListener("click", function () { $("loadFile").click(); });
  $("loadFile").addEventListener("change", function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { applySet(JSON.parse(r.result)); }
      catch (err) { alert("That file is not a valid design JSON."); }
    };
    r.readAsText(f);
    // Clear it, or picking the same file twice fires no change event.
    e.target.value = "";
  });

  /* ---- theme ---- */
  var themeBtn = $("theme");
  function setTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    themeBtn.textContent = mode === "dark" ? "Light" : "Dark";
    try { localStorage.setItem("tlvr-theme", mode); } catch (e) { }
  }
  /* ---- result tabs ---- */
  var tabs = document.querySelectorAll(".tab");
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(tabs, function (o) {
        var panel = $(o.getAttribute("data-panel"));
        var on = (o === t);
        o.classList.toggle("on", on);
        o.setAttribute("aria-selected", on ? "true" : "false");
        if (panel) panel.hidden = !on;
      });
      if (window.TLVRLive) window.TLVRLive.draw();
    });
  });
  themeBtn.addEventListener("click", function () {
    var now = document.documentElement.getAttribute("data-theme");
    setTheme(now === "dark" ? "light" : "dark");
  });
  var saved = null;
  try { saved = localStorage.getItem("tlvr-theme"); } catch (e) { }
  setTheme(saved || (window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  /* ---- boot ---- */
  decorateInputs();
  for (var i = 0; i < IDS.length; i++) {
    $(IDS[i]).addEventListener("input", update);
  }
  initLive();
  update();
})();
