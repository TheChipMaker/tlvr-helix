/* ===========================================================================
   equations.js  —  TLVR design equations
   All formulas traceable to the three source documents:
     [TI]  "Introduction to the Trans-Inductor Voltage Regulator (TLVR)" Rev. A
     [IFX] Infineon AN "Multiphase buck converter with TLVR output filter" v1.4
     [REN] Renesas "TLVR Design Equations" 06/03/20
   Units used internally: V, A, s, H, F, ohm, W.
   =========================================================================== */

var EQ = {};

/* --- topology / timing -------------------------------------------------- */

// D = Vout / Vin   [TI, IFX]
EQ.dutyCycle = (vin, vout) => vout / vin;

// Nsim_on_max = roundup(N*D)   [IFX Eq. 7]
EQ.nSimOnMax = (N, D) => Math.max(1, Math.ceil(N * D));

// Nsim_on_min   [IFX Eq. 8]
EQ.nSimOnMin = (N, D) => {
  const nMax = EQ.nSimOnMax(N, D);
  return Math.abs(nMax - N * D) < 1e-9 ? nMax : Math.max(0, nMax - 1);
};

// D_HF = N*D - INT(N*D)   [IFX Eq. 9]  (overlap duty of the ripple frequency)
EQ.dHF = (N, D) => N * D - Math.trunc(N * D);

// t_overlap = Tsw * [D - INT(N*D)/N]   [IFX Eq. 10]
EQ.tOverlap = (N, D, fsw) => (1 / fsw) * (D - Math.trunc(N * D) / N);

// Lc loop switches at N * fsw (no pulse overlap)   [TI, IFX]
EQ.fHF = (N, fsw) => N * fsw;

/* --- dual-phase mode (phase multiplication) ----------------------------- */

// M power stages share one PWM output. Infineon: treat as one phase carrying
// M x the current, with L_M and L_C both divided by M. Phase count collapses
// to the PWM channel count. Returns the scaled parameter set; LmLeak carries
// the raw per-transformer L_M forward for the leakage term.
// NOTE: (Lm/M)/(Lc/M) = Lm/Lc, so slew and bandwidth gain track PWM COUNT,
// not stage count. M buys current density, not transient performance.
EQ.dualPhase = ({ Lm, Lc, nStages, M }) => ({
  M: M,
  nPhys: nStages,
  N: nStages / M,
  Lm: Lm / M,
  Lc: Lc / M,
  LmLeak: Lm
});

/* --- steady-state ripple ------------------------------------------------ */

// Effective compensating-loop inductance including winding leakage.
// Lct = (1-k^2)*Lm*N + Lc   [REN]
// The N series secondaries each contribute leakage (1-k^2)*Lm, which adds to Lc.
// Validated: applying Lct reproduces the Renesas worked example (dI_Lc = 1.88 A,
// summed ripple = 15.8 A) where bare Lc over-predicts both by ~42%.
// LmLeak is the UNSCALED per-transformer L_M. In dual-phase mode Lm arrives
// pre-divided by M (Infineon) but leakage counts physical secondaries, and
// (1-k^2)*Lm*N_phys/M is identically (1-k^2)*Lm*N_pwm — so pass raw Lm here.
// Omit LmLeak (M=1) and this is bit-identical to the validated single-stage form.
EQ.lct = ({ k, N, Lm, Lc, LmLeak }) =>
  (1 - k * k) * (LmLeak === undefined ? Lm : LmLeak) * N + Lc;

// dI_Lc_pkpk = k*(NsimOnMax*Vin - N*Vout) * D_HF / (Lct * f_HF)   [IFX Eq. 11 + REN Lct]
// Set leakage=false to use bare Lc (Infineon form) instead.
EQ.iLcRipple = ({ k, N, D, vin, vout, Lc, Lm, LmLeak, fsw, leakage = true }) => {
  const nMax = EQ.nSimOnMax(N, D);
  const dhf = EQ.dHF(N, D);
  const fhf = EQ.fHF(N, fsw);
  const Leff = leakage && Lm ? EQ.lct({ k, N, Lm, Lc, LmLeak }) : Lc;
  return (k * (nMax * vin - N * vout) * dhf) / (Leff * fhf);
};

// dI_mag_ph = Vin/(Lm*fsw) * (1-D) * D   [IFX Eq. 13, magnetizing term]
EQ.iMagRipple = ({ vin, Lm, fsw, D }) => (vin / (Lm * fsw)) * (1 - D) * D;

