# AI-Assisted Reverse Engineering of an Axial-Flow Compressor

**Turbomachinery course project, Amirkabir University of Technology (Tehran Polytechnic)**
Team: **Alireza Bayati · Melika Bali** · Supervisor: **Dr. Nader Montazerin**
Phase 1 submission: 24 Mehr 1405 (16 October 2026)

The project pursues two goals at the same time: learning how an axial compressor works, and studying what current AI tools can do in a specialised mechanical-engineering task. The use of AI is required by the course brief and is openly declared.

## Current status

* **Phase 2 target machine: Mitsubishi Power M701JAC** (15-stage axial compressor, PR 25, 3000 rpm). Everything for it is in [`m701jac/`](m701jac/): source index, team dossier, assumption audit, dossier review, and the real-gas analysis with uncertainty ranges.
* The Phase 1 proposal and video below were built around the MAPNA MGT-70(3). They are kept as submitted. Their assumed starting numbers (efficiency, constant c_p, equal stage pressure ratio, inlet velocity and so on) are reviewed in [`m701jac/docs/ASSUMPTIONS_AUDIT.md`](m701jac/docs/ASSUMPTIONS_AUDIT.md).

## Phase 1 deliverables (submitted 24 Mehr 1405, MGT-70(3) target)

| File | What it is |
|---|---|
| [`proposal/Axial_Compressor_Project_Proposal.docx`](proposal/Axial_Compressor_Project_Proposal.docx) | Project proposal (Word, English). Covers the working principle, an introductory theoretical framework (thermodynamics, fluid dynamics, maps, stall/surge, blade stress and vibration), the candidate survey and selection of the **MAPNA MGT-70(3)** 16-stage compressor, a first-pass catalogue-based estimate, methodology, timeline, risks, an AI transparency statement and the original prompt (Appendix A). |
| [`proposal/Axial_Compressor_Project_Proposal_preview.pdf`](proposal/Axial_Compressor_Project_Proposal_preview.pdf) | PDF preview of the proposal, rendered with LibreOffice. Word is the reference layout: when the .docx is opened, Word asks to update fields, which refreshes the table of contents. |
| [`video/Axial_Compressor_AI_Explainer.mp4`](video/Axial_Compressor_AI_Explainer.mp4) | Silent explainer video (≈ 2 min, 1920 × 1080, 30 fps, H.264, no audio). |

## How the video was made

The video contains no stock footage and no hand animation. Every frame is produced from code written by the AI:

* `video/source/src/design.js`: mean-line design of a 16-stage, 50 % reaction compressor (φ = 0.55, ψ = 0.35, π = 12, η_p = 0.90) and the free-vortex blade angles.
* `geometry.js`: twisted blades lofted from cambered NACA-65-like sections wrapped on cylinders, plus the hub and casing of revolution.
* `scene3d.js`: the three.js scene (≈ 1 800 instanced blades, cut-away casing, combustor and turbine) and the flow particles coloured by total temperature.
* `cascade.js`, `plots.js`: the 2-D blade cascade with velocity triangles and pressure field, the T–s diagram, the compressor map and the rotating-stall view.
* `overlay.js`, `main.js`: KaTeX equations, labels and the 118-second timeline.
* `render.js`: renders the page frame by frame in headless Chromium (deterministic `seek(t)`), then `encode.sh` encodes the frames with FFmpeg.

To rebuild: `npm install` in `video/source`, serve that folder on `http://127.0.0.1:8123`, run `node render.js --from 0 --to 3540 --out frames`, then `./encode.sh`.

## How the proposal was made

`proposal/source/proposal.md` (pandoc Markdown with LaTeX equations, converted to native Word equations) → `build.py` (pandoc + `post.py` styling + cached table of contents). `calc.py` contains the first-pass MGT-70(3) estimate and `figs.py` generates Figures 1–6.

---
Prepared with the assistance of Claude (Anthropic).
