# AWC Ark

Retro games for the Anointed Worship Center family: **Pong Plus, Breakout, Space Invaders and Tetris**.
Scores go on a shared leaderboard ("Ark Champions"), and kids earn **AWC Bucks** within the church's rules.

Started as the Google AI Studio "Pong Plus & Retro Arcade" prototype. The four games were kept; the
prototype's local-only leaderboards, fake chat/"E2EE", fake cloud sync, made-up activity feed, teams
and token wagering were removed.

## How it fits together

- **This repo** is a static site built under `/ark/` and deployed as its own Vercel project (`awc-ark`).
- **AWC Connect** serves it at `https://awc-connect.vercel.app/ark/` (a Vercel rewrite), so members are
  already signed in with their Connect account. No new password.
- **Scores and AWC Bucks** live in the AWC Vault database (`supabase/migrations/awc_ark.sql` in the
  Vault repo). The Ark calls Connect's `/api/ark`, which forwards to the Vault's `resource=ark` API.
- **"Who's playing?"**: a parent can play as themself or as one of their household's children, so the
  score and Bucks go to the right person. Adults rank on the board but never earn Bucks.

## AWC Bucks rules (kids only)

| | |
|---|---|
| First game of the day | +2 |
| New personal best (not your first-ever game) | +5 |
| Week's top 3 kids in a game | +10 / +6 / +4 |

Up to 20 a week from playing (Super Admin can change it in the Vault: Events → AWC Ark). Top-3 prizes
are extra, and everything counts inside the AWC Bucks 100-a-week cap. Games under 20 seconds earn
nothing; scores far above a player's best are held for a leader to approve; removing a score takes its
Bucks back.

## Run locally

```bash
cp .env.example .env.local   # same Supabase URL + anon key as AWC Connect
npm install
npm run dev                  # http://localhost:5190/ark/  (API calls go to a local Connect on :3000)
npm test && npm run build
```
