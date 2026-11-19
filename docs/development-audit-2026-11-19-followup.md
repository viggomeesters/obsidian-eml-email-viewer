# Development linter advisory follow-up — 19 November 2026

The official Obsidian linter 0.6.0 depends on Microsoft SDL 1.1.0, which pins eslint-plugin-n 17.10.3 and transitively minimatch 9.0.9, affected by GHSA-g3hv-75wg-m249. The scoped npm override selects eslint-plugin-n 17.24.0 only under SDL. This intentionally replaces SDL's exact pin within the same major; it is a bounded compatibility exception, not an upstream-supported pin. Remove it when a compatible upstream correction is available.

The full and production npm audits report zero for the tested lockfile. Available repository tests, build, lint and typecheck passed on Linux with Node 24.21.0 and npm 11.19.0. The generated plugin bundle matches the previously published release asset; no new runtime or platform test claim follows.

The official recommended lint configuration was compared before and after on HTML Page Viewer, apart from its workspace path; no n/* rule was active there. Independent tests of SDL's optional Node configuration exercised a clean fs example and a deprecated sys import: both versions agreed on those cases and the rule loaded. Rule implementations do differ upstream, so these examples do not establish complete behavioral equivalence. globrex (MIT) and ts-declaration-location (BSD-3-Clause) are development-only dependencies. Review each repository's effective configuration separately.

Node 24 was tested; the inherited minimatch 11 toolchain requires Node 20 or >=22. Recheck upstream releases and repeat local checks when changing the override.

Source: https://github.com/advisories/GHSA-g3hv-75wg-m249.
