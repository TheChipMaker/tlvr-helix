# tlvr-helix

A **modular TLVR** project: a chainable 2-phase Trans-Inductor Voltage Regulator
power module, plus a browser-based calculator for designing both the module and
the systems built from it.

This readme doubles as the context handoff. **If you are an AI assistant starting
a fresh conversation on this project, read this file first** — it carries the
decisions, constraints and open questions that are not recoverable from the
source code alone.

---

## 1. What this project actually is

The goal is a **plug-and-play TLVR building block**. Each module contains two
Infineon TDA22594A power stages with their TLVR transformers. An integrator
chains M modules to reach N = 2M phases, connects the outputs, series-connects
the transformer secondaries into one coupling loop, then supplies their own
PWM controller, compensating inductor L_C and output capacitance.

This split governs everything:

| Fixed in the module               | Chosen by the integrator                       |
| --------------------------------- | ---------------------------------------------- |
| Magnetizing inductance L_M        | Phase count (number of modules)                |
| Coupling coefficient k            | Compensating inductance L_C                    |
| Transformer saturation current    | Output capacitance C_OUT                       |
| Primary and secondary winding DCR | Controller and control scheme                  |
| Rated current per phase           | Output voltage and transient targets           |
| Phases per module                 | Switching frequency within the supported range |

The calculator therefore has **two modes**, and it is important not to confuse
them:

- **Design mode** sizes one complete regulator, where every parameter is yours.
- **Module mode** specifies a chainable module and produces the integrator-facing
  spec sheet. Some inputs are fixed at manufacture; the rest belong to whoever
  buys it.

### The key insight that makes module mode tractable

Magnetizing ripple is `V_IN x (1 - D) x D / (L_M x f_SW)`. It contains **no phase
count and no L_C**. The module's own ripple contribution therefore does not
depend on how many modules get chained or what the integrator picks for L_C.
L_M can be decided in isolation, before anything about the target system is
known. Most other module parameters follow the same pattern.

### The headline spec the module must publish

Infineon Eq. 18 requires transformer saturation current to be at least the
per-phase load current plus half the peak-to-peak phase ripple. Rearranged, the
margin between saturation and rated current is the entire ripple budget the
module can offer:

```
dI_ph_allowed = 2 x (I_sat - I_rated)
dI_Lc_allowed = (dI_ph_allowed - dI_mag) / k
```

So the module datasheet must state something like *"rated 60 A per phase
provided loop ripple stays below X A"*. Without that condition, an integrator
choosing too small an L_C will saturate the transformers. Infineon is explicit
about the consequence: the steep ramp translates into every phase, the
controller loses control, and the power stage sees effectively a short, which
can destroy it.

### The spec most likely to be overlooked

Worst-case secondary loop voltage is `N_ON x V_IN - N x V_OUT`, which grows with
phase count. At 12 V input:

| Phases | Peak secondary voltage |
| ------ | ---------------------- |
| 4      | 45 V                   |
| 8      | 90 V                   |
| 12     | 135 V                  |
| 16     | 180 V                  |

TI's own layout figure labels the L_C pad as high voltage, 50 V or more. **The
inter-module interconnect must be rated for the largest system the module is
sold to support.** This is invisible from single-module analysis.

Two notes from the audit. Infineon publishes the same quantity as Eq. 58–61 with
a leading `k`, so the true figures are ~2% below the table above — immaterial to
the conclusion. And Infineon recommends **splitting L_C into two series parts
with their common node tied to ground**, which halves the absolute voltage
excursion and the PCB stress. At 12 or 16 phases that is worth doing.

---

## 2. Module baseline (provisional)

| Parameter               | Value              | Status                                  |
| ----------------------- | ------------------ | --------------------------------------- |
| Phases per module       | 2                  | fixed                                   |
| Power stage             | Infineon TDA22594A | fixed                                   |
| L_M per transformer     | 100 nH             | **provisional**                         |
| Coupling coefficient k  | 0.98               | **provisional**                         |
| Transformer I_sat       | 80 A               | **unconfirmed**                         |
| Rated current per phase | 60 A               | **unconfirmed**                         |
| Primary DCR             | 0.18 mΩ            | target, per Renesas guidance of <0.2 mΩ |
| Secondary DCR           | 0.3 mΩ             | **provisional**                         |
| Target rail range       | not decided        | **open**                                |

### Reference system for design mode

| Parameter           | Value                               |
| ------------------- | ----------------------------------- |
| Input voltage       | 12 V nominal (part range 4.25–16 V) |
| Output voltage      | 0.75 V                              |
| Phase count         | 4 (2 modules)                       |
| Switching frequency | 600 kHz, provisional                |
| L_M / L_C           | 150 nH / 180 nH, provisional        |

600 kHz was chosen because L_C is excited at N x f_SW. At four phases that is
2.4 MHz; at 1 MHz per phase it would be 4 MHz, where ferrite core loss climbs
steeply. 800 kHz is the fallback if magnetics come out too large.

L_M = 150 nH and L_C = 180 nH come from TI's Table 2 simulation, which is
12 V to 0.8 V, 4-phase, 600 kHz — almost exactly the reference operating point.

---

## 3. Open items

> **A three-pass audit was run against the source PDFs.** Findings are in
> `AUDIT-math.md` (equations) and `AUDIT-code.md` (behaviour). Two figures this
> readme previously called validated did not reproduce and are corrected in §7.
> Items closed by that audit are struck through below.

- [ ] **Decide the target rail range.** The same L_M gives 7.8 A ripple at
      0.75 V but 17 A at 1.8 V. This decision gates the L_M choice.
