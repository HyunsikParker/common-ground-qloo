# Dependency verification

The standalone Node/MCP tree uses Node.js >=22.19.0 and pnpm 12.8.1. The lockfile pins Qloo harness 0.1.26, MCP SDK 1.31.0, React 19.3.0, Vite 8.3.2 and Zod 4.6.5. Scoped pnpm overrides keep the verified Undici and brace-expansion fixes in place.

The hosted tree pins Next 16.3.8, React and React DOM 19.3.0, Vinext 1.0.1, Vite 8.3.3, Cloudflare Vite plugin 1.62.5, Wrangler 4.147.0 and Drizzle ORM 0.45.2. The frozen npm lockfile also retains the baseline-browser-mapping 2.11.0 and fast-uri 3.1.8 overrides used by the hosted build.

On October 9, 2026, all 52 standalone software tests passed. The standalone production build, hosted ESLint check and hosted production build also passed. These checks cover the installed trees; they are not a claim that the application has no security defects.

## Reproduce the checked paths

Standalone:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm build
```

Hosted:

```sh
node scripts/install-ci.mjs
npm run lint
npm run build
```

Do not replace the standalone pnpm installation with `npm install`; the npm dependency shrinkwrap does not preserve the scoped pnpm override path. No issued key or runtime secret is part of either dependency tree.
