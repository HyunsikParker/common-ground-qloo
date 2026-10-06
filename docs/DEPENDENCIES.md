# Dependency verification

The standalone Node/MCP tree uses pnpm 12.8.1 with the pinned Qloo harness and scoped Undici/brace-expansion patches. Its audit found no known advisories in the checked tree; software tests50passed.

The hosted runtime was updated after the initial submission to Next16.3.8, React/React DOM/RSC19.3.0, Vinext1.0.1, Vite8.3.3, Cloudflare Vite plugin1.62.5 and Wrangler4.147.0. The locked baseline-browser-mapping2.11.0 and fast-uri3.1.8 overrides address the remaining runtime findings. Production dependency audit:zero known findings. Full development-tool audit still includes build/lint/generator-chain advisories; this is not a claim of universal application security.

The live app exposes no custom image-generation or server-function endpoint and keeps the Qloo key in runtime secrets. No creator SKILL.md or plugin template original was modified. Installed patched dependencies and the Sites build were verified before deployment.
