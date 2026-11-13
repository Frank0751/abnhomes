"""Verification for the navigation redesign: drawer behavior, desktop nav, RTL mirroring."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_context(viewport={"width": 870, "height": 909}).new_page()
    pg.goto("http://localhost:3000/rent", wait_until="networkidle")
    print("toggle visible @870:", pg.get_by_role("button", name="Open menu").is_visible())
    pg.get_by_role("button", name="Open menu").click()
    pg.wait_for_timeout(700)
    box = pg.evaluate("() => { const r = document.querySelector('#site-menu').getBoundingClientRect(); return [r.x, r.width, r.height]; }")
    print("drawer [x,w,h] @870:", box, "(want x≈422, w=448)")
    print("scroll locked:", pg.evaluate("() => document.body.style.overflow === 'hidden'"))
    print("aria-current:", pg.evaluate("() => document.querySelector('#site-menu [aria-current=page]')?.textContent.trim()"))
    pg.screenshot(path="/tmp/render/drawer_870.png")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    print("esc closed:", pg.evaluate("() => !document.querySelector('#site-menu')"),
          "| focus on toggle:", pg.evaluate("() => document.activeElement?.getAttribute('aria-controls') === 'site-menu'"))

    pg2 = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    pg2.goto("http://localhost:3000/rent", wait_until="networkidle")
    print("toggle hidden @1440:", pg2.get_by_role("button", name="Open menu").count() == 0)
    print("inline nav links @1440:", pg2.evaluate("() => document.querySelectorAll('nav[aria-label=Primary] a').length"),
          "| phone visible:", pg2.evaluate("() => !!document.querySelector('header a[href^=\"tel:\"]')"))
    print("header fits (no overflow):", pg2.evaluate("() => { const el = document.querySelector('header > div'); return el.scrollWidth <= el.clientWidth; }"))
    pg2.screenshot(path="/tmp/render/desktop_1440.png")

    pg3 = b.new_context(viewport={"width": 390, "height": 844}).new_page()
    pg3.goto("http://localhost:3000/", wait_until="networkidle")
    pg3.get_by_role("button", name="Open menu").click(); pg3.wait_for_timeout(700)
    b3 = pg3.evaluate("() => { const r = document.querySelector('#site-menu').getBoundingClientRect(); return [r.x, r.width]; }")
    print("drawer @390:", b3, "(want x=0, w=390)")
    pg3.screenshot(path="/tmp/render/drawer_390.png")
    pg3.get_by_role("button", name="Close menu").click(); pg3.wait_for_timeout(400)
    # switch to Arabic, then reopen: drawer must anchor to the LEFT (RTL)
    pg3.click("button[aria-haspopup='menu']"); pg3.wait_for_timeout(300)
    pg3.click("[role=menuitem] >> text=العربية"); pg3.wait_for_timeout(500)
    pg3.click("header button[aria-controls='site-menu']"); pg3.wait_for_timeout(700)
    rtl_box = pg3.evaluate("() => { const r = document.querySelector('#site-menu').getBoundingClientRect(); return [r.x, r.width]; }")
    print("drawer RTL [x,w]:", rtl_box, "(want x=0)")
    b.close()
