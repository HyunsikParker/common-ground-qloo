# Deployment

The deployed web source is in `hosted/`. It uses Vinext on Cloudflare Workers with a D1 binding named `DB`. The schema and generated migration are included. A sanitized hosting manifest declares DB but omits the owner's Site identity; use your own project identity when publishing a clone.

QLOO_API_KEY is a runtime secret. Configure the exact event key at the host, never in source, browser assets, a recording or a public MCP configuration. The deployed adapter uses the documented event HTTP endpoints and rejects every redirect before any second request. The Node/MCP adapter uses the official Qloo CLI with an isolated environment.

Provision the D1 allowance once, while the Site is owner-private, through `/api/bootstrap` with the already-spent local request count. The operator cap is 1000 requests with one-second spacing and a stop time of November 17 at 04:45 UTC. These are operator limits, not issuer quotas or a claimed key expiration. Disable ALLOWANCE_INITIALIZATION_ALLOWED before public access. A changed or missing allowance must stop requests; redeployment must not reset usage. If a local runtime shares the same key, suspend its separate allowance after handing it to the hosted database.

The public app requires no account. Anonymous sessions expire after twenty minutes and identical comparisons cache completed evidence for ten minutes while preserving vetoes. Verify public access in a normal browser and the actual search/confirm/compare/exclude/restore flow before submitting a clone. Generic unauthenticated command-line clients may receive the hosting platform's browser-signature block; do not spoof a signature or expose a service token as a demo credential.

The optional Dockerfile supports the standalone Node app and its private external access files. It was prepared but not built in this verification because the local Docker daemon was stopped. It is not the deployment path used for the public demo.
