# AUDIT-math.md — Pass 1, mathematical correctness

Equation-by-equation audit of `calc/equations.js` and its callers against the three
source documents, plus the TDA22594A datasheet for device constants.

Source priority: **Infineon > Renesas > TI.**

- **[IFX]** Infineon AN_2011_PL12_2012_221647, *Multiphase buck converter with TLVR
  output filter*, **V 1.4, 2025-05-21**
- **[REN]** Renesas, *TLVR Design Equations*, 06/03/20 (29 slides)
- **[TI]** *Introduction to the Trans-Inductor Voltage Regulator (TLVR)*, Rev. A,
  April 2026
- **[DS]** Infineon TDA22594A datasheet

Every equation below was read from the rendered PDF page, not from text extraction —
`pdftotext` drops fraction numerators and denominators in all three documents, which
silently turns `A/B` into `A B` and makes verification by text unreliable.

**Verdict key:** OK = form, units and scope all match the source. FIX = changed in this
pass. NOTE = correct but the citation or presentation needed work. OPEN = cannot be
settled from the sources.

---

## 1. Summary

| | count |
|---|---|
| Equations audited | 32 |
| Correct as implemented, no change | 24 |
| Citation corrected (no numeric change) | 4 |
| Numeric behaviour changed | 3 |
| Guard added | 1 |
| Left open (needs vendor data or simulation) | 3 |

**No equation was found to be wrong in form.** The maths in `equations.js` is sound.
The three numeric changes are a source-priority correction, a budget-consistency
correction, and a domain clamp. Two figures in `readme.md`'s "validated" tables do
**not** reproduce and are corrected in §7 below.

---

## 2. Topology and timing

| Function | Source | Form check | Scope | Verdict |
|---|---|---|---|---|
| `dutyCycle` | IFX Eq. 1 | `D = Vout/Vin` | whole regulator | OK |
| `nSimOnMax` | IFX Eq. 7 | `Roundup(N·D, 0)` | per-channel `N` | **FIX** — clamp |
| `nSimOnMin` | IFX Eq. 8 | `IF(NsimOnMax = N·D, NsimOnMax, NsimOnMax−1)` | per-channel `N` | OK |
| `dHF` | IFX Eq. 9 | `N·D − INT(N·D)` | per-channel `N` | OK |
| `tOverlap` | IFX Eq. 10 | `Tsw·[D − INT(N·D)/N]` | per-channel `N` | OK |
| `fHF` | IFX Eq. 5 | `N·fsw` | per-channel `N` | OK |
| `tOn` | — | `D/fsw` | whole regulator | OK |

**`nSimOnMax` — FIX.** Was `Math.max(1, Math.ceil(N*D))`. The lower clamp is a sensible
extension of Excel `ROUNDUP` at `D = 0`. There was no upper clamp, so a typed
`V_OUT > V_IN` gives `D > 1`, `nMax > N`, and `(N − nMax)` in Eq. 17 goes negative —
a physically impossible "more phases on than exist" state that propagates into output
ripple without any warning. Now `Math.min(N, Math.max(1, Math.ceil(N*D)))`.
**No effect for `D ≤ 1`**, since `ceil(N·D) ≤ N` whenever `D ≤ 1`.

**`nSimOnMin` confirmed.** The readme records a prior fix replacing `nMax === N*D` with a
`1e-9` tolerance. Correct and necessary: Eq. 8's integer-`N·D` branch is a float equality
in the source's Excel idiom and never fires in IEEE-754. At the Renesas preset
`N·D = 8 × 0.15 = 1.2000000000000002`, so the tolerance matters at exactly the operating
point the calculator ships with.

---

## 3. Steady-state ripple

