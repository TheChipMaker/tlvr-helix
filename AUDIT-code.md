# AUDIT-code.md — Pass 2, code and behaviour

Audit of `calc/` as software rather than as mathematics. Pass 1 (`AUDIT-math.md`)
established that the equations are sound; this pass looks for the ways a correct
equation still produces a wrong screen.

**Headline:** `charts.js` was passing `undefined` for `k` into three chart builders,
so every C_OUT curve in the tool rendered as an empty path on a fabricated axis. And
the readme's claim that "all chart/panel divergence is resolved" was not true — three
divergences survived, including the exact 133 A vs 69.1 A false failure the readme
says was fixed.

Severity: **S1** silently wrong output reaching the user; **S2** wrong under some
inputs or stale state; **S3** cosmetic, dead code, or robustness.

| | count |
|---|---|
| Issues found | 14 |
| Fixed in this pass | 13 |
| Recorded, not changed | 1 |
| Verified clean (no change needed) | 6 areas |

---

## S1 — silently wrong output

### C1. `slopeUpTlvr` / `slopeDownTlvr` called without `k` — every C_OUT curve was blank

**Evidence.** Five call sites in `charts.js` (`dvac` ×2, `coutgov` ×2, `lc` ×1) built
their argument object without `k`. `slopeUpTlvr` forwards it to `EQ.lct`, which computes
`(1 - k*k)`; with `k === undefined` that is `NaN`, so `L_CT` is `NaN`, the slope is `NaN`,
and `coutRequired` returns `NaN`.

Measured on the Renesas preset before the fix:

```
slopeUp  as charts.js called it : NaN
slopeUp  with k supplied        : 3467.62 A/us
coutRequired(NaN slope)         : NaN
```

**Why it looked fine.** `extent()` falls back to `[0, 1]` when every value is non-finite,
and the path builder `continue`s past non-finite points, emitting `d=""`. The result is a
chart with plausible axes, a legend, gridlines, a marker — and no curve. Nothing logs.

Knock-on: the `dvac` chart scans for the tightest `dV_ac` its planned `C_OUT` can hold by
testing `gov(dv) <= p.Cout`. With `gov` returning `NaN` the comparison is always false, so
`dvMin` stayed `NaN` and the red "planned C_OUT floor" line never drew either.

**Fix.** Added `k: p.k` at all five sites.

**Verified.** A harness now evaluates every builder in the real `CHARTS` registry across
all three presets and asserts every series value is finite: 38 builder runs, **0
non-finite points**.

### C2. `itdc` chart contradicted the Module-spec panel at M > 1

**Evidence.** `solve()` computes required transformer saturation per *device*
(`N: p.nPhys`, `dIph: o.st.iPh` from `stageSplit`). The chart used the PWM channel count
and the un-split pair ripple:

| Helix (M = 2) | value |
|---|---|
| Module-spec panel | **69.1 A** |
| `itdc` chart, same design point | **133.0 A** |

This is precisely the failure readme §7 describes — *"Getting this wrong reports 133 A of
required saturation where the true figure is 69.1 A, i.e. a false failure against an 80 A
part."* It was fixed in `solve()` and never in `charts.js`, and the `itdc` chart is offered
in the **Module spec** tab's own sweep list, so the chart directly beside the corrected
panel row disagreed with it.

**Fix.** Route the chart through `EQ.stageSplit` and `p.nPhys`; relabel the series
"Per-phase DC" → "Per-stage DC".

### C3. `itdc` device-absolute-max limit line scaled by PWM count

`limit: p.N * 90` drew 180 A on the Helix cell. The 90 A is the TDA22594A's per-device
*"Output current capability of 90 A"*, so it scales with physical stages: `4 × 90 = 360 A`.
The line sat at half its true value, making the design look twice as close to the device
limit as it is. Same for the sweep's upper bound `hi`.

**Fix.** `p.nPhys * 90` in both places.

### C4. `vin` chart contradicted the Component-limits panel

