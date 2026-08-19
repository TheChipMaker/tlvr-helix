/* ===========================================================================
   terms.js — glossary shown in the "?" hover tooltips.
   Each entry: { t: title, d: description, src: source reference }
   =========================================================================== */

var TERMS = {
  /* --- operating point --- */
  vin: {
    t: "Input voltage (V_IN)",
    d: "The bus voltage feeding the high-side FET of every phase. Sets the on-state magnetizing voltage and the compensating-loop voltage.",
    long: [
      "V_IN sets the on-state magnetizing voltage across each primary winding, V_IN - V_OUT, exactly as in an ordinary buck converter. During the off-state that voltage becomes -V_OUT.",
      "What is specific to TLVR is the second role. The voltage across the compensating inductor is the sum of the magnetizing voltages of all phases, so it evaluates to N_ON x V_IN - N_TOTAL x V_OUT. With several phases on at once this can exceed V_IN itself, and it is the term that drives the loop ripple, the transient slew, and the voltage stress on L_C.",
      "V_IN also fixes the duty cycle D = V_OUT / V_IN. Lowering V_IN raises D, which moves the design along the ripple-versus-duty curve and changes how many phases overlap. That coupling is why V_IN cannot be treated as a free variable once the ripple budget is set.",
      "For the TDA22594A the recommended operating range is 4.25 V to 16 V, with an absolute maximum of 25 V on the VIN pin. The chart sweeps only the recommended range."
    ],
    src: "IFX Eq. 11; TI Eq. 6, 9, 24; TDA22594A Tables 5 and 7"
  },
  vout: {
    t: "Output voltage (V_OUT)",
    d: "The regulated rail delivered to the load. Sets the duty cycle, which drives pulse overlap and the whole L_C ripple picture.",
    long: [
      "V_OUT sets the duty cycle D = V_OUT / V_IN, and D in turn decides how many phases conduct simultaneously. Infineon defines that count as roundup(N x D), with the fractional part N x D - INT(N x D) becoming the overlap duty D_HF that scales the loop ripple directly.",
      "The consequence is a ripple curve with sharp minima. Whenever N x D lands exactly on an integer, the phases overlap perfectly, the maximum and minimum simultaneous phase counts become equal, and the loop ripple falls to zero. The calculator reproduces this: at N = 4 and V_IN = 12 V, an output of 3.0 V gives N x D = 1 and computes exactly zero ripple.",
      "Away from those points a TLVR carries roughly 25 to 50 percent more summed ripple current than an equivalent multiphase buck, and therefore proportionally more output voltage ripple. TI notes this is often tolerable, because the capacitance demanded by the transient specification usually exceeds what the ripple specification alone would require.",
      "At 0.75 V with four phases, N x D = 0.25 sits well away from a cusp, so this design does not benefit from the cancellation. The chart shows where the nearest minima lie."
    ],
    src: "IFX Eq. 7-11; TI Fig. 20 and Steady-State Ripple section"
  },
  fsw: {
    t: "Switching frequency per phase (f_SW)",
    d: "Frequency of each individual phase. The compensating inductor is excited at N x f_SW, so its core loss rises far faster than the phase frequency suggests.",
    long: [
      "Every ripple term carries f_SW in its denominator, so raising the frequency shrinks both the magnetizing ripple and the loop ripple. On its own that makes higher frequencies look like a free improvement.",
      "It is not free, because the compensating inductor does not switch at f_SW. Infineon and TI both give its excitation frequency as N x f_SW when there is no pulse overlap. In this four-phase design, 600 kHz per phase means 2.4 MHz through L_C, and 1 MHz per phase would mean 4 MHz. Ferrite core loss climbs steeply over that range, which is why TI recommends low core-loss materials for this component specifically.",
      "Frequency also bounds the control loop. Infineon limits the practical crossover frequency to between 10 and 85 percent of f_SW, further reduced by the controller's own delay. Their worked example of 500 kHz with eight phases and L_M equal to L_C yields a maximum crossover of about 385 kHz.",
      "Read the right-hand axis of the chart against your L_C vendor's core-loss curve at that frequency. The ripple benefit on the left axis is only half the trade."
    ],
    src: "IFX Eq. 4, 5, 11, 48; TI, LC Inductor Selection"
  },
  nph: {
    t: "Phase count (N_TOTAL)",
    d: "Number of paralleled phases sharing one L_C loop. The transient benefit scales with N, but so does the un-cancelled loop ripple contribution.",
    long: [
      "Phase count enters the TLVR relationships more than once. The loop voltage is N_ON x V_IN - N_TOTAL x V_OUT, the falling slope gains a term proportional to N squared, and the slew advantage over an equivalent buck approaches (L_M / L_C) x N for tight coupling.",
      "The cost appears in the ripple. In an ordinary multiphase buck the phase ripples cancel through interleaving. In a TLVR the loop current I_LC adds once for every phase and does not cancel, so the summed ripple carries a term k x N x dI_Lc that grows with phase count.",
      "TI states that as loop ripple increases at lower phase numbers this additional component can become significant, and gives that as one reason TLVR designs are typically reserved for high-power designs above six phases. This four-phase design sits below that guidance, which is a deliberate accepted trade rather than an oversight.",
      "Phase count also interacts with duty cycle through N x D, so changing N moves the design along the same cusped ripple curve that V_OUT does. The chart shows both effects together: summed ripple on the left, slew advantage on the right."
    ],
    src: "IFX Eq. 7, 16, 17, 46; TI Eq. 18, 20, 25 and Power Loss section"
  },
  itdc: {
    t: "Thermal design current (I_TDC)",
    d: "Sustained DC output current the rail must carry. Divided by N it sets the per-phase pedestal driving conduction loss and inductor DC bias.",
    long: [
      "I_TDC divided by phase count gives the DC pedestal each phase carries. The ripple current rides on top of that pedestal, so the peak a phase actually sees is the DC value plus half the total phase ripple.",
      "That peak sets the transformer requirement. Infineon states the TLVR transformer saturation current must be at least I_out_max / N plus half the peak-to-peak phase ripple. Because TLVR phase ripple includes the coupled loop contribution, this requirement is higher than the equivalent buck design would produce at the same load.",
      "The same ripple raises conduction loss in the power stage. TI's low-side RMS expression shows RMS current rising with the square of the ripple-to-DC ratio, which is why TLVR-optimised power stages must be rated for higher RMS current and for peak pulses approaching twice their RMS rating.",
      "One caution on the device limit shown in red: 90 A is the TDA22594A absolute maximum average output current, not a usable continuous rating. The datasheet thermal derating curve reduces the permissible continuous current with ambient temperature and airflow. Read your real operating point off that curve rather than designing to the absolute maximum."
    ],
    src: "IFX Eq. 18; TI Eq. 27 and TLVR-Optimized Components; TDA22594A Tables 5 and 8, Figure 7"
  },
  k: {
    t: "Coupling coefficient (k)",
    d: "How tightly primary and secondary windings couple. Real parts land near 0.95 to 0.99, and leakage appears squared in the ripple and transient terms.",
    long: [
      "Perfect coupling does not exist. The shortfall shows up as leakage inductance, and because all N secondary windings sit in series in the compensating loop, each contributes leakage to that loop. The effective loop inductance is therefore larger than L_C alone.",
      "Renesas expresses this as L_CT = (1 - k squared) x L_M x N + L_C. This correction is substantial, not a refinement: for their eight-phase example with L_M = 200 nH, L_C = 150 nH and k = 0.98, the effective loop inductance is 213 nH rather than 150 nH. Using bare L_C over-predicted the loop ripple by roughly 40 percent in this calculator until the correction was applied.",
      "Because leakage raises effective loop inductance, higher k means lower L_CT, which means more loop ripple but faster transient response. Coupling is therefore not simply better when tighter; it moves the same trade-off that L_C does.",
      "Coupling also sets the achievable control bandwidth. Infineon gives the crossover gain over an equivalent buck as the square of (1 + k squared x L_M / L_C x N), so k appears squared there too. Note that this gain saturates in practice against the limit in their Equation 48.",
      "Take k from the transformer datasheet where it is published. Where it is not, measure it rather than assuming, since the chart shows results are sensitive across the plausible 0.90 to 0.99 range."
    ],
    src: "Renesas L_CT derivation; IFX Eq. 11, 29, 47, 48"
  },

  /* --- magnetics --- */
  lm: {
    t: "Magnetizing inductance (L_M)",
    d: "The primary-side inductance of each trans-inductor. Sets steady-state phase ripple exactly as a buck filter inductor does.",
    long: [
      "In steady state L_M behaves exactly like the filter inductor of an ordinary multiphase buck. The magnetizing ripple is V_IN x (1 - D) x D / (L_M x f_SW), with no dependence on L_C or coupling. A common target is 30 to 40 percent of the per-phase DC current.",
      "In a plain buck the inductance is the single lever for transient response, and TI notes it cannot be made small without penalty: lower inductance means higher current ripple, higher output voltage ripple, and higher RMS current in every phase, which costs efficiency. The value is therefore always a compromise.",
      "TLVR breaks that compromise. During a transient the effective inductance becomes L_M x L_C / (k squared x N squared x L_M + N x L_C), which is far lower than L_M itself. That lets you choose L_M for steady-state ripple and efficiency, and use L_C to buy the transient response separately.",
      "L_M still bounds L_C, though. Infineon's expression for the largest permissible L_C contains a term N / L_M, and if that term alone already exceeds the required slew rate, no value of L_C can meet the target. Infineon's stated order of work is to pick L_M for overshoot and saturation first, then solve for L_C.",
      "Note that raising L_M lowers phase ripple but raises the effective loop inductance L_CT, because leakage scales with L_M. The two effects pull in opposite directions on the loop, which the chart shows."
    ],
    src: "IFX Eq. 4, 29, 30, 31; TI Converter Transient Response and Eq. 8"
  },
  lc: {
    t: "Compensating inductor (L_C)",
    d: "The inductor closing the series secondary loop. This is the component that makes a TLVR a TLVR.",
    long: [
      "L_C sets how much of the transient benefit you get. Smaller values ramp current faster and cut the output capacitance you need, at the cost of higher steady-state loop ripple, higher RMS loss, and greater stress on the part.",
      "TI recommends starting at L_C equal to L_M as a balanced trade-off, with 0.8 to 1.5 times L_M common in discrete designs. Lower values are more typical of highly integrated designs such as power modules.",
      "At steady state L_C carries no DC current at all, only AC ripple, so its RMS current is set entirely by that ripple. Because it is excited at N x f_SW, TI advises low core-loss materials such as ferrite, and notes that soft-saturating cores may further improve transient response.",
      "Saturation is the critical failure mode, and Infineon is blunt about the consequence: if L_C saturates the steep current ramp is translated into every phase, driving the TLVR transformers into saturation as well. The controller then loses control and the power stage sees what is effectively a short, which can destroy it. L_C must never be allowed to saturate.",
      "For scale, two real parts from the Renesas material: a hard-saturating ferrite at 150 nH with 52 A saturation and 0.17 milliohm DCR in a 6.5 by 6.5 by 10 mm body, and a soft-saturating moulded part at 100 nH with 50 A saturation and 0.8 milliohm DCR in a lower-profile 7.3 by 6.8 by 2.4 mm body. Infineon also notes several L_C parts may be placed in series to reach a target value, which helps with EMI propagation and PCB prepreg breakdown concerns at high phase count."
    ],
    src: "TI LC Inductor Selection, Eq. 21, 22; IFX Sections 2.5, 3; Renesas layout examples"
  },
  rlc: {
    t: "L_C winding resistance (R_DCR,Lc)",
    d: "DC resistance of the compensating inductor. Sets loop decay time together with the secondary and routing resistance.",
    long: [
      "This resistance sits in the compensating loop, which carries only AC current in steady state. Renesas notes that because this path sees no DC load current, its resistance can be tolerated higher than the primary winding path, where DC current makes low resistance critical.",
      "That said, it still does two jobs. It contributes to the loop conduction loss, which scales with the square of the loop RMS current, and it sets how quickly loop current decays after a transient.",
      "Real parts vary widely. The two Renesas examples span 0.17 milliohm for a taller hard-saturating ferrite and 0.8 milliohm for a low-profile soft-saturating moulded part, which is nearly a factor of five for the same functional role. Form factor, saturation behaviour and resistance are traded against each other in the same part choice.",
      "The chart plots decay time and loop loss against total loop resistance, so you can see what changing this component actually buys."
    ],
    src: "IFX Eq. 57; TI Eq. 23, 26; Renesas equivalent circuit model and layout examples"
  },
  rsec: {
    t: "Secondary winding resistance (R_DCR,sec)",
    d: "DC resistance of one trans-inductor secondary. Multiplied by N, since all secondaries sit in series in the loop.",
    long: [
      "All N secondary windings are connected in series in the compensating loop, so this resistance enters every loop calculation multiplied by phase count. At four phases a 0.3 milliohm secondary contributes 1.2 milliohm, typically the largest single term in the loop.",
      "Do not confuse this with the primary winding resistance. The primary carries the phase DC load current, so Renesas states it must be kept low, typically under 0.2 milliohm for voltage regulator designs. The secondary path carries AC only and can tolerate more. The trans-inductor primary is normally wound with more copper for exactly this reason.",
      "Because it is multiplied by N, this term dominates loop damping. It is also the term that scales worst as you add phases, which is worth remembering if the phase count is ever revisited."
    ],
    src: "IFX Eq. 57; TI Eq. 23, 26; Renesas equivalent circuit model"
  },
  rroute: {
    t: "Loop routing resistance (R_routing)",
    d: "Copper resistance of the PCB trace closing the compensating loop. Easy to underestimate on spread-out layouts.",
    long: [
      "The compensating loop must physically close across the board, and on interleaved layouts that trace can be long. Its resistance adds directly to the loop, alongside the compensating inductor and all N secondary windings.",
      "Layout matters here for more than resistance. Infineon advises treating the coupling loop as a noisy net, comparable to a switching node, and recommends routing the connection only on the top layer with no vias, closing the loop through second-layer ground and using vias solely at the ends of the phase and L_C arrangement.",
      "Placement constraints are real. Infineon notes TLVR transformers can stand up to 12 mm tall, which sometimes forces L_C to the opposite side of the board. If that is done, connect both pins with via arrays, and prefer a soft-saturating part where a small form factor is required.",
      "This term is usually the easiest of the three to reduce, and the easiest to accidentally inflate."
    ],
    src: "IFX Eq. 57 and Section 3; TI Eq. 26"
  },
  pcore: {
    t: "L_C core loss (P_core,Lc)",
    d: "Magnetic loss in the compensating inductor core. Read it from the vendor curve at N x f_SW, not at f_SW.",
    long: [
      "Core loss is entered manually rather than calculated, and deliberately so. Predicting it requires Steinmetz coefficients specific to a core material and geometry, which none of the reference documents provide. Any calculated figure here would be invented, so the calculator asks you for the real number instead.",
      "Read it from your L_C vendor's curve at the excitation frequency N x f_SW and at the calculated peak-to-peak ripple, not at the per-phase switching frequency. In this design that is 2.4 MHz rather than 600 kHz, and the difference across that span is large.",
      "TI flags core loss as potentially significant precisely because of this high effective frequency, and recommends low core-loss materials such as ferrite for the compensating inductor specifically. Infineon likewise notes TLVR transformer cores are mostly ferrite based for the same reason.",
      "This value feeds the loop power loss result directly, added to the conduction loss computed from loop RMS current and total loop resistance."
    ],
    src: "TI Eq. 26 and LC Inductor Selection; IFX Section 2.4"
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
    long: [
      "The specification gives a total window, V_OUT_max minus V_OUT_min. TI Equations 4 and 5 divide that window into two parts, and the denominator they use for capacitance sizing is the sum: dV_ac + R_LL x I_STEP. Understanding which part is which is the whole point of this term.",
      "The load-line part, R_LL x I_STEP, is free. With adaptive voltage positioning the rail is deliberately set to V_0 - R_LL x I_OUT, so when load current rises the output is supposed to sit lower. That shift is the new target, not an error, and it costs no capacitance. The AC part, dV_ac, is what you must buy: it is the dynamic excursion beyond that new target, caused by I_SUM being unable to slew instantly while the capacitors alone supply the charge deficit.",
      "With zero load line the whole window is AC budget, and TI notes that overshoot and undershoot then each become fifty percent of the total specification. That is the hardest case and the one this calculator defaults to unless you enter an R_LL.",
      "Rearranging TI Equation 1 gives dV_ac = (1/2 x I_STEP squared / Slope) / C_OUT - R_LL x I_STEP, which exposes the only three levers available. Steepen the slope, which is exactly what the compensating inductor exists to do. Add capacitance, which costs area and money. Or widen the load line, if the load permits it. Nothing else in the design touches this number.",
      "Note that I_STEP enters squared while dV_ac enters linearly. Doubling the step quadruples the required capacitance, but halving the deviation budget only doubles it. This asymmetry is why the transient specification, rather than the ripple specification, almost always sizes a TLVR output filter.",
      "The chart shows required capacitance falling as the budget is widened. The curve is a hyperbola, so tightening a budget that is already tight is expensive: the last few millivolts cost far more capacitance than the first few."
    ],
    src: "TI Eq. 1, 2, 3, 4, 5"
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
    t: "PWM channels turned on in the step (N_ON,step)",
    d: "How many PWM channels the controller fires simultaneously when it detects the step. Counted in channels, not chips, and clamped to the channel count. Sets both the transient slope and the peak voltage stress on L_C.",
    long: [
      "This counts controller outputs, not power stages. On a cell running several stages per PWM channel the two differ, and entering the chip count instead of the channel count silently inflates the results — on the Helix cell, entering 4 for 'all four chips firing' against two channels gave 93.0 V of peak L_C voltage and 1533 A/us of slope where the true figures are 45.0 V and 742 A/us.",
      "The field is now clamped to the channel count, since more channels cannot fire than exist. Where a stage count is genuinely needed the calculator derives it as N_ON x M internally, which is how the peak L_C voltage is computed.",
      "The L_C saturation floor no longer depends on this input at all: Infineon Eq. 50 folds partial phase engagement into the transient duty cycle D_ramp rather than a separate channel count."
    ],
    src: "TI Eq. 18, 24"
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
  coutgov: {
    t: "C_OUT governing value",
    d: "The largest of the three capacitance criteria. This is the one your design must actually satisfy.",
    long: [
      "Three separate requirements are evaluated, and capacitance must satisfy all of them, so the largest wins. The first two come from TI Equation 1 applied to the rising and falling current slopes: while the converter ramps its summed current toward the new load, the capacitors alone supply the difference, and that charge deficit becomes voltage deviation. The third is Infineon Equation 32, covering the window before the controller has even reached its ramp duty cycle.",
      "Which one governs is worth understanding rather than just reading off. The two slope-based criteria are rarely equal, because a TLVR ramps current up and down at very different rates. On a load step the loop sees N_ON x V_IN - N x V_OUT, which is large. On a load release every phase is off and the only voltage driving current down is N x V_OUT, which at a low-voltage rail is small. The release is therefore much slower and usually sets the capacitance.",
      "Infineon notes that the delay criterion is usually covered by the ceramic capacitors placed at the load, and that it is in most cases a much more stringent requirement than the ripple-voltage criterion. That is why ripple alone rarely sizes a TLVR output filter.",
      "A fourth criterion exists that this calculator does not yet evaluate: minimum capacitance for output voltage ripple, Infineon Equation 21. It requires the ESR of the capacitor array, which is not currently an input. Since the transient criteria almost always dominate, adding it would change the governing value only in unusual designs.",
      "If the governing value exceeds your planned capacitance, the levers are a smaller L_C to steepen the slopes, a wider AC deviation budget if the load permits, a load line if one is allowed, or simply more capacitance."
    ],
    src: "TI Eq. 1, 18, 20; IFX Eq. 21, 32"
  },
  coutrel: {
    t: "C_OUT required on load release",
    d: "Capacitance needed to contain overshoot when load current drops. Usually the harder of the two transient cases at low output voltages.",
    long: [
      "When the load drops, the converter turns all phases off simultaneously and current must decay. TI gives the buck falling slope as -N x V_OUT / L_M, with the TLVR adding a further term that scales with the square of phase count. Until the current has fallen, the excess flows into the output capacitors and pushes the voltage up.",
      "The critical point is which voltage drives this. On a step up, the compensating loop sees N_ON x V_IN - N x V_OUT. On a release it sees only N x V_OUT. At a 0.75 V rail that is 3 V against 45 V, so the fall is roughly fifteen times slower than the rise and demands far more capacitance.",
      "This asymmetry is inherent to low-voltage rails and cannot be tuned away, because V_OUT is fixed by the load. Reducing L_C steepens both slopes and is the main lever available.",
      "Infineon adds a warning relevant here. Using non-linear control such as tri-stating all phases to suppress release overshoot is not recommended, because energy keeps recirculating in the coupling loop and decays only at the loop time constant. If the controller releases the tri-state before that current has decayed sufficiently, the stored energy is delivered back to the output, which at some load frequencies can compound into growing current excursions capable of destroying the power stage."
    ],
    src: "TI Eq. 1, 19, 20; IFX Section 2.5 on load release"
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
    src: "IFX Eq. 4 (Eq. 13 is the combined form)"
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
    src: "TI Eq. 4"
  },
  coutdelay: {
    t: "Minimum C_OUT for controller delay",
    d: "Charge the capacitors must supply before the controller even reaches its ramp duty cycle. Usually covered by MLCCs at the load, and often the stricter of the capacitance criteria.",
    long: [
      "Infineon writes the denominator as dV_out and does not model a load line anywhere in the application note. This calculator reads that dV_out as the same total excursion TI Eq. 4 and Eq. 5 use, dV_ac plus R_LL times I_STEP, because all three capacitance criteria are compared with a maximum and must therefore share one budget.",
      "At zero load line this is bit-identical to Eq. 32 as published, which covers every shipped preset. With a load line it lowers the required capacitance, because the load line genuinely widens the allowed excursion by shifting the regulation target."
    ],
    src: "IFX Eq. 32, on the TI Eq. 4 voltage budget"
  },
  lcmax: {
    t: "Maximum L_C for slew target",
    d: "Largest compensating inductance that still lets the current ramp keep up with the load step. If your chosen L_C exceeds this, the rail cannot track the step regardless of capacitance.",
    src: "IFX Eq. 31"
  },
  isatlc: {
    t: "L_C saturation current needed",
    d: "Current L_C builds during the response window. Treat it as a floor and add real margin, or use a soft-saturating core. Scales directly with t_RESP, which is an unconfirmed placeholder — read this as an upper bound, not a rating.",
    long: [
      "Infineon Eq. 50 gives the worst-case coupling-loop excursion during a load-step-on event as k times the response time times (D_trans x N x V_IN - N x V_OUT) over L_C. It supersedes TI Eq. 22, which is the same quantity without the coupling factor and with D_trans fixed at 1.",
      "Infineon folds 'not every phase is fully on' into the transient duty cycle D_trans rather than into a separate N_ON count, so unlike the transient slope this result does not depend on the N_ON input at all.",
      "The number is only as good as t_RESP, and t_RESP is currently a placeholder. Working backwards from the 52 A compensating inductor in the Renesas worked example implies something nearer 100 ns than the 1 microsecond in the preset, so this row currently reads roughly an order of magnitude high. Take the real figure from the controller datasheet or from simulation before sizing a part against it.",
      "Infineon is explicit about the consequence of getting it wrong: if L_C saturates, the steep ramp translates into every phase, the TLVR transformers saturate too, the controller loses control and the power stage sees effectively a short."
    ],
    src: "IFX Eq. 50 (supersedes TI Eq. 22)"
  },
  vlcmax: {
    t: "Peak L_C voltage (dV_Lc,max)",
    d: "N_ON x V_IN - N x V_OUT, in physical units. This can exceed V_IN during a step. Not a creepage concern since it is brief, but it matters for component voltage rating and insulation.",
    long: [
      "This is the transient bound: the controller deliberately fires N_ON channels at once, and all physical secondaries sit in series in the loop, so the stress is (N_ON x M) x V_IN - N_phys x V_OUT rather than the phase-collapsed value.",
      "Infineon gives a separate steady-state bound in Eq. 58 to 61: k times the larger of (N_SimOnMax x V_IN - N x V_OUT) and N x V_OUT, the second branch covering load release. That form is smaller than the transient bound in every configuration checked, including high phase count at 1.8 V where its release branch is largest, so TI Eq. 24 remains the governing number here.",
      "Infineon notes that splitting L_C into two series parts with their common node referenced to ground halves the absolute voltage excursion and reduces PCB stress, which is worth considering at high phase count."
    ],
    src: "TI Eq. 24 (transient); cf. IFX Eq. 58-61 steady-state"
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
  m_stages: {
    t: "Phases per module",
    d: "How many independent phases one module contains: one power stage plus one TLVR transformer each.",
    long: [
      "This is the granularity of the product. Two phases per module means the integrator can only build systems in multiples of two, which is normally fine since TLVR designs favour even, symmetric phase counts.",
      "Each stage has its own TLVR transformer, but stages need not have their own PWM. The Helix module drives four stages from two PWM outputs, so two stages share each PWM in Infineon's dual-phase mode. Set stages per module and PWM channels per module separately; the calculator derives M = stages / PWM and applies Infineon's halving of L_M and L_C.",
      "TLVR transient benefit scales with PWM channel count, not stage count. Four stages on two PWMs gives the same slew gain as two stages on two PWMs, at twice the current. The module is a higher-current 2-phase block, not a 4-phase one."
    ],
    src: "IFX Section 2.8.1 for the dual-phase distinction"
  },
  m_isat: {
    t: "Transformer saturation current",
    d: "The saturation rating of the TLVR transformer inside the module. Sets how much loop ripple the module can tolerate.",
    long: [
      "This is the number that determines your headline integrator spec. Infineon requires the TLVR transformer saturation current to be at least the per-phase load current plus half the peak-to-peak phase ripple. Rearranged, the margin between saturation and rated current is what is available for ripple.",
      "The consequence of getting it wrong is severe. Infineon states that if the compensating inductor saturates, the steep current ramp translates into every phase and drives the transformers into saturation as well. The controller then loses control and the power stage sees effectively a short, which can destroy it.",
      "Take this from the transformer vendor's curve at operating temperature, not at 25 degrees. Saturation degrades with temperature, and TLVR transformer cores are typically ferrite, which Infineon notes requires careful study of the saturation characteristic at high current and temperature."
    ],
    src: "IFX Eq. 18 and Sections 2.4, 2.5"
  },
  m_irated: {
    t: "Rated current per phase",
    d: "The continuous current one phase is specified for, from thermal derating rather than the device absolute maximum.",
    long: [
      "This should come from the power stage thermal derating curve at the ambient temperature and airflow your module is specified for, not from the absolute maximum rating. For the TDA22594A the absolute maximum average output current is 90 A, but the usable continuous figure in still air at elevated ambient is considerably lower.",
      "The gap between this value and the transformer saturation current is the entire ripple budget you can offer an integrator. Rating the module conservatively here leaves more headroom for their L_C choice; rating it aggressively narrows what they can do.",
      "Note that TI advises TLVR-optimised power stages must support peak current pulses approaching twice their RMS rating for short durations, so peak capability and continuous rating are separate questions."
    ],
    src: "IFX Eq. 18; TI TLVR-Optimized Components; TDA22594A Table 8 and Figure 7"
  },
  m_rpri: {
    t: "Primary winding DCR",
    d: "Resistance of the primary winding, which carries the phase DC load current. Must be low.",
    long: [
      "The primary carries the full per-phase load current, so its resistance directly sets steady-state conduction loss. Renesas states this path must be kept low, typically under 0.2 milliohm for voltage regulator designs, and Infineon notes the primary is normally wound with more copper than the secondary for exactly this reason.",
      "This does not appear in the compensating loop calculations, because the loop is the secondary path. It matters for module efficiency and thermals, which is your problem rather than the integrator's."
    ],
    src: "Renesas equivalent circuit model; IFX Section 2.4"
  },
  m_count: {
    t: "Modules in system",
    d: "How many modules the integrator chains together. Sets total phase count and total current.",
    long: [
      "Total phase count is modules times phases per module, and nearly every system-level quantity follows from it. Total current scales linearly. Secondary winding resistance in the loop scales linearly, since all secondaries sit in series. Leakage contributed to the loop scales linearly.",
      "The one that scales dangerously is secondary interconnect voltage. The worst-case loop voltage is N_ON times V_IN minus N times V_OUT, so with all phases firing it grows roughly in proportion to phase count. At four phases and a 12 V input that is around 45 V, but at sixteen phases it approaches 180 V. Your inter-module connector must survive the largest system you intend to support.",
      "Note also that at high phase count the leakage from the modules themselves may exceed the minimum loop inductance needed, at which point no discrete L_C is strictly required for ripple and it becomes purely a transient tuning choice. Infineon makes the same observation for high-frequency designs.",
      "Infineon additionally suggests splitting very high phase counts into multiple coupling loops, but warns that a sixteen-phase design split into two eight-phase loops ramps current by two times eight squared rather than sixteen squared, and that coupling current can be substantially larger than a single-loop arrangement."
    ],
    src: "TI Eq. 24 and Phase Multiplication; IFX Sections 2.8.2, 2.5"
  },
  iphrms: {
    t: "Per-phase RMS current",
    d: "Drives power-stage conduction loss and heating. TLVR designs run higher phase RMS than buck for the same load because of the added Lc ripple.",
    src: "TI, Power Loss"
  },
  m_pwm: {
    t: "PWM channels per module",
    d: "How many independent controller PWM outputs drive the module. Stages divided by this gives M, the dual-phase multiplier.",
    long: [
      "The Helix module is four stages on two PWMs, so M = 2. Set this equal to the stage count for conventional one-stage-per-PWM operation.",
      "This is the number that governs TLVR transient benefit. Slew gain is L_M over L_C times N, where N is this value times the module count. Adding stages without adding PWM channels buys current density, not response.",
      "Infineon treats two stages on one PWM as a single phase carrying twice the current, with both L_M and L_C halved in the calculation. Because both halve, the ratio is unchanged and the multiplier cancels out of the slew expression entirely."
    ],
    src: "IFX Section 2.8.1, dual-phase mode"
  },
  stagerip: {
    t: "Per-stage ripple and peak",
    d: "Ripple and peak current in one transformer, as opposed to the PWM-pair totals shown above.",
    long: [
      "Under Infineon's dual-phase treatment L_M is divided by M, so magnetizing ripple and DC current come out as the pair total rather than per device. Component ratings are per device, so these are the figures to check against the transformer saturation curve and the power stage.",
      "The L_C ripple term is not divided. Loop current couples into every transformer at full value through k, so only the magnetizing and DC terms are shared between the two stages on a PWM."
    ],
    src: "IFX Section 2.8.1 with Eq. 12"
  },
  m_istage: {
    t: "Per-stage DC current",
    d: "Thermal design current divided by the physical stage count: the DC each power stage and its transformer carries.",
    long: [
      "Compare this against the device thermal derating curve at your ambient and airflow, not against the absolute maximum. For the TDA22594A the absolute maximum average output current is 90 A, but the usable continuous figure in still air at elevated ambient is considerably lower."
    ],
    src: "TDA22594A thermal characteristics"
  },
  m_budget: {
    t: "Loop ripple budget",
    d: "The largest L_C loop ripple the module tolerates before its transformers saturate. The headline number an integrator needs.",
    long: [
      "From Infineon Eq. 18 rearranged. The gap between saturation current and rated current is the entire ripple allowance, and the magnetizing term consumes part of it before L_C ripple gets any.",
      "Publishing a rated current without stating this condition is incomplete. An integrator choosing too small an L_C will saturate the transformers, and Infineon is explicit that the resulting steep ramp translates into every phase, the controller loses control, and the power stage sees effectively a short."
    ],
    src: "IFX Eq. 18 rearranged"
  },
  m_vsec: {
    t: "Secondary interconnect voltage",
    d: "Worst-case voltage across the series secondary loop, with all stages conducting simultaneously.",
    long: [
      "Grows with phase count as N_ON times V_IN minus N times V_OUT. At four phases and 12 V input this is about 45 V; at sixteen phases it approaches 180 V.",
      "TI's layout guidance labels the L_C pad as high voltage, 50 V or more. Rate the inter-module interconnect for the largest system the module is sold to support, since this is invisible from single-module analysis."
    ],
    src: "TI Eq. 24, all stages on"
  },
  m_imon: {
    t: "IMON summing resistor",
    d: "Sense resistor value when M current-output IMON pins are tied to one node.",
    long: [
      "The TDA22594A reports phase current as a current source at 5 microamps per amp. Current outputs sum when tied together, so M stages on one node deliver M times the current and the resistor scales down proportionally to hold the controller's volts-per-amp scaling.",
      "The alternative is to keep the nominal resistor and rescale inside the controller. Either works; do not do both."
    ],
    src: "TDA22594A IMON specification"
  },
  m_ppri: {
    t: "Primary loss per stage",
    d: "Conduction loss in one primary winding at the per-stage RMS current.",
    long: [
      "This does not appear in the compensating loop calculations, which are a secondary-side path. It matters for module efficiency and thermals, which is the module designer's problem rather than the integrator's.",
      "Renesas guidance is to keep primary DCR below 0.2 milliohms."
    ],
    src: "Renesas winding resistance guidance"
  },
  esr: {
    t: "C_OUT bulk ESR",
    d: "Equivalent series resistance of the bulk output capacitor bank.",
    long: [
      "At the reference operating point the ESR term dominates output voltage ripple by roughly nineteen times over the capacitive term, so a placeholder value here makes the ripple figure meaningless.",
      "Take it from the capacitor datasheet at the ripple frequency, divided by the number of parts in parallel, and add the mounting and plane resistance."
    ],
    src: "IFX Eq. 19"
  },
  esl: {
    t: "C_OUT bulk ESL",
    d: "Equivalent series inductance of the bulk output capacitor bank and its mounting.",
    long: [
      "Enters Infineon Eq. 19 multiplied by two times N times f_SW, so its contribution grows with both phase count and switching frequency.",
      "Mounting inductance usually dominates the part's own ESL. Via count and placement relative to the load matter more than the capacitor selection."
    ],
    src: "IFX Eq. 19"
  },
  vripc: {
    t: "Capacitive ripple term",
    d: "The output voltage ripple that capacitance alone would produce, shown separately beneath the full figure.",
    long: [
      "Useful as a diagnostic. If this sits far below the full Infineon Eq. 19 result, then ESR or ESL is setting your ripple and adding capacitance will not help."
    ],
    src: "IFX Eq. 19, capacitive term"
  },
  ltransph: {
    t: "Transient L, per phase",
    d: "Renesas per-phase equivalent transient inductance, L_CT times L_M over L_C plus N times L_M.",
    long: [
      "Distinct from the regulator-wide figure above by exactly the phase count. The two are displayed as separate rows and must not be conflated.",
      "They are not two independent sources. Substituting L_CT = (1-k^2) x L_M x N + L_C into Infineon Eq. 29 collapses its denominator to N x (L_C + N x L_M), so at one stage per PWM channel this row is identically N times the regulator-wide row. Same physics, per-phase normalisation.",
      "At more than one stage per PWM channel the two drift apart, 2.05 times instead of 2.00 on the Helix cell, because the M multiplier in L_CT enters Infineon's explicit k^2 N^2 L_M term and the Renesas (L_C + N x L_M) term asymmetrically. Neither vendor publishes a dual-phase form, so this row is unconfirmed against simulation above one stage per channel.",
      "Validated against the Renesas worked example at 24.38 nH against their 24.3 nH."
    ],
    src: "Renesas transient slide (= N x IFX Eq. 29)"
  }
};
