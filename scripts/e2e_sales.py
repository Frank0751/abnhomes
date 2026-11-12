"""E2E test for the sales & applications journeys on the dev server.

Robustness notes learned the hard way:
  - StatCard labels render text-transform: uppercase, so inner_text is
    uppercase — every body-text assertion compares case-insensitively.
  - Client-side <Link> navigation can lag behind networkidle on first compile;
    navigations that matter use goto() directly.
  - The run is repeatable: scripts/e2e-reset.ts re-seeds whatever rows a
    previous run consumed (a fresh APPLICATION purchase, an APPROVED tenancy).

Run:  python3 -I scripts/e2e_sales.py
"""
import os
import re
import subprocess
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
SHOTS = "/tmp/e2e_shots"
ADMIN_EMAIL = "admin@abnhomes.com.gh"
ADMIN_PASSWORD = "AbnHomes2026!"

os.makedirs(SHOTS, exist_ok=True)

results = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def main() -> None:
    # Make the run repeatable regardless of what earlier runs consumed.
    subprocess.run(["npx", "tsx", "scripts/e2e-reset.ts"], check=True, capture_output=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        body_text = lambda: page.locator("body").inner_text()

        # ---------- 1. /own grid ----------
        page.goto(f"{BASE}/own", wait_until="networkidle")
        check("own: page loads", "own an abn home" in body_text().lower())
        hrefs = page.eval_on_selector_all(
            "a[href^='/own/']", "els => els.map(e => e.getAttribute('href'))"
        )
        detail_urls = sorted(set(h for h in hrefs if h and h.count("/") == 2))
        check("own: for-sale cards rendered", len(detail_urls) >= 2, f"{len(detail_urls)} distinct detail urls")
        page.screenshot(path=f"{SHOTS}/01_own_grid.png", full_page=True)

        # ---------- 2. detail + apply (goto: links are client-routed) ----------
        page.goto(f"{BASE}{detail_urls[0]}", wait_until="networkidle")
        page.wait_for_selector("#buy-name", timeout=30000)
        check("own: detail shows calculator", "plan your payment" in body_text().lower())
        check("own: detail shows apply form", page.locator("#buy-name").is_visible())
        page.screenshot(path=f"{SHOTS}/02_own_detail.png", full_page=True)

        page.fill("#buy-name", "Ama Serwaa")
        page.fill("#buy-phone", "024 170 4048")
        page.fill("#buy-email", "ama.serwaa@example.com")
        page.get_by_role("button", name=re.compile("apply to buy", re.I)).click()
        page.wait_for_selector("text=Track your application", timeout=30000)
        body = body_text()
        m = re.search(r"OWN-[0-9A-Z]{6}", body)
        check("own: application success + code", bool(m), m.group(0) if m else "no code")
        page.screenshot(path=f"{SHOTS}/03_apply_success.png", full_page=True)

        # ---------- 3. tracking pages ----------
        fresh_code = m.group(0) if m else None
        if fresh_code:
            page.goto(f"{BASE}/track/{fresh_code}", wait_until="networkidle")
            check("track: fresh application visible", "offer received" in body_text().lower())
        page.screenshot(path=f"{SHOTS}/04_track_fresh.png", full_page=True)

        page.goto(f"{BASE}/track/OWN-TAN7Q4", wait_until="networkidle")
        check("track: seeded purchase found", "OWN-TAN7Q4" in body_text())
        page.goto(f"{BASE}/track/RNT-QW3TB", wait_until="networkidle")
        check("track: seeded tenancy found", "RNT-QW3TB" in body_text())
        page.screenshot(path=f"{SHOTS}/05_track_tenancy.png", full_page=True)

        # ---------- 4. admin sign-in ----------
        page.goto(f"{BASE}/signin", wait_until="networkidle")
        page.fill("#email", ADMIN_EMAIL)
        page.fill("#password", ADMIN_PASSWORD)
        page.get_by_role("button", name=re.compile("sign in", re.I)).last.click()
        page.wait_for_url(re.compile("/admin"), timeout=45000)
        check("admin: signed in", "/admin" in page.url)
        page.screenshot(path=f"{SHOTS}/06_admin_home.png")

        # ---------- 5. applications: approve + contract the fresh offer ----------
        page.goto(f"{BASE}/admin/applications", wait_until="networkidle")
        check("admin: applications page", "new rental applications" in body_text().lower())
        page.screenshot(path=f"{SHOTS}/07_applications_rental.png", full_page=True)

        page.goto(f"{BASE}/admin/applications?tab=sales", wait_until="networkidle")
        page.wait_for_selector("#buy-name", state="detached", timeout=1000) if False else None
        page.wait_for_timeout(500)
        body = body_text()
        check("admin: fresh offer in queue", bool(fresh_code and fresh_code in body))

        page.get_by_role("button", name=re.compile("approve offer", re.I)).first.click()
        page.wait_for_timeout(2500)
        check("admin: offer approved", "approved" in body_text().lower())

        # Re-navigate so the freshly rendered contract form is fully hydrated
        # before we submit it — clicking it mid-hydration degrades to a native
        # form GET, which the server would never see as an action.
        page.goto(f"{BASE}/admin/applications?tab=sales", wait_until="networkidle")
        page.wait_for_timeout(1200)
        page.get_by_role("button", name=re.compile("freeze plan", re.I)).first.click()
        page.wait_for_timeout(3500)
        body = body_text().lower()
        check("admin: purchase contracted", "installment" in body and "contracted" in body)
        page.screenshot(path=f"{SHOTS}/09_contracted.png", full_page=True)

        # ---------- 6. property sales: record an installment ----------
        page.goto(f"{BASE}/admin/sales", wait_until="networkidle")
        check("admin: sales list", "property sales" in body_text().lower())
        page.screenshot(path=f"{SHOTS}/10_sales_list.png", full_page=True)

        sale_href = page.eval_on_selector_all(
            "a[href^='/admin/sales/']", "els => els.map(e => e.getAttribute('href'))"
        )
        contracted_url = next((h for h in sale_href if h), None)
        check("admin: sale detail link found", bool(contracted_url), contracted_url or "none")
        if contracted_url:
            page.goto(f"{BASE}{contracted_url}", wait_until="networkidle")
            page.wait_for_timeout(500)
            body = body_text()
            check("admin: sale detail shows schedule", "installment schedule" in body.lower())
            check("admin: sale detail shows payments", "payments received" in body.lower())
            amount = page.locator("input[name='amount']")
            if amount.count() > 0:
                amount.first.fill("1083333")
                page.locator("select[name='channel']").first.select_option("MOMO_MTN")
                page.get_by_role("button", name=re.compile("record payment", re.I)).first.click()
                page.wait_for_timeout(2500)
                check("admin: installment recorded", "rct-" in body_text().lower())
            page.screenshot(path=f"{SHOTS}/11_sale_detail.png", full_page=True)

        # ---------- 7. rental queue: convert approved application ----------
        page.goto(f"{BASE}/admin/applications?tab=tenancy", wait_until="networkidle")
        page.wait_for_timeout(500)
        convert_btn = page.get_by_role("button", name=re.compile("create lease", re.I))
        if convert_btn.count() > 0:
            convert_btn.first.click()
            page.wait_for_timeout(3000)
            check("admin: lease created from application", re.search(r"LSE-[0-9A-Z]{6}", body_text()) is not None)
        else:
            check("admin: lease created from application", False, "convert button not found")
        page.screenshot(path=f"{SHOTS}/12_tenancy_converted.png", full_page=True)

        # ---------- 8. analytics ----------
        page.goto(f"{BASE}/admin/analytics", wait_until="networkidle")
        page.wait_for_timeout(2000)  # let the charts finish drawing
        body = body_text().lower()
        check("analytics: page renders", "collected · last" in body)
        check("analytics: funnels present", "renting funnel" in body and "ownership funnel" in body)
        svg_count = page.locator("svg.recharts-surface").count()
        check("analytics: charts drew", svg_count >= 3, f"{svg_count} recharts svgs")
        page.screenshot(path=f"{SHOTS}/13_analytics.png", full_page=True)

        # ---------- 9. audit oversight ----------
        page.goto(f"{BASE}/admin/audit", wait_until="networkidle")
        body = body_text().lower()
        check("audit: oversight band", "events, last 24h" in body and "staff active, last 24h" in body)
        check("audit: journey events recorded", "purchase.contracted" in body or "purchase.applied" in body)
        page.screenshot(path=f"{SHOTS}/14_audit.png", full_page=True)

        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print("FAILED:")
        for name, _, detail in failed:
            print(f"  - {name} {detail}")
        sys.exit(1)


if __name__ == "__main__":
    main()
