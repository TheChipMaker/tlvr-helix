# tlvr-helix

TLVR (Trans-Inductor Voltage Regulator) design project: a 4-phase core rail built
around the Infineon TDA22594A power stage, plus a browser-based design calculator.

This readme doubles as the context handoff. **If you are an AI assistant starting a
fresh conversation on this project, read this file first** — it carries the decisions,
constraints and open questions that are not recoverable from the source code alone.

---

## 1. Design target

| Parameter | Value | Status |
|---|---|---|
| Input voltage | 12 V nominal (part range 4.25–16 V) | fixed |
| Output voltage | 0.7 V | fixed |
| Phase count | 4 | fixed |
| Switching frequency | 600 kHz | provisional |
| Power stage | Infineon TDA22594A | fixed |
| Controller | not yet chosen | **open** |
| Magnetizing inductance L_M | 150 nH | provisional |
| Compensating inductance L_C | 180 nH | provisional |
| Thermal design current | ~240 A assumed | **unconfirmed** |

### Why these values

- **600 kHz** was chosen because the compensating inductor is excited at
  `N x f_SW` = 2.4 MHz. At 1 MHz per phase that becomes 4 MHz through L_C, where
  ferrite core loss climbs steeply. 600 kHz is the balance point. Fallback is
  800 kHz if L_M turns out too physically large.
- **L_M = 150 nH, L_C = 180 nH** are lifted from the TI seminar's Table 2
  simulation, which is 12 V → 0.8 V, 4-phase, 600 kHz — almost exactly this
  operating point, so they are a validated starting point rather than a guess.

### Known concerns, not yet resolved

1. **4 phases is low for TLVR.** The TI material notes the topology is normally
   reserved for designs above 6 phases, because the L_C ripple contribution does
   not cancel with interleaving and grows proportionally as phase count drops.
   Expect a larger ripple and RMS penalty than a high-phase-count TLVR.
2. **On-time is short.** D = 0.75/12 = 6.25%, giving t_ON = 104 ns at 600 kHz.
   This must be checked against the chosen controller's minimum on-time.
3. **Peak L_C voltage is 45 V** during a load step (`N_ON x V_IN - N x V_OUT`),
   far above the 16 V input maximum. The compensating inductor and its routing
   must be rated for this transient.
4. **I_TDC of 240 A is an assumption**, derived from 4 x ~60 A off the TDA22594A
   thermal derating curve at 25 °C with no airflow. Confirm against the real
   ambient and airflow before trusting any current-dependent result.

---

## 2. Repository layout

```
DXFs/TDA_Pads/            footprint pad geometry
Libraries/TDA22594A/      schematic symbol / footprint library
datasheets-and-resources/ reference documents
calc/                     the design calculator (below)
Suggested components.txt
readme.md
```

### Confidentiality

The repository is **public**. The TDA22594A datasheet is marked *Restricted* and
the Renesas design deck is marked *Renesas Confidential*. Neither should be
committed to a public repo. If either has already been pushed, deleting the file
is not sufficient — it persists in git history and requires a history rewrite,
and the vendor should be informed.

---

## 3. The calculator

Location: `calc/`. Open `calc/index.html` directly in a browser — it runs from
`file://` with no server, no build step and no network access.

| File | Contents |
|---|---|
| `index.html` | Page structure, input fields, result containers |
| `style.css` | Styling only |
| `equations.js` | **All design maths.** Every function is annotated with its source document and equation number |
| `terms.js` | Glossary text for the hover tooltips |
| `calc.js` | Unit conversion, live recompute, tooltip behaviour, presets, JSON save/load |

### Deliberate constraints — do not break these

- **No ES modules.** Browsers block `import`/`export` under `file://`. All scripts
  are plain `<script>` tags. `equations.js` declares `var EQ = {}`.
- **No external fonts, CDNs or frameworks.** The tool must work offline.
- **No build step.** Editing a file and refreshing must be the whole workflow.

### Features

- Every input and result carries a `?` marker; hovering or focusing it shows a
  plain-language explanation plus the source reference.
- Results are tagged with the document and equation they came from.
- Pass/fail chips on the limit checks (capacitance sufficiency, L_C slew ceiling,
  L_C voltage against V_IN, ripple as a percentage of DC).
- Presets: this design, the TI Table 2 case, and the Renesas worked example.
- Save/open the input set as JSON.

---

## 4. Source documents and their priority

Sources are ranked. **Infineon and Renesas take priority; TI is the fallback.**

1. **Infineon** — *Multiphase buck converter with TLVR output filter*, AN v1.4.
   Same vendor as the power stage. Primary source for ripple and for L_C sizing.
2. **Renesas** — *TLVR Design Equations*, 06/03/20. Primary source for the
   leakage-corrected loop inductance.
3. **TI** — *Introduction to the Trans-Inductor Voltage Regulator (TLVR)*, Rev. A.
   Used only where the other two have no equivalent.

### Which source backs which result

| Result | Source | Notes |
|---|---|---|
| Duty, overlap counts, D_HF, t_overlap | Infineon Eq. 7–10 | |
| L_C / phase / output ripple | Infineon Eq. 11–17 | |
| Effective loop inductance L_CT | Renesas | |
| Effective transient inductance | Infineon Eq. 29 | |
| Maximum L_C for slew | Infineon Eq. 31 | |
| C_OUT for controller delay | Infineon Eq. 32 | |
| I_SUM slopes | TI Eq. 18, 20 | TI-only |
| C_OUT required | TI Eq. 1 | TI-only |
| L_C saturation floor | TI Eq. 22 | TI-only |
| L_C loop time constant | TI Eq. 23 | TI-only |
| Peak L_C voltage | TI Eq. 24 | TI-only |
| L_C loop power loss | TI Eq. 26 | TI-only |

---

## 5. The leakage correction — important

The compensating loop does not present `L_C` alone. All N secondary windings sit
in series in that loop and each contributes leakage, so the effective inductance is

```
L_CT = (1 - k^2) x L_M x N + L_C
```

Using bare `L_C` over-predicts loop ripple substantially. Validated against the
Renesas worked example (8-phase, 12 V → 1.8 V, L_M = 200 nH, L_C = 150 nH,
k = 0.98, 600 kHz):

| Quantity | Renesas | This calculator | Their simulation |
|---|---|---|---|
| L_CT | 213 nH | 213 nH | — |
| L_C ripple | 1.88 A | 1.84 A | 1.9 A |
| Summed output ripple | 15.8 A | 16.4 A | 16.7 A |

Before the correction the same code returned 2.61 A and 22.5 A — roughly 40% high
on both. **Any future change to the ripple path must be re-checked against this
example.**

---

## 6. Open items

- [ ] Choose a controller; confirm minimum on-time against the 104 ns requirement
- [ ] Confirm I_TDC against real ambient temperature and airflow
- [ ] Select actual L_M and L_C parts; verify saturation and core loss at 2.4 MHz
- [ ] Decide whether 4 phases is acceptable given the ripple penalty
- [ ] Obtain a clean transcription of the Renesas overshoot-based C_OUT method so
      it can replace the TI C_OUT equation and complete the source priority
- [ ] Confirm no confidential documents are present in the public repository

---

## 7. Conventions

- Calculator inputs are in engineering units (nH, mV, ns, mΩ, µF, kHz);
  `calc.js` converts to SI on read. `equations.js` is SI throughout.
- When changing `equations.js`, keep the source citation comment on every function.
- Results are estimates. Confirm against simulation before committing a design.