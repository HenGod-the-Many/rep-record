"""Contrast check for the Plate palette (WCAG 2.1). Run: python -X utf8 docs/design/contrast-check.py
Text pairs need 4.5:1 (3:1 for large text 24px+ or bold 18.7px+); UI edges and fills need 3:1."""

def lum(hex_):
    h = hex_.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = out
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

PALETTES = {
    'light': dict(bg='#F4F4F1', surface='#FFFFFF', surface2='#ECEDE9', chart2='#555A62', ink='#111214', soft='#555A62', line='#7D828A',
                  hairline='#D6D8DC', hero='#111214', heroInk='#F4F4F1', heroSoft='#B9BDC4',
                  accent='#C2410C', onAccent='#FFFFFF', accentText='#B23C0B', track='#8E939B',
                  danger='#B42318', good='#1D7A3E'),
    'dark': dict(bg='#0E0F11', surface='#18191D', surface2='#24262B', chart2='#A4A9B1', ink='#F2F2F0', soft='#A4A9B1', line='#6B7079',
                 hairline='#2D3036', hero='#1E2025', heroInk='#F2F2F0', heroSoft='#A9AEB6',
                 accent='#FF7A3D', onAccent='#111214', accentText='#FF8A55', track='#686D76',
                 danger='#FF7B72', good='#5FD08F'),
}

# (foreground, background, minimum, what)
CHECKS = [
    ('ink', 'bg', 4.5, 'body text on page'),
    ('ink', 'surface', 4.5, 'body text on card'),
    ('soft', 'bg', 4.5, 'secondary text on page'),
    ('soft', 'surface', 4.5, 'secondary text on card'),
    ('heroInk', 'hero', 4.5, 'text on workout card'),
    ('heroSoft', 'hero', 4.5, 'secondary text on workout card'),
    ('onAccent', 'accent', 4.5, 'Start button label'),
    ('accent', 'hero', 3.0, 'Start button against workout card'),
    ('accentText', 'bg', 4.5, 'accent text (PRs, current tab) on page'),
    ('accentText', 'surface', 4.5, 'accent text on card'),
    ('danger', 'bg', 4.5, 'delete text on page'),
    ('danger', 'surface', 4.5, 'delete text on card'),
    ('good', 'surface', 4.5, 'up-trend text on card'),
    ('line', 'bg', 3.0, 'field and button edges on page'),
    ('line', 'surface', 3.0, 'field edges on card'),
    ('track', 'surface', 3.0, 'empty segment of a progress bar'),
    ('accent', 'surface', 3.0, 'filled segment of a progress bar'),
    ('ink', 'surface2', 4.5, 'text on a raised control (steppers, chips)'),
    ('soft', 'surface2', 4.5, 'secondary text on a raised panel'),
    ('accentText', 'surface2', 4.5, 'accent text on a raised panel'),
    ('chart2', 'surface', 3.0, 'second line on a chart'),
    ('accent', 'bg', 3.0, 'accent edge or fill on the page'),
]

failures = 0
for mode, p in PALETTES.items():
    print(f'\n{mode}')
    for fg, bg, need, what in CHECKS:
        r = ratio(p[fg], p[bg])
        ok = r >= need
        failures += not ok
        print(f"  {'PASS' if ok else 'FAIL'} {r:5.2f} : 1 (needs {need}) {what}: {fg} {p[fg]} on {bg} {p[bg]}")
print(f'\n{failures} failing pair(s)')
raise SystemExit(1 if failures else 0)
