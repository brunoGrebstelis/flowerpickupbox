"""Convert every PNG in ./png to a vector-traced SVG in ./svg.

Install the dependency once with:
    python -m pip install -r requirements.txt
Then run this file from this project directory:
    python convert_png_to_svg.py
"""

from pathlib import Path
import sys
import tempfile

try:
    import vtracer
    from PIL import Image, ImageChops
except ImportError:
    sys.exit(
        "Missing dependency: run 'python -m pip install -r requirements.txt' first."
    )


PROJECT_DIR = Path(__file__).resolve().parent
INPUT_DIR = PROJECT_DIR / "png"
OUTPUT_DIR = PROJECT_DIR / "svg"
# Ignore pixels below this opacity when tracing transparent brush/ink artwork.
# Raise this value to remove more faint edge detail; lower it to preserve more.
ALPHA_THRESHOLD = 128
# Pixels darker than this in an opaque black-on-white drawing count as ink.
INK_THRESHOLD = 220


def is_grayscale(image: Image.Image) -> bool:
    """Return True when an RGB image contains no meaningful colour information."""
    red, green, blue = image.convert("RGB").split()
    return (
        ImageChops.difference(red, green).getextrema()[1] <= 2
        and ImageChops.difference(green, blue).getextrema()[1] <= 2
    )


def convert_file(source: Path) -> None:
    """Vector-trace one PNG and preserve its filename in the output folder."""
    destination = OUTPUT_DIR / f"{source.stem}.svg"
    with Image.open(source) as image:
        rgba_image = image.convert("RGBA")
        alpha = rgba_image.getchannel("A")

        has_transparency = alpha.getextrema()[0] < 255
        monochrome_ink = is_grayscale(rgba_image)

        if not has_transparency and not monochrome_ink:
            # Full-colour, opaque image: preserve its colours.
            vtracer.Config.poster().convert_file(str(source), str(destination))
            return

        if has_transparency:
            # Trace the visible pixels in transparent brush/ink artwork.
            mask = alpha.point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)
        else:
            # Remove the white paper background from opaque black-on-white art.
            grayscale = rgba_image.convert("L")
            mask = grayscale.point(lambda value: 255 if value <= INK_THRESHOLD else 0)

        # VTracer's BW foreground is light, while its output paths are black.
        # Make a white ink mask on black so only the artwork is traced.
        trace_image = Image.new("L", rgba_image.size, color=0)
        trace_image.paste(255, mask=mask)

        with tempfile.TemporaryDirectory() as temp_dir:
            trace_source = Path(temp_dir) / "alpha-mask.png"
            trace_image.save(trace_source)
            tracer = vtracer.Config(
                clustering="bw",
                mode="spline",
                filter_speckle=8,
                binary_threshold=128,
                path_precision=4,
                simplify=1.0,
            )
            tracer.convert_file(str(trace_source), str(destination))


def main() -> int:
    INPUT_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    png_files = sorted(
        path for path in INPUT_DIR.iterdir() if path.is_file() and path.suffix.lower() == ".png"
    )

    if not png_files:
        print(f"No PNG files found. Add files to: {INPUT_DIR}")
        return 0

    failures = 0
    for source in png_files:
        try:
            convert_file(source)
            print(f"Converted: {source.name} -> {source.stem}.svg")
        except Exception as error:  # Continue so one bad file does not stop the batch.
            failures += 1
            print(f"Could not convert {source.name}: {error}", file=sys.stderr)

    print(f"Finished: {len(png_files) - failures}/{len(png_files)} file(s) converted.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