| Function | Source | Form check | Scope | Verdict |
|---|---|---|---|---|
| `lct` | REN `Leq = (1−k²)·LP·N + Lc` | matches | physical secondaries via `M·N` | OK |
| `iLcRipple` | IFX Eq. 11 on REN `Leq` | matches | per-channel | OK |
| `iMagRipple` | IFX **Eq. 4** | matches | per-channel (pair total at M>1) | NOTE |
| `iPhaseRipple` | IFX Eq. 12 | `dImag + k·dILc` | per-channel | OK |
| `iOutRipple` | IFX Eq. 17 | matches term for term | whole regulator | OK |
| `iRmsLc` | TI Eq. 21 | `dILc/√12` | loop | OK |
| `vOutRippleFull` | IFX Eq. 19 | matches | whole regulator | OK |
| `vOutRipple` | simplified capacitive term | `dI/(8·fHF·Cout)` | whole regulator | OK |
| `iSatTlvr` | IFX Eq. 18 | `Iout_max/N + dIph/2` | **physical** — uses `nPhys` | OK |
| `rippleBudget` | IFX Eq. 18 rearranged | matches | per-stage | OK |
| `stageSplit` | IFX §2.8.1 | see below | per-stage | OK |

**`iMagRipple` — citation NOTE.** Cited IFX Eq. 13. Eq. 13 is the *combined* phase ripple;
the magnetizing term alone is **Eq. 4**. Comment and glossary corrected. No numeric change.
Renesas' `I_Mpkpk = (Vin−Vout)·Vout/(Vin·Lp·fsw)` is algebraically the same thing, since
`Vout/Vin = D`.

**`iPhaseRipple` — the `k` bookkeeping is right, and it is easy to get wrong.**
IFX Eq. 11 already carries a leading `k`, and Eq. 12 multiplies by `k` again, so the
coupling contribution to phase ripple is `k²`. Renesas' `I_Cpkpk` has **no** leading `k`
and their `I_phpkpk = I_Cpkpk + I_Mpkpk` adds no `k` either. The two vendors genuinely
differ here; the calculator follows Infineon throughout, which is the correct priority and
is also closer to Renesas' own simulation (14.55 A computed vs 14.5 A simulated, against
Renesas' own equation giving 14.63 A).

**`iOutRipple` verified term for term** against Eq. 17:

```
dIout_pkpk = k·N·dILc_pkpk + (dImag_ph · t_overlap / Tsw) · (NsimOnMax/D − (N−NsimOnMax)/(1−D))
```

matches `k*N*iLc + ((iMag*tov)/Tsw) * (nMax/D - (N-nMax)/(1-D))` exactly.

**`stageSplit` confirmed against IFX §2.8.1.** Infineon: "the dual phases can be treated as
one phase with twice the current"; "the resulting magnetizing inductance for one PWM output
is half"; "this will be represented in the calculation by dividing the coupling inductance
L_C by two". So under `L_M → L_M/M`, `dI_mag` and `I_ph_DC` emerge as pair totals and must
be divided by `M` for per-device checks, while `dI_Lc` must **not** be — the loop current
couples into every transformer at full value through `k`. The implementation is exactly
this. Note Infineon states only the **M = 2** case; `M > 2` is a natural extension but is
not written down by any vendor.

---

## 4. Transient

| Function | Source | Form check | Scope | Verdict |
|---|---|---|---|---|
| `lTrans` | IFX Eq. 29 | `Lm·Le/(k²N²Lm + N·Le)` | whole regulator | OK |
| `lTransPhase` | REN `LT = Leq·Lp/(Lc + N·Lp)` | matches | per phase | NOTE (§4.1) |
| `slopeUpBuck` | TI Eq. 16 | `Non(Vin−Vout)/L − Noff·Vout/L` | whole regulator | OK |
| `slopeUpTlvr` | TI Eq. 18 | `+ N(Non·Vin − N·Vout)/Lc` | whole regulator | OK |
| `slopeDownBuck` | TI Eq. 19 | `−N·Vout/L` | whole regulator | OK |
| `slopeDownTlvr` | TI Eq. 20 | `− N(N·Vout)/Lc` | whole regulator | OK |
| `coutRequired` | TI **Eq. 4 / Eq. 5** | matches | whole regulator | NOTE |
| `coutMinDelay` | IFX Eq. 32 | matches | whole regulator | **FIX** (§4.3) |
| `lcMaxFromSlew` | IFX Eq. 31 | matches | per-channel, model units | OK (§4.2) |

