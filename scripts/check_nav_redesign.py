"""Verification for the all-viewport hamburger: morph button far left,
dropdown anchored beneath it on desktop/tablet/phone, RTL mirroring, routes."""
from playwright.sync_api import sync_playwright

def panel_box(pg):
    return pg.evaluate("() => { const r = document.querySelector('#site-menu').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width), Math.round(r.y)]; }")

def open_and_check(pg, label, want_x, want_w):
    pg.get_by_role("button", name="Open menu").click()
    pg.wait_for_timeout(600)
    box = panel_box(pg)
    print(f"panel {label} [x,w,top]:", box, f"(want x≈{want_x}, w={want_w})")
    return box

with sync_playwright() as p:
    b = p.chromium.launch()
    # Desktop: hamburger is back
    pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    pg.goto("http://localhost:3000/rent", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    btn = pg.locator("button[aria-controls='site-menu']")
    print("toggle visible @1440:", btn.is_visible(),
          "| morph bars:", pg.evaluate("() => document.querySelectorAll('button[aria-controls=site-menu] span span').length"),
          "| toggle x:", pg.evaluate("() => Math.round(document.querySelector('button[aria-controls=site-menu]').getBoundingClientRect().x)"))
    box = open_and_check(pg, "@1440", 20, 448)
    print("aria-current:", pg.evaluate("() => document.querySelector('#site-menu [aria-current=page]')?.textContent.trim()"))
    pg.screenshot(path="/tmp/render/hamburger_1440.png")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    print("esc closed @1440:", pg.evaluate("() => !document.querySelector('#site-menu')"),
          "| focus on toggle:", pg.evaluate("() => document.activeElement?.getAttribute('aria-controls') === 'site-menu'"))

    # Tablet (user's screenshot scenario)
    pg1 = b.new_context(viewport={"width": 870, "height": 909}).new_page()
    pg1.goto("http://localhost:3000/rent", wait_until="networkidle")
    open_and_check(pg1, "@870", 0, 448)
    pg1.screenshot(path="/tmp/render/hamburger_870.png")
    pg1.keyboard.press("Escape"); pg1.wait_for_timeout(300)

    # Phone
    pg2 = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    pg2.goto("http://localhost:3000/", wait_until="networkidle")
    open_and_check(pg2, "@390", 0, 350)
    pg2.keyboard.press("Escape"); pg2.wait_for_timeout(300)
    # Arabic: panel mirrors to the inline end
    pg2.click("button[aria-haspopup='menu']"); pg2.wait_for_timeout(300)
    pg2.click("[role=menuitem] >> text=العربية"); pg2.wait_for_timeout(500)
    pg2.click("header button[aria-controls='site-menu']"); pg2.wait_for_timeout(600)
    rtl = panel_box(pg2)
    print("panel RTL [x,w,top]:", rtl, f"(want x+w≈390, got {rtl[0] + rtl[1]})")
    b.close()

    # route health: every menu href must resolve
    import urllib.request
    for href in ["/", "/about", "/residences", "/book", "/own", "/rent", "/amenities", "/gallery", "/locations", "/contact"]:
        code = urllib.request.urlopen(f"http://localhost:3000{href}", timeout=15).status
        assert code == 200, (href, code)
    print("all 10 menu hrefs: 200")
