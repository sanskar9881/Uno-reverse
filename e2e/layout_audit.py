"""
Layout audit for Party Night (Phase 7).

Visits every route and main state of the app, in both themes, at every required
viewport, and checks: no horizontal scroll, no element stuck outside the viewport
(except inside a scroll container), no overlapping text/controls, and no clipped
text. Screenshots go to e2e-screenshots/layout/.

    sh e2e/services.sh start
    python3 e2e/layout_audit.py
    sh e2e/services.sh stop

Requires: pip install playwright && playwright install chromium
"""

import asyncio
import json
import os
import sys
import urllib.request
from pathlib import Path

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:4173")
CONTROL = os.environ.get("CONTROL_URL", "http://127.0.0.1:3099")
SHOTS = Path(os.environ.get("SHOTS_DIR", Path(__file__).resolve().parent.parent / "e2e-screenshots" / "layout"))
SHOTS.mkdir(parents=True, exist_ok=True)

# width, height, label
VIEWPORTS = [
    (320, 568, "320x568"),
    (360, 740, "360x740"),
    (390, 844, "390x844"),
    (430, 932, "430x932"),
    (768, 1024, "768x1024"),
    (1024, 768, "1024x768"),
    (1280, 800, "1280x800"),
    (1440, 900, "1440x900"),
    (1920, 1080, "1920x1080"),
    (844, 390, "844x390-landscape"),
]
THEMES = ["light", "dark"]

issues: list[dict] = []

# -------------------------------------------------------------------------- helpers


def rig(hands, start="r5", draws="", filler="y9"):
    body = json.dumps({"hands": hands, "start": start, "draws": draws, "filler": filler}).encode()
    req = urllib.request.Request(f"{CONTROL}/deck", data=body, method="POST", headers={"content-type": "application/json"})
    urllib.request.urlopen(req, timeout=5).read()


async def new_page(browser: Browser, mobile: bool = False) -> tuple[BrowserContext, Page]:
    ctx = await browser.new_context(viewport={"width": 1280, "height": 800}, is_mobile=mobile, has_touch=mobile)
    await ctx.add_init_script("localStorage.setItem('uno-party:debug', '1')")
    page = await ctx.new_page()
    # Freeze motion so a screenshot never lands mid-animation and every check sees the settled layout.
    await page.add_style_tag(content="*, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }")
    return ctx, page


async def set_nickname(page: Page, name: str):
    await page.fill('input[autocomplete="nickname"]', name)