**`coutRequired` — citation NOTE.** Cited "TI Eq. 1, rearranged". TI Eq. 1 is
`ΔV = ΔQ/Cout` with no load line. The load-line form the code actually implements is
**TI Eq. 4** (step up) and **Eq. 5** (release), which spell out the denominator as
`ΔV_ac + R_LL × I_step`. Corrected in comments, result-row references, glossary, and the
`coutgov` chart's series labels — the `dvac` chart already said Eq. 4/Eq. 5, so the two
charts disagreed with each other. No numeric change.

### 4.1 `lTransPhase` is not an independent second source

`readme.md` presents IFX Eq. 29 and the Renesas per-phase form as two results from two
vendors that "differ by roughly 4x at the reference operating point". Both claims need
correction.

Substituting `Le = (1−k²)·Lm·N + Lc` into Eq. 29's denominator:

```
k²N²Lm + N·Le = k²N²Lm + N[(1−k²)·Lm·N + Lc]
              = k²N²Lm + N²Lm − k²N²Lm + N·Lc
              = N²Lm + N·Lc
              = N·(Lc + N·Lm)
```

which is exactly `N ×` the denominator of the Renesas form. So at one stage per PWM
channel, **`lTransPhase ≡ N × lTrans` identically** — the same physics in two
normalisations, not two sources corroborating each other. Verified numerically: the ratio
is `4.0000000000` on the TI preset and `8.0000000000` on the Renesas preset.

The factor is therefore exactly `N`, not "roughly 4x". At the shipped Helix design point
`N = 2`.

At `M > 1` the two drift: the Helix ratio is **2.0495**, not 2.0. The cause is identified —
`EQ.lct`'s `M` multiplier enters Eq. 29's explicit `k²N²Lm` term and the Renesas
`(Lc + N·Lm)` term asymmetrically, leaving `N²Lm(2−k²) + N·Lc` over `N(Lc + N·Lm)`.
This **bounds** the readme's open item "confirm the per-phase transient inductance for
M > 1": the discrepancy is 2.5% at the reference point with a known cause, rather than an
unquantified extrapolation. It remains **OPEN** against simulation, because neither vendor
publishes a dual-phase transient form.

### 4.2 `lcMaxFromSlew` returning `Infinity` is correct

**Question posed by the audit brief; answered: correct behaviour, not a masked
divide-by-zero.**

IFX Eq. 31 derives from Eq. 30:

```
ΔI_LoadStep / T_LoadStep  ≤  (D_ramp·Vin − Vout) · (k²N²/Lc + N/Lm)
```

Rearranged for `Lc`, the denominator is
`ΔI/(T·(D_ramp·Vin − Vout)) − N/Lm`. When the magnetizing path `N/Lm` alone already meets
the slew demand, that denominator is `≤ 0` and the inequality is satisfied by **every**
positive `L_c`: there is genuinely no upper bound. `Infinity` is the right answer, and the
`denom > 0` guard correctly converts the meaningless negative branch to it rather than
returning a negative inductance. At `denom == 0` the division yields `+Infinity` anyway.

Two presentation problems, both fixed in Pass 2 rather than here:

- `eng(Infinity)` renders an em dash beside a green "L_C OK" chip, which reads as missing
  data rather than "no constraint".
- The function returns the **M-scaled** value. The results panel printed it raw
  (292.5 nH on Helix) while the user types `L_C` in as-typed units (180 nH). The export
  report and the `lc` chart limit line already multiplied by `M`; the panel was the only
  consumer that did not.

### 4.3 `coutMinDelay` — the load-line term (FIX)

**Question posed by the audit brief. Resolved: include it.**

IFX Eq. 32 is `C_out_min_trans ≥ t_Delay · ΔI_LoadStep / dV_out`. TI Eq. 4/5 divide by
`ΔV_ac + R_LL × I_step`. `solve()` takes `Math.max()` of all three, so they were being
compared against **different voltage budgets** — the readme correctly flagged this as an
open inconsistency.

