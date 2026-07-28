/**
 * Password encoding for the legacy PDF standard security handler (R = 2/3/4).
 *
 * ISO 32000-2 §7.6.4.3.2, NOTE 1: the password is converted to PDFDocEncoding
 * before padding — one byte per character, not UTF-8. Using UTF-8 produces a
 * file whose password this library accepts but Acrobat, pdf.js and qpdf all
 * reject, because they derive a different key from the same typed password.
 *
 * ASCII passwords encode identically either way, so this only changes
 * behaviour for accented and non-Latin input.
 *
 * (The AES-256 handler uses SASLprep + UTF-8 instead — see the full
 * @pdfsmaller/pdf-encrypt package, which supports both.)
 */

/**
 * Code points where PDFDocEncoding differs from Latin-1 (ISO 32000-2 Table
 * D.2). Byte values not listed map to the identical code point. Entries set to
 * -1 are unused in PDFDocEncoding and cannot be produced by the encoder.
 */
const PDFDOC_DIFFS = {
  0x16: 0x0017, 0x18: 0x02d8, 0x19: 0x02c7, 0x1a: 0x02c6, 0x1b: 0x02d9,
  0x1c: 0x02dd, 0x1d: 0x02db, 0x1e: 0x02da, 0x1f: 0x02dc, 0x7f: -1,
  0x80: 0x2022, 0x81: 0x2020, 0x82: 0x2021, 0x83: 0x2026, 0x84: 0x2014,
  0x85: 0x2013, 0x86: 0x0192, 0x87: 0x2044, 0x88: 0x2039, 0x89: 0x203a,
  0x8a: 0x2212, 0x8b: 0x2030, 0x8c: 0x201e, 0x8d: 0x201c, 0x8e: 0x201d,
  0x8f: 0x2018, 0x90: 0x2019, 0x91: 0x201a, 0x92: 0x2122, 0x93: 0xfb01,
  0x94: 0xfb02, 0x95: 0x0141, 0x96: 0x0152, 0x97: 0x0160, 0x98: 0x0178,
  0x99: 0x017d, 0x9a: 0x0131, 0x9b: 0x0142, 0x9c: 0x0153, 0x9d: 0x0161,
  0x9e: 0x017e, 0x9f: -1, 0xa0: 0x20ac, 0xad: -1,
};

/**
 * Unicode code point → PDFDocEncoding byte.
 *
 * The forward table is not injective: 0x16 is defined as U+0017 while 0x17
 * maps to U+0017 by identity. Where that happens the identity mapping wins, so
 * this stays a true inverse of a decoder for every character one can produce.
 */
const UNICODE_TO_PDFDOC = (() => {
  const map = new Map();
  for (let byte = 0; byte < 256; byte++) {
    const cp = byte in PDFDOC_DIFFS ? PDFDOC_DIFFS[byte] : byte;
    if (cp < 0) continue;              // undefined slot
    if (map.get(cp) === cp) continue;  // identity already claimed it
    map.set(cp, byte);
  }
  return map;
})();

class PasswordEncodingError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PasswordEncodingError';
    this.code = code;
  }
}

/**
 * Encode a password as PDFDocEncoding.
 *
 * Characters outside PDFDocEncoding "shall not be used in a password" per the
 * spec, so they are rejected rather than silently producing a file that cannot
 * be opened again.
 */
function encodePasswordLegacy(password) {
  const bytes = [];
  for (const char of password) {
    const byte = UNICODE_TO_PDFDOC.get(char.codePointAt(0));
    if (byte === undefined) {
      throw new PasswordEncodingError(
        `The character "${char}" cannot be used in an RC4 password — the legacy ` +
        `PDF security handler only supports the PDFDocEncoding character set. ` +
        `Use AES-256 (see @pdfsmaller/pdf-encrypt) for full Unicode support.`,
        'UNSUPPORTED_PASSWORD_CHARACTER'
      );
    }
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}


// PDFSmaller.com exports
exports.encodePasswordLegacy = encodePasswordLegacy;
exports.PasswordEncodingError = PasswordEncodingError;
