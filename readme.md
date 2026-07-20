# TLVR Helix

TLVR Helix is a single-slice core-rail regulator scoped to the power-delivery requirements of a Tomahawk-6-class 3nm switch ASIC. A full deployment current-shares 1 slice; this board proves out one.

A multiphase Trans-Inductor Voltage Regulator (TLVR) for high-current, high-di/dt core rails (AI accelerator / CPU-class loads). Training/portfolio design — built to production-grade rigor.

**Status:** Early design — specification phase
**Author:** Ahmad Nabil (TheChipMaker / VccLabs)

---

## 1. Design Intent
_Why this board exists, the target application, and what "good" looks like._

- Topology: Multiphase buck with trans-inductors (TLVR)
- Target application: TBD
- Key goal: decouple steady-state ripple (Lm) from transient di/dt (Lc + leakage)

## 2. Specifications
_Living spec table. Update as decisions are locked._

| Parameter | Target | Notes |
|---|---|---|
| Input voltage (Vin) | TBD | |
| Output voltage (Vout) | TBD | |
| Output current (Iout) | TBD | |
| Phase count | TBD | |
| Switching frequency (fsw) | TBD | |
| Magnetizing inductance (Lm) | TBD | sets steady-state ripple |
| Compensation inductor (Lc) | TBD | sets transient response |
| Peak di/dt target | TBD | |
| Efficiency target | TBD | at what load point |

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

- _(YYYY-MM-DD)_ Repo created, name locked as TLVR Helix.
'@ | Out-File -FilePath README.md -Encoding utf8