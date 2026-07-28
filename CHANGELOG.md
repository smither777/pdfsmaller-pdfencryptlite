# Changelog

## 1.2.0 — 2026-07-28

Brings this package in line with [@pdfsmaller/pdf-encrypt](https://www.npmjs.com/package/@pdfsmaller/pdf-encrypt),
so code written against one works against the other.

### Added

- **UMD browser build** at `dist/pdf-encrypt-lite.umd.js`, for environments with
  no bundler and no module loader. Load `pdf-lib.min.js` first, then this file,
  then use the `PDFEncryptLite` global. pdf-lib is not bundled — it stays a peer
  dependency, read from the global pdf-lib itself installs.
- **Granular permissions.** The third argument now also accepts an options
  object with the same permission flags as the full package
  (`allowPrinting`, `allowFillingForms`, `allowModifying`, …). Previously every
  permission was hardcoded to "allowed".
- Passing an empty string as the user password produces a PDF that opens with
  no prompt but still declares its permissions — useful for "fill in but do not
  edit" forms. `allowFillingForms` also covers signing an existing signature
  field (ISO 32000-2 Table 22, bit 9 applies even when `allowAnnotating` is
  false).

### Compatibility

The third argument still accepts the owner password as a plain string, and
omitting it still means "all permissions allowed" — so existing calls produce
byte-identical output. This was verified against the published 1.1.0 for the
omitted, `null`, `undefined`, plain-string, empty-string, boxed-`String` and
array forms.

Only a **plain object** is read as options. Boxed strings and arrays are still
passed through to the password encoder exactly as in 1.1.0, because reading
them as options would silently drop the owner password and fall back to the
user password.

## 1.1.0 — 2026-07-28

**Upgrade immediately. 1.0.x produced corrupted PDFs.**

### Fixed — data corruption (critical)

Encrypted strings were written into PDF literal strings without escaping. pdf-lib
writes `PDFString.value` verbatim between `(` and `)` and escapes nothing, so the
random bytes `0x28` `(`, `0x29` `)`, `0x5C` `\` and `0x0D` CR silently destroyed
the object structure of the output file.

Any PDF containing literal strings — form field names, appearance strings,
JavaScript actions, metadata, i.e. effectively all of them — could come back with
fields missing, JavaScript truncated, or objects swallowed whole. Output also
varied from run to run — the file `/ID` feeds the RC4 key, and it was being
regenerated every run by the `/ID` bug below — so a different part broke each
time.

Verified against a real Acrobat form: the output now preserves all form fields and
JavaScript calculations, checked with an independent PDF parser.

### Fixed — spec compliance

- **Passwords are now PDFDocEncoding**, not UTF-8 (ISO 32000-2 §7.6.4.3.2). A
  password such as `café` previously produced a file that no conforming reader
  could open.
- **Signature `/Contents` is no longer encrypted** (ISO 32000-2 §7.6.2). Previously
  only `/Type /Sig` *streams* were skipped, but a signature is a dictionary.
- **`save()` no longer regenerates form appearances after encryption.** pdf-lib's
  `updateFieldAppearances` defaults to `true` and runs inside `save()`, so a
  regenerated appearance stream was written as plaintext into an encrypted file.
- **The existing file `/ID` is preserved.** `Array.isArray()` is false for a
  `PDFArray`, so the trailer ID was previously always discarded and regenerated.
- **`/P` is now a signed 32-bit integer.** The permission flags were written from
  the JavaScript literal `0xFFFFFFFC`, which is the *positive* number
  `4294967292`, so the emitted file carried `/P 4294967292` — outside the range
  ISO 32000 permits. It now emits `/P -4`. Lenient readers tolerated the old
  value; strict readers and validators need not.

### Added

- `AlreadyEncryptedError`, thrown when the input PDF already has an `/Encrypt`
  dictionary. pdf-lib cannot decrypt, so encrypting such a file previously
  produced output that opened with the new password but whose contents stayed
  encrypted under a key nobody had.
- `PasswordEncodingError` (`.code` is `UNSUPPORTED_PASSWORD_CHARACTER`), thrown for
  characters outside PDFDocEncoding — which the legacy handler cannot represent.
  Use [@pdfsmaller/pdf-encrypt](https://www.npmjs.com/package/@pdfsmaller/pdf-encrypt)
  and AES-256 if you need the full Unicode range.
- `encodePasswordLegacy()` is exported for callers that want to validate a password
  before use.
- TypeScript declarations for all of the above.

### Behaviour changes

`encryptPDF()` now throws for inputs it previously accepted and silently mangled:
already-encrypted PDFs, and passwords containing characters outside
PDFDocEncoding. ASCII passwords are byte-identical to 1.0.x.

### A note on the version number

Strict SemVer would call this a major bump: `encryptPDF()` now throws for inputs
1.0.x accepted. It is released as a minor deliberately, because in 1.0.x those
same calls returned a **silently corrupted PDF** — nothing that genuinely worked
has broken. Shipping it as a minor means existing `^1.0.x` dependents pick the
fix up on their next install instead of staying on a version that corrupts every
PDF containing literal strings.

If you pin exact versions, upgrade explicitly.

### Size

Now ~9KB rather than ~7KB, from the PDFDocEncoding table and the string escaping.
Documented size claims were updated to match.

### Internal

- The ESM build now points its relative imports at the `.mjs` siblings instead of
  the CommonJS `.js` files, rather than relying on Node's CJS-interop detection.

## 1.0.2

- Repository metadata and build-script fixes.