- [ ] Confirm rated current per phase from the TDA22594A thermal derating curve
      at real ambient and airflow, not the 90 A absolute maximum
- [ ] Obtain a real transformer saturation figure at operating temperature
- [ ] Specify and rate the inter-module secondary interconnect for the largest
      supported phase count
- [ ] Choose a controller and confirm its minimum on-time against t_ON = 104 ns
      at the reference operating point
- [ ] **Replace the t_RESP placeholder.** See the note below — this is currently
      wrong by roughly a factor of ten. The equation it feeds is now IFX Eq. 50
      rather than TI Eq. 22, and the row is marked unconfirmed in the UI, but the
      input itself still needs a real number
- [ ] Decide whether 4 phases is acceptable for the reference design given TI's
      guidance that TLVR suits designs above six phases
- [x] ~~Obtain a clean transcription of the Renesas overshoot-based C_OUT
      method.~~ Done — transcribed in `AUDIT-math.md` §8. Three corrections to
      how this item was framed: it sizes an **inductance** given C_OUT, not
      C_OUT, so it does not replace the TI equation; its `L_c` line is the exact
      algebraic inverse of `EQ.lTransPhase`, which the calculator already has;
      and **Infineon Eq. 22 is the same equation**, down to the shared 0.9 safety
      factor, so the two priority sources already agree. Wiring it in would need
      three new inputs (`Vmax`, `T_rise`, derated C) and was left out of scope.
- [ ] **Give the reverse solver an objective.** It currently minimises ripple
      alone, which fights the transient. It needs a stated goal — smallest
      C_OUT, fewest stages, lowest total cost — before its output is a
      recommendation rather than an observation.
- [x] ~~**`non` is still unvalidated in advanced mode.**~~ Done — clamped to the
      PWM channel count in `applyDualPhase`, which corrects the field visibly
      when it is over while leaving a blank or mid-edit value usable. The field
      was already relabelled to "PWM channels on in step"; the glossary entry now
      matches. **The shipped `helix` preset was itself in the broken state**
      (`non: 4` against `N = 2`) and is fixed. Measured effect at the reference
      point: peak L_C voltage 93.0 V → **45.0 V**, rising I_SUM slope
      1533 → **742 A/µs**. The L_C saturation floor no longer depends on `non`
      at all, since IFX Eq. 50 folds partial engagement into `D_ramp`.
- [ ] Reconcile `m_isat`: 80 A and 95 A have both been used in saved presets.
      `calc/Presets/tlvr-design.json` carries `m_isat: 95` / `m_irated: 90`
      against the built-in `helix` preset's 80 / 60, along with `k: 0.955` and
      `lm: 82`. It is a later design iteration, not a corrupted copy — but note
      its `m_irated: 90` is the datasheet **absolute maximum** output current
      capability, which the item two above explicitly warns against using as a
      continuous rating. Left as saved rather than silently edited.
- [ ] Confirm no confidential documents remain in the public repository
- [ ] **Decide whether the bandwidth equations should use L_CT.** IFX Eq. 47
      and 48 are published on bare L_C and are currently implemented that way.
      Since the real secondary loop impedance is L_CT, both read optimistically
      high on achievable bandwidth. Left as published rather than silently
      deviating from the source — see §7.
- [x] ~~Decide how module mode is integrated.~~ Done — folded into a fifth
      results tab on the shared input set; `module.js` deleted. See §5.
- [ ] **Confirm the per-phase transient inductance for M > 1 against
      simulation.** Still open, but now **bounded and explained** rather than
      unknown. `lTransPhase` is not an independent Renesas result: at M = 1 it is
      *identically* `N x lTrans`, because substituting L_CT into IFX Eq. 29
      collapses its denominator to `N x (L_C + N x L_M)`. At M > 1 the two drift
      — 2.0495x instead of 2.0x on the Helix cell — because the M multiplier
      enters the two forms asymmetrically. So the uncertainty is a 2.5%
      discrepancy with an identified cause, not an unquantified extrapolation.
      The row is now marked "extrapolated at M = 2" in the UI. See
      `AUDIT-math.md` §4.1.
- [ ] **Confirm the dual-phase L_CT treatment against simulation.** Neither
      Infineon nor Renesas publishes L_CT for dual-phase mode, so the
      physical-secondary-count form is a documented deviation, not a sourced
      equation. It is the one place the calculator goes beyond its sources.
- [ ] Re-examine whether 2 PWM is the right call. The cell pays 2.3x loop
      ripple and 1.5x output ripple against the same four chips on four PWMs.
      That cost lands on L_C sizing and C_OUT.
- [ ] Supply real C_OUT bulk ESR and ESL figures. The defaults (0.2 mΩ, 50 pH)
      are placeholders, and ESR dominates output voltage ripple by roughly 19x
      over the capacitive term at the reference operating point
### Chart/panel divergence — found in the Step 3 audit

The results panel and the charts disagreed because `charts.js` was never
updated when dual-phase scaling landed. Recorded here because the root cause
will recur: **any new consumer of the input set must be checked against
`applyDualPhase`, not just `solve()`.**

- [x] ~~Charts computed leakage with the M-scaled L_M~~, reading ~96 nH where
      the panel read 101.9 nH. Fixed by replacing `LmLeak` with an `M`
      multiplier in `EQ.lct` — see §7.
- [x] ~~Chart markers plotted scaled values~~, so the "you are here" line on the
      L_M chart sat at 75 nH when 150 nH was typed. Fixed by carrying `LmRaw`
      and `LcRaw` through `applyDualPhase`.
