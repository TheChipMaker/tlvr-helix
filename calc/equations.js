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
// Clamped to [1, N]: more phases than exist cannot be on together, and the
// upper clamp keeps (N - Nsim_on_max) in Eq. 17 from going negative when a
// typed V_OUT > V_IN pushes D above 1.
EQ.nSimOnMax = (N, D) => Math.min(N, Math.max(1, Math.ceil(N * D)));

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
  LmRaw: Lm,
  LcRaw: Lc
});

// De-lump PWM-pair quantities back to per-transformer figures.
// Under Infineon's L_M -> L_M/M, magnetizing ripple and DC current come out
// as the PAIR total. Saturation, peak and FET RMS are per-device checks and
// need the stage figures. dI_Lc is NOT divided: the loop current couples into
// every transformer at full value through k.
// M = 1 returns the inputs unchanged.
EQ.stageSplit = ({ iPhDC, iMagPair, iLc, k, M }) => {
  const iMag = iMagPair / M;
  return {
    iDC:  iPhDC / M,
    iMag: iMag,
    iPh:  iMag + k * iLc
  };
};

// Module ripple budget. [IFX Eq. 18 rearranged]
//   I_sat >= I_rated + dI_ph/2  ->  dI_ph_allowed = 2*(I_sat - I_rated)
//   dI_ph = dI_mag + k*dI_Lc    ->  dI_Lc_allowed = (dI_ph_allowed - dI_mag)/k
// Both on PER-STAGE ripple, since I_sat is a per-transformer rating.
EQ.rippleBudget = ({ iSat, iRated, iMagStage, k }) => {
  const dIph = 2 * (iSat - iRated);
  return { dIphAllowed: dIph, dILcAllowed: (dIph - iMagStage) / k };
};

// IMON summing resistor. TDA22594A sources 5 uA/A; M stages on one PWM sum
// into one node, so the resistor scales down to hold the controller's V/A.
EQ.imonResistor = ({ rNominal = 1000, M }) => rNominal / M;

/* --- steady-state ripple ------------------------------------------------ */

// M x N recovers the physical secondary count from the PWM count; Lm is the
// already-scaled value. M defaults to 1, making this bit-identical to the
// validated single-stage form. Sweep-safe: a varying Lm carries its own
// leakage, which an absolute raw-Lm argument would not.
EQ.lct = ({ k, N, Lm, Lc, M = 1 }) => (1 - k * k) * Lm * M * N + Lc;

// dI_Lc_pkpk = k*(NsimOnMax*Vin - N*Vout) * D_HF / (Lct * f_HF)   [IFX Eq. 11 + REN Lct]
// Set leakage=false to use bare Lc (Infineon form) instead.
EQ.iLcRipple = ({ k, N, D, vin, vout, Lc, Lm, M, fsw, leakage = true }) => {
  const nMax = EQ.nSimOnMax(N, D);
  const dhf = EQ.dHF(N, D);
  const fhf = EQ.fHF(N, fsw);
  const Leff = leakage && Lm ? EQ.lct({ k, N, Lm, Lc, M }) : Lc;
  return (k * (nMax * vin - N * vout) * dhf) / (Leff * fhf);
};

// dI_mag_ph = Vin/(Lm*fsw) * (1-D) * D   [IFX Eq. 4]
// (Eq. 13 is the combined phase ripple; Eq. 4 is this term alone. Renesas'
//  I_Mpkpk = (Vin-Vout)*Vout/(Vin*Lp*fsw) is algebraically identical.)
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
EQ.lTrans = ({ Lm, Lc, k, N, M, leakage = true }) => {
  const Le = leakage ? EQ.lct({ k, N, Lm, Lc, M }) : Lc;
  return (Lm * Le) / (k * k * N * N * Lm + N * Le);
};

// Per-phase equivalent transient inductance   [REN]
// L_eq_ph = Lct * Lm / (Lc + N*Lm)   — validated: 24.38 nH vs Renesas' 24.3 nH
// NOT an independent second source. At M = 1 this is identically N * lTrans:
// substituting Lct = (1-k^2)*Lm*N + Lc into IFX Eq. 29 collapses its denominator
// to N^2*Lm + N*Lc = N*(Lc + N*Lm). Same physics, per-phase normalisation.
// At M > 1 the two drift (2.05x instead of 2.00x on the Helix cell) because
// lct's M multiplier enters Eq. 29's explicit k^2*N^2*Lm term and this form's
// (Lc + N*Lm) term asymmetrically. Unconfirmed against simulation at M > 1.
EQ.lTransPhase = ({ Lm, Lc, k, N, M }) =>
  (EQ.lct({ k, N, Lm, Lc, M }) * Lm) / (Lc + N * Lm);

// Rising Isum slope, multiphase buck   [TI, Eq. 15/16 basis]
EQ.slopeUpBuck = ({ nOn, N, vin, vout, Lm }) =>
  (nOn * (vin - vout)) / Lm - ((N - nOn) * vout) / Lm;

// Rising Isum slope, TLVR   [TI Eq. 18]
EQ.slopeUpTlvr = ({ nOn, N, vin, vout, Lm, Lc, k, M, leakage = true }) => {
  const Le = leakage ? EQ.lct({ k, N, Lm, Lc, M }) : Lc;
  return EQ.slopeUpBuck({ nOn, N, vin, vout, Lm }) +
    (N * (nOn * vin - N * vout)) / Le;
};

