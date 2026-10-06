# Dependency review — 2026-10-03 KST

The complete dependency tree passed `pnpm audit`: zero known advisories. All 41 software tests and the production build passed on the pinned installation. The supported `qloo exec --help` startup check and `qloo api` commands with synthetic responses also passed. No live Qloo API request was made.

## Reproducible patches

Use pnpm 12.8.1 and the committed `pnpm-lock.yaml`. `pnpm-workspace.yaml` applies two scoped overrides:

| Dependency | Original | Patched |
| --- | --- | --- |
| Undici under Pi coding agent | 8.9.0 | 8.10.2 |
| brace-expansion in the affected version-5 range | 5.0.9 | 5.0.12 |

The official Qloo harness remains at 0.1.26 and Pi remains at 0.84.2. Their source files were not patched or replaced. On October 6 the unchanged harness moved to runtime dependencies for the gated provider factory. The new dependency audit also found zero advisories; all 46 software tests and the production build passed. No live event request was made.

The original npm installation reported four affected packages through those two dependencies. Its published dependency shrinkwrap retained the old versions despite root overrides. The pnpm installation applies the patches, and a second clean install from the frozen lockfile reproduced them. Do not use `npm install` or regenerate an npm lockfile for this project; it would not preserve this verified installation path.

## Verify

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm audit
pnpm test
pnpm build
```

The audit includes development dependencies; no advisory was excluded or suppressed. A zero-advisory result is time-bound evidence, not proof that the application has no security defects.

References: [pnpm scoped overrides](https://pnpm.io/settings/dependency-resolution#overrides), [npm override and published shrinkwrap behavior](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides), [brace-expansion advisory](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [Undici advisory](https://github.com/advisories/GHSA-w293-vg96-wgc3).
