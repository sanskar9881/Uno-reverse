"""
Browser end-to-end tests for UNO Party.

Drives several real Chromium browser contexts (one per player, like separate
devices) against the built client and the rigged e2e server, and saves
screenshots to e2e-screenshots/.

    sh e2e/services.sh start      # rigged game server :3001 + client preview :4173
    python3 e2e/run_e2e.py
    sh e2e/services.sh stop

Requires: pip install playwright && playwright install chromium
"""

import asyncio
import json
import os
import re
import sys
import time
import traceback
import urllib.request
from pathlib import Path

from playwright.async_api import Browser, async_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:4173")
CONTROL = os.environ.get("CONTROL_URL", "http://127.0.0.1:3099")
SHOTS = Path(os.environ.get("SHOTS_DIR", Path(__file__).resolve().parent.parent / "e2e-screenshots"))
SHOTS.mkdir(exist_ok=True)

DESKTOP = {"width": 1280, "height": 800}
MOBILE = {"width": 390, "height": 844}
WINNING_HAND = "rS rS gS gS bS b1 b2"  # five skips keep the turn in a 2-player game
AVATARS = {"Sanskar": 1, "Riya": 2, "Amit": 3, "Zoya": 5, "Neel": 4, "Tab Two": 6, "Host": 10}

page_errors: list[str] = []
results: list[tuple[str, bool, str, float]] = []


def rig(hands, start="r5", draws="", filler="y9"):
    """Deal a known deck for the next round (e2e server only)."""
    body = json.dumps({"hands": hands, "start": start, "draws": draws, "filler": filler}).encode()
    req = urllib.request.Request(f"{CONTROL}/deck", data=body, method="POST", headers={"content-type": "application/json"})
    urllib.request.urlopen(req, timeout=5).read()


class Player:
    def __init__(self, name, ctx, page):
        self.name, self.ctx, self.page = name, ctx, page

    @classmethod
    async def open(cls, browser: Browser, name, viewport=DESKTOP, path="/uno", mobile=False, ctx=None):
        if ctx is None:
            ctx = await browser.new_context(
                viewport=viewport, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1
            )
            await ctx.add_init_script("localStorage.setItem('uno-party:debug', '1')")
        page = await ctx.new_page()
        page.on("pageerror", lambda e: page_errors.append(f"{name}: {e}"))
        page.on("console", lambda m: m.type == "error" and page_errors.append(f"{name} console: {m.text}"))
        await page.goto(BASE + path)
        return cls(name, ctx, page)

    async def state(self):
        return await self.page.evaluate("() => window.__unoParty.store.getState().state")

    async def wait(self, predicate: str, timeout=8000):
        await self.page.wait_for_function(
            "() => { const s = window.__unoParty && window.__unoParty.store.getState().state;"
            f" return !!s && ({predicate}); }}",
            timeout=timeout,
        )

    async def self_id(self):
        return (await self.state())["selfId"]

    async def set_nickname(self, nickname):
        await self.page.get_by_label("Your nickname").fill(nickname)
        if nickname in AVATARS:
            await self.page.get_by_role("radio", name=f"Avatar {AVATARS[nickname]}", exact=True).click()

    async def create(self):
        await self.set_nickname(self.name)
        await self.page.get_by_role("button", name="Create Game").click()
        await self.page.wait_for_url(re.compile(r"/room/[A-Z0-9]{6}$"))
        await self.wait('s.room.status === "lobby"')
        return self.page.url.rsplit("/", 1)[1]

    async def join_from_landing(self, code):
        await self.set_nickname(self.name)
        await self.page.get_by_role("button", name="Join Game").click()
        await self.page.locator("#room-code").fill(code)
        await self.page.get_by_role("button", name="Join", exact=True).click()
        await self.page.wait_for_url(f"**/room/{code}")
        await self.wait(f"s.room.code === {json.dumps(code)}")

    async def join_from_link(self, code):
        await self.set_nickname(self.name)
        await self.page.get_by_role("button", name="Join Game").click()
        await self.wait(f"s.room.code === {json.dumps(code)}")

    def card(self, label):
        return self.page.get_by_role("button", name=re.compile("^" + label + r"(,|$)")).first

    async def play(self, label, color=None):
        """Tap a card to select it, tap again to play (and pick a color for wilds)."""
        n = len((await self.state())["hand"])
        await self.card(label).click()
        await self.card(label).click()
        if color:
            dialog = self.page.get_by_role("dialog", name="Choose a color")
            await dialog.get_by_role("button", name=re.compile("^" + color, re.I)).click()
        await self.wait(f's.hand.length === {n - 1} || s.room.status === "roundOver"')

    async def forged(self, event, payload_js):
        """Send a raw socket event, bypassing the UI, to prove the server validates."""
        return await self.page.evaluate(
            "async () => { const s = window.__unoParty.store.getState().state;"
            f" return await window.__unoParty.socket.timeout(3000).emitWithAck({json.dumps(event)}, {payload_js}); }}"
        )

    async def shot(self, name, settle=0):
        if settle:
            await self.page.wait_for_timeout(settle)
        await self.page.screenshot(path=str(SHOTS / f"{name}.png"))