`solve()` correctly computes peak L_C voltage as `(nOn × M) × V_IN − nPhys × V_OUT`; the
`vin` chart still called `vLcMax({nOn: p.nOn, N: p.N})`. On the Helix cell the panel read
93.0 V and the chart read 46.5 V — a factor of exactly `M`.

This is the same bug class readme §7 documents fixing, again applied to `solve()` only.
It matters because this is the number that specifies L_C insulation and the inter-module
interconnect rating.

**Fix.** Use `nOn * p.M` and `p.nPhys`, matching `solve()`.

### C5. `Max L_C for slew target` printed in M-collapsed units

The panel printed `o.lcMax` raw. `lcMaxFromSlew` returns the model (M-scaled) value, but
the user types `L_C` unscaled. On the Helix cell the row read **292.5 nH** against a typed
`L_C` of 180 nH, inviting a 60% oversize that the pass/fail chip would then reject.

The export report (`o.lcMax * p.M`) and the `lc` chart limit line (`lcMax * p.M * 1e9`)
both already scaled correctly, so the results panel was the only consumer that did not —
three consumers, two right.

**Fix.** Display `o.lcMax * p.M`. The pass/fail chip is unchanged: it compares `p.Lc` to
`o.lcMax`, both in model units, and was already correct.

### C6. Degenerate inputs rendered as results, not as errors

No input was range-checked. Measured behaviour before the fix:

| Input | Result | Rendered as |
|---|---|---|
| `V_IN = 0` | `D = Infinity`, everything `NaN` | em dashes + red fail chips |
| `V_OUT = 0` | `iOut = NaN` (0/0 in `nMax/D`) | em dash |
| `V_OUT > V_IN` | `D > 1`, magnetizing ripple **−1466 A** | a plausible negative number |
| `L_M = 0` | `iMag = Infinity` | em dash |
| `f_SW = 0` | `Infinity` / `NaN` | em dash |
| `C_OUT = 0` | ripple `Infinity` | em dash |
| `dV_ac = 0` | `coutRequired = Infinity` | em dash |
| `t_step = 0` | `lcMax = 0` | **"0 H"** + "L_C too large" fail chip |
| `m_pwm > m_stages` | `M < 1`, silently forced to 1 | correct-looking results for the wrong topology |
| 3 stages on 2 PWM | `M = 1.5` | correct-looking results for an impossible topology |

The worst of these are not the dashes — they are `V_OUT > V_IN` producing a signed number
and `t_step = 0` producing a red fail chip. Both read as *"your design failed"* rather than
*"your input is wrong"*.

Compounding it: `eng()`/`fx()` map both `NaN` and `Infinity` to an em dash, and every
pass/fail comparison against `NaN` is `false`, so a broken input reliably earns a red chip.

**Fix.** Added `validate(p)` in `calc.js`, exported as `window.TLVR.validate`, and a gate
in `update()` that replaces all five results panels with the specific reason and blanks the
charts. `simple.js` uses the same gate. New `.rows-error` style rule.

Covers: `V_IN`, `V_OUT`, `V_OUT ≥ V_IN`, `f_SW`, `L_M`, `L_C`, `k ∈ (0, 1]`, `C_OUT`,
`dV_ac`, `t_step`, `D_ramp ∈ (0, 1]`, stage/PWM counts ≥ 1, PWM ≤ stages, and integer `M`.

**Verified.** 20 cases, including the baseline which must still compute. All pass.

### C7. Reverse solver offered a negative inductance as a part to buy

When series winding leakage alone exceeds the loop inductance the ripple target needs,
`LcReq = lctReq − leakage` goes negative and was rendered directly. Measured,
12 V → 1.8 V at 50 A per stage:

| N | required `L_CT` | leakage | shown before | shown now |
|---|---|---|---|---|
| 8 | 64.0 nH | 57.7 nH | 6 nH | 6 nH |
| 12 | 42.7 nH | 86.6 nH | **−44 nH** | 0 nH + explanation |
| 16 | 48.0 nH | 115.4 nH | **−67 nH** | 0 nH + explanation |
| 20 | 0.0 nH | 144.3 nH | **−144 nH** | 0 nH + explanation |

