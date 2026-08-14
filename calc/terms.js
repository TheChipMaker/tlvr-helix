/* ===========================================================================
   terms.js — glossary shown in the "?" hover tooltips.
   Each entry: { t: title, d: description, src: source reference }
   =========================================================================== */

var TERMS = {
  /* --- operating point --- */
  vin: {
    t: "Input voltage (V_IN)",
    d: "The bus voltage feeding the high-side FET of every phase. Sets the on-state magnetizing voltage (V_IN - V_OUT) and, importantly for TLVR, appears in the compensating-loop voltage N_ON x V_IN - N x V_OUT.",
    src: "TI Eq. 6, 24"
  },
  vout: {
    t: "Output voltage (V_OUT)",
    d: "The regulated rail delivered to the load. With V_IN fixed it sets the duty cycle D = V_OUT / V_IN, which drives pulse overlap and therefore the whole Lc ripple picture.",
    src: "TI Eq. 7"
  },
  fsw: {
    t: "Switching frequency per phase (f_SW)",
    d: "Frequency of each individual phase. The compensating inductor sees N x f_SW, not f_SW, so a 4-phase design at 600 kHz runs 2.4 MHz through Lc. Higher f_SW shrinks the magnetics but pushes Lc core loss up fast.",
    src: "TI, LC Inductor Selection"
  },
  nph: {
    t: "Phase count (N_TOTAL)",
    d: "Number of paralleled phases sharing one Lc loop. TLVR benefit scales with N: the transient boost term goes as N-squared, but so does the un-cancelled Lc ripple. TLVR is normally favoured above 6 phases.",
    src: "TI Eq. 18, 20, 25"
  },
  itdc: {
    t: "Thermal design current (I_TDC)",
    d: "Sustained DC output current the rail must carry. Divided by N it gives the per-phase DC pedestal that sets power-stage conduction loss and inductor DC bias.",
    src: "Design input"
  },
  k: {
    t: "Coupling coefficient (k)",
    d: "How tightly the primary and secondary windings of the trans-inductor are coupled. Real parts land around 0.95-0.99. Leakage (1-k) blunts the Lc coupling, so k appears squared in the transient and ripple terms.",
    src: "IFX Eq. 11, 29; REN"
  },

  /* --- magnetics --- */
  lm: {
    t: "Magnetizing inductance (L_M)",
    d: "The primary-side inductance of each trans-inductor, equivalent to the filter inductor of a plain multiphase buck. Sets the steady-state phase ripple exactly as in a buck converter.",
    src: "TI Eq. 8"
  },
  lc: {
    t: "Compensating inductor (L_C)",
    d: "The inductor closing the series secondary loop. This is the component that makes a TLVR a TLVR. Smaller L_C means a faster current slew during transients but larger steady-state ripple and higher RMS loss. Start at L_C = L_M; 0.8x to 1.5x L_M is the usual discrete range.",
    src: "TI, LC Inductor Selection"
  },
  rlc: {
    t: "L_C winding resistance (R_DCR,Lc)",
    d: "DC resistance of the compensating inductor itself. Combines with the secondary DCRs and routing to set both the loop decay time constant and the conduction loss.",
    src: "TI Eq. 23, 26"
  },
  rsec: {
    t: "Secondary winding resistance (R_DCR,sec)",
    d: "DC resistance of one trans-inductor secondary winding. It appears multiplied by N because all N secondaries sit in series in the compensating loop.",
    src: "TI Eq. 23, 26"
  },
  rroute: {
    t: "Loop routing resistance (R_routing)",
    d: "Copper resistance of the PCB trace closing the Lc loop. Easy to underestimate on interleaved layouts where loops span the board.",
    src: "TI Eq. 26"
  },
  pcore: {
    t: "L_C core loss (P_core,Lc)",
    d: "Magnetic loss in the compensating inductor core. Significant here because the part is excited at N x f_SW. Take it from the vendor curve at that frequency and the calculated ripple.",
    src: "TI Eq. 26"
  },

  /* --- transient --- */
  istep: {
    t: "Load step size (I_STEP)",
    d: "Magnitude of the current step the rail must absorb. It enters the capacitor sizing squared, so it dominates C_OUT more than any other single input.",
    src: "TI Eq. 1"
  },
  tstep: {
    t: "Load step duration (T_step)",
    d: "Time over which the load applies its step. I_STEP / T_step is the slew rate the converter must match to avoid dumping charge out of C_OUT.",
    src: "IFX Eq. 30"
  },
  dvac: {
    t: "Allowed AC deviation (dV_ac)",
    d: "Voltage excursion budget beyond the load-line allowance. This is the number the whole transient design is fighting for.",
    src: "TI Eq. 1"
  },
  rll: {
    t: "Load line (R_LL)",
    d: "Deliberate output impedance that lets V_OUT droop with load current. A non-zero load line widens the usable transient window; zero load line is the hardest case.",
    src: "Design input"
  },
  tresp: {
    t: "Controller response time (t_RESP)",
    d: "Time from the load step until the controller has ramped I_SUM to the new level. Directly sets how much current L_C builds during the event, so it drives the L_C saturation requirement.",
    src: "TI Eq. 22"
  },
  non: {
    t: "Phases turned on in the step (N_ON,step)",
    d: "How many phases the controller fires simultaneously when it detects the step. Often fewer than N_TOTAL. This term sets both the transient slope and the peak voltage stress on L_C.",
    src: "TI Eq. 18, 22, 24"
  },
  dramp: {
    t: "Ramp duty cycle (D_ramp)",
    d: "The effective duty cycle the controller commands during the transient ramp, usually well above the steady-state D and possibly with pulse overlap. Used to check whether L_C is small enough to hit the required slew.",
    src: "IFX Eq. 30, 31"
  },
  tdelay: {
    t: "Controller delay (t_delay)",
    d: "Dead time before the controller actually reaches D_ramp. During this window the output capacitors alone supply the step, which sets a hard minimum on local MLCC capacitance.",
    src: "IFX Eq. 32"
  },
  cout: {
    t: "Output capacitance (C_OUT)",
    d: "Total bulk plus ceramic capacitance at the load. Enter your actual planned value here; the tool compares it against what the transient spec demands.",
    src: "TI Eq. 1"
  },

  /* --- results --- */
  duty: {
    t: "Duty cycle (D)",
    d: "V_OUT / V_IN. At low output voltages this gets very small, so check the resulting on-time against the controller's minimum on-time before committing to a switching frequency.",
    src: "TI"
  },
  ton: {
    t: "On-time (t_ON)",
    d: "D / f_SW: how long the high-side FET conducts each cycle. If this falls near the controller or power-stage minimum, drop f_SW.",
    src: "Derived"
  },
  nmax: {
    t: "Max simultaneous phases on (N_SimOnMax)",
    d: "Roundup(N x D). Tells you how many phases overlap in the on-state at steady state, which governs the Lc excitation.",
    src: "IFX Eq. 7"
  },
  dhf: {
    t: "Overlap duty (D_HF)",
    d: "Fractional part of N x D. When it reaches zero the phases interleave perfectly and Lc ripple collapses; that is the sweet spot visible in TI's ripple-vs-duty plot.",
    src: "IFX Eq. 9"
  },
  fhf: {
    t: "L_C excitation frequency (f_HF)",
    d: "N x f_SW. The frequency the compensating inductor actually operates at, and the frequency you must read its core-loss curve at.",
    src: "TI, IFX Eq. 11"
  },
  lct: {
    t: "Effective loop inductance (L_CT)",
    d: "The inductance the compensating loop really presents: L_C plus the leakage of all N series secondary windings, (1-k^2) x L_M x N. Always larger than L_C alone. Using bare L_C over-predicts loop ripple by tens of percent, so this correction matters.",
    src: "Renesas; validated against their worked example"
  },
  ilcrip: {
    t: "L_C ripple current (dI_Lc,pk-pk)",
    d: "Peak-to-peak AC current circulating in the compensating loop. At steady state L_C carries no DC, only this ripple, so it sets the RMS loss entirely.",
    src: "IFX Eq. 11"
  },
  imagrip: {
    t: "Magnetizing ripple (dI_mag,ph)",
    d: "The plain-buck component of per-phase ripple, set only by L_M, V_IN and D. Target roughly 30-40% of the per-phase DC current.",
    src: "IFX Eq. 13"
  },
  iphrip: {
    t: "Total phase ripple (dI_ph,pk-pk)",
    d: "Magnetizing ripple plus the coupled Lc contribution. This is what the power stage actually sees, and it is why TLVR power stages need higher RMS and peak ratings than buck equivalents.",
    src: "IFX Eq. 12"
  },
  ioutrip: {
    t: "Summed output ripple (dI_out,pk-pk)",
    d: "Ripple on I_SUM. In a buck the phase ripples cancel by interleaving, but the Lc contribution adds once per phase and does not cancel. Expect 25-50% more than an equivalent buck.",
    src: "IFX Eq. 17; TI Eq. 25"
  },
  irmslc: {
    t: "L_C RMS current (I_rms,Lc)",
    d: "dI_Lc divided by root 12. Pure ripple, no DC term, because the loop carries no average current at steady state.",
    src: "TI Eq. 21"
  },
  ltrans: {
    t: "Effective transient inductance (L_trans)",
    d: "The inductance the converter behaves as during a transient, far lower than L_M because the Lc loop contributes in parallel. This is the whole point of the topology.",
    src: "IFX Eq. 29"
  },
  slopeup: {
    t: "Rising I_SUM slope",
    d: "How fast the converter can ramp total current up after a load step. The TLVR term adds N x (N_ON x V_IN - N x V_OUT) / L_C on top of the buck slope.",
    src: "TI Eq. 18"
  },
  slopedn: {
    t: "Falling I_SUM slope",
    d: "How fast current ramps down on a load release. The TLVR advantage here scales with N squared, which is why release overshoot improves so much.",
    src: "TI Eq. 20"
  },
  coutreq: {
    t: "Required C_OUT",
    d: "Capacitance needed to keep the excursion inside dV_ac plus the load-line allowance, given the achievable slope. Compare against your planned C_OUT.",
    src: "TI Eq. 1"
  },
  coutdelay: {
    t: "Minimum C_OUT for controller delay",
    d: "Charge the capacitors must supply before the controller even reaches its ramp duty cycle. Usually covered by MLCCs at the load, and often the stricter of the two capacitance criteria.",
    src: "IFX Eq. 32"
  },
  lcmax: {
    t: "Maximum L_C for slew target",
    d: "Largest compensating inductance that still lets the current ramp keep up with the load step. If your chosen L_C exceeds this, the rail cannot track the step regardless of capacitance.",
    src: "IFX Eq. 31"
  },
  isatlc: {
    t: "L_C saturation current needed",
    d: "Current L_C builds during the response window. TI's wording is 'much greater than', so treat this as a floor and add real margin, or use a soft-saturating core.",
    src: "TI Eq. 22"
  },
  vlcmax: {
    t: "Peak L_C voltage (dV_Lc,max)",
    d: "N_ON x V_IN - N x V_OUT. This can exceed V_IN during a step. Not a creepage concern since it is brief, but it matters for component voltage rating and insulation.",
    src: "TI Eq. 24"
  },
  taulc: {
    t: "L_C loop time constant (tau_Lc)",
    d: "How quickly the built-up loop current decays after a transient. If repetitive steps arrive faster than this, Lc current will not fully settle between events.",
    src: "TI Eq. 23"
  },
  plc: {
    t: "L_C loop power loss (P_Lc)",
    d: "Conduction loss on the loop RMS current plus core loss. Present only in TLVR designs, and the main reason TLVR efficiency lands slightly below an equivalent buck.",
    src: "TI Eq. 26"
  },
  vrip: {
    t: "Output voltage ripple",
    d: "First-order estimate from the summed current ripple into C_OUT. Real ripple depends on the PDN impedance between converter and load, so treat this as indicative only.",
    src: "TI Fig. 19"
  },
  iphdc: {
    t: "Per-phase DC current",
    d: "I_TDC divided by N. Check this against the power stage thermal derating curve at your ambient and airflow, not against the absolute maximum rating.",
    src: "Derived"
  },
  iphpk: {
    t: "Per-phase peak current",
    d: "DC pedestal plus half the total phase ripple. Must sit inside the power stage peak rating, and the trans-inductor must not saturate here.",
    src: "Derived"
  },
  iphrms: {
    t: "Per-phase RMS current",
    d: "Drives power-stage conduction loss and heating. TLVR designs run higher phase RMS than buck for the same load because of the added Lc ripple.",
    src: "TI, Power Loss"
  }
};
