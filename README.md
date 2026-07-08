# 🐍 Slithering Snakes & Ladders 🪜

A dynamic, single-page twist on classic Snakes & Ladders — built with **vanilla HTML, CSS, and JavaScript** (no frameworks, no libraries, no Canvas).

The catch: **the board doesn't sit still.** Before every roll, every snake and ladder on the board shifts its head and tail by a random amount. Ladders can scoop you up mid-shift. Snakes can slither right past you. Nothing is ever quite where you left it.

## 🎮 [Play it live here](#) 
*(Replace this link with your GitHub Pages URL once it's live — see below.)*

## Features

- **1–4 players**, each assigned a distinct color
- Classic **10x10 zigzag board** (boustrophedon layout), rendered with CSS Grid
- **The Slither**: 5 snakes and 4 ladders randomly reposition their heads/tails (±2 squares) before every turn
- **Strict physics**:
  - Entities whose head passes square 90 lock in place permanently
  - Shifts are cancelled if they'd push an entity out of bounds (below 2 or above 99)
  - No two entities can ever share a head square
  - If a ladder's base shifts onto a player, they're instantly scooped to the top
  - If a snake's head shifts onto a player, nothing happens — no shift-bites allowed
- **Live SVG overlay** connecting every snake head→tail and ladder base→top with animated arrows, recalculated on every slither
- Dice roll animation, turn indicator, scrolling event log, and exact-roll-to-win rule for square 100

## How to run it

No build steps, no installs. Just open `index.html` in a browser, or host it anywhere that serves static files (GitHub Pages, Netlify, etc.).

```
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
cd YOUR-REPO-NAME
open index.html   # or just double-click it
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure — setup screen and game screen |
| `style.css`  | All styling and animations |
| `script.js`  | Game logic — board generation, slither physics, dice, win condition, SVG rendering |

## Rules quick reference

- Roll the dice to move your token forward.
- Land exactly on a snake's head → slide down to its tail.
- Land exactly on a ladder's base → climb up to its top.
- You must roll the **exact** number needed to land on square 100 — overshooting keeps you in place.
- First player to land exactly on square 100 wins.

---

Built as a fun experiment in "physics-constrained randomness" — the board reshuffles itself every turn but never breaks its own rules.
