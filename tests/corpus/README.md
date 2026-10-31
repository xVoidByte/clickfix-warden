# Test corpus

Replicas of ClickFix lure pages and of ordinary pages with copy buttons, used by the end-to-end tests in `tests/e2e`.

The lure pages are rebuilt from public write-ups of each technique, they are not captured malicious pages. Every command in them points at a reserved name (`.invalid`, `.test`, `example.com`) or a TEST-NET address (`192.0.2.0/24`), so nothing in this folder can reach a real server, and the tests only ever read the clipboard, they never run what is in it.

To add a real captured lure, save only its HTML and JavaScript here, replace every payload address with a `.invalid` name first, and add a test for it in `tests/e2e/clickfix.spec.ts`.
