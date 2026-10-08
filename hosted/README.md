# Common Ground — hosted application

Common Ground helps a group with different cultural interests choose one place to meet. The October 6 live run showed the trade-off: the profiles for *Arrival* (2016), Miles Davis and Brian Eno had different first choices, while the minimax result ranked fourth, fourth and first. The current UI keeps that trade-off visible instead of combining the group into one profile.

The group can filter Qloo recommendations to a cafe, bar, restaurant or live music venue. The comparison names each member's confirmed interests, shows the same shortlist in every column and retains Qloo's nomination contributions for the selected venue. Raw affinity scores from different profiles are never averaged.

**Try a public example** loads a fixed, timestamped cafe snapshot captured on October 8, 2026. It costs 0 Qloo requests each time it opens. Live comparisons are reused for up to ten minutes only when the group, meeting area and place type are unchanged in the current anonymous session.

## Run and build

Use Node.js >=22.19.0. Install the frozen npm lockfile through the bundled Sites installer, generate the D1 migration when the schema changes, then run lint and the Vinext build.

```sh
node scripts/install-ci.mjs
npm run db:generate
npm run lint
npm run build
```

Apply the included D1 migration to a local preview before testing API routes. The build command is `npm run build`.

## Runtime boundaries

`QLOO_API_KEY` is a runtime secret. It never belongs in this repository or the client bundle. The only allowed Qloo origin is `https://hackathon.api.qloo.com`. The 1,000-request cap and one-second spacing are conservative operator safeguards, not published issuer quotas. The event-use stop time is November 17 at 04:45 UTC, not a claimed issuer key expiration.

Provision the D1 allowance row once during owner-private setup with the already-spent count, then set `ALLOWANCE_INITIALIZATION_ALLOWED=false` before public access. The deployed guard adds recorded off-platform calls to the D1 count. A missing or changed allowance stops requests; a restart or publication does not reset it. The remaining effective allowance appears unobtrusively in the page provenance line.

Search results require explicit confirmation. The app sends only public cultural IDs, the selected public area and a cached venue-category tag to Qloo. Anonymous member labels, contact details and account identifiers are not Qloo inputs. Browser sessions expire after 20 minutes. The app does not verify prices or opening hours and does not book, purchase or send messages.

AI assistance: Codex was used for implementation, tests and documentation. License: MIT. React, Vinext, Cloudflare Workers and Drizzle retain their respective licenses.
