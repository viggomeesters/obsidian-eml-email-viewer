## Summary

-

## Checks

- [ ] `npm run build`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] Tested plain text `.eml`
- [ ] Tested HTML `.eml` with remote content blocked
- [ ] Tested malformed MIME fallback

## Security

- [ ] Viewer remains read-only
- [ ] No mailbox sync, IMAP, SMTP, send, reply, forward, archive, or import behavior added
- [ ] No remote content loading added
- [ ] No attachment opening added
- [ ] No clipboard, process, or plugin network APIs added