- [x] ~~Presets were broken by derived `nph`.~~ They wrote a read-only field and
      left the module definition untouched, so the Renesas preset silently
      loaded a 2-phase design. Presets now set `m_stages`/`m_pwm`/`m_count`.
- [x] ~~Eleven terms rendered a `?` with no glossary entry.~~ All eleven added:
      `esr`, `esl`, `vripc`, `ltransph` (pre-existing gaps) and `m_pwm`,
      `stagerip`, `m_istage`, `m_budget`, `m_vsec`, `m_imon`, `m_ppri`.
      Note the schema is `t` / `d` / `long` / `src` — an entry using any other
      key for the extended text parses fine and silently renders an empty
      detail panel.
- [x] ~~Magnetics charts swept in M-scaled units.~~ The L_M and L_C sweeps now
      run on as-typed values and divide by M inside the callback, so axis,
      marker and curve agree. The `lc` chart's slew limit is multiplied by M
      to match the raw axis.
- [ ] The `nph` chart sweeps PWM count against M-scaled magnetics, which is not
      a meaningful comparison. It should sweep **stages per PWM** instead,
      since that is now the live design question.
- [x] ~~**`non` is unvalidated against `N`.**~~ Clamped — see §3.

**Correction: chart/panel divergence was not resolved.** This section previously
claimed it was. Three divergences survived the Step 3 audit, all of them the same
per-channel-vs-physical trap applied to `solve()` and not to `charts.js`, and one
of them was the *exact* false failure §7 says was fixed:

- [x] ~~The `itdc` chart reported **133 A** of required transformer saturation
      where the panel reported **69.1 A** on the Helix cell.~~ It used the PWM
      channel count and the un-split pair ripple instead of `EQ.stageSplit` and
      `nPhys`. Fixed.
- [x] ~~The `itdc` device-absolute-max limit line used PWM count~~, drawing
      180 A where four stages at the TDA22594A's 90 A give 360 A. Fixed.
- [x] ~~The `vin` chart reported peak L_C voltage in collapsed units~~, 46.5 V
      against the panel's 93.0 V — a factor of exactly `M`, on the number that
      specifies L_C insulation. Fixed.

And a defect that made three charts render nothing at all:

- [x] ~~`charts.js` passed no `k` into `slopeUpTlvr`/`slopeDownTlvr`~~ at five
      call sites. `EQ.lct` then computed `(1 - undefined²) = NaN`, so **every
      C_OUT curve in the tool was a NaN series**. `extent()` falls back to
      `[0,1]` when all values are non-finite and the path builder skips them, so
      the charts drew axes, gridlines, a legend and a marker with no curve, and
      nothing logged. Fixed.

Divergence is now checked rather than asserted: a harness interpolates every
chart series at the design point and compares it against `solve()` — 63
comparisons across the three presets, all within 0.15%.

The "15 call sites" figure was already stale when written — the pre-audit file
had **17**, and after these fixes it has **18**. A count that drifts silently is
a poor invariant; prefer the divergence harness above.

### The t_RESP placeholder — read this before trusting transient results

The preset ships with `t_RESP = 1 µs`.

**Correction from the audit: it *is* grounded in a source.** TI Figure 14
annotates `t_resp ≈ 1 µs` for the TLVR load-step-up case, and Figure 16 annotates
≈ 3 µs for the step-down — and those are the very figures TI Eq. 22
cross-references. What is wrong is the *mapping*, not the provenance: the
equation wants the interval over which loop voltage is actually applied, while
TI's annotation is total settling time. The conclusion below is unaffected; only
its stated justification was.

At 1 µs it produces an L_C saturation floor of 219 A for the reference design
(250 A under the old TI Eq. 22 form), while real compensating inductors in the
Renesas material are rated near 50 A.

Sanity check against Renesas' own design, where the answer is known because they
specified a 52 A part: loop voltage is 8 x 12 - 8 x 1.8 = 81.6 V across 150 nH,
giving 544 A per microsecond. At t_RESP = 1 µs that would demand 544 A. Working
backwards from their 52 A part gives roughly **96 ns**.

So t_RESP is of order 100–200 ns. Take the real figure from the controller
datasheet or simulation. Everything downstream — the saturation floor and both
capacitance criteria — scales directly with it.

Until it is replaced, the L_C saturation row carries a **"t_RESP unconfirmed"**
marker in the UI so the number is never read as authoritative. Simple mode omits
the row entirely.

---

## 4. Repository layout

```
DXFs/TDA_Pads/            footprint pad geometry
Libraries/TDA22594A/      schematic symbol / footprint library
calc/                     the calculator
  index.html              markup, both modes
  style.css               tokens, layout, both modes
  equations.js            EQ.* — pure functions, no DOM
  terms.js                glossary: t / d / long / src
  charts.js               chart registry + SVG renderer
  calc.js                 advanced mode wiring, readInputs, solve, export
  simple.js               simple mode: forward check + reverse sizing
  Presets/                saved designs and exported reports
Suggested components.txt
readme.md
AUDIT-math.md             equation-by-equation audit against the source PDFs
AUDIT-code.md             behaviour audit: NaN paths, guards, state, divergence
```

### Confidentiality — action required

The repository has been public. Vendor documents were committed under
`datasheets-and-resources/`, including the TDA22594A datasheet marked
*Restricted* and the Renesas design deck marked *Renesas Confidential*.

Making the repository private stops future access but does not undo past
exposure, and the files remain in git history regardless. To stop tracking them:

```
git rm -r --cached datasheets-and-resources
echo "datasheets-and-resources/" >> .gitignore
git add .gitignore
git commit -m "Remove vendor documents from version control"
git push
```

Purging them from history requires `git filter-repo` or BFG plus a force push.

