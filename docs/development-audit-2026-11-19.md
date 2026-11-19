# Development dependency assessment — 19 November 2026

The development dependency update reduces the reported advisories without downgrading the official Obsidian linter or forcing cross-major overrides. Repository checks and production audit passed; the production bundle matches the previously published asset. The dependency change alone adds no runtime compatibility claim.

Four moderate dependency nodes remain in the development tooling for one advisory: eslint-plugin-obsidianmd 0.6.0 → @microsoft/eslint-plugin-sdl 1.1.0 → eslint-plugin-n 17.10.3 → minimatch 9.0.9. The affected optimizationLevel >= 2 is not the default used in the previously inspected lint path. This bounds the assessment and does not establish universal immunity or a clean development audit. Recheck supported upstream releases; do not force an incompatible override or downgrade.

Validation used Node 24.21.0 and npm 11.19.0 on Linux. The updated minimatch 11.0.9 toolchain requires Node 20 or Node 22 and later; these checks do not establish support for Node 18 or 21.

The additional @isaacs/nonrecursive-glob-match dependency, where present, is development-only and uses BlueOak-1.0.0. Published assets are unchanged.

Sources: https://github.com/advisories/GHSA-g3hv-75wg-m249 and https://github.com/advisories/GHSA-4p3w-j4w9-5jqw.
