# TLVR Helix

TLVR Helix is a single-slice core-rail regulator scoped to the power-delivery
requirements of a Tomahawk-6-class 3nm switch ASIC. A full core rail is built by
interleaving and current-sharing multiple identical slices; this board designs,
builds, and proves out one slice.

A multiphase Trans-Inductor Voltage Regulator (TLVR) for high-current, high-di/dt core rails (AI accelerator / CPU-class loads). Training/portfolio design — built to production-grade rigor.

**Status:** Early design — specification phase
**Author:** Ahmad Nabil (TheChipMaker / VccLabs)

---

## 1. Design Intent
_Why this board exists, the target application, and what "good" looks like._

**Target application.** The power-delivery problem posed by a Broadcom
Tomahawk-6-class switch ASIC (102.4 Tbps, TSMC 3nm). Whole-chip power is in the
~700–1000 W range at a sub-1 V core rail, implying a core-rail current on the
order of ~1.3 kA. Rails at this current are not built as one monolithic
converter — they are built from multiple interleaved, current-shared regulator
"slices."

**What this board is.** One such slice: an 8-phase TLVR delivering ~500 A at the
core voltage from a 12 V intermediate bus. Designing one slice to production-grade
rigor is the real engineering content; replicating it to reach full-rail current
is an architectural exercise documented here rather than a per-board redesign.

**Full-rail scaling path.** ~1.3 kA ÷ ~500 A per slice ≈ 3 slices, interleaved
and current-shared, feeding a shared PDN. This board is the validated unit cell
of that architecture.

**Topology.** Multiphase synchronous buck with trans-inductors (TLVR): each
phase inductor is a two-winding trans-inductor whose secondaries are series-
connected through a common compensation inductor (Lc).

**Core design goal.** Decouple steady-state ripple current (set by the
magnetizing inductance Lm) from transient di/dt response (set by Lc + leakage),
so ripple/efficiency and load-step performance can be optimized independently —
the property that makes TLVR the right choice for high-di/dt AI-class core rails.

**Definition of "good."** A slice that (1) holds the core rail within spec under
worst-case load steps, (2) hits its efficiency target at the nominal load point,
(3) is thermally and electrically buildable on a single PCB, and (4) is cleanly
replicable into a multi-slice full rail.

## 2. Specifications
_Living spec table. Update as decisions are locked._

| Parameter | Target | Notes |
|---|---|---|
| Input voltage (Vin) | 12 V | Intermediate bus (48 V → 12 V upstream, out of scope) |
| Output voltage (Vout) | 0.75 V | Representative Tomahawk-6-class core rail; final value TBD from load target |
| Output current (Iout) | 500 A | Per-slice target (~3 slices → ~1.3 kA full rail) |
| Phase count | 8 | ~62 A/phase; pairs with 70 A-class DrMOS at realistic derating |
| Switching frequency (fsw) | 600 kHz/phase | TLVR-typical range (400–800 kHz); balances magnetics size vs. loss |
| Magnetizing inductance (Lm) | ~150 nH | Starting point; sets steady-state ripple |
| Compensation inductor (Lc) | ~100 nH | Starting point; primary transient-tuning lever |
| Duty cycle (nominal) | ~0.063 | 0.75 V / 12 V; drives DrMOS/controller min on-time constraint |
| Peak di/dt target | TBD | Derive from Tomahawk-6 load-step profile |
| Efficiency target | TBD | Set once nominal/typical load point is fixed |

## 3. Component Selection Log
_Every major part: what was chosen, alternatives considered, and WHY. This is the record that becomes the final documentation._

### Controller
- **Chosen:** TBD
- **Alternatives considered:** TBD
- **Rationale:** TBD

### DrMOS / Power stage
- **Chosen:** TBD
- **Alternatives considered:** TBD
- **Rationale:** TBD

### Trans-inductors (Lm)
- **Chosen:** TBD
- **Rationale:** TBD

### Compensation inductor (Lc)
- **Chosen:** TBD
- **Rationale:** TBD

## 4. Challenges & Issues Log
_Running record of problems hit and how they were resolved. Date each entry._

| Date | Issue | Resolution / Status |
|---|---|---|
| | | |

## 5. Design Decisions & Changelog
_High-level decisions and pivots, newest first._

- _(2026-07-20)_ Design context set: Tomahawk-6-class core rail. Board scoped as one ~500 A / 8-phase / 12 V→0.75 V TLVR slice; full rail = ~3 interleaved slices.
- _(2026-07-20)_ Repo created, name locked as TLVR Helix.
'@ | Out-File -FilePath README.md -Encoding utf8