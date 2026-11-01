# The verifier

**Where Gamdom links it.** gamdom.com/help/fair: "The sample code to generate games hashes and
calculate Crash results can be found here", with "here" linking

    https://codesandbox.io/embed/crash-verifier-4nl2fc?hidenavigation=1&initialpath=%2F%3Fhash%3D&view=preview

(on both 19 September and 9 October 2026, `../claims/help-fair/capture.json`).

**What it is.** CodeSandbox `4nl2fc`, from CodeSandbox's metadata for the sandbox
(`sandbox-4nl2fc-metadata.json`, saved 19 September 2026):

| field | value |
|---|---|
| id / alias | `4nl2fc` / `crash-verifier-4nl2fc` |
| title | `crash-verifier` |
| created (`inserted_at`) | 2026-01-02T08:45:55 |
| last updated (`updated_at`) | 2026-01-02T08:54:54 |
| workspace | `gamdom` (`ws_C2fz4ww91TziShxUVtCa12`) |
| author account | `vlad15` |

CodeSandbox gives these times without a time zone. The editor screenshot
(`screenshot-editor-2026-09-19.png`) shows the `gamdom` workspace badge.

**The source as captured** (19 September 2026), in `sandbox-4nl2fc/`, with sizes and sha256 in
`sandbox-4nl2fc/FILE-HASHES.json`. The file that computes results is `math.js`,
sha256 `b2a4b9fa4fc8b2a530c894c34f03e71888c026dea0173a25b837d85ef141898e`. The `math.js` carried in
the CodeSandbox metadata response is identical to it. It depends on `crypto-js` 4.2.0
(`package.json`).

**Which rounds it covers.** The sandbox's own page says: "For game results before 19.11.2025 16:30
UTC see https://codesandbox.io/embed/lf6uy" and "For game results before 02.01.2026 see
https://codesandbox.io/embed/crash-verifier-h846zc" (`App.js`, lines 64 and 70;
`screenshot-preview-2026-09-19.png`). Every round in this pack is from September and October 2026,
after both dates.

**The port.** `../scripts/verifier.mjs` is `math.js` in Node with no dependencies. It changes two
things: the crypto-js calls become `node:crypto` calls with the same inputs, and `var` becomes
`const`/`let`. crypto-js is called as `HmacSHA256(message, key)`, so in `HmacSHA256(salt, serverSeed)`
the salt is the message and the round's hash is the key; the port keeps that order.
