"""Verification for the dropdown nav: anchored under the left 3-lines button,
route health, desktop inline nav, RTL mirroring."""
from playwright.sync_api import sync_playwright

def panel_box(pg):
    return pg.evaluate("() => { const r = document.querySelector('#site-menu').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width), Math.round(r.y)]; }")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 870, "height": 909}).new_page()
    pg.goto("http://localhost:3000/rent", wait_until="networkidle")
    tb = pg.evaluate("() => { const r = document.querySelector('button[aria-controls=site-menu]').getBoundingClientRect(); return [Math.round(r.x), Math.round(r.width)]; }")
    print("toggle @870 [x,w]:", tb, "(far left)")
    pg.get_by_role("button", name="Open menu").click()
    pg.wait_for_timeout(600)
    print("panel @870 [x,w,top]:", panel_box(pg), "(want x≈0, w=448, top≈ header bottom ~64)")
    print("aria-current:", pg.evaluate("() => document.querySelector('#site-menu [aria-current=page]')?.textContent.trim()"))
    pg.screenshot(path="/tmp/render/dropdown_870.png")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    print("esc closed:", pg.evaluate("() => !document.querySelector('#site-menu')"),
          "| focus on toggle:", pg.evaluate("() => document.activeElement?.getAttribute('aria-controls') === 'site-menu'"))

    pg2 = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    pg2.goto("http://localhost:3000/rent", wait_until="networkidle")
    pg2.wait_for_timeout(1500)
    print("toggle hidden @1440:", pg2.get_by_role("button", name="Open menu").count() == 0,
          "| inline links:", pg2.evaluate("() => document.querySelectorAll('nav[aria-label=Primary] a').length"),
          "| header fits:", pg2.evaluate("() => { const el = document.querySelector('header > div'); return el.scrollWidth <= el.clientWidth; }"))

    pg3 = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    pg3.goto("http://localhost:3000/", wait_until="networkidle")
    pg3.get_by_role("button", name="Open menu").click(); pg3.wait_for_timeout(600)
    print("panel @390 [x,w,top]:", panel_box(pg3), "(want x≈0, w=350)")
    pg3.screenshot(path="/tmp/render/dropdown_390.png")
    pg3.keyboard.press("Escape"); pg3.wait_for_timeout(400)
    # Arabic: panel must mirror to the inline END (right side)
    pg3.click("button[aria-haspopup='menu']"); pg3.wait_for_timeout(300)
    pg3.click("[role=menuitem] >> text=العربية"); pg3.wait_for_timeout(500)
    pg3.click("header button[aria-controls='site-menu']"); pg3.wait_for_timeout(600)
    rtl = panel_box(pg3)
    print("panel RTL [x,w,top]:", rtl, f"(want x+w≈390, got {rtl[0] + rtl[1]})")
    b.close()

    # route health: every menu href must resolve (the 404 complaint)
    import urllib.request
    for href in ["/", "/about", "/residences", "/book", "/own", "/rent", "/amenities", "/gallery", "/locations", "/contact"]:
        code = urllib.request.urlopen(f"http://localhost:3000{href}", timeout=15).status
        assert code == 200, (href, code)
    print("all 10 menu hrefs: 200")