# The check runs in-page: it returns a list of {check, path, detail}. A CSS path is built
# from tag + nth-of-type, which is stable enough to point a person at the offending element.
CHECK_JS = """
() => {
  function cssPath(el) {
    const path = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) { path.unshift(selector + '#' + el.id); break; }
      let sib = el, nth = 1;
      while ((sib = sib.previousElementSibling)) { if (sib.nodeName === el.nodeName) nth++; }
      if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ') || 'body';
  }

  function isOverlapOk(el) {
    return !!el.closest('[data-overlap-ok]');
  }

  function scrollableAncestor(el) {
    let p = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      const scrollsY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1;
      const scrollsX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1;
      if (scrollsY || scrollsX) return p;
      p = p.parentElement;
    }
    return null;
  }

  function isVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = [];

  // 1. No horizontal scrolling.
  if (document.documentElement.scrollWidth > vw + 1) {
    out.push({ check: 'horizontal-scroll', path: 'html', detail: 'scrollWidth ' + document.documentElement.scrollWidth + ' > viewport ' + vw });
  }

  // If a modal/sheet is open, it visually hides everything behind it — comparing the dialog's
  // own content against the page underneath would just report the overlay doing its job. Scope
  // every check to the topmost overlay's contents in that case.
  const overlayRoot = document.querySelector('.z-modal, .z-overlay');
  const scopeRoot = overlayRoot || document.body;

  // "Meaningful" elements: interactive controls, and leaves that carry their own text.
  const interactiveSel = 'button, a, input, textarea, select, [role="button"], [role="radio"], [role="dialog"], [role="checkbox"]';
  const interactive = Array.from(scopeRoot.querySelectorAll(interactiveSel)).filter(isVisible);
  const textLeaves = Array.from(scopeRoot.querySelectorAll('*')).filter((el) => {
    if (!isVisible(el)) return false;
    if (el.children.length > 0) return false; // only true leaves, so a wrapper isn't double-counted
    const text = (el.textContent || '').trim();
    return text.length > 0;
  });
  const targets = Array.from(new Set([...interactive, ...textLeaves]));

  // 2. No visible element sticks out of the viewport, except inside a scroll container.
  // Horizontally this is always a bug (it's what causes check 1's scrollWidth to grow).
  // Vertically, a normal content page (the hub, a lobby, a setup screen) is expected to be
  // taller than one screen and scroll as a whole document — that's not a bug. It only counts
  // as "stuck outside the viewport" for a fixed-position element (which claims to always be
  // visible regardless of scroll) or on a screen that isn't meant to scroll at all (a game
  // screen built to fit in 100dvh), where the whole page's scrollHeight already matches vh.
  const pageScrolls = document.documentElement.scrollHeight > vh + 2;
  for (const el of targets) {
    if (isOverlapOk(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const horizontallyStuck = r.left < -1 || r.right > vw + 1;
    const verticallyStuck = r.top < -1 || r.bottom > vh + 1;
    const verticalCounts = cs.position === 'fixed' || !pageScrolls;
    const sticksOut = horizontallyStuck || (verticallyStuck && verticalCounts);
    if (sticksOut && !scrollableAncestor(el)) {
      out.push({
        check: 'offscreen',
        path: cssPath(el),
        detail: 'rect ' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom) + ' vs viewport ' + vw + 'x' + vh,
      });
    }
  }

  // 3. No two targets overlap, unless related by ancestry or opted out with data-overlap-ok.
  for (let i = 0; i < targets.length; i++) {
    const a = targets[i];
    if (isOverlapOk(a)) continue;
    const ra = a.getBoundingClientRect();
    if (ra.width < 1 || ra.height < 1) continue;
    for (let j = i + 1; j < targets.length; j++) {
      const b = targets[j];
      if (isOverlapOk(b)) continue;
      if (a.contains(b) || b.contains(a)) continue;
      const rb = b.getBoundingClientRect();
      if (rb.width < 1 || rb.height < 1) continue;
      const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix > 2 && iy > 2) {
        out.push({
          check: 'overlap',
          path: cssPath(a) + '  <->  ' + cssPath(b),
          detail: 'overlap ' + Math.round(ix) + 'x' + Math.round(iy),
        });
      }
    }
  }

  // 4. No clipped text, unless it's an intentional ellipsis or line-clamp.
  const textEls = Array.from(scopeRoot.querySelectorAll('*')).filter((el) => {
    if (!isVisible(el)) return false;
    const direct = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    return direct;
  });
  for (const el of textEls) {
    if (isOverlapOk(el)) continue;
    const cs = getComputedStyle(el);
    const isEllipsis = cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible';
    const isClamped = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    const nowrapButScrollable = cs.whiteSpace === 'nowrap' && !!scrollableAncestor(el);
    if (isEllipsis || isClamped || nowrapButScrollable) continue;
    const clippedX = el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'hidden';
    const clippedY = el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden';
    if (clippedX || clippedY) {
      out.push({ check: 'clipped-text', path: cssPath(el), detail: 'scroll ' + el.scrollWidth + 'x' + el.scrollHeight + ' vs client ' + el.clientWidth + 'x' + el.clientHeight });
    }
  }

  return out;
}
"""


async def audit_state(page: Page, state_name: str):
    """Runs every viewport x theme combination against the page as it currently sits, without
    navigating or reloading — so any local-only UI state (an open modal, a color picker) survives."""
    for width, height, vp_label in VIEWPORTS:
        await page.set_viewport_size({"width": width, "height": height})
        await page.evaluate("window.scrollTo(0, 0)")
        for theme in THEMES:
            await page.evaluate(
                """(t) => {
                    document.documentElement.setAttribute('data-theme', t);
                    document.documentElement.style.colorScheme = t;
                }""",
                theme,
            )
            await page.wait_for_timeout(120)
            await page.evaluate("window.scrollTo(0, 0)")
            found = await page.evaluate(CHECK_JS)
            for item in found:
                issues.append({"state": state_name, "viewport": vp_label, "theme": theme, **item})
            shot_name = f"{state_name}__{vp_label}__{theme}.png"
            await page.screenshot(path=str(SHOTS / shot_name))
    print(f"  audited {state_name} ({len(VIEWPORTS) * len(THEMES)} combinations)")


# -------------------------------------------------------------------------- states