Physically, a load line is adaptive voltage positioning: the regulation target itself moves
down by `R_LL × I_step` on a load step, so the total allowed excursion is the AC window
*plus* that shift. Both the ramp-charge criterion and the delay criterion measure the same
droop against that same window. Infineon writes `dV_out` without qualification and does not
model a load line anywhere in the AN, so reading their `dV_out` as the full excursion is an
instantiation of the source, not a contradiction of it.

Added `EQ.dvBudget({dVac, rLL, iStep})` and routed both criteria through it.

- **No change to any shipped preset** — `helix`, `ti` and `ren` all have `R_LL = 0`, where
  this is bit-identical to Eq. 32 as published.
- Measured effect at `R_LL = 0.15 mΩ`, `I_step = 200 A` (60 mV total vs 30 mV AC):
  delay criterion 1333 µF → 667 µF.
- The deviation from the literal Eq. 32 text is documented in the function comment and the
  glossary, and the result row now reads "IFX Eq. 32, on the TI Eq. 4 budget".

---

## 5. L_C component limits

| Function | Source | Form check | Scope | Verdict |
|---|---|---|---|---|
| `iLcTransOn` | IFX Eq. 50 | `k·t·(D_trans·N·Vin − N·Vout)/Lc` | physical (M cancels) | **FIX — now live** |
| `iSatLcNeeded` | TI Eq. 22 | `t_RESP·(Non·Vin − N·Vout)/Lc` | — | superseded, retained |
| `iLcTransOff` | IFX Eq. 56 | `t·k·N·Vout/Lc` | physical | OK, not wired (§5.2) |
| `tauLc` | TI Eq. 23 = IFX Eq. 57 | `Lc/(Rlc + N·Rsec + Rroute)` | loop | OK |
| `vLcMax` | TI Eq. 24 | `Non·Vin − N·Vout` | **physical** | OK (§5.3) |
| `pLcLoop` | TI Eq. 26 | `Irms²·R + Pcore` | loop | OK |

### 5.1 L_C saturation floor: TI Eq. 22 → IFX Eq. 50 (FIX)

TI Eq. 22 and IFX Eq. 50 compute the same quantity — the coupling-loop current excursion
during a load-step-on event, which sets the L_C saturation floor. Infineon is the
higher-priority source and its form is strictly more complete:

```
TI  Eq. 22:  I_SAT(Lc) >> t_RESP · (N_ON·V_IN − N·V_OUT) / L_c
IFX Eq. 50:  ΔI_Lc     =  k · t_trans_on · (D_trans·N·V_IN − N·V_OUT) / L_c
```

TI Eq. 22 is the `D_trans = 1` limit of Eq. 50 with the coupling factor dropped. Infineon
also folds "not every phase is fully on" into `D_trans` rather than a separate `N_ON`
count, so **the swap removes this row's dependence on the unvalidated `non` input
entirely**.

`iLcTransOn` was already written and correct in `equations.js` but had never been called.
Now wired into `solve()` with `t_trans_on ← tresp`, `D_trans ← dramp`. `iSatLcNeeded` is
retained with a comment marking it superseded.

**Per-channel vs physical:** `M` cancels. With `N → N/M` and `L_c → L_c/M`:

```
k·t·(D·(nPhys/M)·Vin − (nPhys/M)·Vout) / (Lc_raw/M)  =  k·t·nPhys·(D·Vin − Vout)/Lc_raw
```

so the collapsed inputs give the true physical loop current. Same cancellation the readme
records for `dV/L_C`.

Effect at the reference points:

| Preset | TI Eq. 22 (with `non` clamped) | IFX Eq. 50 |
|---|---|---|
| Helix | 250 A | **219 A** |
| Renesas | 544 A | **470 A** |

**This does not fix `t_RESP`, and must not be read as having done so.** Both forms scale
linearly with it, and `t_RESP = 1 µs` still yields a figure roughly an order of magnitude
above the ~50 A compensating inductors in the Renesas material. The change corrects the
*sourcing*; the input remains unconfirmed and the row is now labelled to say so.