// Falling Isum slope, multiphase buck   [TI Eq. 19]
EQ.slopeDownBuck = ({ N, vout, Lm }) => -(N * vout) / Lm;

// Falling Isum slope, TLVR   [TI Eq. 20]
EQ.slopeDownTlvr = ({ N, vout, Lm, Lc, k, M, leakage = true }) => {
  const Le = leakage ? EQ.lct({ k, N, Lm, Lc, M }) : Lc;
  return EQ.slopeDownBuck({ N, vout, Lm }) - (N * (N * vout)) / Le;
};

// Cout required to hold dV during the ramp   [TI Eq. 4 (step up) / Eq. 5 (release)]
// Cout = (0.5 * Istep^2 / Slope) / dV_total,  dV_total = dVac + Rll*Istep
// The load-line term is explicit in TI Eq. 4/5; TI Eq. 1 is the same relation
// written without it.
EQ.coutRequired = ({ iStep, slope, dVac, rLL }) =>
  (0.5 * (iStep * iStep)) / Math.abs(slope) / EQ.dvBudget({ dVac, rLL, iStep });

// Total allowed output excursion for a load step of iStep.
// A load line moves the regulation target by Rll*Istep, so that shift is
// available on top of the AC window. Shared by every capacitance criterion so
// they are comparable when max()'d against one another.
EQ.dvBudget = ({ dVac, rLL = 0, iStep = 0 }) => dVac + rLL * iStep;

// Cout to cover controller delay before reaching Dramp   [IFX Eq. 32]
// Infineon writes the denominator as dVout without defining a load line, since
// the AN does not model one. Read here as the same total excursion TI Eq. 4/5
// uses, because coutRequired and this are max()'d together and must share a
// budget. Identical to bare Eq. 32 whenever Rll = 0.
EQ.coutMinDelay = ({ tDelay, iStep, dVac, rLL = 0 }) =>
  (tDelay * iStep) / EQ.dvBudget({ dVac, rLL, iStep });

// Maximum Lc that still meets the load-step slew target   [IFX Eq. 31]
// Lc <= k^2*N^2 / [ (dI/dt_step)/(Dramp*Vin - Vout) - N/Lm ]
// Infinity is the CORRECT answer, not a masked divide-by-zero: Eq. 31 comes from
// Eq. 30, dI/dt <= (Dramp*Vin - Vout)*(k^2*N^2/Lc + N/Lm). When N/Lm alone meets
// the target the inequality holds for every positive Lc, so there is no upper
// bound. denom < 0 is that case; denom == 0 divides to +Infinity anyway.
// Returns the M-scaled (model) value — multiply by M to compare against a
// typed L_C.
EQ.lcMaxFromSlew = ({ k, N, iStep, tStep, dRamp, vin, vout, Lm }) => {
  const denom = iStep / tStep / (dRamp * vin - vout) - N / Lm;
  return denom > 0 ? (k * k * N * N) / denom : Infinity;
};

/* --- Lc component limits ------------------------------------------------ */

// Isat_Lc >> tresp * (Non*Vin - N*Vout) / Lc   [TI Eq. 22]
// SUPERSEDED by EQ.iLcTransOn (IFX Eq. 50), which is the same quantity at
// higher source priority and adds the coupling factor k and the transient duty
// cycle D_trans. TI Eq. 22 is the D_trans = 1 limit of Eq. 50 without the k.
// Kept for comparison; not wired to the UI. See AUDIT-math.md.
EQ.iSatLcNeeded = ({ tResp, nOn, vin, N, vout, Lc }) =>
  (tResp * (nOn * vin - N * vout)) / Lc;

// tau_Lc = Lc / (Rdcr_Lc + N*Rdcr_sec + Rrouting)   [TI Eq. 23]
EQ.tauLc = ({ Lc, rLc, rSec, N, rRoute }) =>
  Lc / (rLc + N * rSec + rRoute);

// dV_Lc_max = Non*Vin - N*Vout   [TI Eq. 24]
// TRANSIENT bound: the controller deliberately turns Non phases on at once.
// Infineon's Eq. 58-61 give the STEADY-STATE bound instead — k*max(NsimOnMax*Vin
// - N*Vout, N*Vout), i.e. with a coupling factor and a load-release branch. That
// form is smaller than this one in every configuration checked (see
// AUDIT-math.md), so TI Eq. 24 is the governing number and is kept unmodified.
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
// This is the L_C saturation floor: the loop must stay in control, so I_SAT of
// the compensating inductor has to exceed it. Supersedes TI Eq. 22.
// Infineon folds "not every phase is fully on" into D_trans rather than into a
// separate N_ON count, so this does NOT depend on the `non` input.
// Per-channel vs physical: M cancels. (N/M) against (Lc/M) recovers
// nPhys*(D_trans*Vin - Vout)/Lc_raw, so the collapsed inputs give the true
// physical loop current. Feed the scaled N and Lc.
EQ.iLcTransOn = ({ k, tTransOn, dTrans, N, vin, vout, Lc }) =>
  (k * tTransOn * (dTrans * N * vin - N * vout)) / Lc;

// L_C current excursion during load release, ramps negative   [IFX Eq. 56]
EQ.iLcTransOff = ({ tTransOff, k, N, vout, Lc }) =>
  (tTransOff * k * N * vout) / Lc;