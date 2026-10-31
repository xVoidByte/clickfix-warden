# Store listing texts

The same texts work for the Chrome Web Store, Edge Add-ons, Opera add-ons and Firefox Add-ons. Per-store fields are in `chrome-web-store.md`, `edge-addons.md` and `firefox-amo.md`.

## Name

ClickFix Warden

## Short description (132 characters max, Chrome and Edge)

Stops ClickFix and fake CAPTCHA attacks that trick you into running commands, and warns about sites reported as malicious.

## Summary (250 characters max, Firefox)

Stops ClickFix and fake CAPTCHA pages that trick you into pasting a command into Run, Terminal or File Explorer, and warns about sites reported as malicious. Every check runs in your browser, no data is collected.

## Description (English)

ClickFix pages pretend to be a CAPTCHA, a browser error or a Windows update. They quietly put a command in your clipboard and walk you through pressing Win+R, Ctrl+V and Enter, or pasting into Terminal or the File Explorer address bar. That one paste installs password stealers and remote access tools. It is one of the most common ways people get infected today, and antivirus often sees it too late.

ClickFix Warden stops the command before it reaches your clipboard, puts a harmless note there instead and tells you in plain words what the page tried to do and why it was stopped. The command itself is never shown, so nobody can copy it by mistake.

WHAT IT STOPS
- Fake CAPTCHA, "verify you are human", browser error and "fix it" pages that fill your clipboard
- Commands hidden behind blank space, Base64, scrambled letters or invisible characters
- The Run box, Win+X Terminal, File Explorer address bar and macOS Terminal variants
- ConsentFix pages that ask you to paste back a sign-in link with a secret code
- Links that open Script Editor or Windows search on a remote share
- Fake full-screen Windows update pages that try to lock your keyboard
- Hacked websites that load fake CAPTCHA code from a blockchain
- Known malicious extensions such as fake ad blockers, on request

REPORTED SITES
ClickFix Warden also warns you about sites, download links and servers reported in the public URLhaus, ThreatFox and Feodo Tracker databases by abuse.ch, and stops sites reported as ClickFix pages before they load. You can check your browsing history against the same database, inside your browser, whenever you want.

ALWAYS UP TO DATE
Attackers change their tricks every week. The detection rules and the database update every hour from a digitally signed source, without waiting for a new version of the extension.

PRIVATE BY DESIGN
- No account, no telemetry, no analytics, no server of its own
- Every check runs inside your browser, your browsing never leaves your computer
- The only download is the signed database and rules from GitHub
- Open source at https://github.com/xVoidByte/ClickFixWarden

DOES NOT GET IN YOUR WAY
Install guides with copy buttons, support articles and everything else you copy keep working. A command is only stopped when it carries the marks of a ClickFix attack, or when the page around it tells you to paste it somewhere it should not go. A site you know can still be trusted after a clear warning about the risk.

FOR ORGANISATIONS
Every setting can be set and locked by policy, and you can add your own help desk message to every warning.

Remember, no real website will ever ask you to paste something into Run, Terminal or File Explorer to prove you are human.

## Screenshot captions

1. Stops fake CAPTCHA pages before the command reaches your clipboard
2. Says in plain words what was blocked and why
3. Blocks known ClickFix sites before they load
4. Warns about sites reported in public threat databases
5. Every check runs in your browser, nothing is collected
