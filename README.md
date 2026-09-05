# Lazy Lagoon

A tiny browser arcade with a pixel lake vibe. Lounge around and play **Snake**, **Minesweeper**, **Tic-Tac-Toe**, or **Sudoku** — no install, no account.

Open it, pick a game, chase a high score.

## Play

Serve the folder (recommended) or open `index.html` in your browser:

```bash
npx --yes serve .
# or: python -m http.server 8080
```

Then open the URL it prints (for example `http://localhost:3000`).

Double-clicking `index.html` also works.

### Routes

| Path | Game |
|------|------|
| `#/` | Lobby |
| `#/snake` | Snake |
| `#/minesweeper` | Minesweeper |
| `#/tictactoe` | Tic-Tac-Toe |
| `#/sudoku` | Sudoku |

### Controls

| Game | How to play |
|------|-------------|
| **Snake** | Arrows or WASD (also starts the run), or the on-screen pad. Space pauses. |
| **Minesweeper** | Click to reveal. Right-click or long-press to flag. |
| **Tic-Tac-Toe** | Click a cell. Play vs a friend or vs the AI. |
| **Sudoku** | Click a cell, then use the number pad or keys `1`–`9`. Delete clears. |

Personal bests for the in-game HUD stay in this browser (`localStorage`).

## Leaderboard

The lobby **Leaderboard** shows a **top 10** list per game (Snake, Minesweeper, Tic-Tac-Toe, Sudoku). Minesweeper and Sudoku also split Easy / Medium / Hard.

When you finish a run, you can optionally enter a name. Only scores that earn a top-10 spot are saved. Scores stay **on this device** (browser storage) — there is no shared/global board.

- **Snake** — higher score wins
- **Minesweeper / Sudoku** — faster time (seconds) wins
- **Tic-Tac-Toe** — recent wins (up to 10)

## Project layout

```
lazy-lagoon/
  index.html
  css/styles.css
  js/           # games, lobby, leaderboard, lake background
  assets/favicon.svg
```

Plain HTML, CSS, and JS. No build step.

## Accessibility

Animations ease off when `prefers-reduced-motion` is set.

## License

MIT � see [LICENSE](LICENSE).
