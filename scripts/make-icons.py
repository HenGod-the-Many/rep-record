"""Generate the app icons in public/. Run: python -X utf8 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

BG = (17, 20, 24)
FG = (79, 156, 249)
OUT = Path(__file__).resolve().parent.parent / 'public'
OUT.mkdir(exist_ok=True)


def dumbbell(size: int) -> Image.Image:
    s = size / 512
    img = Image.new('RGB', (size, size), BG)
    d = ImageDraw.Draw(img)
    r = lambda x0, y0, x1, y1, rad: d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=rad * s, fill=FG)
    r(150, 238, 362, 274, 10)   # bar
    r(96, 170, 146, 342, 18)    # inner plates
    r(366, 170, 416, 342, 18)
    r(56, 206, 100, 306, 14)    # outer plates
    r(412, 206, 456, 306, 14)
    return img


for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    dumbbell(size).save(OUT / name)

(OUT / 'icon.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    '<rect width="512" height="512" rx="96" fill="#111418"/>'
    '<g fill="#4f9cf9">'
    '<rect x="150" y="238" width="212" height="36" rx="10"/>'
    '<rect x="96" y="170" width="50" height="172" rx="18"/><rect x="366" y="170" width="50" height="172" rx="18"/>'
    '<rect x="56" y="206" width="44" height="100" rx="14"/><rect x="412" y="206" width="44" height="100" rx="14"/>'
    '</g></svg>\n',
    encoding='utf-8',
)
print('icons written to', OUT)
