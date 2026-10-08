# Lazy Lagoon

A tiny browser arcade with a pixel lake vibe. Lounge around and play **Snake**, **Minesweeper**, **Tic-Tac-Toe**, **Sudoku**, **Memory Match**, **2048**, or **Breakout**

Open it, pick a game, chase a high score.

## Play

Serve the folder over http (recommended) or open index.html in your browser. The shared seed scores on the leaderboard only load over http, so opening the file directly (file://) shows just this device's scores:

```bash
npx --yes serve .
# or: python -m http.server 8080
```

Then open the URL.

### Routes

| Path | Game |
|------|------|
| #/ | Lobby |
| #/snake | Snake |
| #/minesweeper | Minesweeper |
| #/tictactoe | Tic-Tac-Toe |
| #/sudoku | Sudoku |
| #/memory | Memory Match |
| #/2048 | 2048 |
| #/breakout | Breakout |

### Controls

| Game | How to play |
|------|-------------|
| **Snake** | Arrows or WASD (also starts the run), or the on-screen pad. Space pauses. |
| **Minesweeper** | Click to reveal. Right-click or long-press to flag. |
| **Tic-Tac-Toe** | Click a cell. Play vs a friend or vs the AI. |
| **Sudoku** | Click a cell, then use the number pad or keys 1–9. Delete clears. |
| **Memory Match** | Click cards to flip. Easy / Medium / Hard board sizes. Match all pairs; fewer moves is better. |
| **2048** | Arrows, WASD, swipe, or on-screen pad. Merge tiles to raise your score. |
| **Breakout** | Mouse, touch, or arrows move the paddle. Space / click launches or pauses. |

Personal bests for the in-game HUD stay in this browser.

## Leaderboard

The lobby **Leaderboard** shows a **top 10** list per game (Snake, Minesweeper, Tic-Tac-Toe, Sudoku, Memory, 2048, Breakout). Minesweeper, Sudoku, and Memory also split Easy / Medium / Hard.

Published scores ship in `data/leaderboard-seed.json` (committed with the site). Each browser also keeps a **device overlay** in localStorage (`leaderboard.local`) for scores submitted on that machine only.

- **Snake / 2048**: higher score wins
- **Minesweeper / Sudoku / Breakout**: faster time wins
- **Memory Match**: fewer moves wins
- **Tic-Tac-Toe**: recent wins (up to 10)

## Project layout

```
lazy-lagoon/
  index.html
  css/styles.css
  js/           # games, lobby, leaderboard, lake background
  data/leaderboard-seed.json
  assets/lazy-lagoon-logo.svg
  tools/smoke-test.js   # dev-only, not part of the site
  .github/workflows/smoke-test.yml
```

Plain HTML, CSS, and JS. No build step.

## Accessibility

Animations ease off when prefers-reduced-motion is set.

Snake and Breakout pause automatically when you switch tabs (press Resume to carry on), and Breakout's clear time does not count time spent away. Score changes, game over, win, and pause messages are announced to screen readers.

## Development

`tools/smoke-test.js` is a dev-only headless check. It serves the folder on a local port, opens every route in Chrome, opens the leaderboard, and fails on any page error or console error. It needs Node 18+ and a local Chrome install. Nothing is added to the repo:

```bash
npm i --no-save --prefix tools puppeteer-core
node tools/smoke-test.js
```

Chrome defaults to the standard install path for Windows, macOS, or Linux. Set `CHROME_PATH` to use another browser binary. `tools/node_modules` is gitignored.

GitHub Actions runs the same smoke test on every push to `main` and on every pull request: see `.github/workflows/smoke-test.yml`. It uses the runner's preinstalled Google Chrome.

## License

MIT. See [LICENSE](LICENSE).
