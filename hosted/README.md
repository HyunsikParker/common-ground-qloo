# Common Ground — hosted application

The web app compares the same Qloo venue shortlist for two to six public cultural interest sets. It minimizes the largest ordinal rank regret, then mean regret. It never averages affinity scores from different profiles.

This checkout preserves the existing Common Ground UI and domain logic. The hosted backend uses the documented event HTTP endpoints, the server-side issued key and Cloudflare D1 for anonymous sessions and shared request accounting. The accompanying Node/MCP implementation uses the official Qloo CLI. No model-provider API key is needed.

Actual event search, nomination, common-shortlist ranking, exclusion and restoration were validated on October 6 using representative public test interests. These checks are not a user study or a measured preference-prediction improvement.

## Run and build

Use Node22 or later. Install the frozen npm lockfile through the bundled Sites installer, generate the schema migrations with `npm run db:generate`, then build through `build-site.mjs`. Apply the included D1 migration to a local preview before using API routes.

Runtime secret: QLOO_API_KEY. It is never included in this repository or the client bundle. The exact Qloo origin is https://hackathon.api.qloo.com. The API request cap1000 and1second spacing are conservative operator limits, not published issuer quotas. The event-use stop time is November17 04:45UTC, not a claimed issuer key expiration.

The allowance row must be provisioned once during the owner-private setup, using the already-spent local request count. Set ALLOWANCE_INITIALIZATION_ALLOWED=false before public access. A missing or changed persistent allowance stops requests; restart and publication do not reset it. No billing enrollment or paid dependency is used.

Search choices require explicit confirmation. The app sends only public cultural IDs and a public meeting area to Qloo. Anonymous member labels, account identifiers and contact details are not Qloo inputs. The browser session expires after20minutes. Prices and opening hours are not checked.

AI assistance: Codex was used for implementation, tests and documentation. License:MIT. React, Vinext, Cloudflare Workers and Drizzle retain their respective licenses.
