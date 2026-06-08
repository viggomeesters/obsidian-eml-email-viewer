# Security Policy

## Supported versions

Only the latest release is actively supported.

## Reporting a vulnerability

Please report security issues privately by emailing the maintainer or opening a minimal GitHub security advisory if available.

Do not include sensitive mail content in public issues. Reduce reproductions to synthetic `.eml` files first.

## Security posture

EML Email Viewer is read-only. It reads `.eml` files through Obsidian's vault API and renders a local inspection view.

The plugin does not sync mailboxes, connect to IMAP or SMTP, send mail, reply, forward, archive, import mail, open attachments, trigger a default mail client, access the clipboard, call plugin network APIs, or edit `.eml` files.

HTML preview is sanitized before rendering. Scripts, external styles, forms, remote image attributes, tracking pixels, and active URL attributes are removed or converted to inert `data-blocked-*` attributes. The Raw MIME tab is retained so malformed or partially parsed messages can still be inspected.
