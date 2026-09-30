# PNG to SVG

Put `.png` files in the `png` folder. Run:

```powershell
python -m pip install -U -r ".\Python projects\PNG-to-SVG\requirements.txt"
python ".\Python projects\PNG-to-SVG\convert_png_to_svg.py"
```

The generated, vector-traced files are saved to `svg` using the same filename.

PNG is a raster format, so the script traces the image into editable SVG paths; results are best for logos, icons, and flat artwork.

Transparent black artwork is traced from its alpha channel, while opaque black-on-white line art has its white paper background removed automatically. Change `ALPHA_THRESHOLD` or `INK_THRESHOLD` in `convert_png_to_svg.py` if you need to retain more or less faint edge detail.
