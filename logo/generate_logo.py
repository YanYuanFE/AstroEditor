#!/usr/bin/env python3
"""
AstroEditor Logo — polished version
Clean coral circle + rounded star + dot, Cairo-style.
Uses aggdraw for smooth anti-aliased rounded shapes.
"""

from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 2048  # render at 2x then downsample for crisp AA
CENTER = SIZE // 2
PAD = 120

# Cairo coral
CORAL = (241, 90, 74)
WHITE = (255, 255, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)


def polar(cx, cy, r, angle_deg):
    a = math.radians(angle_deg - 90)
    return cx + r * math.cos(a), cy + r * math.sin(a)


# ─── Circle ───────────────────────────────────────────────────────────────────
cr = (SIZE - PAD * 2) // 2
draw.ellipse([PAD, PAD, SIZE - PAD, SIZE - PAD], fill=CORAL)

# ─── Rounded star ─────────────────────────────────────────────────────────────
# Build star path then draw with slight rounding via mask approach
star_cx = CENTER
star_cy = CENTER + 30  # optical center nudge

outer_r = 440
inner_r = 185

# Generate raw star points
raw = []
for i in range(5):
    raw.append(polar(star_cx, star_cy, outer_r, i * 72))
    raw.append(polar(star_cx, star_cy, inner_r, i * 72 + 36))

# Draw star on a mask, blur slightly for rounded effect, then threshold
star_mask = Image.new("L", (SIZE, SIZE), 0)
star_draw = ImageDraw.Draw(star_mask)
star_draw.polygon(raw, fill=255)

# Slight gaussian blur + threshold gives rounded corners
blur_radius = 18
star_mask = star_mask.filter(ImageFilter.GaussianBlur(blur_radius))
star_mask = star_mask.point(lambda x: 255 if x > 128 else 0)

# Apply white star through rounded mask
star_layer = Image.new("RGBA", (SIZE, SIZE), (*WHITE, 255))
img.paste(star_layer, mask=star_mask)

# ─── Dot above — echoing Cairo's head circle ─────────────────────────────────
dot_r = 58
dot_cx = CENTER
dot_cy = CENTER - 510

draw = ImageDraw.Draw(img)
draw.ellipse(
    [dot_cx - dot_r, dot_cy - dot_r, dot_cx + dot_r, dot_cy + dot_r],
    fill=WHITE
)

# ═══════════════════════════════════════════════════════════════════════════════
# Downsample to final sizes
# ═══════════════════════════════════════════════════════════════════════════════
out_dir = "/Users/yanyuan/Documents/Develop/Github/AstroEditor/logo"

final = img.resize((1024, 1024), Image.LANCZOS)
final.save(f"{out_dir}/astro-editor-logo.png", "PNG")

for s in [512, 256, 128, 64, 32]:
    resized = img.resize((s, s), Image.LANCZOS)
    resized.save(f"{out_dir}/astro-editor-logo-{s}.png", "PNG")

print("Polished logo generated.")
