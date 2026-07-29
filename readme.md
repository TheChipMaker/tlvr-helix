# TLVR Helix

TLVR Helix is a full core-rail TLVR regulator scoped to the power-delivery
requirements of a Tomahawk-6-class 3nm switch ASIC — the entire ~1.3 kA rail,
built from a repeating **modular power cell** rather than a single monolithic PCB.

The design is based on Infineon **TDA22594A** smart power stages arranged into
compact, stackable **C-shaped power-cell modules**. Each module mounts directly
onto a host motherboard (e.g. the TH6 motherboard) as a standalone high-current
VRM building block. Training/portfolio design — built to production-grade rigor.

**Status:** Early design — architecture definition
**Author:** Ahmad Nabil (TheChipMaker / Nurvia Tech)

---

## 1. Design Intent
_Why this board exists, the target application, and what "good" looks like._

**Target application.** The power-delivery problem posed by a Broadcom
Tomahawk-6-class switch ASIC (102.4 Tbps, TSMC 3nm). Whole-chip power is in the
~700–1000 W range at a sub-1 V core rail, implying a core-rail current on the
order of ~1.3 kA.

**What this board is.** The full core rail, delivered by an array of identical
**modular power cells**. Each cell is a self-contained VRM module built around
Infineon TDA22594A power stages, mounted directly onto the host motherboard.
The full ~1.3 kA rail is formed by populating enough cells to meet the current
target, current-shared and interleaved by the controller.

**The power cell.** Each module contains **two TDA22594A power stages operating
in parallel**, sharing a **single PWM signal** from the controller — so from the
controller's perspective one module presents as a single, larger VRM phase.
Each module carries its own trans-inductors and duplicated supporting circuitry
per stage.

**Why modular.** A repeating, self-contained, motherboard-mountable cell means
the hard electrical/thermal/parasitic problem is solved **once** at the cell
level and then replicated, instead of being re-solved across a sprawling
monolithic board. It also enables the vertical-stacking (Helix Tower) density
path below.

**Topology.** Multiphase synchronous buck with trans-inductors (TLVR): each
phase inductor is a two-winding trans-inductor. The winding in the buck path
(switch node → Vout) carries the phase's DC + magnetizing ripple current; the
secondary windings of all phases are series-connected through a common
compensation inductor (Lc).

**Core design goal.** Decouple steady-state ripple current (set by the
magnetizing inductance Lm) from transient di/dt response (set by Lc + leakage),
so ripple/efficiency and load-step performance can be optimized independently —
the property that makes TLVR the right choice for high-di/dt AI-class core rails.

**Definition of "good."** A power cell that (1) delivers its rated current within
thermal limits, (2) minimizes parasitic inductance across the C-shaped
board-to-board current paths, (3) is as mechanically compact as physically
possible, (4) mounts cleanly as a standalone motherboard VRM, and (5) remains
compatible with vertical stacking (Helix Tower). The full rail is "good" when
enough cells share current cleanly to hold the ~1.3 kA core rail within spec
under worst-case load steps.

## 2. Mechanical Architecture
_Each power cell is a three-PCB assembly forming a compact C-shape._

Unlike a traditional single-PCB VRM, each Helix power cell is built from three
interconnected PCBs:

1. **Foundation** (horizontal, base PCB)
   - Carries the **trans-inductors** and any components that must stay close to them.
   - There are **two trans-inductors** per module (one per parallel power stage).

2. **Wall** (vertical PCB, perpendicular to the Foundation → forms an "L")
   - Carries the **supporting circuitry** required by the power stages.
   - Provides the vertical board-to-board interconnect between Foundation and Roof.

3. **Roof** (horizontal PCB, on the top edge of the Wall → completes the "C")
   - Carries the **two TDA22594A ICs** and any components that must stay close to them.

Assembled arrangement:

```
   [ Roof ]      ← TDA22594A power stages
      |
   [ Wall ]      ← supporting circuitry
      |
[ Foundation ]   ← trans-inductors
```

**Critical layout implication.** With the power stages on the Roof and the
trans-inductors on the Foundation, the **switch-node current path traverses two
board-to-board interconnects** (Roof → Wall → Foundation). The switch node is the
highest-di/dt, most parasitic-sensitive net in the converter, so minimizing the
inductance of this vertical path is the central mechanical/electrical challenge
of the C-shaped concept. (See Challenges & Issues.)

## 3. Scalability — Helix Tower
_Vertical stacking for density._

The C-shaped module is designed for future vertical expansion. During layout,
the module is made **mechanically stackable**, allowing up to **two complete
C-modules** to be mounted vertically, one atop the other. This stacked
configuration is the **Helix Tower** architecture — the density path for fitting
more current-delivery capacity into the same motherboard footprint.

## 4. Design Objectives
_Priorities held throughout the design process._

- Minimize overall module dimensions (as compact as physically possible).
- Optimize current paths and reduce parasitic inductance — especially the
  Roof→Wall→Foundation switch-node path.