This is not an edge case — readme §7 already describes it as a real high-phase-count
outcome: *"this leakage term alone can exceed the minimum loop inductance needed ... at
which point no discrete L_C is required for ripple."* The solver simply had no branch for
it. (At N = 20, `N·D` is exactly 3, so `D_HF = 0`, ripple is zero and the required `L_CT`
is legitimately 0.)

**Fix.** Clamp to zero, set `lcFromLeakage`, and state the actual numbers in the row note
rather than printing a negative. The downstream C_OUT estimate now uses `L_C = 0` rather
than falling back to the typed value, which is the honest answer for the sized magnetics.

---

## S2 — wrong under some state

### C8. Reverse-sizing mode disabled `L_M` / `L_C` in advanced mode

`setDir()` ran from `DOMContentLoaded` unconditionally, restoring the persisted direction
whether or not simple mode was showing. If the last simple-mode session ended in "Size
them for me", opening the calculator in advanced mode left the `L_M` and `L_C` inputs
`disabled` and greyed at 40% opacity by `body.rev` — the two most important inputs in the
tool, unusable, with nothing on screen explaining why.

**Fix.** Extracted `applyDirState()`, which applies the disable only while
`body.simple` is set, and called it from both `setDir()` and `setMode()`.

**Verified.** Enter reverse → both disabled. Toggle to advanced → both enabled.

### C9. Loading a preset or JSON left simple mode showing the previous design

`applySet()` assigns `.value` and calls `update()`. Assigning `.value` does **not** fire an
`input` event, and `simple.js` re-renders only on `document`'s `input` listener. So loading
the Renesas preset while simple mode was on screen updated the inputs and left the previous
design's pass/fail verdicts displayed beside them.

**Fix.** `applySet()` calls `window.TLVRSimple.render()` when `body.simple` is set.

### C10. Re-opening the same JSON file was a no-op

`<input type="file">` fires `change` only when the value changes. Opening a design, editing
it, then re-opening the same file to revert did nothing.

**Fix.** Clear `e.target.value` after reading.

### C11. `applyDualPhase` wrote `NaN` into the derived phase-count field

`$("nph").value = p.N` ran unconditionally. Mid-edit — clearing "Modules chained" before
typing a new value — `p.N` is `NaN`, and assigning that to a `number` input blanks it.

**Fix.** Only assign when `isFinite(p.N)`.

---

## S3 — presentation, dead code

### C12. `Infinity` from `lcMaxFromSlew` presented as missing data

`AUDIT-math.md` §4.2 establishes that `Infinity` is the correct answer: when `L_M` alone
meets the slew target, no value of `L_C` violates it. But `eng(Infinity)` returns an em
dash, so the row read "—" beside a **green "L_C OK" chip** — indistinguishable from a
computation that failed.

**Fix.** Detect it and render "no upper limit", reference "IFX Eq. 31 — L_M alone meets the
slew target", chip "unconstrained".

### C13. Dead code removed

`calc.js:185` `ripplePct` (computed, never used — a leftover from the ripple pass/fail fix
readme §7 records), `calc.js:280` `void 0;`, `calc.js:361` `resultsCol`, `charts.js` `_iMag`
on the `lc` spec and its now-unused `iMag` local, and `coutgov`'s `limit: {value: NaN}`.

`EQ.cinPenalty` (IFX Eq. 65) is also uncalled but is a correct, sourced equation left in
place for future use — noted, not removed.

### C14. `dvac` chart's limit line silently absent when out of range — recorded, not changed

If no `dV_ac` in the swept range lets the planned `C_OUT` suffice, `dvMin` stays `NaN` and
`draw()`'s `isFinite` check suppresses the line. This happens on the TI preset. The
behaviour is correct — there is no floor within the range — but its absence is
indistinguishable from the C1 bug that produced the same emptiness for a different reason.
Left as-is to keep the diff minimal; flagged here so the next reader does not mistake one
for the other.

---

## Verified clean — checked, no change needed

