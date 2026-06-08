# Privacy and Security Notes

EML Email Viewer treats `.eml` files as potentially hostile local documents.

## What is rendered

- Header summary for common mail headers.
- Plain text body, capped for responsiveness.
- Sanitized HTML body, capped for responsiveness.
- Attachment metadata only.
- Raw MIME source, capped for responsiveness.

## What is blocked

- Remote images and tracking pixels.
- Scripts.
- External styles.
- Forms.
- Active URL attributes.
- Mail client launch.
- Attachment opening.
- Clipboard access.
- Mailbox sync.
- IMAP and SMTP.
- `.eml` file edits.
- Vault note conversion.

## Parser limitations

The v0.1 parser covers common MIME structures: plain text, HTML, multipart alternative, multipart mixed, encoded headers, base64, quoted-printable, attachments, malformed boundaries, and large messages. Raw MIME source remains visible when parsing is incomplete.