async def audit_hub(browser: Browser):
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/")
    # Each tile's entrance spring is delayed by 0.15 + index * 0.1s; wait past the last one
    # (plus settle time) regardless of how many tiles the hub currently has.
    await page.wait_for_timeout(1500)
    await audit_state(page, "hub")
    await ctx.close()


async def audit_uno(browser: Browser):
    import re as _re

    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/uno")
    await page.wait_for_timeout(300)
    await audit_state(page, "uno-landing")

    await set_nickname(page, "Sanskar")
    await page.get_by_role("button", name="Create Game").click()
    await page.wait_for_url("**/room/*")
    await page.wait_for_timeout(300)

    ctx2, page2 = await new_page(browser)
    code = page.url.rsplit("/", 1)[1]
    await page2.goto(f"{BASE}/room/{code}")
    await set_nickname(page2, "Riya")
    await page2.get_by_role("button", name="Join Game").click()
    await page.wait_for_function("() => window.__unoParty.store.getState().state?.room.players.length === 2")
    await page.wait_for_timeout(3200)  # let the "Riya joined" toast auto-dismiss before auditing steady-state UI
    await audit_state(page, "uno-lobby")

    # A Wild is always playable regardless of the top card, so dealing one straight into the
    # host's hand is enough to reach both "mid-game" and "color picker" in the same round.
    rig(["rS gS bS b1 W b4 b5", "y1 y2 y3 y4 y5 y6 y7"], start="r5")
    await page.get_by_role("button", name="Start Game").click()
    await page.wait_for_function("() => window.__unoParty.store.getState().state?.room.status === 'playing'")
    await page.wait_for_timeout(400)
    await audit_state(page, "uno-table-midgame")

    wild_btn = page.get_by_role("button", name="Wild").first
    if await wild_btn.count() > 0:
        await wild_btn.click()
        await wild_btn.click()
        await page.wait_for_selector('[role="dialog"][aria-label="Choose a color"]', timeout=4000)
        await audit_state(page, "uno-color-picker")
        await page.keyboard.press("Escape")

    await ctx2.close()
    await ctx.close()

    # Round over needs its own fresh room: the scripted win (five skips, call UNO, then the
    # last two blue cards) only works from a round's very first turn.
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/uno")
    await set_nickname(page, "Sanskar")
    await page.get_by_role("button", name="Create Game").click()
    await page.wait_for_url("**/room/*")
    code = page.url.rsplit("/", 1)[1]

    ctx2, page2 = await new_page(browser)
    await page2.goto(f"{BASE}/room/{code}")
    await set_nickname(page2, "Riya")
    await page2.get_by_role("button", name="Join Game").click()
    await page.wait_for_function("() => window.__unoParty.store.getState().state?.room.players.length === 2")

    rig(["rS rS gS gS bS b1 b2", "y1 y2 y3 y4 y6 y7 W"])
    await page.get_by_role("button", name="Start Game").click()
    await page.wait_for_function("() => window.__unoParty.store.getState().state?.room.status === 'playing'")

    async def play(label):
        btn = page.get_by_role("button", name=_re.compile("^" + label + r"(,|$)")).first
        await btn.click()
        await btn.click()
        await page.wait_for_timeout(120)

    for label in ("Red Skip", "Red Skip", "Green Skip", "Green Skip", "Blue Skip"):
        await play(label)
    await page.get_by_role("button", name="Call UNO").click(force=True)
    await page.wait_for_timeout(200)
    await play("Blue 1")
    await page.wait_for_timeout(300)
    # Riya can't play blue 2, so she draws a dead card; then the host's last card wins the round.
    await page2.get_by_role("button", name="Draw card").click()
    await page.wait_for_timeout(300)
    await play("Blue 2")
    await page.wait_for_function("() => window.__unoParty.store.getState().state?.room.status === 'roundOver'", timeout=8000)
    await page.wait_for_timeout(400)
    await audit_state(page, "uno-round-over")

    await ctx2.close()
    await ctx.close()


async def audit_wheel(browser: Browser):
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/wheel")
    await page.wait_for_timeout(200)
    await page.fill("#wheel-names", "Riya\nSanskar")
    await page.wait_for_timeout(150)
    await audit_state(page, "wheel-2-names")

    hundred = "\n".join(f"Player {i}" for i in range(1, 101))
    await page.fill("#wheel-names", hundred)
    await page.wait_for_timeout(150)
    await audit_state(page, "wheel-100-names")

    await page.fill("#wheel-names", "Riya\nSanskar\nAmit")
    await page.wait_for_timeout(150)
    await page.get_by_role("button", name="Spin", exact=True).click()
    await page.wait_for_selector("text=The wheel says", timeout=15000)
    await page.wait_for_timeout(300)
    await audit_state(page, "wheel-result")
    await ctx.close()


