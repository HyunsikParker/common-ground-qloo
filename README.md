# Common Ground

[Live demo](https://common-ground-qloo.skaiea.chatgpt.site)

Common Ground helps a group compare meeting places without flattening everyone's interests into one profile. Each person confirms public books, films or artists. Qloo supplies the venue nominations and ranks the same shortlist for each interest set. The app chooses the smallest worst rank sacrifice, then uses mean sacrifice and a stable venue ID to break ties.

Choose **Try a public example** to compare Arrival (2016), Miles Davis and Brian Eno. The example uses real Qloo responses; the interests are representative examples, not the visitor's preferences. Exclude a venue, compare again and restore it. You can also replace the interests and choose a public meeting area. There is no booking, purchase, message or account action.

The seven stdio MCP tools let an agent search, confirm works, compare, exclude, restore, read and reset a group. Agents must show ambiguous matches before confirming them. No model-provider API key is needed.

## Node app and MCP

Requires Node 22.19+ and pnpm 12.8.1.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm start
pnpm mcp
```

The default localhost app uses clearly labeled fictional fixtures. It is an offline option, not a fallback from a live failure. For a live Node/MCP instance, provide `COMMON_GROUND_PROVIDER=qloo` and `COMMON_GROUND_ACCESS_FILE` pointing to a private configuration outside this source tree. Never include a key in command arguments or browser code. See [integration notes](docs/INTEGRATION.md).

## Hosted app

The `hosted/` directory contains the deployed Vinext/Cloudflare Worker source and D1 migrations. D1 holds anonymous 20-minute sessions and the durable shared request counter. The hosted adapter uses the documented Qloo event HTTP endpoints; the Node adapter uses the official Qloo CLI. Both use only https://hackathon.api.qloo.com and refuse redirects and automatic retries.

Identical comparisons reuse Qloo evidence for up to 10 minutes while preserving exclusions. The evidence time is shown in the result. The request cap 1000 and 1 second spacing are operator limits, not published issuer quotas. The event-use stop time is November 17 04:45 UTC, not a claimed key expiration. The hosted allowance inherited 30 already-spent local requests and never resets on restart or deployment; local access to the same key is suspended after that handoff.

## Verification and limits

`pnpm test`: 50 passing software tests. Actual event search, nomination, shared-shortlist ranking, exclusion and restoration also passed. The deployed Worker passed the same real-provider journey and retained exclusions on a cached comparison. Its bootstrap endpoint is disabled after setup. The source and client bundles contain no issued key.

The algorithm compares ordinal rankings, not individual preference probabilities. Venue availability, hours and prices are not verified. No adoption, satisfaction improvement or prize result has been measured.

AI assistance: Codex was used for implementation, tests and documentation.

License: MIT. Qloo harness 0.1.26, React, Vite, MCP SDK, Vinext and Drizzle retain their respective licenses. Dependency versions and the two scoped transitive patches are pinned.
