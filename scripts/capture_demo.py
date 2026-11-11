"""Capture the ABN Homes demo: screenshots (for docs/slides) + walkthrough video.

One Playwright run over production:
  public site tour -> guest booking journey (hold -> pay -> simulate -> confirm)
  -> staff admin tour -> owner portal -> tenant OTP portal.
Screenshots land in download/slides/ (PPT assets); the recorded webm lands in
assets/video/ for ffmpeg assembly.
"""
import os
import re
from datetime import date, timedelta

from playwright.sync_api import sync_playwright

BASE = "https://abnhomes.vercel.app"
SHOTS = "/home/z/my-project/download/slides"
VID = "/home/z/my-project/assets/video"
UNIT_ID = "cmvxv0msb000iontseixmorg0"  # Tantra Hill A2, Two Bedroom Apartment

os.makedirs(SHOTS, exist_ok=True)
os.makedirs(VID, exist_ok=True)

check_in = date.today() + timedelta(days=45)
check_out = date.today() + timedelta(days=48)  # 3 nights — the unit's minimum stay
CONFIRM_QS = f"unitId={UNIT_ID}&checkIn={check_in}&checkOut={check_out}&guests=2"


def run() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 720},
            device_scale_factor=2,
            record_video_dir=VID,
            record_video_size={"width": 1280, "height": 720},
        )
        page = ctx.new_page()

        def shot(name: str) -> None:
            page.screenshot(path=f"{SHOTS}/{name}.png")
            print(f"shot: {name}")

        def settle(seconds: float = 1.5) -> None:
            page.wait_for_timeout(int(seconds * 1000))

        def goto(path: str, wait: float = 2.5) -> None:
            page.goto(BASE + path, wait_until="domcontentloaded", timeout=60000)
            settle(wait)

        def sign_out() -> None:
            page.goto(BASE + "/api/auth/signout", wait_until="domcontentloaded")
            page.get_by_role("button", name="Sign out").click()
            settle(2)

        def staff_sign_in(email: str, password: str) -> None:
            goto("/signin", 2)
            page.get_by_role("tab", name="Staff").click()
            settle(0.6)
            page.get_by_label("Email").fill(email)
            page.get_by_label("Password").fill(password)
            page.get_by_role("button", name=re.compile("Sign in", re.I)).click()
            settle(4)

        # ---------- 1. public site ----------
        goto("/", 3)
        shot("site_home")
        page.mouse.wheel(0, 1600)
        settle(1)
        shot("site_homes")
        page.mouse.wheel(0, 1600)
        settle(1)
        shot("site_amenities")

        goto("/residences", 3)
        shot("market_residences")

        goto("/stays/tantra-hill-ph", 3)
        shot("stay_detail")
        page.mouse.wheel(0, 900)
        settle(1)
        shot("stay_gallery")
        page.mouse.wheel(0, 1400)
        settle(1)
        shot("stay_availability")

        # ---------- 2. guest booking journey ----------
        confirm_qs = None
        for offset in (45, 55, 65, 75):
            qs = (
                f"unitId={UNIT_ID}"
                f"&checkIn={date.today() + timedelta(days=offset)}"
                f"&checkOut={date.today() + timedelta(days=offset + 3)}"
                f"&guests=2"
            )
            goto(f"/book/confirm?{qs}", 4)
            if "have just gone" in page.locator("body").inner_text():
                print(f"dates +{offset}d taken, trying next window")
                continue
            confirm_qs = qs
            break
        if confirm_qs is None:
            raise RuntimeError("no available date window found")
        page.wait_for_selector('input[name="name"]', timeout=20000)
        page.locator('input[name="name"]').fill("Ama Serwaa")
        page.locator('input[name="phone"]').fill("024 170 4048")
        page.locator('input[name="email"]').fill("ama.serwaa@example.com")
        for box in page.locator("input[type=checkbox]").all():
            if not box.is_checked():
                box.check()
        settle(0.5)
        shot("book_form_filled")
        page.get_by_role("button", name=re.compile("Hold these dates", re.I)).click()
        # The form does not auto-redirect: it renders a success panel whose
        # link continues to the payment page. Click it.
        page.locator('a[href^="/pay/"]').first.click(timeout=30000)
        for _ in range(20):
            if "/pay/" in page.url:
                break
            settle(1)
        if "/pay/" not in page.url:
            alerts = [a.inner_text() for a in page.locator("[role=alert], .text-red-500, .text-rose-600").all()][:5]
            raise RuntimeError("never reached /pay — url " + page.url + " — alerts: " + " | ".join(alerts))
        settle(2)
        shot("pay_page")

        # pay via mobile money
        page.get_by_text(re.compile("Mobile Money|MoMo", re.I)).first.click()
        settle(0.8)
        page.get_by_role("button", name=re.compile("Pay .* securely", re.I)).click()
        for _ in range(30):
            if "/payments/simulate" in page.url:
                break
            settle(1)
        settle(2)
        shot("payment_simulate")
        page.get_by_role("button").filter(has_text=re.compile("successful|Complete|Pay", re.I)).first.click()
        for _ in range(30):
            if "/payments/callback" in page.url:
                break
            settle(1)
        settle(2.5)
        shot("payment_success")

        # ---------- 3. staff admin tour ----------
        sign_out()
        staff_sign_in("admin@abnhomes.com.gh", "AbnHomes2026!")
        goto("/admin", 3)
        shot("admin_dashboard")
        goto("/admin/bookings", 3)
        shot("admin_bookings")
        page.locator("a[href*='/admin/bookings/']:not([href$='/new'])").first.click(timeout=30000)
        settle(2.5)
        shot("admin_booking_detail")
        goto("/admin/money", 3)
        shot("admin_money")
        goto("/admin/calendar", 3)
        shot("admin_calendar")
        goto("/admin/housekeeping", 3)
        shot("admin_housekeeping")
        goto("/admin/reports", 3)
        shot("admin_reports")
        goto("/admin/messages", 3)
        shot("admin_messages")
        goto("/admin/portfolio", 3)
        shot("admin_portfolio")

        # ---------- 4. owner portal ----------
        sign_out()
        staff_sign_in("owner@example.com", "AbnHomes2026!")
        goto("/portal/owner", 3)
        shot("owner_portal")

        # ---------- 5. tenant OTP portal ----------
        sign_out()
        goto("/signin", 2)
        page.get_by_role("tab", name="Tenant, owner or vendor").click()
        settle(0.6)
        page.get_by_label(re.compile("Phone", re.I)).fill("0244123456")
        page.get_by_role("button", name=re.compile("code|Send|Request", re.I)).first.click()
        settle(2.5)
        match = re.search(r"code:\s*(\d{6})", page.content())
        if not match:
            raise RuntimeError("devCode not found on sign-in page")
        page.get_by_role("textbox", name="Six-digit code").fill(match.group(1))
        page.get_by_role("button", name=re.compile("Sign in|Verify", re.I)).first.click()
        settle(4)
        goto("/portal/tenant", 2.5)
        shot("tenant_portal")

        ctx.close()
        browser.close()
        print("done")


if __name__ == "__main__":
    run()