async def check(name, coro):
    start = time.time()
    try:
        await coro
        results.append((name, True, "", time.time() - start))
        print(f"  PASS  {name}")
    except Exception as error:  # noqa: BLE001 - report everything
        results.append((name, False, f"{type(error).__name__}: {error}", time.time() - start))
        print(f"  FAIL  {name}\n{traceback.format_exc()}")


# --------------------------------------------------------------------------- scenarios


async def four_player_game(browser: Browser):
    """Create, join (invite link + code), settings, start, every card type, reconnect, disconnect, mobile."""
    host = await Player.open(browser, "Sanskar")
    await host.shot("01-landing-desktop", settle=900)
    code = await host.create()

    riya = await Player.open(browser, "Riya", path=f"/room/{code}")
    await riya.shot("04-invite-link-join", settle=300)
    await riya.join_from_link(code)
    amit = await Player.open(browser, "Amit")
    await amit.join_from_landing(code)
    zoya = await Player.open(browser, "Zoya", viewport=MOBILE, mobile=True)
    await zoya.shot("02-landing-mobile", settle=900)
    await zoya.join_from_landing(code)
    for p in (host, riya, amit, zoya):
        await p.wait("s.room.players.length === 4")
    await expect(host.page.get_by_text("Zoya joined")).to_be_visible()

    # Host changes a setting; everyone sees it. Guests can't start.
    await host.page.get_by_role("radio", name="45s").click()
    await zoya.wait("s.room.settings.turnSeconds === 45")
    assert await riya.page.get_by_role("button", name="Start Game").count() == 0
    await expect(riya.page.get_by_text("Waiting for Sanskar to start the game")).to_be_visible()
    await host.shot("03-lobby-host", settle=400)
    await zoya.shot("03b-lobby-mobile", settle=200)

    # Seats: Sanskar, Riya, Amit, Zoya (clockwise). Sanskar starts on a red 5.
    rig(["rS b2 b3 b4 b6 b7 b8", "rD y1 y2 y3 y4 y6 y7", "rR W4 y8 y9 r3 r4 r6", "W g1 g2 y5 r7 r8 r9"])
    await host.page.get_by_role("button", name="Start Game").click()
    for p in (host, riya, amit, zoya):
        await p.wait('s.room.status === "playing" && s.hand.length === 7')
    await host.shot("05-board-desktop-4p", settle=1200)
    await zoya.shot("07-board-mobile", settle=300)
    assert await zoya.page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "mobile overflows"

    # Hidden information: nobody's snapshot contains another player's cards.
    host_json = json.dumps(await host.state())
    for other in (riya, amit, zoya):
        for c in (await other.state())["hand"]:
            assert c["id"] not in host_json, "another player's card leaked"

    # Invalid play: the UI explains, and a forged emit is refused by the server.
    await host.card("Blue 3").click()
    await host.card("Blue 3").click()
    await expect(host.page.get_by_text("Blue 3 doesn't match")).to_be_visible()
    res = await host.forged(
        "game:play", "{ turnId: s.game.turnId, cardId: s.hand.find(c => c.color === 'blue' && c.value === '3').id }"
    )
    assert res["ok"] is False and res["error"]["code"] == "INVALID_PLAY", res
    res = await riya.forged("game:play", "{ turnId: s.game.turnId, cardId: s.hand[0].id }")
    assert res["error"]["code"] == "NOT_YOUR_TURN", res
    res = await riya.forged("room:settings", "{ turnSeconds: 15 }")
    assert res["error"]["code"] == "NOT_HOST", res

    # Skip: Riya is skipped, Amit plays.
    await host.play("Red Skip")
    await amit.wait("s.game.currentPlayerId === s.selfId")
    # Reverse: play goes back to Riya.
    await amit.play("Red Reverse")
    await riya.wait("s.game.direction === -1 && s.game.currentPlayerId === s.selfId")
    # Draw two: Sanskar draws 2 and is skipped, Zoya is next.
    await riya.play(r"Red \+2")
    await zoya.wait("s.game.currentPlayerId === s.selfId")
    await host.wait("s.hand.length === 8")
    # Wild (on the phone): color picker, green.
    await zoya.card("Wild").click()
    await zoya.card("Wild").click()
    await expect(zoya.page.get_by_role("dialog", name="Choose a color")).to_be_visible()
    await zoya.shot("06-color-picker-mobile", settle=400)
    await zoya.page.get_by_role("dialog", name="Choose a color").get_by_role("button", name=re.compile("^green")).click()
    await amit.wait('s.game.currentColor === "green" && s.game.currentPlayerId === s.selfId')
    # Wild +4 (Amit has no green): Amit plays it, then Riya accepts (the next player always
    # gets to accept or challenge, per the official rules).
    await amit.play(r"Wild \+4", color="blue")
    await riya.wait('s.game.pendingDraw !== null && s.game.currentColor === "blue"')
    await expect(riya.page.get_by_role("button", name=re.compile("^Accept"))).to_be_visible()
    await riya.page.get_by_role("button", name=re.compile("^Accept")).click()
    await host.wait('s.game.currentPlayerId === s.selfId && s.game.currentColor === "blue"')
    await riya.wait("s.hand.length === 10")
    await host.play("Blue 2")
    # Draw: Zoya draws a dead card and the turn passes automatically.
    await zoya.wait("s.game.currentPlayerId === s.selfId")
    await zoya.page.get_by_role("button", name="Draw card").click()
    await amit.wait("s.game.currentPlayerId === s.selfId")
    await zoya.wait("s.hand.length === 7")
    await host.shot("08-board-midgame", settle=600)

    # Reconnect: Riya refreshes and gets the same seat and cards back.
    before = sorted(c["id"] for c in (await riya.state())["hand"])
    await riya.page.reload()
    await riya.wait(f"s.hand.length === {len(before)}")
    after = sorted(c["id"] for c in (await riya.state())["hand"])
    assert before == after, "hand changed after reconnect"
    await expect(host.page.get_by_text("Riya is back")).to_be_visible()

    # Disconnect: Amit closes his browser on his turn. The seat is held, the turn auto-passes,
    # then after the grace period he's removed and the game carries on with three.
    await amit.ctx.close()
    await host.wait('s.room.players.some(p => p.nickname === "Amit" && !p.connected)')
    await host.shot("09-player-offline", settle=300)
    await riya.wait("s.game.currentPlayerId === s.selfId", timeout=8000)  # Amit's turn timed out
    await host.wait('!s.room.players.some(p => p.nickname === "Amit")', timeout=15000)
    await host.wait("s.game.turnOrder.length === 3")
    for p in (host, riya, zoya):
        await p.ctx.close()