**Correction to `readme.md` §3.** The readme states `t_RESP = 1 µs` is "not grounded in any
source". It is: **TI Figure 14 annotates `t_resp ≈ 1 µs`** for the TLVR load-step-up case,
and Figure 16 annotates ≈ 3 µs for the step-down — those are the very figures TI Eq. 22
cross-references. What is wrong is the *mapping*, not the provenance: Eq. 22 and Eq. 50 want
the interval over which loop voltage is actually applied, and TI's annotation is total
settling time. The readme's back-calculation from Renesas' 52 A part (≈ 96 ns) stands as a
sanity check. The warning survives; its stated justification does not.

### 5.2 IFX Eq. 56 checked, not wired

The load-release counterpart `ΔI_c_trans_off = t·k·N·V_OUT/L_c` is implemented and correct
but produces the smaller excursion at all three presets (94 A vs 470 A on Renesas; smaller
still at low `V_OUT`, since it scales with `V_OUT` alone). Eq. 50 governs, so one row still
suffices. Recorded here rather than added to the UI, per minimal-diff.

### 5.3 `vLcMax` — TI Eq. 24 retained deliberately

Infineon does publish this quantity, at higher priority:

```
IFX Eq. 59:  V_LC_max_pos = k · N · (V_in − V_out)
IFX Eq. 61:  V_LC_max     = k · max(N_SimOnMax·V_in − N·V_out,  N·V_out)
TI  Eq. 24:  ΔV_LC(max)   = N_ON(step) · V_IN − N_TOTAL · V_OUT
```

These are **different scenarios, not competing forms**. Eq. 61 uses `N_SimOnMax`, the
*steady-state* overlap count, and adds a load-release branch. TI Eq. 24 is the *transient*
case where the controller deliberately fires `N_ON` channels at once. Measured across
configurations, the transient bound is larger every time, including where Infineon's
release branch is largest:

| Config | TI Eq. 24 (transient) | IFX Eq. 61 (steady state) |
|---|---|---|
| Helix, `non` clamped to N | 45.0 V | 20.6 V |
| Renesas 8 ph, 1.8 V | 81.6 V | 14.1 V (release branch) |
| 16 ph, 1.8 V | 163.2 V | 28.2 V (release branch) |
| 20 ph, 1.8 V | 204.0 V | 35.3 V (release branch) |

So there is **no under-reporting to fix** and the number is left alone. Adding Infineon's
`k` would *lower* a safety-relevant figure by 2% while mixing two scenarios, which is the
wrong trade. The distinction is now recorded in the function comment and the glossary.

Cross-check of the physical-units fix the readme records: with `non` correctly clamped to
`N = 2`, TI Eq. 24 gives `(2×2)×12 − 4×0.75 = 45.0 V` and IFX Eq. 59 gives
`0.98 × 4 × 11.25 = 44.1 V`. **They agree to within `k`**, which independently confirms the
`(nOn × M) × V_IN − nPhys × V_OUT` form. The 93 V the calculator shows today is entirely
the unclamped `non = 4` against `N = 2` — see Pass 3.

---

## 6. Bandwidth, saturation and device relations

| Function | Source | Verdict |
|---|---|---|
| `slewGainVsBuck` | IFX Eq. 46 `(Lm/Lc)·N` | OK |
| `bwGainVsBuck` | IFX Eq. 47 `(1 + k²(Lm/Lc)N)²` | OK |
| `fcMax` | IFX Eq. 48 | OK — see below |
| `cinPenalty` | IFX Eq. 65 `(Lm/Lc)·N` | OK, **dead code** (never called) |
| `iRmsLowSide` | TI Eq. 27 | OK |
| `iPhaseDC`, `iPhasePeak`, `iPhaseRms` | standard | OK |
| `imonResistor` | [DS] | constants OK, scaling OPEN (§6.2) |

### 6.1 `fcMax` and the hard-coded 8.5 — confirmed from source

IFX Eq. 48 reads, literally:

```
f_C_TLVR ≤ 1 / [ t_delay + 1 / (0.10 · MIN((1 + k²·(L_m/L_c)·N)², 8.5) · f_sw) ]
```

The `8.5` is **in the source**, inside a `MIN`, exactly as implemented. Infineon's
surrounding text confirms the intent: "a crossover frequency range from 10% of the
switching frequency to a maximum of 85% of it" — and `0.10 × 8.5 = 0.85`. The readme's
account of this is correct.

Reproduced Infineon's own worked example: 500 kHz, 8 phases, `L_m = L_c`, `k → 1`
→ `MIN(81, 8.5) = 8.5` → **385.1 kHz at `t_delay = 244 ns`**, against Infineon's stated
385 kHz. Confirms both the equation and the readme's inferred delay.

Infineon's revision history shows Eq. 48 and 49 were corrected in v1.2, so the v1.4
citation matters — retained.

### 6.2 `imonResistor` — constants sourced, scaling is a design choice

The TDA22594A datasheet confirms both constants: *"On-chip MOSFET current sensing and
reporting at 5 µA/A"*, and *"IMON Gain resistor range R_IMON 1 kΩ ... for 5 mV/A,
recommended 1 kΩ R_IMON"*.

The `/M` scaling is **not** in any document. It is a defensible design choice — current
outputs sum when tied together, so `M` stages on one node deliver `M×` the current — but
the alternative (keep 1 kΩ and rescale in the controller) is equally valid, and the
datasheet does not address multi-stage summing. **OPEN**; the glossary already states both
options. Flagged in Pass 3 so the UI does not present it as sourced.

The `90 A` device-absolute-maximum used as a chart limit line is confirmed by
[DS] *"Output current capability of 90 A"*. It is a per-device figure — see Pass 2 for the
chart that scaled it by PWM count instead of stage count.

---

## 7. Numerical validation

Driven through the shipped code path — a Node harness that `eval`-loads the real
`equations.js` and replicates `readInputs()` + `applyDualPhase()` + `solve()` exactly as
`calc.js` does, so this exercises the shipped path rather than the equations in isolation.

### 7.1 Renesas worked example — the validation anchor

8 phases, 12 V → 1.8 V, `L_P = 200 nH`, `L_C = 150 nH`, `k = 0.98`, 600 kHz.

| Quantity | Renesas equation | Renesas simulation | This calculator | Note |
|---|---|---|---|---|
| `L_eq` (L_CT) | 213 nH | — | **213.4 nH** | exact |
| `I_Cpkpk` | 1.88 A | 1.9 A | **1.84 A** | gap is exactly `k` |
| `I_phpkpk` | 14.63 A | 14.5 A | **14.55 A** | closer to sim than REN |
| `I_Total` | 16.70 A | 16.7 A | **16.40 A** | 1.8% low |
| `L_T` per phase | 24.3 nH | — | **24.38 nH** | exact |

The `1.88 → 1.84 A` and `16.70 → 16.40 A` gaps are **not errors**. Renesas' `I_Cpkpk` omits
the leading `k` that Infineon Eq. 11 carries; `1.88 × 0.98 = 1.84`. The calculator follows
Infineon, which is the correct source priority, and lands closer to Renesas' own simulation
on phase ripple.

### 7.2 A readme "validated" figure that is wrong: the 15.8 A reference

`readme.md` §7 reads:

> | Summed output ripple | Renesas **15.8** | This calculator 16.4 | Their simulation 16.7 |

**15.8 A is from the wrong Renesas example.** It comes from the *design-procedure* worked
example (slide 24: 120 nH Delta transformer, `I_max = 450 A`, `V_out = 1.83 V`,
`L_c` ripple 1.64 A, phase ripple 22.9 A). The calculator's `ren` preset is configured to
the *equations* example (`L_P = 200 nH`, `V_out = 1.8 V`), for which Renesas' own
`I_Total` equation gives:

```
I_Total = (N·Vin/fsw)·(D − m/N)·((1+m)/N − D)·(k·N/Leq + 1/Lp)
        = (8·12/600k)·(0.025)·(0.1)·(0.98·8/213n + 1/200n)
        = 16.70 A          [Renesas' own slide prints 16.7 A; their sim says 16.7 A]
```

