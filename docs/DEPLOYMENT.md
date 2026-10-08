# Deployment

The public web source is in `hosted/`. It uses Vinext on Cloudflare Workers with a D1 binding named `DB`. The schema and generated migration are included. A sanitized hosting manifest declares the binding but omits the owner's Site identity; a clone needs its own project identity.

`QLOO_API_KEY` is a runtime secret. Configure the exact event key at the host, never in source, browser assets, a recording or a public MCP configuration. The Worker accepts only `https://hackathon.api.qloo.com`, rejects redirects before any second request and never retries automatically.

Provision the D1 allowance once while the Site is owner-private, using `/api/bootstrap` and the already-spent count. Set `ALLOWANCE_INITIALIZATION_ALLOWED=false` before public access. The guard combines the durable D1 row with the recorded off-platform offset. A missing or changed row stops requests, and redeployment must not reset either component.

The 1,000-request cap, one-second spacing and November 17 at 04:45 UTC stop time are operator safeguards, not issuer quotas or a claimed credential expiration. The page reads the effective remaining allowance without exposing the key or policy hash.

The fixed public-example snapshot is compiled into the server source and makes no Qloo request. Live comparisons cache completed evidence for ten minutes only when the confirmed group, public area and venue type are unchanged in the same anonymous session. Sessions expire after 20 minutes; exclusions remain local to the session.

Before publishing a clone, run `npm run lint` and `npm run build`, apply the D1 migration, verify the public page in a normal browser, confirm that the example does not move the allowance, and run one bounded search/confirm/compare flow. Generic command-line clients may meet the hosting platform's browser-signature block; do not spoof a browser or expose a service token.

The optional root Dockerfile supports the standalone Node app with private access files mounted outside the image. It is not the deployment path used by the public demo.