async def two_player_rounds(browser: Browser):
    """UNO call, missed-UNO catch, winning, scoring, next round, leaving mid-round (forfeit), stats."""
    host = await Player.open(browser, "Sanskar")
    code = await host.create()
    riya = await Player.open(browser, "Riya")
    await riya.join_from_landing(code)
    host_id, riya_id = await host.self_id(), await riya.self_id()

    rig([WINNING_HAND, "y1 y2 y3 y4 y6 y7 W"])
    await host.page.get_by_role("button", name="Start Game").click()
    await host.wait('s.room.status === "playing"')
    for label in ("Red Skip", "Red Skip", "Green Skip", "Green Skip", "Blue Skip"):
        await host.play(label)

    uno = host.page.get_by_role("button", name="Call UNO")
    await expect(uno).to_be_enabled()
    await uno.click(force=True)  # it pulses for attention, so it's never 'stable'
    await riya.wait(f's.game.unoDeclared.includes("{host_id}")')
    await expect(riya.page.get_by_text("Sanskar called UNO!")).to_be_visible()
    await host.shot("10-uno-called", settle=300)
    await host.play("Blue 1")
    await riya.wait("s.game.currentPlayerId === s.selfId")
    await riya.page.get_by_role("button", name="Draw card").click()
    await host.wait("s.game.currentPlayerId === s.selfId")
    await host.play("Blue 2")

    await host.wait('s.room.status === "roundOver"')
    await riya.wait('s.room.status === "roundOver"')
    await expect(host.page.get_by_role("heading", name="You win round 1!")).to_be_visible()
    await expect(riya.page.get_by_text("Waiting for Sanskar to start the next round")).to_be_visible()
    state = await host.state()
    assert state["room"]["lastRound"]["points"] == 1 + 2 + 3 + 4 + 6 + 7 + 50 + 9, state["room"]["lastRound"]
    await host.shot("11-round-over-winner", settle=700)
    await riya.shot("11b-round-over-other", settle=200)

    # Next round: Riya starts (the first seat rotates) and forgets to call UNO.
    rig(["y1 y2 y3 y4 y6 y7 y8", WINNING_HAND])
    await host.page.get_by_role("button", name="Next Round").click()
    await riya.wait("s.room.roundNumber === 2 && s.game.currentPlayerId === s.selfId")
    for label in ("Red Skip", "Red Skip", "Green Skip", "Green Skip", "Blue Skip", "Blue 1"):
        await riya.play(label)
    await host.wait(f's.game.unoVulnerableId === "{riya_id}"')
    await expect(host.page.get_by_role("button", name=re.compile("Catch")).first).to_be_visible()
    await host.shot("12-catch-button", settle=300)
    await host.page.get_by_role("button", name=re.compile("Catch")).first.click(force=True)  # it wiggles
    await riya.wait("s.hand.length === 3")
    await expect(riya.page.get_by_text("Sanskar caught you without UNO. Draw 2.")).to_be_visible()

    # Riya leaves mid-round: Sanskar wins by default.
    await riya.page.get_by_role("button", name="Leave", exact=True).click()
    await riya.page.get_by_role("button", name="Leave game").click()
    await riya.page.wait_for_url(BASE + "/uno")
    await host.wait('s.room.status === "roundOver" && s.room.lastRound.reason === "forfeit"')
    await expect(host.page.get_by_role("heading", name="You win by default")).to_be_visible()
    await host.shot("13-forfeit", settle=500)

    # Stats (in-memory without MongoDB) show on the landing page.
    await host.page.get_by_role("button", name="Leave room").click()
    await host.page.wait_for_url(BASE + "/uno")
    await host.page.reload()
    await expect(host.page.get_by_role("heading", name="Your record")).to_be_visible()
    await expect(host.page.get_by_role("heading", name="Most wins")).to_be_visible()
    await host.shot("14-landing-with-stats", settle=900)
    await host.ctx.close()
    await riya.ctx.close()