So the correct comparison is **16.40 A computed against 16.70 A**, i.e. the calculator is
**1.8% low**, not 3.8% high against a figure from a different design. The 0.30 A gap has
the same cause as the row above it — Infineon's extra `k` on the coupling term.

The readme table is corrected in Pass 3.

### 7.3 A readme "validated" figure that is wrong: Renesas I_sat needed

`readme.md` §7's full preset regression table gives the Renesas row's `I_sat needed` as
**67.3 A**. The shipped path returns **57.3 A**:

```
I_sat = I_TDC/nPhys + dIph_stage/2
      = 400/8 + 14.55/2
      = 50 + 7.28
      = 57.3 A
```

67.3 A requires `I_TDC = 480 A` (`480/8 = 60`, `60 + 7.28 = 67.3`), but the `ren` preset
ships `itdc: 400`. Every other cell in that table reproduces exactly, so this is an
isolated transcription error, not a code regression. Corrected in Pass 3.

Renesas' own slide 23 computes `ISAT > 450/8 + 22.9/2 = 67.7 A` for the *design-procedure*
example — the likely source of the confusion, and the same mix-up as §7.2.

### 7.4 Corrected preset regression table

Post-Pass-1, driven through `EQ.dualPhase` exactly as `applyDualPhase` does:

| Preset | M | N | L_CT | dI_Lc | dI_out | L_trans/ph | I_sat needed |
|---|---|---|---|---|---|---|---|
| Renesas | 1 | 8 | 213.4 nH | 1.84 A | 16.4 A | 24.38 nH | **57.3 A** |
| Helix | 2 | 2 | 101.9 nH | 10.52 A | 35.2 A | 31.84 nH | 69.1 A |
| TI Table 2 | 1 | 4 | 203.8 nH | 4.70 A | 25.0 A | 39.18 nH | 87.7 A |

Only the Renesas `I_sat needed` cell changed, and only because the readme's figure was
wrong. **The Pass 1 equation changes altered none of these**, as intended: `coutMinDelay`
is unchanged at `R_LL = 0`, the `nSimOnMax` clamp is inactive at `D ≤ 1`, and the Eq. 50
swap touches only the L_C saturation row, which this table does not carry.

### 7.5 TI Table 2 preset verified against source

TI Table 2: `V_IN 12 V`, `V_OUT 0.8 V`, `N_TOTAL 4`, `f_SW 600 kHz`,
`I_STEP 25 A → 325 A`, `L_M 150 nH`, `L_C 180 nH`, `C_OUT 5.0 mF`. The `ti` preset matches
on every field. The saturation failure the readme records (87.7 A needed against an assumed
80 A transformer) is real and is a property of TI's 325 A design, not a defect.

### 7.6 Non-finite sweep

Every value returned by `solve()` is finite across all three presets. This assertion is the
check that would have caught the `charts.js` defect handled in Pass 2.

---

## 8. Bonus: the Renesas overshoot method, transcribed

Closes the readme open item *"Obtain a clean transcription of the Renesas overshoot-based
C_OUT method"*. From slides 18 and 20:

```
L_TMax ≤ 0.9 · (2·N·C·Vo / I_step²) · [ ΔVmax − ( I_step·ESR + ESL·I_step/T_rise ) ]

L_c    ≤ L_P·N·( L_TMax − (1−k²)·L_P ) / ( L_P − L_TMax )

where  ΔVmax = Vmax − (Vout − Imax·R_LL),   C = total output capacitance with derating
```

Three findings worth recording:

1. **The second line is the exact inverse of `EQ.lTransPhase`.** Solving
   `L_T = Leq·L_P/(L_c + N·L_P)` for `L_c` yields it term for term. So the calculator
   already contains the forward direction of this method.
