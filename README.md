# 🔐 SafeKey

**Catch and block accidental API key leaks before you hit send.**

SafeKey is a lightweight Chrome extension that watches text fields on any website
and flags API keys, access tokens, and other secrets before they get pasted or
typed into a chat, form, or comment box. When it finds a match, it doesn't just
warn you — it **blocks the send** (Enter key or form submit) until you explicitly
confirm you want to proceed.

Everything runs **100% locally** in your browser. No data is ever sent to any
server, logged, or stored outside your own machine.

---

## Features

- **Real-time detection** as you type or paste, on any website.
- **Known-format matching** for major providers: OpenAI, Anthropic, AWS, Stripe,
  GitHub, Slack, Twilio, SendGrid, Mailgun, Telegram, Discord, npm, DigitalOcean,
  Firebase, Shopify, Square, and generic `key=`/`secret=`/`token=` patterns.
- **Entropy-based fallback** — catches unknown or custom secrets even without a
  recognizable prefix, by measuring how "random" a string looks (with built-in
  filters to avoid flagging git commit hashes or UUIDs).
- **Active blocking**, not just a warning: intercepts Enter-to-send and native
  HTML form submissions, and requires an explicit "Send anyway" confirmation.
- **Per-site muting** and a toggle to disable blocking (warning-only mode) from
  the popup.
- **Zero network requests** — the entire scan happens in-page, client-side.

## Installation (unpacked, for development/personal use)

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the project folder.
5. Test it by typing a fake key like `sk-test1234567890abcdefghijklmno` into any
   text field.

> SafeKey is not yet published on the Chrome Web Store. Loading it unpacked works
> indefinitely for personal use — no cost, no time limit.

## How it works

| File | Responsibility |
|---|---|
| `manifest.json` | Manifest V3 configuration, permissions, and script injection rules. |
| `detector.js` | Pattern definitions and the entropy-based fallback scanner. Exposes `window.__safekeyScan(text)`. |
| `content.js` | Listens for input/paste/keydown/submit events on the page, shows the warning banner, and blocks send attempts with a confirmation modal. |
| `content.css` | Styles for the banner and blocking modal. |
| `popup.html` / `popup.js` | Settings UI: enable/disable, toggle blocking, manage muted domains. |

### Detection flow

1. On every keystroke or paste in an editable field, the current value is scanned
   against known patterns first (fast, low false-positive rate).
2. If nothing matches, an entropy check runs on any long alphanumeric substring —
   flagging strings that "look random enough" to be a secret.
3. If a match is found, a non-blocking banner appears immediately.
4. If the user tries to send (Enter or form submit) while a match is still
   present, the action is intercepted and a modal requires an explicit decision.

## Known limitations

- Blocking currently covers **Enter-to-send** and **native `<form>` submissions**.
  Sites that trigger sending via a custom button with JavaScript (not Enter, not
  a form submit) won't be blocked — you'll still see the warning banner, but the
  click itself won't be intercepted. Open an issue if you hit one of these and
  we can special-case it.
- Detection runs against the raw text value; it can't see into iframes from a
  different origin (a browser security restriction, not a SafeKey bug).
- The entropy threshold is tuned to minimize false positives, which means very
  short or low-entropy secrets may not be caught. Prefer the specific
  provider patterns for those cases.

## Roadmap

- [ ] Publish to the Chrome Web Store.
- [ ] Configurable per-domain sensitivity.
- [ ] Alert history / audit log (opt-in, local only).
- [ ] Premium tier: custom regex patterns, unlimited muted-domain sync across
      devices.

## Contributing

Pattern additions are the easiest way to help — add an entry to the
`SAFEKEY_PATTERNS` array in `detector.js` and a corresponding test case. Pull
requests welcome.

## License

MIT (or your preferred license — not yet finalized).
