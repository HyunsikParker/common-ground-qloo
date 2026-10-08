# Common Ground

[Live demo](https://common-ground-qloo.skaiea.chatgpt.site)

A group with different tastes needs one place to meet. One member chooses *Arrival* (2016), another Miles Davis, and another Brian Eno. In the October 6 live run, Qloo ranked Top of the Rock first for the *Arrival* profile but eighth and seventh for the other two. Sear Sound ranked first for Miles Davis but ninth and fifth for the others. Common Ground chose the New Museum at fourth, fourth and first: nobody got every profile's favorite, but the largest drop stopped at fourth place.

That run also exposed a product problem. An unconstrained “place” search returned landmarks, a recording studio and a guitar shop alongside plausible meeting venues. The current version lets the group choose **Cafe**, **Bar**, **Restaurant** or **Live music venue**, sends the matching Qloo place tag, and labels results with that category.

Common Ground keeps each confirmed interest set separate. Qloo nominates venues and ranks the same shortlist for every member. The app minimizes the worst ordinal rank regret, then mean regret, with a stable venue ID as the final tie-break. Raw affinity scores from different profiles are never averaged.

## Try the example

**Try a public example** loads a fixed Qloo snapshot for *Arrival* (2016), Miles Davis and Brian Eno. It was captured on October 8, 2026 with the **Cafe** filter and costs **0 new Qloo requests** whenever it is opened. Each comparison column names the confirmed interests, and the selected venue shows the Qloo signal contributions retained from nomination explainability. Those contributions explain a nomination; they are not personal enjoyment probabilities.

You can exclude a venue, restore it, change the public meeting area or choose another place type. A live comparison is reused for up to ten minutes only when the group, area and place type are unchanged in the same session. The app makes no booking, purchase, message or account change.

## Node app and MCP

Requires Node.js >=22.19.0 and pnpm 12.8.1.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm start
pnpm mcp
```

The default localhost app uses clearly labeled fictional fixtures. It is an offline mode, not a fallback from a live failure. A live Node/MCP instance requires `COMMON_GROUND_PROVIDER=qloo` and `COMMON_GROUND_ACCESS_FILE` pointing to private access metadata outside the source tree. Never put the key in command arguments, browser code or committed configuration.

The seven stdio MCP tools search and confirm cultural works, compare venues, exclude or restore a venue, read the current group, and reset it. `compare_places` accepts the same venue types as the web app. Agents must show ambiguous matches before confirmation.

## Hosted app and allowance

The `hosted/` directory contains the Vinext/Cloudflare Worker source and D1 migration. D1 stores anonymous 20-minute sessions and the durable shared request count. The Worker combines that count with recorded off-platform calls, so a restart or deployment cannot reset the effective allowance. The page shows the remaining operator allowance.

The 1,000-request cap, one-second spacing and November 17 at 04:45 UTC stop time are operator safeguards, not published issuer quotas or a claimed credential expiration. The Node adapter uses the official Qloo CLI; the hosted adapter uses the documented event HTTP endpoints. Both allow only `https://hackathon.api.qloo.com`, reject redirects and do not retry automatically.

## Verification and limits

`pnpm test`: 52 passing software tests. They cover the fixed snapshot, venue-tag forwarding and cache separation, explainability preservation, minimax ranking, explicit entity confirmation, request accounting, transport failures, HTTP sessions and the MCP interface. Both production builds pass; the hosted tree also passes ESLint. On October 9, one bounded local live search returned 12 confirmation choices and used exactly three Qloo requests.

Software tests do not establish recommendation quality. Venue availability, opening hours and prices are not checked. No adoption, satisfaction improvement, judging result, award or payment is claimed.

AI assistance: Codex was used for implementation, tests and documentation.

License: MIT. Qloo harness 0.1.26, React, Vite, MCP SDK, Vinext and Drizzle retain their respective licenses. Dependency versions and scoped transitive patches are pinned.
