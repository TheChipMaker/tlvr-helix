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

| Fixed in the module | Chosen by the integrator |
|---|---|
| Magnetizing inductance L_M | Phase count (number of modules) |
| Coupling coefficient k | Compensating inductance L_C |
| Transformer saturation current | Output capacitance C_OUT |
| Primary and secondary winding DCR | Controller and control scheme |
| Rated current per phase | Output voltage and transient targets |
| Phases per module | Switching frequency within the supported range |

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
|---|---|
| 4 | 45 V |
| 8 | 90 V |
| 12 | 135 V |
| 16 | 180 V |

TI's own layout figure labels the L_C pad as high voltage, 50 V or more. **The
inter-module interconnect must be rated for the largest system the module is
sold to support.** This is invisible from single-module analysis.

---

## 2. Module baseline (provisional)

| Parameter | Value | Status |
|---|---|---|
| Phases per module | 2 | fixed |
| Power stage | Infineon TDA22594A | fixed |
| L_M per transformer | 100 nH | **provisional** |
| Coupling coefficient k | 0.98 | **provisional** |
| Transformer I_sat | 80 A | **unconfirmed** |
| Rated current per phase | 60 A | **unconfirmed** |
| Primary DCR | 0.18 mΩ | target, per Renesas guidance of <0.2 mΩ |
| Secondary DCR | 0.3 mΩ | **provisional** |
| Target rail range | not decided | **open** |

### Reference system for design mode

| Parameter | Value |
|---|---|
| Input voltage | 12 V nominal (part range 4.25–16 V) |
| Output voltage | 0.75 V |
| Phase count | 4 (2 modules) |
| Switching frequency | 600 kHz, provisional |
| L_M / L_C | 150 nH / 180 nH, provisional |

600 kHz was chosen because L_C is excited at N x f_SW. At four phases that is
2.4 MHz; at 1 MHz per phase it would be 4 MHz, where ferrite core loss climbs
steeply. 800 kHz is the fallback if magnetics come out too large.

L_M = 150 nH and L_C = 180 nH come from TI's Table 2 simulation, which is
12 V to 0.8 V, 4-phase, 600 kHz — almost exactly the reference operating point.

---

## 3. Open items

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
      wrong by roughly a factor of ten
- [ ] Decide whether 4 phases is acceptable for the reference design given TI's
      guidance that TLVR suits designs above six phases
- [ ] Obtain a clean transcription of the Renesas overshoot-based C_OUT method
      so it can replace the TI equation and complete the source priority
- [ ] Confirm no confidential documents remain in the public repository

### The t_RESP placeholder — read this before trusting transient results

The preset ships with `t_RESP = 1 µs`, which is **not grounded in any source**.
It produces an L_C saturation floor of 250 A for the reference design, while
real compensating inductors in the Renesas material are rated near 50 A.

Sanity check against Renesas' own design, where the answer is known because they
specified a 52 A part: loop voltage is 8 x 12 - 8 x 1.8 = 81.6 V across 150 nH,
giving 544 A per microsecond. At t_RESP = 1 µs that would demand 544 A. Working
backwards from their 52 A part gives roughly **96 ns**.

So t_RESP is of order 100–200 ns. Take the real figure from the controller
datasheet or simulation. Everything downstream — the saturation floor and both
capacitance criteria — scales directly with it.

---

## 4. Repository layout

```
DXFs/TDA_Pads/            footprint pad geometry
Libraries/TDA22594A/      schematic symbol / footprint library
calc/                     the calculator
Suggested components.txt
readme.md
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

| File | Contents |
|---|---|
| `index.html` | Page structure and design-mode inputs |
| `style.css` | Styling only, both light and dark themes |
| `equations.js` | **All design maths.** Every function annotated with its source document and equation number |
| `terms.js` | Glossary: short text for tooltips, extended text for detail panels |
| `calc.js` | Unit conversion, live recompute, tooltips, presets, JSON save/load |
| `charts.js` | Detail panel, SVG chart renderer, per-term chart registry |
| `module.js` | Module mode: builds its own panel and spec-sheet output |

### Deliberate constraints — do not break these

- **No ES modules.** Browsers block `import`/`export` under `file://`. All
  scripts are plain `<script>` tags; `equations.js` declares `var EQ = {}`.
- **Brand fonts load from Google Fonts with full system fallbacks.** No other
  external dependency: no CDN libraries, no frameworks.
- **No build step.** Edit a file, refresh, done.
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
- Presets: reference design, TI Table 2, Renesas worked example.
- Save and reload the input set as JSON.
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

