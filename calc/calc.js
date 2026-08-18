/* ===========================================================================
   calc.js — wiring: reads inputs, runs equations.js, renders results,
   drives the "?" tooltips. Plain script (no modules) so file:// works.
   =========================================================================== */

(function () {
  "use strict";

  var IDS = ["vin","vout","fsw","nph","itdc","k","lm","lc","rlc","rsec",
             "rroute","pcore","istep","tstep","dvac","rll","tresp","non",
             "dramp","tdelay","cout","esr","esl"];

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { return parseFloat($(id).value); };

  /* ---- formatting helpers ---- */
  function eng(v, unit, dp) {
    if (!isFinite(v)) return "\u2014";
    dp = dp === undefined ? 2 : dp;
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    if (a === 0) return "0 " + unit;
    var t = [[1e9,"G"],[1e6,"M"],[1e3,"k"],[1,""],[1e-3,"m"],
             [1e-6,"\u00B5"],[1e-9,"n"],[1e-12,"p"]];
    for (var i = 0; i < t.length; i++) {
      if (a >= t[i][0]) return s + (a / t[i][0]).toFixed(dp) + " " + t[i][1] + unit;
    }
    return s + (a / 1e-12).toFixed(dp) + " p" + unit;
  }
  function fx(v, dp) { return isFinite(v) ? v.toFixed(dp === undefined ? 3 : dp) : "\u2014"; }

  /* ---- read the form, converting display units to SI ---- */
  function readInputs() {
    return {
      vin:    num("vin"),
      vout:   num("vout"),
      fsw:    num("fsw")    * 1e3,     // kHz -> Hz
      N:      num("nph"),
      iTdc:   num("itdc"),
      k:      num("k"),
      Lm:     num("lm")     * 1e-9,    // nH -> H
      Lc:     num("lc")     * 1e-9,
      rLc:    num("rlc")    * 1e-3,    // mohm -> ohm
      rSec:   num("rsec")   * 1e-3,
      rRoute: num("rroute") * 1e-3,
      pCore:  num("pcore"),
      iStep:  num("istep"),
      tStep:  num("tstep")  * 1e-9,    // ns -> s
      dVac:   num("dvac")   * 1e-3,    // mV -> V
      rLL:    num("rll")    * 1e-3,
      tResp:  num("tresp")  * 1e-6,    // us -> s
      nOn:    num("non"),
      dRamp:  num("dramp"),
      tDelay: num("tdelay") * 1e-9,
      Cout:   num("cout")   * 1e-6,    // uF -> F
      esr:    num("esr")    * 1e-3,    // mohm -> ohm
      esl:    num("esl")    * 1e-12    // pH -> H
    };
  }

  /* ---- run every equation ---- */
  function solve(p) {
    var o = {};
    o.D    = EQ.dutyCycle(p.vin, p.vout);
    o.tOn  = EQ.tOn(o.D, p.fsw);
    o.nMax = EQ.nSimOnMax(p.N, o.D);
    o.nMin = EQ.nSimOnMin(p.N, o.D);
    o.dHF  = EQ.dHF(p.N, o.D);
    o.fHF  = EQ.fHF(p.N, p.fsw);
    o.tOv  = EQ.tOverlap(p.N, o.D, p.fsw);

    o.Lct   = EQ.lct({ k:p.k, N:p.N, Lm:p.Lm, Lc:p.Lc });
    o.iLc   = EQ.iLcRipple({ k:p.k, N:p.N, D:o.D, vin:p.vin, vout:p.vout,
                             Lc:p.Lc, Lm:p.Lm, fsw:p.fsw });
    o.iMag  = EQ.iMagRipple({ vin:p.vin, Lm:p.Lm, fsw:p.fsw, D:o.D });
    o.iPh   = EQ.iPhaseRipple(o.iMag, p.k, o.iLc);
    o.iOut  = EQ.iOutRipple({ k:p.k, N:p.N, D:o.D, fsw:p.fsw, iLc:o.iLc, iMag:o.iMag });
    o.iRms  = EQ.iRmsLc(o.iLc);
    o.vRipC = EQ.vOutRipple({ iOut:o.iOut, N:p.N, fsw:p.fsw, Cout:p.Cout });
    o.vRip  = EQ.vOutRippleFull({ dIout:o.iOut, Cout:p.Cout, N:p.N, fsw:p.fsw,
                                  esr:p.esr, esl:p.esl });

    o.iPhDC  = EQ.iPhaseDC(p.iTdc, p.N);
    o.iPhPk  = EQ.iPhasePeak(o.iPhDC, o.iPh);
    o.iPhRms = EQ.iPhaseRms(o.iPhDC, o.iPh);

    o.lTrans    = EQ.lTrans({ Lm:p.Lm, Lc:p.Lc, k:p.k, N:p.N });
    o.lTransPh  = EQ.lTransPhase({ Lm:p.Lm, Lc:p.Lc, k:p.k, N:p.N });
    o.slUpBuck = EQ.slopeUpBuck({ nOn:p.nOn, N:p.N, vin:p.vin, vout:p.vout, Lm:p.Lm });
    o.slUp     = EQ.slopeUpTlvr({ nOn:p.nOn, N:p.N, vin:p.vin, vout:p.vout, Lm:p.Lm, Lc:p.Lc, k:p.k });
    o.slDnBuck = EQ.slopeDownBuck({ N:p.N, vout:p.vout, Lm:p.Lm });
    o.slDn     = EQ.slopeDownTlvr({ N:p.N, vout:p.vout, Lm:p.Lm, Lc:p.Lc, k:p.k });

    o.coutUp   = EQ.coutRequired({ iStep:p.iStep, slope:o.slUp,  dVac:p.dVac, rLL:p.rLL });
    o.coutDn   = EQ.coutRequired({ iStep:p.iStep, slope:o.slDn,  dVac:p.dVac, rLL:p.rLL });
    o.coutDly  = EQ.coutMinDelay({ tDelay:p.tDelay, iStep:p.iStep, dVout:p.dVac });
    o.coutNeed = Math.max(o.coutUp, o.coutDn, o.coutDly);
    o.lcMax    = EQ.lcMaxFromSlew({ k:p.k, N:p.N, iStep:p.iStep, tStep:p.tStep,
                                    dRamp:p.dRamp, vin:p.vin, vout:p.vout, Lm:p.Lm });

    o.iSat  = EQ.iSatLcNeeded({ tResp:p.tResp, nOn:p.nOn, vin:p.vin, N:p.N, vout:p.vout, Lc:p.Lc });
    o.vLc   = EQ.vLcMax({ nOn:p.nOn, vin:p.vin, N:p.N, vout:p.vout });
    o.tau   = EQ.tauLc({ Lc:p.Lc, rLc:p.rLc, rSec:p.rSec, N:p.N, rRoute:p.rRoute });
    o.pLc   = EQ.pLcLoop({ iRms:o.iRms, rLc:p.rLc, rSec:p.rSec, N:p.N,
                           rRoute:p.rRoute, pCore:p.pCore });
    return o;
  }

  /* ---- rendering ----
     row(term, name, value, ref, verdict)
     verdict: undefined | {ok:bool, label:string}                        */
  function row(term, name, value, ref, verdict) {
    var chip = "";
    var cls = "";
    if (verdict) {
      cls = verdict.ok ? " ok" : " no";
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
      row("duty",  "Duty cycle D",              (o.D * 100).toFixed(2) + " %",  "D = V_OUT / V_IN") +
      row("ton",   "On-time",                   eng(o.tOn, "s"),                "t_ON = D / f_SW") +
      row("nmax",  "Max phases on together",    o.nMax + " of " + p.N,          "IFX Eq. 7") +
      row("dhf",   "Overlap duty D_HF",         fx(o.dHF, 3),                   "IFX Eq. 9") +
      row("fhf",   "L_C excitation freq",       eng(o.fHF, "Hz", 2),            "f_HF = N x f_SW") +
      row("iphdc", "Per-phase DC current",      fx(o.iPhDC, 1) + " A",          "I_TDC / N");

    var ripplePct = (o.iPh / o.iPhDC) * 100;
    $("r-ripple").innerHTML =
      row("imagrip", "Magnetizing ripple",       fx(o.iMag, 2) + " A",  "IFX Eq. 13") +
      row("lct",     "Effective loop L (L_CT)",  eng(o.Lct, "H", 1),    "REN, (1-k^2)xL_MxN + L_C") +
      row("ilcrip",  "L_C ripple",               fx(o.iLc, 2) + " A",   "IFX Eq. 11 on L_CT") +
      row("iphrip",  "Total phase ripple",       fx(o.iPh, 2) + " A",   "IFX Eq. 12") +
      row("ioutrip", "Summed output ripple",     fx(o.iOut, 2) + " A",  "IFX Eq. 17") +
      row("irmslc",  "L_C RMS current",          fx(o.iRms, 2) + " A",  "TI Eq. 21") +
      row("vrip",    "Output voltage ripple",    eng(o.vRip, "V", 2),   "IFX Eq. 19 (C + ESR + ESL)") +
      row("vripc",   "\u2514 capacitive term only", eng(o.vRipC, "V", 2), "dI / (8 x f_HF x C_OUT)") +
      row("iphpk",   "Per-phase peak current",   fx(o.iPhPk, 1) + " A", "I_DC + dI_ph / 2") +
      row("iphrms",  "Per-phase RMS current",    fx(o.iPhRms, 1) + " A","sqrt(I_DC^2 + dI^2/12)");

    var gainUp = o.slUp / o.slUpBuck;
    var gainDn = o.slDn / o.slDnBuck;
    var coutOk = p.Cout >= o.coutNeed;
    var lcOk   = p.Lc <= o.lcMax;

    $("r-trans").innerHTML =
      row("ltrans",  "Transient L (regulator)", eng(o.lTrans, "H", 1),                "IFX Eq. 29 on L_CT") +
      row("ltransph","Transient L (per phase)", eng(o.lTransPh, "H", 1),              "REN, L_CT\u00B7L_M/(L_C+N\u00B7L_M)") +
      row("slopeup", "Rising I_SUM slope",      eng(o.slUp, "A/s", 2),                "TI Eq. 18",
          { ok: gainUp > 1, label: fx(gainUp, 2) + "x buck" }) +
      row("slopedn", "Falling I_SUM slope",     eng(o.slDn, "A/s", 2),                "TI Eq. 20",
          { ok: gainDn > 1, label: fx(gainDn, 2) + "x buck" }) +
      row("coutreq", "C_OUT required (step up)", eng(o.coutUp, "F", 2),               "TI Eq. 1 \u2014 no IFX/REN equivalent") +
      row("coutrel", "C_OUT required (release)", eng(o.coutDn, "F", 2),               "TI Eq. 1, Eq. 20 slope") +
      row("coutdelay","C_OUT for controller delay", eng(o.coutDly, "F", 2),           "IFX Eq. 32") +
      row("coutgov", "C_OUT governing value",   eng(o.coutNeed, "F", 2),              "max of the three",
          { ok: coutOk, label: coutOk ? "planned OK" : "short" }) +
      row("lcmax",   "Max L_C for slew target", eng(o.lcMax, "H", 1),                 "IFX Eq. 31",
          { ok: lcOk, label: lcOk ? "L_C OK" : "L_C too large" });

    $("r-limits").innerHTML =
      row("isatlc", "L_C saturation floor",    fx(o.iSat, 1) + " A",  "TI Eq. 22, needs margin above") +
      row("vlcmax", "Peak L_C voltage",        fx(o.vLc, 1) + " V",   "TI Eq. 24",
          { ok: o.vLc <= p.vin, label: o.vLc > p.vin ? "exceeds V_IN" : "under V_IN" }) +
      row("taulc",  "L_C loop time constant",  eng(o.tau, "s", 2),    "IFX Eq. 57 (= TI Eq. 23)") +
      row("plc",    "L_C loop power loss",     fx(o.pLc, 2) + " W",   "TI Eq. 26");
  }

  /* ---- live charts: one plot per tab, sweep variable chosen by the select ---- */
  var LIVE = {
    op:     { terms: ["vout", "vin", "nph", "fsw"],      sel: "pick-op",     plot: "plot-op" },
    ripple: { terms: ["lc", "lm", "k", "fsw", "nph"],    sel: "pick-ripple", plot: "plot-ripple" },
    trans:  { terms: ["coutgov", "lc", "lm", "k"],       sel: "pick-trans",  plot: "plot-trans" },
    limits: { terms: ["itdc", "rlc", "rsec", "rroute"],  sel: "pick-limits", plot: "plot-limits" }
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
      void 0;
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

  function update() {
    var p = readInputs();
    render(p, solve(p));
    drawLive();
  }

  window.TLVRLive = { draw: drawLive, init: initLive };

  window.TLVR = { readInputs: readInputs, solve: solve };

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
    var x = r.left + window.scrollX;
    var y = r.bottom + window.scrollY + 8;
    if (x + tip.offsetWidth > window.innerWidth - 12) {
      x = window.innerWidth - tip.offsetWidth - 12;
    }
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = y + "px";
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
    helix: { vin:12, vout:0.75, fsw:600, nph:4, itdc:240, k:0.98, lm:150, lc:180,
             rlc:0.4, rsec:0.3, rroute:0.5, pcore:0.2, istep:200, tstep:500,
             dvac:30, rll:0, tresp:1, non:4, dramp:0.9, tdelay:200, cout:5000 },
    ti:    { vin:12, vout:0.8, fsw:600, nph:4, itdc:325, k:0.98, lm:150, lc:180,
             rlc:0.4, rsec:0.3, rroute:0.5, pcore:0.2, istep:300, tstep:500,
             dvac:30, rll:0, tresp:1, non:4, dramp:0.9, tdelay:200, cout:5000 },
    ren:   { vin:12, vout:1.8, fsw:600, nph:8, itdc:400, k:0.98, lm:200, lc:150,
             rlc:0.4, rsec:0.3, rroute:0.5, pcore:0.2, istep:200, tstep:500,
             dvac:30, rll:0, tresp:1, non:8, dramp:0.9, tdelay:200, cout:5000 }
  };

  function applySet(v) {
    for (var i = 0; i < IDS.length; i++) {
      if (v[IDS[i]] !== undefined) $(IDS[i]).value = v[IDS[i]];
    }
    update();
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
  });

  /* ---- theme ---- */
  var themeBtn = $("theme");
  function setTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    themeBtn.textContent = mode === "dark" ? "Light" : "Dark";
    try { localStorage.setItem("tlvr-theme", mode); } catch (e) {}
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
  try { saved = localStorage.getItem("tlvr-theme"); } catch (e) {}
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
