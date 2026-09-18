# Lazy Lagoon

A tiny browser arcade with a pixel lake vibe. Lounge around and play **Snake**, **Minesweeper**, **Tic-Tac-Toe**, **Sudoku**, **Memory Match**, **2048**, or **Breakout**

Open it, pick a game, chase a high score.

## Play

Serve the folder (recommended) or open index.html in your browser:

```bash
npx --yes serve .
# or: python -m http.server 8080
```

Then open the URL it prints (for example http://localhost:3000).

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

Published scores ship in `data/leaderboard-seed.json` (committed with the site). Each browser also keeps a **device overlay** in localStorage (`leaderboard.local`) for scores submitted on that machine only. The UI merges seed + overlay. Use **Export seed** in the leaderboard modal to download the merged board and overwrite the seed file when refreshing published tops.

- **Snake / 2048 / Breakout** — higher score wins
- **Minesweeper / Sudoku** — faster time (seconds) wins
- **Memory Match** — fewer moves wins
- **Tic-Tac-Toe** — recent wins (up to 10)

## Project layout

```
lazy-lagoon/
  index.html
  css/styles.css
  js/           # games, lobby, leaderboard, lake background
  data/leaderboard-seed.json
  assets/favicon.svg
```

Plain HTML, CSS, and JS. No build step.

## Accessibility

Animations ease off when prefers-reduced-motion is set.

## License

MIT — see [LICENSE](LICENSE).