// dI_ph_pkpk = dI_mag_ph + k * dI_Lc_pkpk   [IFX Eq. 12]
EQ.iPhaseRipple = (iMag, k, iLc) => iMag + k * iLc;

// dI_out_pkpk   [IFX Eq. 17] — total (summed) output ripple current
EQ.iOutRipple = ({ k, N, D, fsw, iLc, iMag }) => {
  const nMax = EQ.nSimOnMax(N, D);
  const tov = EQ.tOverlap(N, D, fsw);
  const Tsw = 1 / fsw;
  return (
    k * N * iLc +
    ((iMag * tov) / Tsw) * (nMax / D - (N - nMax) / (1 - D))
  );
};

// Irms_Lc ~= dI_Lc / sqrt(12)   [TI Eq. 21]
EQ.iRmsLc = (iLcPkPk) => iLcPkPk / Math.sqrt(12);

// Output voltage ripple across the PDN impedance (first-order, Cout only)
// dV = dI_out / (8 * f_HF * Cout)  — standard buck ripple form at the
// effective ripple frequency. [TI Fig. 19 model, simplified]
EQ.vOutRipple = ({ iOut, N, fsw, Cout }) =>
  iOut / (8 * EQ.fHF(N, fsw) * Cout);

/* --- transient ---------------------------------------------------------- */

// L_trans (whole regulator) = Lm*Le / (k^2*N^2*Lm + N*Le)   [IFX Eq. 29]
// Le = Lct when leakage is accounted for, else bare Lc.
EQ.lTrans = ({ Lm, Lc, k, N, LmLeak, leakage = true }) => {
  const Le = leakage ? EQ.lct({ k, N, Lm, Lc, LmLeak }) : Lc;
  return (Lm * Le) / (k * k * N * N * Lm + N * Le);
};

// Per-phase equivalent transient inductance   [REN]
// L_eq_ph = Lct * Lm / (Lc + N*Lm)   — validated: 24.3 nH on the Renesas example
EQ.lTransPhase = ({ Lm, Lc, k, N, LmLeak }) =>
  (EQ.lct({ k, N, Lm, Lc, LmLeak }) * Lm) / (Lc + N * Lm);

// Rising Isum slope, multiphase buck   [TI, Eq. 15/16 basis]
EQ.slopeUpBuck = ({ nOn, N, vin, vout, Lm }) =>
  (nOn * (vin - vout)) / Lm - ((N - nOn) * vout) / Lm;

// Rising Isum slope, TLVR   [TI Eq. 18]
EQ.slopeUpTlvr = ({ nOn, N, vin, vout, Lm, Lc, k, LmLeak, leakage = true }) => {
  const Le = leakage ? EQ.lct({ k, N, Lm, Lc, LmLeak }) : Lc;
  return EQ.slopeUpBuck({ nOn, N, vin, vout, Lm }) +
    (N * (nOn * vin - N * vout)) / Le;
};

// Falling Isum slope, multiphase buck   [TI Eq. 19]
EQ.slopeDownBuck = ({ N, vout, Lm }) => -(N * vout) / Lm;

// Falling Isum slope, TLVR   [TI Eq. 20]
EQ.slopeDownTlvr = ({ N, vout, Lm, Lc, k, LmLeak, leakage = true }) => {
  const Le = leakage ? EQ.lct({ k, N, Lm, Lc, LmLeak }) : Lc;
  return EQ.slopeDownBuck({ N, vout, Lm }) - (N * (N * vout)) / Le;
};

// Cout required to hold dV during the ramp   [TI Eq. 1, rearranged]
// dV = (1/2 * Istep^2 / Slope) / Cout  ->  Cout = 0.5*Istep^2/Slope/dV_total
// dV_total includes the load-line allowance: dVac + Rll*Istep
EQ.coutRequired = ({ iStep, slope, dVac, rLL }) => {
  const dvTotal = dVac + rLL * iStep;
  return (0.5 * (iStep * iStep)) / Math.abs(slope) / dvTotal;
};

// Cout to cover controller delay before reaching Dramp   [IFX Eq. 32]
EQ.coutMinDelay = ({ tDelay, iStep, dVout }) => (tDelay * iStep) / dVout;

