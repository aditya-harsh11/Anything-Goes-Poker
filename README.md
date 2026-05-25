# Card Room

A self-hosted, real-time multiplayer Texas Hold'em room for home games. A host creates a game,
shares a link, and up to 8 players join as guests. The app tracks **play-money chips only** — no
real cash moves through it (settle up offline). The server runs the full game: dealing, blinds,
betting rounds, all-ins, side pots, hand evaluation, and pot awarding.

## Stack
- **client/** — React + Vite + TypeScript (Tailwind CSS)
- **server/** — Node.js + Express + Socket.IO + TypeScript (authoritative game engine)
- **shared/** — TypeScript types shared by client and server (`@poker/shared`)

## Develop
```bash
npm install          # installs all workspaces
npm run dev          # starts server (:3001) + client (:5173) together
```
Open http://localhost:5173 to create a game. The client listens on the LAN too, so friends on the
same network can open `http://<your-lan-ip>:5173/game/<roomId>`.

## Test
```bash
npm test             # runs the server engine unit tests (vitest)
```

## Scope
Texas Hold'em only for now. Other variants will be added behind a variant layer later.
```
```
