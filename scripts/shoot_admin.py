"""Visual check: sign in and screenshot the upgraded analytics + reports pages."""
import re

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
OUT = "/home/z/my-project/scripts/shots"
ADMIN_EMAIL = "admin@abnhomes.com.gh"
ADMIN_PASSWORD = "AbnHomes2026!"

import os
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(f"{BASE}/signin", wait_until="networkidle")
    page.fill("#email", ADMIN_EMAIL)
    page.fill("#password", ADMIN_PASSWORD)
    page.get_by_role("button", name=re.compile("sign in", re.I)).last.click()
    page.wait_for_url(re.compile("/admin"), timeout=45000)

    # Analytics — default 90 days
    page.goto(f"{BASE}/admin/analytics", wait_until="networkidle")
    page.wait_for_timeout(1800)  # let recharts settle
    page.screenshot(path=f"{OUT}/analytics_90.png", full_page=True)

    # Analytics — 12 months + a property filter
    page.goto(f"{BASE}/admin/analytics?range=365", wait_until="networkidle")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/analytics_365.png", full_page=False)

    # Reports — narrative + stats
    page.goto(f"{BASE}/admin/reports", wait_until="networkidle")
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}/reports.png", full_page=True)

    browser.close()
print("done:", os.listdir(OUT))