// Maximum Lc that still meets the load-step slew target   [IFX Eq. 31]
// Lc <= k^2*N^2 / [ (dI/dt_step)/(Dramp*Vin - Vout) - N/Lm ]
EQ.lcMaxFromSlew = ({ k, N, iStep, tStep, dRamp, vin, vout, Lm }) => {
  const denom = iStep / tStep / (dRamp * vin - vout) - N / Lm;
  return denom > 0 ? (k * k * N * N) / denom : Infinity;
};

/* --- Lc component limits ------------------------------------------------ */

// Isat_Lc >> tresp * (Non*Vin - N*Vout) / Lc   [TI Eq. 22]
EQ.iSatLcNeeded = ({ tResp, nOn, vin, N, vout, Lc }) =>
  (tResp * (nOn * vin - N * vout)) / Lc;

// tau_Lc = Lc / (Rdcr_Lc + N*Rdcr_sec + Rrouting)   [TI Eq. 23]
EQ.tauLc = ({ Lc, rLc, rSec, N, rRoute }) =>
  Lc / (rLc + N * rSec + rRoute);

// dV_Lc_max = Non*Vin - N*Vout   [TI Eq. 24]
EQ.vLcMax = ({ nOn, vin, N, vout }) => nOn * vin - N * vout;

// P_Lc = Irms^2 * (Rdcr_Lc + N*Rdcr_sec + Rrouting) + Pcore   [TI Eq. 26]
EQ.pLcLoop = ({ iRms, rLc, rSec, N, rRoute, pCore }) =>
  iRms * iRms * (rLc + N * rSec + rRoute) + pCore;

/* --- per-phase currents ------------------------------------------------- */

EQ.iPhaseDC = (iTdc, N) => iTdc / N;

// Peak phase current including the full phase ripple
EQ.iPhasePeak = (iDC, iPhRipple) => iDC + iPhRipple / 2;

// Phase RMS, triangular ripple on a DC pedestal
EQ.iPhaseRms = (iDC, iPhRipple) =>
  Math.sqrt(iDC * iDC + (iPhRipple * iPhRipple) / 12);

/* --- on-time check ------------------------------------------------------ */

EQ.tOn = (D, fsw) => D / fsw;


/* ===========================================================================
   Additional sourced relationships used by the detail-panel charts.
   =========================================================================== */

// TLVR transformer saturation requirement   [IFX Eq. 18]
EQ.iSatTlvr = ({ iOutMax, N, dIph }) => iOutMax / N + dIph / 2;

// Low-side MOSFET RMS current   [TI Eq. 27]  (per-phase form)
EQ.iRmsLowSide = ({ iPhDC, D, dIph }) =>
  iPhDC * Math.sqrt(1 - D) * Math.sqrt(1 + (1 / 3) * Math.pow(dIph / (2 * iPhDC), 2));

// Output current slew advantage over a multiphase buck   [IFX Eq. 46]
EQ.slewGainVsBuck = ({ Lm, Lc, N }) => (Lm / Lc) * N;

// Control-loop crossover frequency gain   [IFX Eq. 47]
EQ.bwGainVsBuck = ({ k, Lm, Lc, N }) => Math.pow(1 + k * k * (Lm / Lc) * N, 2);

// Practical maximum crossover frequency   [IFX Eq. 48]
EQ.fcMax = ({ tDelay, k, Lm, Lc, N, fsw }) => {
  const g = Math.min(Math.pow(1 + k * k * (Lm / Lc) * N, 2), 8.5);
  return 1 / (tDelay + 1 / (0.10 * g * fsw));
};

// Input capacitance penalty vs an equivalent multiphase buck   [IFX Eq. 65]
EQ.cinPenalty = ({ Lm, Lc, N }) => (Lm / Lc) * N;

// Output voltage ripple including ESR and ESL   [IFX Eq. 19]
EQ.vOutRippleFull = ({ dIout, Cout, N, fsw, esr = 0, esl = 0 }) =>
  dIout * (1 / (8 * Cout * N * fsw) + esr + 2 * N * fsw * esl);

// Worst-case L_C current excursion during a load-step-on event   [IFX Eq. 50]
EQ.iLcTransOn = ({ k, tTransOn, dTrans, N, vin, vout, Lc }) =>
  (k * tTransOn * (dTrans * N * vin - N * vout)) / Lc;

// L_C current excursion during load release, ramps negative   [IFX Eq. 56]
EQ.iLcTransOff = ({ tTransOff, k, N, vout, Lc }) =>
  (tTransOff * k * N * vout) / Lc;