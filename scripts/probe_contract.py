"""Probe: click the freeze-plan button and dump console + network activity."""
import re

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    console_msgs = []
    page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text[:300]}"))
    page.on("pageerror", lambda e: console_msgs.append(f"[pageerror] {str(e)[:400]}"))

    page.goto(f"{BASE}/signin", wait_until="networkidle")
    page.fill("#email", "admin@abnhomes.com.gh")
    page.fill("#password", "AbnHomes2026!")
    page.get_by_role("button", name=re.compile("sign in", re.I)).last.click()
    page.wait_for_url(re.compile("/admin"), timeout=45000)

    page.goto(f"{BASE}/admin/applications?tab=sales", wait_until="networkidle")
    page.wait_for_timeout(1500)
    console_msgs.clear()

    btn = page.get_by_role("button", name=re.compile("freeze plan", re.I)).first
    print("button visible:", btn.is_visible(), "enabled:", btn.is_enabled())
    btn.click()
    page.wait_for_timeout(4000)

    print("--- console since click ---")
    for m in console_msgs[:20]:
        print(m)
    body = page.locator("body").inner_text()
    print("still on url:", page.url)
    print("has APPROVED:", "APPROVED" in body.upper(), "| has CONTRACTED:", "CONTRACTED" in body.upper())
    browser.close()
