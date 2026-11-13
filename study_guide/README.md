# Study guide: axial compressors and turbomachinery basics

`Axial_Compressor_Study_Guide.pdf`: reading plan, formula sheets and one solved problem per type from Korpela, *Principles of Turbomachinery* (2nd ed.):

* Chapters 2 and 3 are covered in full.
* Chapters 5 and 8 are limited to what the six compressor videos (`../scripts.txt`) teach.

Personal study material; not a course submission.

To rebuild from `source/`:

1. `python3 figs.py`
2. `pandoc guide.md -s --katex=katex/ --css style.css -o guide.html`
3. `node pdf.js` (needs the KaTeX `dist/` folder copied to `katex/`)

`solve.py` and `solve2.py` recompute every answer.