**`file://` constraint holds, absolutely.** Re-checked after every edit:

- No `import` / `export` statement anywhere.
- No `fetch`, `XMLHttpRequest`, `require`, or dynamic import.
- No CDN library, no framework, no build step, no bundler config.
- The only external reference in the whole tool is the Google Fonts `<link>` in
  `index.html`, which readme §8 sanctions and which has full system fallbacks.
- Script order in `index.html` is `equations → terms → charts → calc → simple`, satisfying
  the documented requirement that `charts.js` precede `calc.js`.
- All five files pass `node --check` as plain scripts.

**No event-listener leak.** `draw()` attaches `mousemove` and `mouseleave` to each SVG
element it creates. `renderInto()` clears `container.innerHTML` and appends a fresh SVG on
every keystroke, so the listeners are attached to the discarded node and are collected with
it. Nothing accumulates on `document` or `window`. The document-level listeners in
`calc.js` (`mouseover`, `mouseout`, `focusin`, `keydown`, `click`, `scroll`) and
`simple.js` (`input`) are each registered exactly once at parse time.

**The two modes cannot disagree.** They read the same input elements and both route through
`window.TLVR.readInputs`, which applies `applyDualPhase`. Confirmed by inspection of every
call site; `simple.js` never calls the private `readInputs`.

**Save / Open / Export round-trip all 29 inputs, including the read-only one.** Verified
programmatically that the set of `<input>` ids in `index.html` and the `IDS` array in
`calc.js` are equal — no field in either that is missing from the other. `nph` is
read-only and derived; it round-trips (written on load, then immediately re-derived by
`applyDualPhase`), so the value in the JSON is redundant but never lost or wrong.

**Registries agree.** All 64 terms referenced by `row()` and `data-term` exist in `TERMS`;
every `LIVE` key exists in `CHARTS`; no `TERMS` entry uses a key outside the documented
`t` / `d` / `long` / `src` schema (the readme warns that a stray key renders an empty
detail panel silently).

**No injection surface.** Every value interpolated into `innerHTML` comes from `fx()`,
`eng()` or `num()`, all of which return numeric strings; term ids are string literals in
source. The new `validate()` messages are literals plus numbers.

---

## Verification performed

Three Node harnesses, all driving the real files rather than reimplementations:

1. **`reg.js`** — `eval`-loads `equations.js` and replicates `readInputs` +
   `applyDualPhase` + `solve` exactly as `calc.js` does. Reproduces the readme §7 preset
   regression table, the Renesas source anchors, Infineon's own Eq. 48 worked example, and
   asserts every `solve()` output is finite. **ALL CHECKS PASS.**
2. **Chart builder sweep** — evaluates every entry in the real `CHARTS` registry across all
   three presets and asserts no series value is non-finite. 38 runs, 0 non-finite points.
   **This is the check that would have caught C1.**
3. **DOM shim** — boots `equations.js` + `terms.js` + `charts.js` + `calc.js` + `simple.js`
   against a shim built from the real `index.html` input set, then exercises `validate()`
   (20 cases), the reverse-solver clamp (4 phase counts), the mode/direction state machine,
   and preset loading in simple mode. **ALL BEHAVIOUR CHECKS PASS.**

A fourth check confirms chart/panel agreement directly: for each preset, every chart series
is interpolated at the design point and compared against the corresponding `solve()` output
— 21 comparisons per preset, 63 total, all within 0.15%. Before this pass, C2 diverged by
93% and C4 by 100%.

None of these harnesses are committed: they are development-time checks run under Node, and
adding them to `calc/` would put a second execution environment inside a directory whose
whole premise is that it runs from `file://` with nothing installed.

---

## Files changed in Pass 2

- **`calc/charts.js`** — C1 (5 sites), C2, C3, C4, C13.
- **`calc/calc.js`** — C5, C6 (`validate` + `renderErrors` + gate), C9, C10, C11, C12, C13.
- **`calc/simple.js`** — C6 (shared gate), C7, C8.
- **`calc/style.css`** — `.rows-error` rule for C6.
