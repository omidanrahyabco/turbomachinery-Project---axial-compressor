# Review of the M701JAC Technical Data Dossier (compiled 5 Aban 1405)

This review checks the dossier (`m701jac/sources/M701JAC_Technical_Dossier.docx`) claim by claim against the source documents supplied with it (D2–D8). D1, the product page, was supplied only as its figures (correction curves, layouts, rotor photo), not as text. Claims that rest on D1 alone are therefore marked as not verifiable from the supplied files.

Legend: ✅ confirmed · ⚠️ needs correction or a caveat · ❓ not verifiable from the supplied files

## Confirmed

| Dossier item | Source check |
|---|---|
| Table 3 — both ISO ratings: 448 MW / 8182 kJ/kWh / 44.0 % / PR 25 / 765 kg/s / 663 °C and 574 MW / 8295 kJ/kWh / 43.4 % / PR > 25 / 1,024 kg/s / 646 °C; 3000 rpm | ✅ D2, performance table (pp. 21–22). The energy balance closes to +1.1 % (448 MW) and +1.7 % (574 MW) of heat input, so the data are self-consistent (`results_tables.md` §1) |
| Table 4 — MPCP1 650 MW / 840 MW, > 64 %, GT/ST split 441.7/208.3 and 570.9/269.1 MW | ✅ D2 |
| Variable IGV plus variable vanes on the first three stages ("four stages operate together") | ✅ D2 p. 9–10; D6 §2.2 |
| Start-up bleed from low-, middle- and high-pressure stages | ✅ D6 §2.2 |
| Rotating stall extinguished at ≈ 60 % speed; efficiency and air flow measured at each IGV angle | ✅ D6 §3.2 |
| J-series compressor PR 23, based on the H-series compressor (PR 25); 3-D design; full-scale high-speed research compressor | ✅ D6 §2.2 |
| JAC: PR raised from 23 to 25 to limit the exhaust-temperature rise; rotating-stall concern at start-up; T-Point verification May 2018 | ✅ D4 §4.3 |
| "High-load, high-efficiency compressor" | ✅ D3 §3.1 (iii) |
| Boundary-layer-controlled high-loading compressor; eight-stage front-block rig with variable vanes; surge verification | ✅ D7 §2.1, D8 §2.1 |
| M501G 17 stages / PR 20 / 267 MW; M501J 15 stages / PR 23 / 327 MW gross (330 MW in D4) | ✅ D6 Table 1, D4 Table 1 |
| M501JAC 425 MW / PR 25 (D4) and 453 MW / PR > 25 (D2) | ✅ |
| M701J = 1.2× geometric scale of M501J; flow and output × 1.44 | ✅ D5 §4.1 (GTCC 680 MW vs 470 MW = 1.45) |
| Bolted discs with torque pins (compressor), curvic couplings (turbine); two bearings; cold-end drive; axial exhaust; horizontally split casings | ✅ D6 §2.1, D2 p. 11–12 |
| Turbine rows 1–4 blades and vanes air-cooled (JAC); row-1 vane cooled by compressor discharge air, others by intermediate-stage bleed | ✅ D2 p. 9–10 |
| Correction curves (inlet temperature, barometric pressure) | ✅ D1 figures (received) |

## Needs correction or a caveat

1. ⚠️ **"2015 rating" / "2018 rating" labels (§3, Table 3).** None of the supplied documents dates the two ratings. D2 lists both without years. Either cite the source of the years or remove them.
2. ⚠️ **§4.4: "The same rule links the M501JAC and M701JAC."** This contradicts D2. A 1.2× scale of the current M501JAC (815 kg/s) would pass 1,174 kg/s, but the M701JAC ratings pass 765 and 1,024 kg/s, which correspond to linear scales of 0.97 and 1.12. The rule is documented only for the J series (D5). Recommended wording: "the 1.2× rule was used for the J series (D5); the current M701JAC ratings do not follow it exactly."
3. ⚠️ **Where the shock losses are (§4.2).** D6 says "reduce the shockwave loss in the *initial* stages and frictional loss in the intermediate and final stages". The D2 catalogue text reads "shockwave loss in the intermediate and final stages", which looks like an editorial shortening. The dossier follows D6, which is the technical source, but it cites D1 and D6 together. Cite D6 alone, or note the discrepancy.
4. ⚠️ **§5 derived quantities.** These repeat the Phase 1 assumptions that were challenged: η_p = 0.90 fixed, constant c_p, about 2 % fuel and equal stage pressure ratio. The replacements are in `ASSUMPTIONS_AUDIT.md`. In particular:
   * the fuel fraction from the heat rate is 2.7–3.0 %, not 2 %;
   * T₀₂ is 789 K (771–809 K) with real-gas properties, against 801 K;
   * the stage pressure ratio is not 1.239 in every stage: it runs from about 1.35 in the front stages to about 1.12 at the rear.
5. ⚠️ **§6, last paragraph:** "This is why the M701JAC was not selected … and NASA Rotor 37 was chosen instead." This does not match the submitted Phase 1 proposal, which selected the MGT-70(3) compressor and used Rotor 37 only as a validation benchmark. It also contradicts the new decision to reverse-engineer the M701JAC. Rewrite it as the list of data gaps the reverse engineering must fill.
6. ⚠️ **"15-stage axial" for the M701JAC.** This is consistent with D2 ("flow path of the compressor … same shape as that of the J-series") together with D5 and D6 (J series: 15 stages). However, no supplied document states it explicitly *for the M701JAC*. It is presumably on D1; add the D1 text or a screenshot.
7. ⚠️ **"Same flow path as J; PR raised" (Table 5).** D2 says the JAC compressor flow path has the same shape as the J series. D4 says the JAC compressor has "a high pressure ratio design equivalent to our H-series". Both can be true (same annulus, re-bladed for higher loading), but the dossier should say that this is an interpretation.

## Not verifiable from the supplied files (D1 product-page text needed)

* ❓ 22 combustor cans for the M701JAC. D5 gives 22 for the steam-cooled M701J, so this is plausible.
* ❓ Approximate dimensions 16.7 × 6.5 × 6.9 m and weight 550 t.
* ❓ 30 % H₂ co-firing demonstrated.
* ❓ "> 3.2 million operating hours (Dec. 2025)". D2 says "more than 3 million AOH, date as of May 2025".

## Useful additions from the documents (not yet in the dossier)

* **D3 (Thailand):** 10 M701JAC single-shaft GTCC units, 6,700 MW in total; GSRC and GPD 2,650 MW with 4 units each (≈ 662 MW net each); HKP 1,400 MW with 2 units (700 MW each). First unit in operation March 2021; 140,000 actual operating hours. Per-unit outputs above the 650 MW combined-cycle rating of the 448 MW gas turbine suggest that the fleet uses the larger (574 MW-class) machine.
* **D2:** the enhanced air-cooling system extracts air at the compressor outlet, cools it externally, re-compresses it in a dedicated compressor and returns it to the combustor casing. This matters for the compressor delivery-flow definition and for the energy balance, because the cooler rejects heat that does not leave through the exhaust.
* **D4:** the high-PR compressor has a "relatively reduced outlet flow area". This agrees with the computed exit-to-inlet area ratio of about 0.10.