async def audit_bottle(browser: Browser):
    # One phone.
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/bottle")
    await page.wait_for_timeout(200)
    await audit_state(page, "bottle-choice")

    await page.get_by_role("button", name="Get started").click()
    await page.wait_for_timeout(150)
    await audit_state(page, "bottle-setup")

    for n in ("Riya", "Sanskar"):
        await page.fill('input[placeholder="Player name"]', n)
        await page.get_by_role("button", name="Add").click()
    await page.get_by_role("button", name="Start").click()
    await page.wait_for_timeout(300)
    await audit_state(page, "bottle-table-onephone")
    await ctx.close()

    # Online.
    ctx1, page1 = await new_page(browser)
    await page1.goto(f"{BASE}/bottle")
    await page1.get_by_role("button", name="Create a room").click()
    await set_nickname(page1, "Sanskar")
    await page1.get_by_role("button", name="Create room").click()
    await page1.wait_for_url("**/room/*")
    code = page1.url.rsplit("/", 1)[1]

    ctx2, page2 = await new_page(browser)
    await page2.goto(f"{BASE}/room/{code}")
    await set_nickname(page2, "Riya")
    await page2.get_by_role("button", name="Join Game").click()
    await page1.wait_for_function("() => window.__unoParty.store.getState().state?.room.players.length === 2")
    await page1.wait_for_timeout(3200)  # let the "Riya joined" toast auto-dismiss before auditing steady-state UI
    await audit_state(page1, "bottle-online-lobby")

    await page1.get_by_role("button", name="Start Game").click()
    await page1.wait_for_selector('svg[aria-label="Spin the bottle table"]', timeout=8000)
    await page1.wait_for_timeout(300)
    await audit_state(page1, "bottle-online-table")
    await ctx1.close()
    await ctx2.close()


async def audit_couples(browser: Browser):
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/couples")
    await page.wait_for_timeout(200)
    await audit_state(page, "couples-agegate")

    await page.get_by_role("button", name="We're both 18+").click()
    await page.get_by_role("button", name="Play together").click()
    await page.wait_for_timeout(200)

    # Draw dares until one carries a timer (several of the built-in Sweet dares do).
    found_timer = False
    for i in range(40):
        if i == 0:
            await page.get_by_role("button", name="Dare", exact=True).click()
        else:
            await page.get_by_role("button", name="Pass", exact=True).click()
        await page.wait_for_timeout(80)
        if await page.locator("span.font-display.tabular-nums").count() > 0:
            found_timer = True
            break
    if not found_timer:
        print("  warning: no timed couples card turned up in 40 draws")
    await audit_state(page, "couples-card-timer")
    await ctx.close()


async def audit_intimacy(browser: Browser):
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/intimacy")
    await page.wait_for_timeout(200)
    await audit_state(page, "intimacy-agegate")

    await page.get_by_role("button", name="We're both 18+").click()
    await page.get_by_role("button", name="Play together").click()
    await page.wait_for_timeout(200)
    await audit_state(page, "intimacy-together-idle")

    await page.get_by_role("button", name="Draw a card", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "intimacy-together-card")

    await page.get_by_role("button", name="Categories (5)", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "intimacy-categories")
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(150)

    await page.get_by_role("button", name="Our deck", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "intimacy-ourdeck")
    await page.get_by_role("button", name="+ Add a card", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "intimacy-ourdeck-composer")
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(150)

    # Draw (alternating Draw/Done, since Intimacy hands the turn to the other partner every
    # time) until a timed card turns up. Sweet Touch and massage carries several.
    found_timer = False
    for i in range(60):
        if i > 0:
            await page.get_by_role("button", name="Done", exact=True).click()
            await page.wait_for_timeout(60)
            await page.get_by_role("button", name="Draw a card", exact=True).click()
        await page.wait_for_timeout(60)
        if await page.get_by_role("button", name="Start", exact=True).count() > 0:
            found_timer = True
            break
    if not found_timer:
        print("  warning: no timed intimacy card turned up in 60 draws")
    await audit_state(page, "intimacy-card-timer-start")

    await page.get_by_role("button", name="Start", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "intimacy-card-timer-ready")
    await page.wait_for_timeout(2400)  # let the get-ready countdown finish
    await audit_state(page, "intimacy-card-timer-running")
    await ctx.close()