| Result | Source |
|---|---|
| Duty, overlap counts, D_HF, t_overlap | IFX Eq. 7–10 |
| L_C / phase / output ripple | IFX Eq. 11–17 |
| Transformer saturation requirement | IFX Eq. 18 |
| Output ripple with ESR and ESL | IFX Eq. 19 |
| Effective transient inductance | IFX Eq. 29 |
| Maximum L_C for slew | IFX Eq. 31 |
| C_OUT for controller delay | IFX Eq. 32 |
| Slew and bandwidth gain vs buck | IFX Eq. 46, 47, 48 |
| L_C transient excursions | IFX Eq. 50, 56 |
| Loop time constant | IFX Eq. 57 |
| Effective loop inductance L_CT | Renesas |
| I_SUM slopes | TI Eq. 18, 20 — TI-only |
| C_OUT required | TI Eq. 1 — TI-only |
| L_C saturation floor | TI Eq. 22 — TI-only |
| Peak L_C voltage | TI Eq. 24 — TI-only |
| L_C loop power loss | TI Eq. 26 — TI-only |
| Low-side FET RMS | TI Eq. 27 — TI-only |

---

## 7. The leakage correction — validated, do not regress

The compensating loop does not present L_C alone. All N secondary windings sit
in series and each contributes leakage:

```
L_CT = (1 - k^2) x L_M x N + L_C
```

Validated against the Renesas worked example (8-phase, 12 V to 1.8 V,
L_M = 200 nH, L_C = 150 nH, k = 0.98, 600 kHz):

| Quantity | Renesas | This calculator | Their simulation |
|---|---|---|---|
| L_CT | 213 nH | 213 nH | — |
| L_C ripple | 1.88 A | 1.84 A | 1.9 A |
| Summed output ripple | 15.8 A | 16.4 A | 16.7 A |

Before the correction the same code returned 2.61 A and 22.5 A, roughly 40%
high. **Any change to the ripple path must be re-checked against this example.**

A useful consequence for the module product: at high phase count this leakage
term alone can exceed the minimum loop inductance needed to hold ripple inside
the saturation budget, at which point no discrete L_C is required for ripple and
it becomes purely a transient tuning choice.

---

## 8. Brand guide

All project output follows the corporate brand guide v2. Company logo and
wordmark are **not** used inside the calculator; only colour, type and tone.

### Colour tokens

**Neutrals**

| Token | Hex | Use |
|---|---|---|
| Ink | `#0E1116` | Primary text, dark surfaces |
| Ink 2 | `#161A20` | Cards on dark |
| Ink 3 | `#1F242C` | Raised dark tile |
| Slate | `#59626E` | Labels, secondary text on light |
| Slate dark | `#8A94A1` | Secondary text on dark |
| Line | `#E7E9ED` | Hairlines on light |
| Line 2 | `#DADDE2` | Stronger hairline |
| Line dark | `#242A32` | Hairlines on dark |
| Paper | `#FFFFFF` | Light background |
| Paper 2 | `#F6F7F9` | Light section tint |

**Semantic four**

| Token | Hex | Meaning |
|---|---|---|
| `--ready` | `#15B86A` | Ready / go / success. Also the brand accent |
| `--ready-bright` | `#2BD27D` | Live accent on dark |
| `--ready-deep` | `#0C7A48` | Legible green text on light |
| `--signal` | `#2C66EA` | Interactive: buttons, links, info |
| `--signal-deep` | `#1B4FCB` | Legible blue text on light |
| `--fault` | `#EF4444` | Fault / stop / destructive |
| `--warn` | `#F5C542` | Caution / thermal derate |

### The colour rule — do not break this

Green is both the brand accent and the ready signal, deliberately never split.
**Green only ever means ready.** Never decoration, never a category colour,
never a heading accent. Clickable is a different idea from good, so
interactivity uses Signal blue.

In the calculator: legends, `?` markers, focus rings and tooltip rules are blue;
pass chips green; fail chips red. Chart data series use blue and neutrals, never
green. An earlier copper accent was removed for violating this.

### Typography

| Role | Font / weight | Size · line-height |
|---|---|---|
| Hero / H1 | Sora 800 | clamp 36–60px · 1.02 |
| H2 | Sora 700 | 30px · 1.2 |
| H3 | Sora 600 | 17–20px · 1.3 |
| Body | Inter 400 | 16px · 1.55 |
| Body strong | Inter 600 | 16px · 1.55 |
| Small / caption | Inter 400 | 12–13px · 1.4 |
| Eyebrow / tag | JetBrains Mono 500 | 11–12px · upper · .12em |
| Data / specs | JetBrains Mono 400–500 | 13–15px · 1.5 |

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
- Results are estimates. Confirm against simulation before committing a design.