async def lobby_and_tabs(browser: Browser):
    """Two tabs in one browser are two players; host leaves -> host transfer; duplicate tab takes over a seat."""
    first = await Player.open(browser, "Host")
    code = await first.create()
    second = await Player.open(browser, "Tab Two", path=f"/room/{code}", ctx=first.ctx)  # same browser, new tab
    await second.page.get_by_role("button", name="Join Game").click()  # same saved nickname as tab 1
    await expect(second.page.get_by_role("alert")).to_contain_text("nickname")
    await second.join_from_link(code)
    neel = await Player.open(browser, "Neel")
    await neel.join_from_landing(code)
    await first.wait("s.room.players.length === 3")

    # The host leaves the lobby: the next player becomes host right away.
    await first.page.get_by_role("button", name="Leave room").click()
    await first.page.wait_for_url(BASE + "/uno")
    await expect(second.page.get_by_role("button", name="Start Game")).to_be_visible()
    await expect(second.page.get_by_text("You're the host now")).to_be_visible()

    # A duplicated tab (same saved seat) takes the seat over; the old tab can take it back.
    session = await second.page.evaluate("sessionStorage.getItem('uno-party:session')")
    dup = await Player.open(browser, "Dup", ctx=first.ctx)
    await dup.page.evaluate(f"sessionStorage.setItem('uno-party:session', {json.dumps(session)})")
    await dup.page.goto(f"{BASE}/room/{code}")
    await dup.wait("s.room.players.length === 2")
    await expect(second.page.get_by_role("heading", name="This game is open in another tab")).to_be_visible()
    await second.shot("15-open-in-another-tab", settle=300)
    await second.page.get_by_role("button", name="Play here instead").click()
    await second.wait("s.room.players.length === 2")
    await expect(second.page.get_by_role("button", name="Start Game")).to_be_visible()
    await expect(dup.page.get_by_role("heading", name="This game is open in another tab")).to_be_visible()

    # Bad room codes are handled.
    await dup.page.goto(f"{BASE}/room/ZZZZZZ")
    await dup.page.get_by_role("button", name="Join Game").click()
    await expect(dup.page.get_by_role("heading", name="Room ZZZZZZ isn't open")).to_be_visible()
    await first.ctx.close()
    await neel.ctx.close()


