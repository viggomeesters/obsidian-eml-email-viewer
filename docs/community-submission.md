# Obsidian Community Submission Checklist

Current release target: `0.1.0`

## Repository

- [x] Public GitHub repository exists.
- [x] `README.md` describes what the plugin does and how to use it.
- [x] `LICENSE` exists.
- [x] `manifest.json` exists at repository root.
- [x] `manifest.json.id` is unique and does not contain `obsidian`.
- [x] `manifest.json.id` contains only lowercase letters and hyphens.
- [x] `manifest.json.id` does not end with `plugin`.
- [x] `manifest.json.name` uses Basic Latin characters and does not include `Obsidian`.
- [x] `manifest.json.version` uses `x.y.z`.
- [x] `versions.json` maps plugin version to minimum Obsidian version.
- [x] Runtime code avoids Node.js, Electron, process, clipboard, and plugin network APIs.
- [x] `main.js` is not tracked in source; it is built for release assets.

## Release

- [x] `npm run build` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npm test` passes.
- [x] GitHub release tag equals `manifest.json.version`.
- [x] Release assets include `main.js`.
- [x] Release assets include `manifest.json`.
- [x] Release assets include `styles.css`.

## Artifact attestations

The repository contains `.github/workflows/release.yml` with `actions/attest-build-provenance@v3`. GitHub rejected workflow dispatch with `Actions has been disabled for this user`, so release `0.1.0` was created manually. Obsidian can install manual releases, but automated review may recommend enabling GitHub Actions and publishing a workflow-built release with artifact attestations.

## Directory Submission

- [ ] Sign in to https://community.obsidian.md.
- [ ] Link the GitHub account that owns the repository.
- [ ] Open **Plugins -> New plugin**.
- [ ] Submit:

```text
https://github.com/viggomeesters/obsidian-eml-email-viewer
```

- [ ] Confirm developer policies and support commitment.
- [ ] Address automated review feedback.

These final steps require the repository owner's Obsidian account.

## Security summary

- read-only local file viewer
- no mail account sync, IMAP, SMTP, sending, reply, forward, archive, or import pipeline
- no remote image loading, scripts, external styles, forms, or active URL attributes in HTML preview
- no attachment opening
- no clipboard access
- no `.eml` write-back or vault note conversion

Official references:

- https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
- https://docs.obsidian.md/Reference/Manifest
- https://docs.obsidian.md/Reference/Versions
- https://github.com/obsidianmd/obsidian-releases