Also do not commit the brand guide HTML export — it contains an account email
and organization UUIDs.

---

## 5. The calculator

Location: `calc/`. Open `calc/index.html` directly in a browser. It runs from
`file://` with no server and no build step.

| File           | Contents                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`   | Page structure, design-mode inputs, result tab bar                                                                         |
| `style.css`    | Styling only, both light and dark themes                                                                                   |
| `equations.js` | **All design maths.** Every function annotated with its source document and equation number                                |
| `terms.js`     | Glossary: short text for tooltips, extended text for detail panels                                                         |
| `calc.js`      | Unit conversion, live recompute, tooltips, presets, JSON save/load                                                         |
| `charts.js`    | Detail panel, SVG chart renderer, per-term chart registry                                                                  |

### Deliberate constraints — do not break these

- **No ES modules.** Browsers block `import`/`export` under `file://`. All
  scripts are plain `<script>` tags; `equations.js` declares `var EQ = {}`.
- **Brand fonts load from Google Fonts with full system fallbacks.** No other
  external dependency: no CDN libraries, no frameworks.
- **No build step.** Edit a file, refresh, done.
- **Script order matters.** `charts.js` must load before `calc.js`, because
  `calc.js` calls `initLive()` at parse time and needs `window.TLVRDetail` to
  already exist. Loading it after fails silently — empty selects, no charts.
- **`.panel` belongs to the modal detail panel only.** Result tab fieldsets use
  `.tabpanel`. The modal rule carries `overflow:hidden` and `max-height:88vh`,
  which clips inline charts if the class is reused.
- **One layout rule serves both modes.** `main, #module-mode` share a single
  grid definition and a single 1100px breakpoint. A mode-specific override
  placed later in the file wins on equal specificity and silently desyncs the
  two — this happened once already. Do not reintroduce one.
- **`#tip` is `position:fixed`.** Positioning therefore uses raw
  `getBoundingClientRect()` values with no scroll offsets. Adding `scrollX` or
  `scrollY` back will break it. The tooltip flips above its marker near the
  viewport bottom and mirrors the `::before` hover bridge via a `.flip` class;
  bridge and panel must stay on the same side or pointer travel to the
  "Learn more" button crosses dead space and dismisses early.

- **No invented numbers.** Every figure and claim traces to a numbered equation
  or a datasheet table. Where a quantity cannot be derived from the sources —
  core loss being the standing example, which needs Steinmetz coefficients none
  of the documents provide — the calculator asks the user for it and explains
  why, rather than modelling it.

### Features

- Every input and result carries a `?`. Hovering shows a brief; the tooltip
  persists while the pointer is over it so the button inside stays reachable.
- **Learn more** opens a detail panel with extended explanation, source
  references, and an interactive chart plotting the current design. The button
  appears only on terms that have a chart.
- Results tagged with the document and equation they came from.
- Pass/fail chips on limit checks.
- **Results split into four tabs** (operating point, steady-state ripple,
  transient, component limits) so one section is visible at a time.
- **A live chart in every results tab**, with a select to choose the swept
  variable. Redraws on every keystroke in the input form, so the design-point
  marker tracks the inputs as you type. Reuses the `charts.js` registry via
  `TLVRDetail.renderInto(term, container)`.
- Inputs sit in a sticky left column; the results column scrolls independently
  with the tab bar pinned, so the chart stays visible while inputs are adjusted.
- **Export report** writes `tlvr-report.txt`: every input as typed plus the full
  computed set, in flat readable text for pasting into a review conversation.
- **Inputs are range-checked.** A zero, negative or inverted input replaces the
  results panels with the specific reason rather than computing on it. Before
  the audit, `V_OUT > V_IN` produced a magnetizing ripple of −1466 A and
  `t_step = 0` produced "0 H" beside a red fail chip — both reading as a failed
  *design* rather than a bad *input*. Both modes share one `validate()`.
