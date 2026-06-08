# Contributing

Keep changes aligned with the v0.1 security model:

- no mailbox sync
- no IMAP or SMTP
- no sending, reply, forward, archive, or import workflow
- no remote content loading
- no attachment opening
- no clipboard access
- no `.eml` write-back

Run before submitting changes:

```bash
npm run build
npx tsc --noEmit
npm test
```