async def add_group_player(page: Page, name: str):
    await page.fill('input[placeholder="Player name"]', name)
    await page.get_by_role("button", name="Add", exact=True).click()


async def close_sheet(page: Page, label: str):
    """Clicks a corner of the backdrop itself (not just those page coordinates) to close it."""
    await page.locator(".z-overlay").click(position={"x": 5, "y": 5})
    await page.get_by_role("dialog", name=label).wait_for(state="detached", timeout=5000)


async def audit_group(browser: Browser):
    ctx, page = await new_page(browser)
    await page.goto(f"{BASE}/group")
    await page.wait_for_timeout(200)
    await audit_state(page, "group-choice")

    await page.get_by_role("button", name="Get started", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "group-setup-empty")

    for name in ["Alex", "Blair", "Casey"]:
        await add_group_player(page, name)
    await page.wait_for_timeout(150)
    await audit_state(page, "group-setup-players")

    await page.get_by_role("button", name="Start", exact=True).click()
    await page.wait_for_timeout(200)
    await audit_state(page, "group-play-idle")

    await page.get_by_role("button", name="Truth", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "group-play-card")

    await page.get_by_role("button", name="Options", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "group-options")
    # Turn on Spin to pick, then trigger it from the play screen.
    await page.locator('label:has-text("Spin to pick who\'s next") input[type="checkbox"]').check()
    await close_sheet(page, "Options")

    await page.get_by_role("button", name="Done", exact=True).click()
    await page.wait_for_timeout(200)
    await audit_state(page, "group-spin")
    await page.get_by_role("button", name="Spin", exact=True).click()
    await page.wait_for_timeout(200)

    # Turn Spin to pick back off so the rest of this audit can advance turns predictably.
    await page.get_by_role("button", name="Options", exact=True).click()
    await page.wait_for_timeout(150)
    await page.locator('label:has-text("Spin to pick who\'s next") input[type="checkbox"]').uncheck()
    await close_sheet(page, "Options")

    await page.get_by_role("button", name="Custom cards", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "group-customcards")
    await page.get_by_role("button", name="+ Add a card", exact=True).click()
    await page.wait_for_timeout(150)
    await audit_state(page, "group-customcards-composer")
    await close_sheet(page, "Custom cards")

    # Draw dares (Normal has several timed ones) until a Start button turns up.
    found_timer = False
    for i in range(60):
        if i > 0:
            done_btn = page.get_by_role("button", name="Done", exact=True)
            if await done_btn.count() > 0:
                await done_btn.click()
                await page.wait_for_timeout(60)
        dare_btn = page.get_by_role("button", name="Dare", exact=True)
        if await dare_btn.count() > 0:
            await dare_btn.click()
        else:
            pass_btn = page.get_by_role("button", name="Pass", exact=True)
            if await pass_btn.count() > 0:
                await pass_btn.click()
        await page.wait_for_timeout(60)
        if await page.get_by_role("button", name="Start", exact=True).count() > 0:
            found_timer = True
            break
    if not found_timer:
        print("  warning: no timed group card turned up in 60 draws")
    await audit_state(page, "group-card-timer-start")

    start_btn = page.get_by_role("button", name="Start", exact=True)
    if await start_btn.count() > 0:
        await start_btn.click()
        await page.wait_for_timeout(150)
        await audit_state(page, "group-card-timer-ready")
        await page.wait_for_timeout(2400)
        await audit_state(page, "group-card-timer-running")
    await ctx.close()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        print("Layout audit")
        await audit_hub(browser)
        await audit_uno(browser)
        await audit_wheel(browser)
        await audit_bottle(browser)
        await audit_couples(browser)
        await audit_intimacy(browser)
        await audit_group(browser)
        await browser.close()

    print()
    if not issues:
        print(f"0 issues found across {len(VIEWPORTS)} viewports x {len(THEMES)} themes. Screenshots in {SHOTS}")
        sys.exit(0)

    by_check: dict[str, list[dict]] = {}
    for it in issues:
        by_check.setdefault(it["check"], []).append(it)

    print(f"{len(issues)} issues found:\n")
    for check, items in by_check.items():
        print(f"=== {check} ({len(items)}) ===")
        for it in items:
            print(f"  [{it['state']} @ {it['viewport']} {it['theme']}] {it['path']}  —  {it['detail']}")
        print()

    print(f"Screenshots in {SHOTS}")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
