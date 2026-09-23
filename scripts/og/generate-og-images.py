"""Builds the KADİK social-share (Open Graph) images: the council logo in white
on the brand blue, with the page name underneath. Output: public/kadik/og/*.png
(1200x630, the size Facebook, LinkedIn, WhatsApp and X expect).

    python3 scripts/og/generate-og-images.py

Requires Pillow and NumPy. Re-run after changing the logo or a page name.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "public/kadik/kadik-logo.png"
OUT = ROOT / "public/kadik/og"
W, H = 1200, 630
NAVY = (7, 40, 95)
BLUE = (11, 77, 162)
GOLD = (196, 154, 74)
WHITE = (255, 255, 255)

SERIF_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

# file name -> page caption (None = the site-wide default card)
PAGES = {
    "default": None,
    "about": "About Us",
    "board": "Board Members",
    "events": "Events & Calendar",
    "announcements": "Announcements",
    "news": "News & Insights",
    "membership": "Membership Application",
    "gallery": "Photo Gallery",
    "contact": "Contact the Secretariat",
    "privacy": "Privacy Policy",
    "terms": "Terms of Use",
    "charter": "Charter",
    "not-found": "Page Not Found",
}


def white_logo(size: int) -> Image.Image:
    logo = Image.open(LOGO).convert("RGBA")
    alpha = logo.getchannel("A")
    white = Image.new("RGBA", logo.size, WHITE + (0,))
    white.putalpha(alpha)
    return white.resize((size, size), Image.LANCZOS)


def background() -> Image.Image:
    base = Image.new("RGB", (W, H), NAVY)
    # Smooth diagonal blend: navy top-left -> brand blue bottom-right.
    xs = np.linspace(0, 1, W)[None, :]
    ys = np.linspace(0, 1, H)[:, None]
    gradient = Image.fromarray(((xs * 0.55 + ys * 0.45) * 255).astype("uint8"), "L")
    base = Image.composite(Image.new("RGB", (W, H), BLUE), base, gradient)
    # Faint oversized logo as a watermark on the right edge.
    mark = white_logo(760)
    faded = mark.copy()
    faded.putalpha(mark.getchannel("A").point(lambda a: a * 0.07))
    base.paste(faded, (W - 470, -60), faded)
    return base


def spaced(draw: ImageDraw.ImageDraw, text: str, font, tracking: int) -> int:
    return sum(draw.textlength(ch, font=font) for ch in text) + tracking * (len(text) - 1)


def draw_spaced(draw, center_x: int, y: int, text: str, font, tracking: int, fill):
    x = center_x - spaced(draw, text, font, tracking) / 2
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def render(caption: str | None) -> Image.Image:
    img = background()
    draw = ImageDraw.Draw(img)
    cx = W // 2
    logo_size = 250 if caption is None else 200
    logo = white_logo(logo_size)
    top = 70 if caption is None else 66
    shadow = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    shadow.putalpha(logo.getchannel("A").point(lambda a: a * 0.35))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    img.paste((0, 20, 60), (cx - logo_size // 2, top + 8), shadow)
    img.paste(logo, (cx - logo_size // 2, top), logo)

    y = top + logo_size + 26
    brand = ImageFont.truetype(SERIF_BOLD, 76 if caption is None else 64)
    draw_spaced(draw, cx, y, "KADİK", brand, 10, WHITE)
    y += (76 if caption is None else 64) + 20
    council = ImageFont.truetype(SANS_BOLD, 21)
    draw_spaced(draw, cx, y, "KYBELE ATASEVER WORLD BUSINESS COUNCIL", council, 4, (220, 229, 243))
    y += 44
    draw.line([(cx - 60, y), (cx + 60, y)], fill=GOLD, width=3)
    if caption:
        page = ImageFont.truetype(SERIF_BOLD, 40)
        width = draw.textlength(caption, font=page)
        draw.text((cx - width / 2, y + 18), caption, font=page, fill=WHITE)
    else:
        tagline = ImageFont.truetype(SANS, 24)
        text = "London · Trust, shared judgement and global partnerships"
        width = draw.textlength(text, font=tagline)
        draw.text((cx - width / 2, y + 20), text, font=tagline, fill=(220, 229, 243))
    return img


def post_background() -> Image.Image:
    """Card background for news articles: brand block on top, room for the
    article title (drawn at request time by app/news/[slug]/opengraph-image.tsx)."""
    img = background()
    draw = ImageDraw.Draw(img)
    logo = white_logo(96)
    img.paste(logo, (72, 56), logo)
    brand = ImageFont.truetype(SERIF_BOLD, 44)
    x = 72 + 96 + 24
    for ch in "KADİK":
        draw.text((x, 62), ch, font=brand, fill=WHITE)
        x += draw.textlength(ch, font=brand) + 6
    council = ImageFont.truetype(SANS_BOLD, 16)
    x = 72 + 96 + 26
    for ch in "KYBELE ATASEVER WORLD BUSINESS COUNCIL":
        draw.text((x, 120), ch, font=council, fill=(220, 229, 243))
        x += draw.textlength(ch, font=council) + 3
    draw.line([(72, 196), (192, 196)], fill=GOLD, width=3)
    return img


def app_icon(size: int, radius_ratio: float) -> Image.Image:
    """Favicon / home-screen icon: white logo on the brand blue."""
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    icon.paste(Image.new("RGBA", (size, size), NAVY + (255,)), (0, 0), mask)
    logo = white_logo(int(size * 0.78))
    offset = (size - logo.size[0]) // 2
    icon.paste(logo, (offset, offset), logo)
    return icon


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, caption in PAGES.items():
        render(caption).save(OUT / f"{name}.png", optimize=True)
        print("wrote", OUT / f"{name}.png")
    post_background().save(OUT / "post-background.png", optimize=True)
    white_logo(512).save(OUT / "logo-white.png", optimize=True)
    app = ROOT / "app"
    app_icon(512, 0.22).save(app / "icon.png", optimize=True)
    app_icon(180, 0.0).convert("RGB").save(app / "apple-icon.png", optimize=True)
    print("wrote post background, white logo and app icons")


if __name__ == "__main__":
    main()
