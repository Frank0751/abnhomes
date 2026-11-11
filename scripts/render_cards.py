"""Render the demo video's opening/closing title cards to PNG (1280x720)."""
from playwright.sync_api import sync_playwright

CARD_HTML = """
<!DOCTYPE html><html><head><style>
  body {{ margin:0; width:1280px; height:720px; background:#0a0e1a;
         display:flex; flex-direction:column; justify-content:center; align-items:center;
         font-family: Georgia, 'Times New Roman', serif; }}
  .kicker {{ color:#14b8a6; font-family: Arial, sans-serif; letter-spacing:6px;
             font-size:20px; text-transform:uppercase; margin-bottom:28px; }}
  h1 {{ color:#faf8f3; font-size:76px; margin:0 0 18px; font-weight:700; }}
  p  {{ color:#9aa3b2; font-family: Arial, sans-serif; font-size:24px; margin:6px 0; }}
  .bar {{ width:120px; height:4px; background:#0d9488; margin-top:36px; }}
</style></head><body>
  <div class="kicker">Product demonstration</div>
  <h1>{title}</h1>
  <p>{line1}</p>
  <p>{line2}</p>
  <div class="bar"></div>
</body></html>
"""

CARDS = [
    ("card_open.png", "ABN Homes", "One platform for stays, long lets and operations",
     "Guest journey · Admin console · Owner & tenant portals"),
    ("card_close.png", "Built. Tested. Live.", "abnhomes.vercel.app — bookings, ledger, automation",
     "Documentation and walkthrough slides accompany this video"),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    for name, title, line1, line2 in CARDS:
        page.set_content(CARD_HTML.format(title=title, line1=line1, line2=line2))
        page.wait_for_timeout(300)
        page.screenshot(path=f"/home/z/my-project/assets/video/{name}")
        print("rendered", name)
    browser.close()
