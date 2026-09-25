from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIRECTORY = PROJECT_ROOT / "public" / "icons"
CREAM = (248, 244, 240, 255)

STANDARD_EXPORTS = {
    "huddle-app-v1-192.png": 192,
    "huddle-app-v1-512.png": 512,
    "huddle-app-apple-v1-180.png": 180,
    "huddle-app-favicon-v1-32.png": 32,
}

MASKABLE_EXPORTS = {
    "huddle-app-maskable-v1-192.png": 192,
    "huddle-app-maskable-v1-512.png": 512,
}


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def opaque_maskable(image: Image.Image) -> Image.Image:
    background = Image.new("RGBA", image.size, CREAM)
    return Image.alpha_composite(background, image)


def export_icons(source_path: Path, output_directory: Path) -> list[Path]:
    with Image.open(source_path) as source_file:
        source = source_file.convert("RGBA")
        icc_profile = source_file.info.get("icc_profile")

    if source.width != source.height:
        raise ValueError(
            f"Source artwork must be square, got {source.width}x{source.height}."
        )

    output_directory.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    for filename, size in STANDARD_EXPORTS.items():
        output_path = output_directory / filename
        resized(source, size).save(
            output_path,
            format="PNG",
            optimize=True,
            icc_profile=icc_profile,
        )
        written.append(output_path)

    maskable_source = opaque_maskable(source)
    for filename, size in MASKABLE_EXPORTS.items():
        output_path = output_directory / filename
        resized(maskable_source, size).save(
            output_path,
            format="PNG",
            optimize=True,
            icc_profile=icc_profile,
        )
        written.append(output_path)

    return written


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate Huddle application icons from the approved source artwork."
    )
    parser.add_argument("source", type=Path, help="Path to the square source PNG.")
    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help="Directory for generated PNG files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    for output_path in export_icons(args.source, args.output_directory):
        print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