- Maintain excellent thermal performance across both power stages.
- Ensure the module is suitable for direct motherboard mounting as a standalone VRM.
- Preserve compatibility with future vertical stacking (Helix Tower).
- Treat TDA22594A datasheet details as confidential — request missing
  specifications rather than assuming them.

## 5. Specifications
_Living spec table. Update as decisions are locked. Values marked TBD depend on
confidential TDA22594A datasheet parameters to be supplied during design._

| Parameter | Target | Notes |
|---|---|---|
| Input voltage (Vin) | 12 V | Intermediate bus (48 V → 12 V upstream, out of scope) |
| Output voltage (Vout) | 0.75 V | Representative Tomahawk-6-class core rail; final value TBD from load target |
| Full-rail output current (Iout) | ~1300 A | Full Tomahawk-6-class core rail, delivered by an array of power cells |
| Power stage IC | Infineon TDA22594A | ~90 A max per IC (per datasheet); two per module |
| Power cell (module) | 2 × TDA22594A in parallel | Shared single PWM → presents as one controller phase |
| Per-module max current | ~180 A | 2 × ~90 A; continuous/derated value TBD from datasheet thermals |
| Module count (full rail) | TBD | ~1300 A ÷ derated per-module current; pending datasheet derating |
| Switching frequency (fsw) | 600 kHz/phase | TLVR-typical range (400–800 kHz); balances magnetics size vs. loss |
| Magnetizing inductance (Lm) | ~150 nH | Starting point; sets steady-state ripple |
| Compensation inductor (Lc) | ~100 nH | Starting point; primary transient-tuning lever |
| Duty cycle (nominal) | ~0.063 | 0.75 V / 12 V; drives power-stage/controller min on-time constraint |
| Peak di/dt target | TBD | Derive from Tomahawk-6 load-step profile |
| Efficiency target | TBD | Set once nominal/typical load point is fixed |

## 6. Component Selection Log
_Every major part: what was chosen, alternatives considered, and WHY. This is the
record that becomes the final documentation._

### Power stage
- **Chosen:** Infineon TDA22594A (smart power stage), two per module in parallel.
- **Alternatives considered:** TBD
- **Rationale:** Selected as the architectural foundation for the modular power
  cell. Two stages share one PWM to form a single higher-current cell.
  (Datasheet confidential — electrical parameters supplied during design.)

### Controller
- **Chosen:** TBD
- **Alternatives considered:** TBD
- **Rationale:** Must drive N modules (each = one shared-PWM phase) with clean
  current-sharing across all modules; phase count driven by final module count.

### Trans-inductors (Lm)
- **Chosen:** TBD
- **Rationale:** TBD — must fit the Foundation footprint and hit Lm target while
  handling per-stage peak (DC + ripple + reflected secondary-loop current).

### Compensation inductor (Lc)
- **Chosen:** TBD
- **Rationale:** TBD — primary transient-tuning lever; select largest Lc that
  still meets the di/dt / voltage-deviation spec to minimize circulating current.

## 7. Design Notes
_Reference notes captured during design for documentation and training decks._

- **TLVR winding naming is not standardized.** Across vendors and patents, the
  same physical winding is labeled "primary" or "secondary" inconsistently.
  Helix uses the TI/ADI/Würth convention (**primary = buck winding, switch node →
  Vout; secondary = the series Lc loop**) and always annotates windings by node
  in schematics and docs so the meaning survives regardless of a reader's
  convention.
- **Saturation current (I_sat) must be sized against transient peak, not the DC
  average.** In TLVR, the trans-inductor core flux is driven by the primary phase
  current *and* the reflected secondary-loop current, so worst-case peak flux —
  and required I_sat margin — is higher than the per-stage DC current alone
  implies. Also check the datasheet's I_sat definition (−10% / −20% / −30% L
  drop) and take the lower of I_sat (magnetic) and I_rms (thermal) as the usable
  limit.

## 8. Challenges & Issues Log
_Running record of problems hit and how they were resolved. Date each entry._

| Date | Issue | Resolution / Status |
|---|---|---|
| 2026-07-29 | C-shape puts power stages (Roof) and trans-inductors (Foundation) on separate PCBs — switch-node current path crosses two board-to-board interconnects, adding parasitic inductance on the most di/dt-sensitive net. | Open — central layout challenge; minimize vertical interconnect inductance (Roof→Wall→Foundation). |

## 9. Design Decisions & Changelog
_High-level decisions and pivots, newest first._

- _(2026-07-29)_ Architecture pivot to modular **power-cell** design based on
  Infineon **TDA22594A**. Each cell = 2× TDA22594A in parallel sharing one PWM,
  built as a 3-PCB **C-shaped** module (Foundation / Wall / Roof), motherboard-
  mountable, and vertically stackable into the **Helix Tower**. Full ~1.3 kA rail
  now delivered by an array of these cells. Supersedes the earlier slice framing.
- _(2026-07-20)_ Scope set to full ~1.3 kA core rail (superseded by cell array above).
- _(2026-07-20)_ Design context set: Tomahawk-6-class core rail.
- _(2026-07-20)_ Repo created, name locked as TLVR Helix.