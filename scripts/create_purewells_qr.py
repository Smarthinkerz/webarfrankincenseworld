from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

SCAN_URL = "https://frankincenseworld.com/scan/purewells-wacandy-japan?mode=video"
OUTPUT_DIR = Path("/home/ubuntu/ar-vision-studio-local/public/ar-entry")
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

lines = ["Purewells Wacandy Japan", "Scan to open the video"]
y = 48
for i, line in enumerate(lines):
    font = title_font if i == 0 else body_font
    bbox = draw.textbbox((0, 0), line, font=font)
    draw.text(((canvas_width - (bbox[2] - bbox[0])) / 2, y), line, fill="#07111f", font=font)
    y += 58 if i == 0 else 42

canvas.paste(qr_img, (padding, header_height))
footer_lines = [
    "This opens the Purewells video directly.",
    "Tap Open AR scanner only when testing target detection.",
]
y = header_height + qr_img.height + 42
for line in footer_lines:
    bbox = draw.textbbox((0, 0), line, font=small_font)
    draw.text(((canvas_width - (bbox[2] - bbox[0])) / 2, y), line, fill="#25405f", font=small_font)
    y += 30

output_path = OUTPUT_DIR / "purewells-scan-qr.png"
canvas.save(output_path)
print(f"{output_path} -> {SCAN_URL}")
