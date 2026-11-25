# Regenerate with: pip install python-barcode pillow; python3 e2e/fixtures/make_return_page.py e2e/fixtures/synthetic-return-page.png
"""Synthetic Amazon-style return page: instructions, dashed cut lines, a 4x6 UPS-style
label turned a quarter turn counter-clockwise, and a return slip with its own barcode.
All text and numbers are made up."""
import random, sys
import barcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont

DPI = 144
random.seed(7)
def font(size):
    for name in ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default(size)
def bold(size):
    for name in ("DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return font(size)
def code128(data, module_px, height_px):
    img = barcode.get("code128", data, writer=ImageWriter()).render(
        {"module_width": module_px * 25.4 / DPI, "module_height": height_px * 25.4 / DPI,
         "quiet_zone": 2.5, "write_text": False, "dpi": DPI}).convert("L")
    return img

# Upright 4x6 label.
label = Image.new("L", (4 * DPI, 6 * DPI), 255)
d = ImageDraw.Draw(label)
W, H = label.size
d.rectangle([2, 2, W - 3, H - 3], outline=0, width=2)
d.text((14, 12), "EXAMPLE CUSTOMER\n100 SAMPLE ROAD\nSPRINGFIELD ZZ 00000", font=font(13), fill=0)
d.text((W - 120, 12), "2.0 LBS   1 OF 1", font=bold(13), fill=0)
d.text((14, 90), "SHIP\nTO:", font=bold(18), fill=0)
d.text((80, 92), "EXAMPLE RETURNS CENTER\n200 DEMO AVENUE\nTESTVILLE ZZ 99999", font=bold(15), fill=0)
d.line([0, 175, W, 175], fill=0, width=2)
# Fake MaxiCode: random dots around a bullseye.
mx, my = 18, 190
for _ in range(900):
    x, y = random.randrange(0, 130), random.randrange(0, 120)
    d.rectangle([mx + x, my + y, mx + x + 3, my + y + 3], fill=0)
for r in (26, 18, 10):
    d.ellipse([mx + 65 - r, my + 60 - r, mx + 65 + r, my + 60 + r], outline=0, width=4)
d.text((170, 190), "ZZ 999 9-99", font=bold(34), fill=0)
label.paste(code128("420999999", 2, 70), (175, 240))
d.line([0, 330, W, 330], fill=0, width=3)
d.text((14, 340), "UPS GROUND", font=bold(30), fill=0)
d.text((14, 378), "TRACKING #: 1Z 999 AA1 01 2345 6784", font=bold(14), fill=0)
d.line([0, 400, W, 400], fill=0, width=2)
label.paste(code128("1Z999AA10123456784", 2, 150), (40, 412))
d.line([0, 580, W, 580], fill=0, width=3)
d.text((14, 590), "BILLING: P/P\nDESC: RETURNED MERCHANDISE\nRETURN SERVICE\nREFERENCE NO: TEST0001", font=font(13), fill=0)
d.line([0, 680, W, 680], fill=0, width=2)
d.text((W - 80, 690), "E4", font=bold(40), fill=0)
label.paste(code128("TEST0001RMA", 2, 90), (20, 740))

page = Image.new("L", (int(8.5 * DPI), 11 * DPI), 255)
p = ImageDraw.Draw(page)
PW, PH = page.size
y = 60
p.text((72, y), "Online Return Center", font=bold(26), fill=0); y += 50
for line in ["Return summary for a made-up order. Nothing here is real.",
             "Print this page and follow the steps below."]:
    p.text((72, y), line, font=font(15), fill=0); y += 24
y += 10
p.rectangle([72, y, PW - 72, y + 40], outline=40, width=2)
p.text((84, y + 10), "All items must be sent by Jan 1, 2099.", font=font(15), fill=0); y += 60
p.text((72, y), "Additional instructions for mailing your package", font=bold(17), fill=0); y += 32
for line in ["Make sure no other tracking labels are on your package.",
             "Affix the mailing label squarely onto the address side of the parcel.",
             "Bring your return to a drop-off location near you.",
             "Keep the battery inside the product."]:
    p.text((72, y), line, font=font(15), fill=0); y += 22
y += 14
p.text((72, y), "Return Mailing Label", font=bold(17), fill=0); y += 28
p.text((72, y), "Cut this label and affix to the outside of the return package", font=font(15), fill=0); y += 34
def dashed(yy):
    for x in range(72, PW - 72, 12):
        p.line([x, yy, x + 6, yy], fill=0, width=1)
dashed(y); top = y
turned = label.rotate(90, expand=True, fillcolor=255)   # reads bottom to top
page.paste(turned, ((PW - turned.width) // 2, top + 14))
y = top + 14 + turned.height + 14
dashed(y); y += 24
p.text((72, y), "Return Authorization Slip", font=bold(17), fill=0); y += 30
p.text((72, y), "Place this barcode and item description inside your return package.", font=font(15), fill=0); y += 34
page.paste(code128("RMA0001TEST", 2, 60), (72, y)); y += 80
p.text((72, y), "1 x Example cordless tool (made up)", font=font(15), fill=0)
page.save(sys.argv[1], optimize=True)
label_box = ((PW - turned.width) // 2, top + 14, (PW - turned.width) // 2 + turned.width, top + 14 + turned.height)
print("page", page.size, "label box", label_box)
