# legacy-extract

Python scripts (standard library only) for reading the legacy Visual FoxPro ERP in `MCERP/`.
They never write into `MCERP/`.

- `vfp.py` — reads DBF tables with their memo files (`.fpt`, `.sct`, `.frt`, `.pjt`).
  `python vfp.py FORM.SCX` lists a form's objects and properties.
- `dump_scx.py OUT_DIR FORM.SCX ...` — writes each form's controls and method code to a text file.
- `render_scx.py OUT.html FORM.SCX ...` — renders forms as static HTML that approximates the layout,
  with embedded icons, as a reference for the new UI.

Run them from the module's source folder (e.g. `MCERP/CONTAC/fuente`) so icons resolve.
Write the output outside the repo or to a gitignored folder, because it can contain client names.
