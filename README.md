# ClickFix Warden

A free, open source browser extension that stops ClickFix and fake CAPTCHA attacks and warns you about sites reported as malicious in public threat databases.

ClickFix pages pretend to be a CAPTCHA, a browser error or a Windows update. They quietly put a command in your clipboard and walk you through pasting it into Run, Terminal or File Explorer, which installs an infostealer or a remote access tool. ClickFix Warden sees the command before it reaches your clipboard, swaps it for a harmless note and shows you what the page tried to make you run.

## What it stops

- Fake CAPTCHA, fake browser error and "fix it" pages that write a command to the clipboard through `navigator.clipboard`, `ClipboardItem`, `execCommand('copy')` on a hidden field, or a copy handler, including the trick of borrowing a clean clipboard from a fresh iframe
- Commands hidden behind a wall of blank space (FileFix), Base64, caret and backtick escapes, split strings, invisible characters and look-alike letters
- The Run box (Win+R), the Win+X Terminal variant, the File Explorer address bar (FileFix), and macOS Terminal lures with `curl | bash`, Base64 into bash, `osascript` password prompts and quarantine removal
- Payloads that come through `mshta`, `msiexec`, `regsvr32`, `rundll32`, WebDAV shares, `cmdkey`, `certutil`, `bitsadmin`, `finger`, DNS TXT records and headless `conhost`
- ConsentFix, where a page asks you to paste back a sign-in link that carries an authorization code
- Links that open Script Editor with a prepared script (`applescript://`) or Windows search on a remote share (`search-ms:`)
- Fake full-screen Windows update pages that try to lock the keyboard (JackFix)
- Hacked sites that load their fake CAPTCHA code from a blockchain test network (ClearFake, EtherHiding)
- Known malicious extensions such as the fake ad blocker behind CrashFix, on request
- Sites, download links and server IPs reported to URLhaus, ThreatFox and Feodo Tracker, with a full-page block for sites tagged as ClickFix

Pages that merely show commands with a copy button, like install guides for Rust, Homebrew, uv or Docker, keep working. A command is only blocked when it carries the marks of a ClickFix lure, or when the page around it walks you through pasting it.

## Privacy

ClickFix Warden collects no data. It has no account, no telemetry and no server of its own, and every check runs inside your browser. The only network request is the hourly download of the signed database and rules from GitHub Pages, which carries nothing about you or your browsing. The detection log and the optional history check stay on your computer. See the [privacy policy](https://xvoidbyte.github.io/clickfix-warden/privacy.html).

## How it works

- `src/content/hooks.ts` runs in the page before any page script and wraps the functions a lure needs. It asks the isolated guard script for a verdict through a synchronous DOM event that page code cannot see or answer.
- `src/engine` cleans up the command and scores what it can do, the ClickFix hallmarks it carries and the page around it, including the button that was clicked.
- `rules/rules.json` holds every pattern as data. The extension downloads a signed copy every hour, so new variants reach everyone without a store review, and nothing remote is ever run as code.
- `feed-builder` turns the abuse.ch exports into `feed.json`, signs it with Ed25519 and publishes it through GitHub Actions. The extension refuses any file that is unsigned, signed with another key or older than what it has.

## Install

Store links will be added here once the listings are live. To try it from source:

```
npm ci
npm run build            # Chrome, Brave, Opera: load .output/chrome-mv3 as an unpacked extension
npm run build:firefox    # Firefox: load .output/firefox-mv3/manifest.json in about:debugging
npm run build:edge       # Edge: load .output/edge-mv3
```

## Development

```
npm run dev              # Chrome with live reload
npm test                 # unit tests
npm run test:e2e         # end-to-end tests in Chromium against the pages in tests/corpus
npm run typecheck
npm run lint:firefox     # the same checks AMO runs
npm run zip              # store packages and SHA256SUMS.txt in .output
```

The end-to-end tests load the extension into Chromium and run it against replicas of each ClickFix technique and against normal pages with copy buttons. Every payload points at a reserved `.invalid` or `.test` name or a TEST-NET address, and the tests block all traffic that is not local.

## Adding a new ClickFix variant

1. Add the pattern to `rules/rules.json` and raise `version` by one.
2. Add the command to `tests/unit/samples.ts`, and a page replica to `tests/corpus/lures` with a test in `tests/e2e/clickfix.spec.ts`.
3. Run `npm test` and `npm run test:e2e`, then push. The database workflow signs and publishes the new rules within the hour.

If a variant needs a new kind of check rather than a new pattern, it ships as an extension update and `minEngine` keeps older versions from loading rules they cannot use.

`ABUSECH_AUTH_KEY=... npm run review:clickfix` lists the newest ClickFix reports from ThreatFox and URLhaus without opening any of the sites.

## Publishing setup

The database workflow needs two repository secrets.

- `ABUSECH_AUTH_KEY`, a free key from the [abuse.ch authentication portal](https://auth.abuse.ch/)
- `FEED_SIGNING_KEY`, the private key made by `npm run keys:generate`, which saves it outside the repository and writes the public half to `src/feed/public-key.ts`

GitHub Pages has to be set to deploy from GitHub Actions in the repository settings. Until both secrets exist the workflow only leaves a notice.

## For organisations

Every setting can be set and locked through managed storage. On Windows with Chrome, for example, the policy goes under `HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\<extension id>\policy`, with keys such as `trustedSites`, `customWarning` and `lockSettings`. The full list is in `public/managed_schema.json`.

## Data sources

Reports come from [URLhaus](https://urlhaus.abuse.ch/), [ThreatFox](https://threatfox.abuse.ch/) and [Feodo Tracker](https://feodotracker.abuse.ch/) by abuse.ch, used under their fair use terms for non-commercial projects.

## License

MIT, see [LICENSE](LICENSE).
