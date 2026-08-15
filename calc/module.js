/* ===========================================================================
   module.js — Module mode.

   The design calculator sizes one complete regulator. This mode is for the
   other side of the problem: specifying a chainable TLVR power module, where
   some parameters are fixed in the module at manufacture and the rest belong
   to whoever integrates it.

   Module owns:      L_M, coupling k, transformer saturation, winding DCRs,
                     per-phase current rating, stage count per module.
   Integrator owns:  phase count (how many modules), L_C, C_OUT, controller,
                     V_OUT, transient targets.

   The output is the spec sheet the integrator needs: how much loop ripple the
   module can tolerate before its transformers saturate, the minimum L_C that
   guarantees it, the voltage its secondary interconnect must survive, and what
   the module contributes to loop resistance.

   Equation sources are the same three documents used throughout.
   =========================================================================== */

(function () {
  "use strict";

  var IDS = ["m_stages", "m_lm", "m_k", "m_isat", "m_irated", "m_rpri",
             "m_rsec", "m_count", "m_vin", "m_vout", "m_fsw"];

  function $(id) { return document.getElementById(id); }
  function n(id) { return parseFloat($(id).value); }

  function eng(v, unit, dp) {
    if (!isFinite(v)) return "\u2014";
    dp = dp === undefined ? 2 : dp;
    var a = Math.abs(v), s = v < 0 ? "-" : "";
    if (a === 0) return "0 " + unit;
    var t = [[1e9,"G"],[1e6,"M"],[1e3,"k"],[1,""],[1e-3,"m"],[1e-6,"\u00B5"],[1e-9,"n"]];
    for (var i = 0; i < t.length; i++) {
      if (a >= t[i][0]) return s + (a / t[i][0]).toFixed(dp) + " " + t[i][1] + unit;
    }
    return s + v.toExponential(1) + " " + unit;
  }

  /* ---------- the panel ---------- */
  function buildDom() {
    var sec = document.createElement("section");
    sec.id = "module-mode";
    sec.hidden = true;
    sec.innerHTML =
      '<div class="col">' +
        '<fieldset><legend>Module definition &mdash; fixed at manufacture</legend>' +
          '<div class="grid">' +
            '<label data-term="m_stages">Phases per module<span class="u">&mdash;</span><input id="m_stages" type="number" step="1" value="2"></label>' +
            '<label data-term="lm">L_M per transformer<span class="u">nH</span><input id="m_lm" type="number" step="any" value="100"></label>' +
            '<label data-term="k">Coupling coefficient<span class="u">&mdash;</span><input id="m_k" type="number" step="any" value="0.98"></label>' +
            '<label data-term="m_isat">Transformer I_sat<span class="u">A</span><input id="m_isat" type="number" step="any" value="80"></label>' +
            '<label data-term="m_irated">Rated current per phase<span class="u">A</span><input id="m_irated" type="number" step="any" value="60"></label>' +
            '<label data-term="m_rpri">Primary DCR<span class="u">m&#8486;</span><input id="m_rpri" type="number" step="any" value="0.18"></label>' +
            '<label data-term="rsec">Secondary DCR<span class="u">m&#8486;</span><input id="m_rsec" type="number" step="any" value="0.3"></label>' +
          '</div>' +
        '</fieldset>' +
        '<fieldset><legend>Integrator&rsquo;s system</legend>' +
          '<div class="grid">' +
            '<label data-term="m_count">Modules in system<span class="u">&mdash;</span><input id="m_count" type="number" step="1" value="2"></label>' +
            '<label data-term="vin">Input voltage<span class="u">V</span><input id="m_vin" type="number" step="any" value="12"></label>' +
            '<label data-term="vout">Output voltage<span class="u">V</span><input id="m_vout" type="number" step="any" value="0.75"></label>' +
            '<label data-term="fsw">Switching freq<span class="u">kHz</span><input id="m_fsw" type="number" step="any" value="600"></label>' +
          '</div>' +
        '</fieldset>' +
      '</div>' +
      '<div class="col">' +
        '<fieldset><legend>System scale</legend><div class="rows" id="m-scale"></div></fieldset>' +
        '<fieldset><legend>Integrator constraints &mdash; publish these</legend><div class="rows" id="m-limits"></div></fieldset>' +
        '<fieldset><legend>Module contribution to the loop</legend><div class="rows" id="m-loop"></div></fieldset>' +
      '</div>';
    document.querySelector("main").parentNode.insertBefore(
      sec, document.querySelector("footer"));
    return sec;
  }

  /* ---------- compute ---------- */
  function compute() {
    var p = {
      stages: n("m_stages"),
      Lm:     n("m_lm") * 1e-9,
      k:      n("m_k"),
      iSat:   n("m_isat"),
      iRated: n("m_irated"),
      rPri:   n("m_rpri") * 1e-3,
      rSec:   n("m_rsec") * 1e-3,
      count:  n("m_count"),
      vin:    n("m_vin"),
      vout:   n("m_vout"),
      fsw:    n("m_fsw") * 1e3
    };

    var o = {};
    o.N = p.stages * p.count;
    o.iTotal = o.N * p.iRated;
    o.D = EQ.dutyCycle(p.vin, p.vout);
    o.nMax = EQ.nSimOnMax(o.N, o.D);
    o.dHF = EQ.dHF(o.N, o.D);
    o.fHF = EQ.fHF(o.N, p.fsw);

    // Module's own ripple contribution. Independent of N and of L_C.  [IFX Eq. 4]
    o.iMag = EQ.iMagRipple({ vin: p.vin, Lm: p.Lm, fsw: p.fsw, D: o.D });
    o.magPct = (o.iMag / p.iRated) * 100;

    // Saturation headroom.  [IFX Eq. 18] rearranged:
    //   I_sat >= I_rated + dI_ph/2   ->   dI_ph_allowed = 2*(I_sat - I_rated)
    // and dI_ph = dI_mag + k*dI_Lc   ->   dI_Lc_allowed = (dI_ph - dI_mag)/k
    o.dIphAllowed = 2 * (p.iSat - p.iRated);
    o.dILcMax = (o.dIphAllowed - o.iMag) / p.k;

    // Leakage the module contributes to the loop.  [REN]
    o.leak = (1 - p.k * p.k) * p.Lm * o.N;

    // Minimum effective loop inductance to stay inside that ripple. [IFX Eq. 11]
    o.LctMin = (p.k * (o.nMax * p.vin - o.N * p.vout) * o.dHF) / (o.dILcMax * o.fHF);
    o.LcMin = o.LctMin - o.leak;
    o.leakSufficient = o.LcMin <= 0;

    // Worst-case secondary loop voltage: all phases on.  [TI Eq. 24]
    o.vSecPeak = EQ.vLcMax({ nOn: o.N, vin: p.vin, N: o.N, vout: p.vout });

    // Loop resistance contributed by this module set.  [IFX Eq. 57]
    o.rLoopModules = o.N * p.rSec;
    o.pPriPerPhase = p.iRated * p.iRated * p.rPri;

    return { p: p, o: o };
  }

  /* ---------- render ---------- */
  function row(name, value, ref, verdict) {
    var chip = "", cls = "";
    if (verdict) {
      cls = verdict.ok ? " ok" : " no";
      chip = '<span class="chip' + cls + '">' + verdict.label + "</span>";
    }
    return '<div class="row"><span class="name">' + name + "</span>" +
           '<span class="val' + cls + '">' + value + chip + "</span>" +
           '<span class="ref">' + ref + "</span></div>";
  }

  function render() {
    var r = compute(), p = r.p, o = r.o;

    $("m-scale").innerHTML =
      row("Total phases", o.N + " (" + p.count + " \u00D7 " + p.stages + ")",
          "modules \u00D7 phases per module") +
      row("Total rated current", o.iTotal.toFixed(0) + " A",
          "N \u00D7 rated per phase") +
      row("Duty cycle", (o.D * 100).toFixed(2) + " %", "D = V_OUT / V_IN") +
      row("L_C excitation frequency", eng(o.fHF, "Hz", 2), "f_HF = N \u00D7 f_SW") +
      row("Module magnetizing ripple", o.iMag.toFixed(1) + " A",
          "IFX Eq. 4 \u2014 independent of N and L_C",
          { ok: o.magPct >= 15 && o.magPct <= 45,
            label: o.magPct.toFixed(0) + "% of rated" });

    $("m-limits").innerHTML =
      row("Max loop ripple \u0394I_Lc", o.dILcMax.toFixed(1) + " A",
          "IFX Eq. 18 rearranged \u2014 headline spec",
          { ok: o.dILcMax > 0, label: o.dILcMax > 0 ? "has headroom" : "saturates" }) +
      row("Min effective loop L (L_CT)", eng(o.LctMin, "H", 1),
          "IFX Eq. 11 solved for L_CT") +
      row("Minimum L_C required",
          o.leakSufficient ? "none needed" : eng(o.LcMin, "H", 1),
          o.leakSufficient
            ? "leakage alone exceeds L_CT min \u2014 L_C free for transient tuning"
            : "L_CT min minus module leakage",
          { ok: o.leakSufficient, label: o.leakSufficient ? "leakage covers it" : "L_C mandatory" }) +
      row("Secondary interconnect voltage", o.vSecPeak.toFixed(0) + " V",
          "TI Eq. 24 with all phases on \u2014 worst case",
          { ok: o.vSecPeak <= 100, label: o.vSecPeak > 100 ? "high \u2014 check rating" : "under 100 V" });

    $("m-loop").innerHTML =
      row("Leakage into loop", eng(o.leak, "H", 1),
          "REN, (1 - k\u00B2) \u00D7 L_M \u00D7 N") +
      row("Secondary DCR in loop", (o.rLoopModules * 1e3).toFixed(2) + " m\u2126",
          "IFX Eq. 57 \u2014 N windings in series") +
      row("Primary loss per phase", o.pPriPerPhase.toFixed(2) + " W",
          "I\u00B2R at rated current");
  }

  /* ---------- mode switching ---------- */
  var sec = buildDom();
  var btn = document.createElement("button");
  btn.type = "button";
  btn.id = "modeBtn";
  btn.textContent = "Module mode";
  document.querySelector(".toolbar").insertBefore(
    btn, document.querySelector(".toolbar").firstChild);

  btn.addEventListener("click", function () {
    var showModule = sec.hidden;
    sec.hidden = !showModule;
    document.querySelector("main").hidden = showModule;
    btn.textContent = showModule ? "Design mode" : "Module mode";
    if (showModule) render();
  });

  IDS.forEach(function (id) { $(id).addEventListener("input", render); });

  /* decorate the ? markers on module-mode inputs too */
  var labels = sec.querySelectorAll("label[data-term]");
  for (var i = 0; i < labels.length; i++) {
    var q = document.createElement("span");
    q.className = "q";
    q.tabIndex = 0;
    q.textContent = "?";
    q.setAttribute("data-term", labels[i].getAttribute("data-term"));
    labels[i].insertBefore(q, labels[i].querySelector(".u"));
  }

  render();
})();