- **Results that rest on an unconfirmed input or an unsourced scaling carry an
  amber marker**, distinct from the green/red pass-fail chips: the L_C
  saturation floor ("t_RESP unconfirmed"), per-phase transient L at M > 1
  ("extrapolated at M = 2"), and the IMON summing resistor at M > 1 ("scaling
  not vendor-specified"). Green still only ever means pass.

### Simple mode

A second view over the *same* input elements, toggled from the masthead, so the
two modes can never disagree and Save/Open/Export keep working unchanged.

Its design rule is **reliability by omission**: it shows only quantities that
trace to a validated equation. Deliberately absent are the `t_RESP`-driven loop
I_SAT, per-phase `L_trans` at M > 1, and the slew-derived L_C ceiling — all three
flagged untrustworthy elsewhere in this document. `N_ON` is not an input here;
it is forced to N, the worst case and the only value that cannot be mis-entered.

Two explicit directions, never on screen together:

- **Check my parts** — forward. Duty, per-stage peak vs rated, I_SAT vs device,
  output ripple, C_OUT required vs planned, L_C voltage rating.
- **Size them for me** — reverse. Works back from the per-stage ripple budget to
  minimum L_M and L_C. Those two input fields are disabled while it is active,
  because they are outputs in this direction.

Its inversions were checked in the audit and are **algebraically sound** — the
sized `L_M`/`L_C` reproduce the target ripple split to full precision when fed
back through the forward path, and the `L_CT` back-out is the exact inverse of
`EQ.lct`. One case was missing: where series winding leakage alone exceeds the
loop inductance the ripple target needs, the back-out went negative and the
panel offered a **negative inductance as a part to buy** (−44 nH at 12 phases,
−144 nH at 20). It now reports 0 nH and explains that no discrete L_C is needed
for ripple — the outcome §7 already predicted.

The reverse solver has **no objective function.** It returns the smallest
inductances that keep per-stage peak under the rated current, and nothing more.
Because larger inductance cuts ripple but flattens the transient slope, its
recommendations generally *raise* required C_OUT — the panel now shows that cost
explicitly. Treat the L_M/L_C pair as one self-consistent starting point to feed
back into the forward check, not as a solved design. The 70/30 budget split
between them is a convention, not physics.

### Module mode — resolved, and what replaced it

`module.js` and the `#module-mode` section are gone. The duplicated inputs
(`m_lm`, `m_vin`, `m_fsw`, `m_k`, `m_rsec`) were deleted rather than ported, so
every quantity now lives in exactly one input. Module specification is a fifth
results tab reading the shared `readInputs()`, and the genuinely
module-specific inputs sit in a "Module definition" fieldset in the shared
input column.

**Phase count is now derived and read-only.** The `nph` field displays
`m_pwm x m_count` and is written by `applyDualPhase`, never typed. Editing it
has no effect.

### Dual-phase mode — the Helix cell

The module is **four TDA22594A stages driven by two PWM channels**, so two
stages share each PWM in Infineon's dual-phase mode. `M = stages / PWM`.

`applyDualPhase()` in `calc.js` runs between `readInputs()` and `solve()`,
scaling `L_M -> L_M/M`, `L_C -> L_C/M` and collapsing `N` to the PWM count.
Everything downstream is untouched. It is called from `update()` **and** from
the `window.TLVR.readInputs` export, so the charts and the results panel cannot
diverge.

**The decision, stated plainly:** slew gain is `(L_M/L_C) x N`, and since both
inductances divide by M, **M cancels**. TLVR transient benefit tracks PWM
channel count, not chip count. Four stages on two PWMs performs identically to
two stages on two PWMs, at twice the current. The cell is a high-current
2-phase block, not a 4-phase one. Four stages on four PWMs would be
meaningfully better on transient — this is a deliberate trade of transient
performance for current density and controller channel economy.

Measured cost at the reference point:

| Quantity    | 4 stages, 2 PWM | 4 stages, 4 PWM |
| ----------- | --------------- | --------------- |
| Effective N | 2               | 4               |
| L_CT        | 101.9 nH        | 203.8 nH        |
| f_HF        | 1.20 MHz        | 2.40 MHz        |
| dI_Lc       | 10.52 A         | 4.51 A          |
| dI_out      | 35.2 A          | 23.9 A          |

#### Two subtleties that will bite anyone editing this

**Leakage does not scale with M.** `L_CT` counts *physical* series secondaries,
and four stages put four in the loop however many PWMs drive them. `EQ.lct`
therefore takes an optional `M` multiplier:

    L_CT = (1 - k^2) x L_M x M x N + L_C

where `L_M` is the already-scaled value and `M x N` recovers the physical
secondary count. `M` defaults to 1, making the function bit-identical to the
validated single-stage form.

This was first implemented as an `LmLeak` argument carrying the raw L_M. That
is correct at the design point but **wrong under sweeping** — a chart varying
L_M would hold leakage frozen at the typed value while the curve moved. The
multiplier form tracks the swept value automatically. Do not revert it.

**Ripple and current come out as PWM-pair quantities.** Under `L_M -> L_M/M`,
`dI_mag` and `I_ph_DC` are the pair total, not per transformer. Saturation,
peak current and FET RMS are per-device checks and must use `EQ.stageSplit`,
which divides both by M. **`dI_Lc` is not divided** — the loop current couples
into every transformer at full value through k. Getting this wrong reports
133 A of required saturation where the true figure is 69.1 A, i.e. a false
failure against an 80 A part.
- Presets: reference design, TI Table 2, Renesas worked example.
- Save and reload the input set as JSON.
- **Export report** writes `tlvr-report.txt`: every input as typed, plus the
  full computed set — topology, ripple, per-stage currents, transient, loop —
  in flat readable text. Intended for pasting into a review conversation, so
  format for a human reader rather than a parser.
- Light and dark themes, defaulting to the operating system preference.

---

## 6. Source documents and their priority

**Infineon and Renesas take priority; TI is the fallback.**

1. **Infineon** — *Multiphase buck converter with TLVR output filter*, AN v1.4.
   Same vendor as the power stage. Primary source for ripple, L_C sizing,
   dual-phase mode and transformer saturation.
2. **Renesas** — *TLVR Design Equations*, 06/03/20. Primary source for the
   leakage-corrected loop inductance and winding resistance guidance.
3. **TI** — *Introduction to the Trans-Inductor Voltage Regulator (TLVR)*,
   Rev. A. Used where the other two have no equivalent.

| Result                                          | Source                                     |
| ----------------------------------------------- | ------------------------------------------ |
| Duty, overlap counts, D_HF, t_overlap           | IFX Eq. 7–10                               |
| Magnetizing ripple alone                        | IFX Eq. 4 (Eq. 13 is the combined form)    |
| L_C / phase / output ripple                     | IFX Eq. 11–17                              |
| Transformer saturation requirement              | IFX Eq. 18                                 |
| Output ripple with ESR and ESL                  | IFX Eq. 19                                 |
| Effective transient inductance, whole regulator | IFX Eq. 29, on L_CT                        |
| Effective transient inductance, per phase       | Renesas — but see §7, it is N × Eq. 29     |
| Maximum L_C for slew                            | IFX Eq. 31                                 |
| C_OUT for controller delay                      | IFX Eq. 32, on the TI Eq. 4 budget         |
| Slew and bandwidth gain vs buck                 | IFX Eq. 46, 47, 48 — verified, on bare L_C |
| **L_C saturation floor**                        | **IFX Eq. 50** — supersedes TI Eq. 22      |
| L_C transient excursion on release              | IFX Eq. 56 — implemented, not displayed    |
| Loop time constant                              | IFX Eq. 57 (= TI Eq. 23)                   |
| Effective loop inductance L_CT                  | Renesas                                    |
| I_SUM slopes                                    | TI Eq. 16, 18, 19, 20 — TI-only            |
| C_OUT required                                  | TI Eq. 4 (step up), Eq. 5 (release)        |
| Peak L_C voltage, transient                     | TI Eq. 24 — cf. IFX Eq. 58–61 steady state |
| L_C loop power loss                             | TI Eq. 26 — TI-only                        |
| Low-side FET RMS                                | TI Eq. 27 — TI-only                        |

Every row above was re-derived from the rendered PDF pages during the audit; see
`AUDIT-math.md` for the form, units and per-stage/per-channel/whole-regulator
classification of each. Note that `pdftotext` silently drops fraction numerators
in all three documents, so text extraction is not a safe way to check these.

---

## 7. The leakage correction — validated, do not regress

The compensating loop does not present L_C alone. All N secondary windings sit
in series and each contributes leakage:

```
L_CT = (1 - k^2) x L_M x N + L_C
```

Validated against the Renesas worked example (8-phase, 12 V to 1.8 V,
L_M = 200 nH, L_C = 150 nH, k = 0.98, 600 kHz):

| Quantity             | Renesas equation | This calculator | Their simulation |
| -------------------- | ---------------- | --------------- | ---------------- |
| L_CT                 | 213 nH           | 213.4 nH        | —                |
| L_C ripple           | 1.88 A           | 1.84 A          | 1.9 A            |
| Per-phase ripple     | 14.63 A          | 14.55 A         | 14.5 A           |
| Summed output ripple | **16.70 A**      | 16.4 A          | 16.7 A           |
| L_T per phase        | 24.3 nH          | 24.38 nH        | —                |

**Corrected: the summed-output-ripple row previously read "Renesas 15.8 A" and
that was the wrong example.** 15.8 A comes from Renesas' *design-procedure*
worked example — a 120 nH transformer at 450 A and 1.83 V — not the *equations*
example this preset is configured to. For the 200 nH case, Renesas' own
`I_Total` equation gives 16.70 A, matching their simulation exactly. So the
calculator is **1.8% low against the right reference**, not 3.8% high against a
figure from a different design.

The remaining gaps on the L_C and output-ripple rows are **not errors**: they are
precisely the extra factor of `k` that Infineon Eq. 11 carries and Renesas omits
(`1.88 × 0.98 = 1.84`). Following Infineon here is the correct source priority,
and it lands closer to Renesas' own simulation on phase ripple than Renesas'
equation does.

Before the leakage correction the same code returned 2.61 A and 22.5 A, roughly
40% high. **Any change to the ripple path must be re-checked against this
example.**

A useful consequence for the module product: at high phase count this leakage
term alone can exceed the minimum loop inductance needed to hold ripple inside
the saturation budget, at which point no discrete L_C is required for ripple and
it becomes purely a transient tuning choice.

### The correction now applies to the transient path too

The correction was originally applied only to the ripple equations, leaving the
transient path on bare L_C — the same physics corrected in one place and not the
other. Renesas uses L_CT on both sides, and their transient slide gives:

L_eq_per_phase = L_CT x L_M / (L_C + N x L_M)


On the same worked example that is 213 x 200 / (150 + 1600) = **24.3 nH**. The
uncorrected code returned 17.8 nH for the equivalent quantity, 37% optimistic.

`lTrans`, `slopeUpTlvr` and `slopeDownTlvr` now take a `leakage` flag defaulting
to true and compute L_CT internally. `lTransPhase` was added for the Renesas
per-phase form. The regulator-wide and per-phase figures are displayed as
separate rows and must not be conflated.

**Corrected: they differ by exactly `N`, not "roughly 4x".** And they are not two
independent sources. Substituting `L_CT = (1-k²)·L_M·N + L_C` into IFX Eq. 29
collapses its denominator to `N·(L_C + N·L_M)`, so at M = 1 the Renesas per-phase
form is *identically* `N × ` IFX Eq. 29 — the same physics in two normalisations.
Verified: the ratio is `4.0000000000` on the TI preset and `8.0000000000` on the
Renesas one. At the shipped Helix design point `N = 2`, so the factor is 2.

At M > 1 the two drift (2.0495x on Helix) because `EQ.lct`'s `M` multiplier
enters the two forms asymmetrically. See `AUDIT-math.md` §4.1.

Still on bare L_C, deliberately: `lcMaxFromSlew` (IFX Eq. 31), `iLcTransOn` /
`iLcTransOff` (IFX Eq. 50, 56), and the bandwidth pair (IFX Eq. 47, 48). These
are published that way and there is no vendor counterpart to defer to. Revisit as
a group, not piecemeal.

### The L_C saturation floor now uses Infineon, not TI

`iSatLcNeeded` (TI Eq. 22) has been **superseded by `iLcTransOn` (IFX Eq. 50)**,
which is the same quantity at higher source priority:

```
TI  Eq. 22:  I_SAT(Lc) >> t_RESP · (N_ON·V_IN − N·V_OUT) / L_c
IFX Eq. 50:  ΔI_Lc     =  k · t · (D_trans·N·V_IN − N·V_OUT) / L_c
```

TI Eq. 22 is the `D_trans = 1` limit of Eq. 50 with the coupling factor dropped.
Infineon folds partial phase engagement into `D_trans` rather than a separate
`N_ON` count, so **the swap also removes this row's dependence on `non`**.
Reference point: 250 A → 219 A. `iSatLcNeeded` is retained in `equations.js`,
marked superseded, for comparison.

This corrects the *sourcing* only. `t_RESP` remains unconfirmed and the row is
marked as such in the UI.

### Validation additions

| Quantity              | Renesas | This calculator |
| --------------------- | ------- | --------------- |
| Per-phase transient L | 24.3 nH | 24.38 nH        |

**Full preset regression, run after the chart fixes.** Driven through
`EQ.dualPhase` exactly as `applyDualPhase` does, so this exercises the shipped
path rather than the equations in isolation.

| Preset | M | N | L_CT | dI_Lc | dI_out | L_trans/ph | I_sat needed |
|---|---|---|---|---|---|---|---|
| Renesas | 1 | 8 | 213.4 nH | 1.84 A | 16.4 A | 24.38 nH | **57.3 A** |
| Helix | 2 | 2 | 101.9 nH | 10.52 A | 35.2 A | 31.84 nH | 69.1 A |
| TI Table 2 | 1 | 4 | 203.8 nH | 4.70 A | 25.0 A | 39.18 nH | 87.7 A |

**Corrected: the Renesas I_sat cell previously read 67.3 A and does not
reproduce.** The shipped path returns 57.3 A:

```
I_sat = I_TDC/nPhys + dI_ph_stage/2 = 400/8 + 14.55/2 = 50 + 7.28 = 57.3 A
```

67.3 A requires `I_TDC = 480 A`, but the `ren` preset ships `itdc: 400`. Renesas'
own slide computes `450/8 + 22.9/2 = 67.7 A` for their *design-procedure*
example — the same 120 nH case that produced the wrong 15.8 A above, so both
errors have one root: two Renesas worked examples being read as one. Every other
cell in this table reproduces exactly.

The Renesas row is the validation anchor and reproduces §7 exactly. **Any
future edit to the dual-phase path must reproduce this whole table**, since
M = 1 is the identity case and the Helix row is the only coverage of M > 1.

Two things about this table that are not defects:

- **The TI preset fails its saturation check** (87.7 A needed against the
  assumed 80 A transformer). That preset is TI's 325 A design on four phases,
  which is more current than the provisional Helix magnetics support. It is
  a reference operating point, not a Helix configuration.
- **`L_trans/ph` for the Helix row is the least trustworthy number here.** The
  Renesas per-phase form was never published for dual-phase mode, so the M > 1
  value is an extrapolation — now known to be a 2.5% drift from `N × ` IFX
  Eq. 29 with an identified cause (§7 above). Marked "extrapolated at M = 2" in
  the UI. Confirm against simulation before relying on it.

### Other correctness fixes from the same review

- `nSimOnMin` compared a float to an integer (`nMax === N * D`), so the
  integer-N·D case IFX Eq. 8 calls out never fired. Now uses a 1e-9 tolerance.
- The steady-state ripple pass/fail chip judged `dI_mag / I_ph_DC`, i.e. the
  magnetizing term alone. Saturation and RMS follow total phase ripple, so it
  now judges `dI_ph / I_ph_DC`. At the reference point this moved 13% (fail) to
  20% (pass).
- Output voltage ripple was capacitive-only. Now uses IFX Eq. 19 including ESR
  and ESL, with the capacitive term shown separately beneath it.
- IFX Eq. 47 and 48 were audited and are correct as implemented. The hard-coded
  8.5 in `fcMax` is not arbitrary: 0.10 x 8.5 = 0.85, the 85% ceiling expressed
  inside the 10%-of-f_SW rule of thumb. Reproduces Infineon's own worked example
  (500 kHz, 8 phases, L_M = L_C, 385 kHz crossover) at t_delay ≈ 244 ns.
  Note Infineon's revision history shows Eq. 48 and 49 were corrected in v1.2 —
  cite v1.4 only.
- **Peak L_C voltage was reported in collapsed units**, understating the real
  stress by exactly M. TI Eq. 24 is `N_ON x V_IN - N x V_OUT`, and it was being
  fed the PWM channel count. But the voltage is a *physical* stress: all `nPhys`
  secondaries sit in series in the loop, and each of the `nOn` channels drives
  `M` stages. On the Helix cell that is 4x12 - 4x0.7 = 45.2 V, where the
  collapsed form reported 22.6 V. Now computed as
  `(nOn x M) x V_IN - nPhys x V_OUT`, matching `vSecPeak`, which was already
  correct.

  **No other result was affected.** The M-scaling divides `L_C` by M as well, so
  the loop *current* `dV/L_C` is identical either way — slopes, ripple and C_OUT
  were all right. Only the displayed voltage was wrong, and it is the number
  that specifies L_C insulation and interconnect rating, so it mattered. This
  is the same class of bug as the chart divergence above: a quantity that is
  physical rather than per-channel being fed collapsed inputs.

---

## 8. Brand guide

All project output follows the corporate brand guide v2. Company logo and
wordmark are **not** used inside the calculator; only colour, type and tone.

### Colour tokens

**Neutrals**

| Token      | Hex       | Use                             |
| ---------- | --------- | ------------------------------- |
| Ink        | `#0E1116` | Primary text, dark surfaces     |
| Ink 2      | `#161A20` | Cards on dark                   |
| Ink 3      | `#1F242C` | Raised dark tile                |
| Slate      | `#59626E` | Labels, secondary text on light |
| Slate dark | `#8A94A1` | Secondary text on dark          |
| Line       | `#E7E9ED` | Hairlines on light              |
| Line 2     | `#DADDE2` | Stronger hairline               |
| Line dark  | `#242A32` | Hairlines on dark               |
| Paper      | `#FFFFFF` | Light background                |
| Paper 2    | `#F6F7F9` | Light section tint              |

**Semantic four**

| Token            | Hex       | Meaning                                     |
| ---------------- | --------- | ------------------------------------------- |
| `--ready`        | `#15B86A` | Ready / go / success. Also the brand accent |
| `--ready-bright` | `#2BD27D` | Live accent on dark                         |
| `--ready-deep`   | `#0C7A48` | Legible green text on light                 |
| `--signal`       | `#2C66EA` | Interactive: buttons, links, info           |
| `--signal-deep`  | `#1B4FCB` | Legible blue text on light                  |
| `--fault`        | `#EF4444` | Fault / stop / destructive                  |
| `--warn`         | `#F5C542` | Caution / thermal derate                    |

### The colour rule — do not break this

Green is both the brand accent and the ready signal, deliberately never split.
**Green only ever means ready.** Never decoration, never a category colour,
never a heading accent. Clickable is a different idea from good, so
interactivity uses Signal blue.

In the calculator: legends, `?` markers, focus rings and tooltip rules are blue;
pass chips green; fail chips red. Chart data series use blue and neutrals, never
green. An earlier copper accent was removed for violating this.

### Typography

| Role            | Font / weight          | Size · line-height      |
| --------------- | ---------------------- | ----------------------- |
| Hero / H1       | Sora 800               | clamp 36–60px · 1.02    |
| H2              | Sora 700               | 30px · 1.2              |
| H3              | Sora 600               | 17–20px · 1.3           |
| Body            | Inter 400              | 16px · 1.55             |
| Body strong     | Inter 600              | 16px · 1.55             |
| Small / caption | Inter 400              | 12–13px · 1.4           |
| Eyebrow / tag   | JetBrains Mono 500     | 11–12px · upper · .12em |
| Data / specs    | JetBrains Mono 400–500 | 13–15px · 1.5           |

**Every measured value uses JetBrains Mono** — voltages, currents, inductances,
part numbers. Non-negotiable in the calculator and all documents.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Known compromise: the brand requires Google-hosted fonts but the calculator must
run offline. Resolution is to load them with complete system fallbacks. For
brand-exact offline rendering, download the woff2 files to `calc/fonts/` and
switch to local `@font-face`.

### Other tokens

Radius 16px standard, 10px small. Ink is `#0E1116`, not pure black.

### Voice and tone

A competent engineer who respects the reader's time. Precise where it is
safety-critical, plain-spoken everywhere else. Numbers exact, instructions as
verbs. Calm under fault: say what happened and the one next action, without
alarm or blame. This governs tooltip and detail-panel text.

---

## 9. Conventions

- Calculator inputs use engineering units (nH, mV, ns, mΩ, µF, kHz);
  `calc.js` converts to SI on read. `equations.js` is SI throughout.
- Keep the source citation comment on every function in `equations.js`.
- Where a function can run with or without the leakage correction, expose a
  `leakage` flag defaulting to true rather than forking the function.
- New chart terms must be registered in the `CHARTS` object in `charts.js` and
  referenced by the same key in the `LIVE` map in `calc.js`. A key present in
  one and absent from the other logs a console warning.
- **A quantity lives in exactly one input.** Do not add a duplicate of an
  existing input. Derived quantities are rendered read-only, never typed.
- **All scaling happens in `applyDualPhase`, once.** Equation functions receive
  already-scaled values and must not divide by M themselves. If a new consumer
  of the input set appears, route it through `window.TLVR.readInputs`, not the
  private `readInputs`.
- **Fix a quantity in every consumer, not just `solve()`.** Three of the four
  defects found in the code audit were a correction applied to `solve()` and not
  to `charts.js`, one of them re-creating a false failure this readme already
  recorded as fixed. Any quantity that appears in both the results panel and a
  chart has **two** call sites, and the export report may be a third.
- **Pass every argument an equation destructures, including the ones that look
  optional.** `EQ.lct` reads `k`; omitting it yields `(1 - undefined²) = NaN`,
  which propagates silently and renders as a chart with no curve. Missing
  arguments in JavaScript are not an error, so nothing warns.
- **A view that hides unreliable numbers is more useful than one that shows
  everything.** Simple mode's value is what it omits. If a new result cannot be
  traced to a validated equation, it belongs in advanced mode or nowhere.
- **Decide whether each quantity is per-channel or physical before wiring it.**
  Collapsed `N` and scaled `L_M`/`L_C` are correct for anything the M-scaling
  cancels through — slopes, ripple, capacitance. Anything describing a physical
  part needs `nPhys` and `M`: saturation current, per-device RMS, secondary
  loop voltage, interconnect rating. Both the `stageSplit` split and the
  Eq. 24 fix are instances of the same question.
- Layout belongs to shared selectors. Prefer adding a mode to an existing rule
  over writing a rule for that mode.
- **Verify against the source PDF page, not extracted text.** `pdftotext` drops
  fraction numerators and denominators in all three vendor documents, silently
  turning `A/B` into `A B`. Every equation check in `AUDIT-math.md` was made
  against the rendered page for this reason.
- **Check a claim before repeating it.** Two figures in this file were labelled
  validated and did not reproduce, both from conflating Renesas' two separate
  worked examples; and the "all divergence resolved" claim was false when
  written. If a number matters, re-derive it.
- Results are estimates. Confirm against simulation before committing a design.