async def name_wheel_spin(browser: Browser):
    """Name Wheel: add names, spin, and see a winner."""
    p = await Player.open(browser, "Wheeler", path="/wheel")
    await p.page.fill("#wheel-names", "Riya\nSanskar\nAmit\nZoya")
    await p.page.wait_for_timeout(200)
    await p.page.get_by_role("button", name="Spin", exact=True).click()
    await p.page.wait_for_selector("text=The wheel says", timeout=15000)
    await p.shot("16-wheel-result", settle=300)
    await p.ctx.close()


async def bottle_online_three_players(browser: Browser):
    """Spin the Bottle online: three players see the same spin land on the same player."""
    host = await Player.open(browser, "Sanskar", path="/bottle")
    await host.page.get_by_role("button", name="Create a room").click()
    await host.set_nickname("Sanskar")
    await host.page.get_by_role("button", name="Create room").click()
    await host.page.wait_for_url(re.compile(r"/room/[A-Z0-9]{6}$"))
    code = host.page.url.rsplit("/", 1)[1]

    riya = await Player.open(browser, "Riya", path=f"/room/{code}")
    await riya.join_from_link(code)
    amit = await Player.open(browser, "Amit", path=f"/room/{code}")
    await amit.join_from_link(code)
    players = (host, riya, amit)
    for p in players:
        await p.wait("s.room.players.length === 3")

    await host.page.get_by_role("button", name="Start Game").click()
    for p in players:
        await p.page.wait_for_selector('svg[aria-label="Spin the bottle table"]', timeout=8000)
    await host.shot("17-bottle-online-lobby-started", settle=300)

    state = await host.state()
    spinner_id = state["party"]["spinnerId"]
    by_id = {await p.self_id(): p for p in players}
    spinner = by_id[spinner_id]
    await spinner.page.locator('svg[aria-label="Spin the bottle table"]').click()

    for p in players:
        await p.wait("s.party && s.party.spin === null && s.party.turnId === 1", timeout=8000)

    targets = {(await p.state())["party"]["spinnerId"] for p in players}
    assert len(targets) == 1, f"players disagree on who the bottle landed on: {targets}"
    await host.shot("18-bottle-online-result", settle=300)
    for p in players:
        await p.ctx.close()