2. **Infineon Eq. 22 is the same equation.** `L_m ≤ sfac·2·(N·C_out/I_LoadStep²)·V_out ·
   [ΔV_out_max − I_LoadStep·(ESR + ESL/t_LoadStep)]` — identical structure, identical
   bracket, and the same `0.9` safety factor Renesas hard-codes. **The two priority sources
   agree**, which is a stronger position than the readme assumes.
3. **The readme's framing is backwards.** This is not a "C_OUT method" — it sizes an
   *inductance* given `C_OUT`. Inverting it does yield a `C_OUT` minimum, but it does not
   "replace the TI equation" for required capacitance; it is a different constraint
   (overshoot energy) from a different direction.

**Transcription warning:** Renesas' printed worked example says `k = 0.95` but its
arithmetic uses `0.98`. With 0.95 the formula gives 142 nH; with 0.98 it gives 254 nH,
against their printed 252 nH. Use 0.98 when reproducing that slide.

Wiring this in is **out of scope** for this audit (it would add inputs — `Vmax`, `T_rise`,
derated `C`). Recorded so the next person does not have to re-derive it.

---

## 9. A naming trap worth recording

Renesas (slide 10) labels the winding that carries DC load current the **secondary**
("This sees DC current, so must be low, typically <0.2 mΩ for VR designs"), and the
coupling-loop winding the primary. Infineon (§2) uses the opposite convention: "the current
from phase node to output ... is referred to as the primary current". **This calculator
follows Infineon.**

The readme's §2 entry — "Primary DCR 0.18 mΩ, target, per Renesas guidance of <0.2 mΩ" —
maps the right guidance onto the right winding despite the naming clash. Correct, but it
survives only because someone read the diagram rather than the label. Likewise
`EQ.tauLc`'s `N × rSec` correctly uses the coupling-loop winding, matching IFX Eq. 57's
`N · DCR_TLVR`.

---

## 10. Changes made in Pass 1

**`calc/equations.js`**
- `nSimOnMax` — clamp to `[1, N]`.
- `dvBudget` — new shared helper for the total allowed output excursion.
- `coutRequired` — routed through `dvBudget`; citation corrected to TI Eq. 4/5.
- `coutMinDelay` — signature `dVout` → `{dVac, rLL}`, routed through `dvBudget`;
  deviation from the literal Eq. 32 documented.
- `iMagRipple` — citation corrected to IFX Eq. 4.
- `iSatLcNeeded` — marked superseded by Eq. 50, retained for comparison.
- `iLcTransOn` — documented as the live L_C saturation equation; `M`-cancellation recorded.
- `lcMaxFromSlew` — `Infinity` semantics and model-units return documented.
- `lTransPhase` — the `N × lTrans` identity and the `M > 1` drift documented.
- `vLcMax` — transient-vs-steady-state distinction against IFX Eq. 58–61 documented.

**`calc/calc.js`** — `coutMinDelay` call updated; L_C saturation row switched to
`iLcTransOn`; result-row references corrected to TI Eq. 4/Eq. 5 and IFX Eq. 50; export
report annotates the `t_RESP` dependence.

**`calc/simple.js`** — both `coutMinDelay` calls updated.

**`calc/charts.js`** — three `coutMinDelay` calls updated; `coutgov` series labels corrected
to TI Eq. 4/Eq. 5 to match the `dvac` chart.

**`calc/terms.js`** — `isatlc`, `vlcmax`, `coutdelay`, `ltransph`, `imagrip`, `coutreq`
updated for the new sources and the identity finding.

## 11. Still open after Pass 1

| Item | Why it cannot be closed here |
|---|---|
| `t_RESP` real value | Needs a controller datasheet or simulation. Provenance corrected; magnitude still wrong. |
| `lTransPhase` at `M > 1` | Bounded to a 2.5% drift with a known cause, but no vendor publishes a dual-phase transient form. Needs simulation. |
| `imonResistor` `/M` scaling | Not addressed by the datasheet. A design choice, not an equation. |
| Bandwidth pair on bare `L_C` | IFX Eq. 47/48 are published on `L_C`. Left as published; see readme §7. |
| `M > 2` generally | Infineon states dual-phase mode for `M = 2` only. |
