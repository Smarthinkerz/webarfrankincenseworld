from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/ar-vision-studio-local')
source = root / 'public/ar-targets/purewells-target.png'
output = root / 'public/ar-targets/purewells-target-compiled.png'

with Image.open(source) as image:
    image = image.convert('RGB')
    width, height = image.size
    max_side = 1024
    scale = min(1.0, max_side / max(width, height))
    resized_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    resized = image.resize(resized_size, Image.Resampling.LANCZOS)
    resized.save(output, format='PNG', optimize=True)

print(f'source={width}x{height}')
print(f'compiled={resized_size[0]}x{resized_size[1]}')
print(f'output={output}')
