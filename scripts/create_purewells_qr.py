from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

# The QR only opens the camera. The video belongs to the physical objects: it plays once the
# camera is pointed at the stamp or the pin badge, not on arrival. The old value carried
# ?mode=video, which opened the plain video player and skipped the AR entirely.
SCAN_URL = "https://www.frankincenseworld.com/"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "ar-entry"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

qr = qrcode.QRCode(
    version=None,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=14,
    border=4,
)
qr.add_data(SCAN_URL)
qr.make(fit=True)
qr_img = qr.make_image(fill_color="#07111f", back_color="white").convert("RGB")

padding = 72
header_height = 170
footer_height = 150
canvas_width = qr_img.width + padding * 2
canvas_height = qr_img.height + header_height + footer_height
canvas = Image.new("RGB", (canvas_width, canvas_height), "white")
draw = ImageDraw.Draw(canvas)

try:
    title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
    body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
except OSError:
    title_font = body_font = small_font = ImageFont.load_default()

lines = ["Purewells Wacandy Japan", "Scan to open the camera"]
y = 48
for i, line in enumerate(lines):
    font = title_font if i == 0 else body_font
    bbox = draw.textbbox((0, 0), line, font=font)
    draw.text(((canvas_width - (bbox[2] - bbox[0])) / 2, y), line, fill="#07111f", font=font)
    y += 58 if i == 0 else 42

canvas.paste(qr_img, (padding, header_height))
footer_lines = [
    "Opens the camera. Tap Start camera and allow access.",
    "Point it at the OSAKA stamp or the pin badge to play the video.",
]
y = header_height + qr_img.height + 42
for line in footer_lines:
    bbox = draw.textbbox((0, 0), line, font=small_font)
    draw.text(((canvas_width - (bbox[2] - bbox[0])) / 2, y), line, fill="#25405f", font=small_font)
    y += 30

output_path = OUTPUT_DIR / "purewells-scan-qr.png"
canvas.save(output_path)
print(f"{output_path} -> {SCAN_URL}")
