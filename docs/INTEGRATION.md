# Qloo integration notes

`QlooProvider` accepts an explicit Qloo client, a workflow-compatible executor and a public meeting area. `COMMON_GROUND_PROVIDER=qloo` constructs the CLI transport only when `COMMON_GROUND_ACCESS_FILE` loads private, verified event metadata and an existing allowance. An ambient `QLOO_API_KEY` cannot activate it, and a live failure never selects fixture data.

## Request flow

| Step | Qloo input | Bound |
| --- | --- | --- |
| Search | Public cultural query and one of book/movie/artist | Three sequential searches, four choices per type |
| Nominate | One member's confirmed cultural UUIDs, public area and one cached venue tag | One recommendation call per member, four places |
| Rank | The same candidate UUIDs for every member and that member's confirmed interests | One ranking call per member, at most ten options |

The venue tags were resolved once through the documented `/v2/tags` endpoint and are cached in `venue-types.js`:

- Cafe: `urn:tag:genre:place:restaurant:cafe`
- Bar: `urn:tag:genre:place:restaurant:bar`
- Restaurant: `urn:tag:genre:place:restaurant`
- Live music venue: `urn:tag:genre:place:live_music_venue`

The provider uses the official workflow field `include_tags`; the CLI and Worker adapters map it to `filter.tags` with the union operator. Only those four exact tags are accepted. Nomination requests enable `feature.explainability`. The adapters retain only confirmed input entity IDs and finite contribution scores, then associate them with the member whose nomination produced the venue.

Every person ranks the same candidate set through `filter.results.entities`. Only finite returned affinities enter the ranking. Missing values remain missing; duplicate, unrequested or conflicting entities fail closed. Raw affinities from separate people are never averaged.

## Fixed public example

`scripts/capture-public-example.mjs` requires the expected suspended private event policy, creates a temporary private copy for the bounded run and removes it afterward. The checked snapshot used three nomination and three ranking calls. Candidate details and explainability are sanitized; per-member affinities are converted to ordinal values that preserve order and ties before being stored. The app never falls back to a live request when the snapshot is absent or invalid.

## Transport and allowance

`HarnessTransport` runs the pinned package's supported `qloo api search` and `qloo api insights` commands in isolated Node subprocesses. Each operation permits one GET to the exact event endpoint. The child inherits no ambient model credentials, proxies, `NODE_OPTIONS` or Qloo settings. The key remains in its private file, responses are bounded to 1 MB, fetch is bounded to eight seconds and no redirect, retry or alternate host is allowed.

The hosted Worker applies the same domain and ranking logic over the documented HTTP endpoints. It reserves each attempt atomically in D1 before fetch. Its effective allowance includes a fixed record of off-platform calls made against the same key. Anonymous sessions use fenced D1 locks; a missing or changed allowance stops requests.

Authentication, quota, local spacing, timeout, malformed response and incomplete evidence remain distinct errors. Raw provider diagnostics do not reach the browser or MCP client. The operator safeguards do not claim an official quota or guarantee perpetual issuer availability.