async def couples_online_two_players(browser: Browser):
    """Couples online: two partners draw the same card, and the lower-of-two consent rule holds."""
    alex = await Player.open(browser, "Alex", path="/couples")
    await alex.page.get_by_role("button", name="We're both 18+").click()
    await alex.page.get_by_role("button", name="Start a room").click()
    await alex.set_nickname("Alex")
    await alex.page.get_by_role("button", name="Start room").click()
    await alex.page.wait_for_url(re.compile(r"/room/[A-Z0-9]{6}$"))
    code = alex.page.url.rsplit("/", 1)[1]

    blair = await Player.open(browser, "Blair", path=f"/room/{code}")
    await blair.join_from_link(code)
    for p in (alex, blair):
        await p.wait("s.room.players.length === 2")

    await alex.page.get_by_role("button", name="Start Game").click()
    # Blair is a separate browser context (a separate device), so their age gate is unconfirmed too.
    await blair.page.wait_for_selector("text=This game is for adults.", timeout=5000)
    await blair.page.get_by_role("button", name="We're both 18+").click()
    for p in (alex, blair):
        await p.wait("s.party !== null", timeout=8000)
    await alex.shot("19-couples-online-lobby-started", settle=300)

    state = await alex.state()
    current_id = state["party"]["currentPartnerId"]
    by_id = {await alex.self_id(): alex, await blair.self_id(): blair}
    current, other = by_id[current_id], (blair if by_id[current_id] is alex else alex)

    # Consent: the current partner sets Spicy, the other stays at the default Sweet. The
    # card drawn must play at the lower of the two, i.e. Sweet, never Spicy.
    await current.page.get_by_role("radio", name="Spicy").click()
    await current.page.wait_for_timeout(200)
    await current.page.get_by_role("button", name="Dare", exact=True).click()
    for p in (alex, blair):
        await p.wait("s.party && s.party.card !== null", timeout=5000)
    a_card = (await alex.state())["party"]["card"]
    b_card = (await blair.state())["party"]["card"]
    assert a_card == b_card, f"partners saw different cards: {a_card} vs {b_card}"
    assert a_card["level"] == "sweet", f"expected the lower level (sweet), got {a_card['level']}"
    await current.shot("20-couples-online-card", settle=300)

    await current.page.get_by_role("button", name="Done", exact=True).click()
    for p in (alex, blair):
        await p.wait("s.party && s.party.card === null && s.party.currentPartnerId !== " + json.dumps(current_id), timeout=5000)
    for p in (alex, blair):
        await p.ctx.close()


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        print("UNO Party browser tests")
        await check("4 players: create, join by link and code, every card type, reconnect, disconnect, mobile", four_player_game(browser))
        await check("2 players: UNO, catch, win, scoring, next round, forfeit, stats", two_player_rounds(browser))
        await check("lobby: tabs as players, host transfer, duplicate tab, bad codes", lobby_and_tabs(browser))
        await check("name wheel: spin and see a result", name_wheel_spin(browser))
        await check("spin the bottle online: three players see the same result", bottle_online_three_players(browser))
        await check("couples online: two players draw cards, consent rule for levels holds", couples_online_two_players(browser))
        await browser.close()

    print()
    for name, ok, err, secs in results:
        print(f"{'PASS' if ok else 'FAIL'}  {secs:5.1f}s  {name}" + (f"\n      {err}" if err else ""))
    # Expected noise: the refresh and closed tabs abort in-flight requests.
    errors = [e for e in page_errors if "net::ERR" not in e and "WebSocket" not in e]
    if errors:
        print("\nBrowser errors:")
        for e in errors:
            print("  " + e)
    failed = [r for r in results if not r[1]] or errors
    print(f"\n{len(results) - len([r for r in results if not r[1]])}/{len(results)} scenarios passed; screenshots in {SHOTS}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
