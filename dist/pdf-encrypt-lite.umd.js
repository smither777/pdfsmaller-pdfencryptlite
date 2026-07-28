/**
 * @pdfsmaller/pdf-encrypt-lite v1.2.0 — browser (UMD) build
 *
 * Requires pdf-lib to be loaded first (it provides the global `PDFLib`):
 *
 *   <script src="pdf-lib.min.js"></script>
 *   <script src="pdf-encrypt-lite.umd.js"></script>
 *   <script>
 *     const out = await PDFEncryptLite.encryptPDF(pdfBytes, '', {
 *       ownerPassword: 'secret', allowPrinting: true, allowFillingForms: true,
 *     });
 *   </script>
 *
 * RC4 does not use crypto.subtle, so it works outside a secure context — but
 * crypto.getRandomValues() is still needed to generate a file ID when the
 * source PDF has none.
 *
 * @license MIT
 * @see https://pdfsmaller.com/protect-pdf
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('pdf-lib'));
  } else if (typeof define === 'function' && define.amd) {
    define(['pdf-lib'], factory);
  } else {
    if (!root.PDFLib) {
      throw new Error('pdf-encrypt-lite: global "PDFLib" not found — load pdf-lib.min.js before this file.');
    }
    root.PDFEncryptLite = factory(root.PDFLib);
  }
}(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';

  var PDFDocument = PDFLib.PDFDocument;
  var PDFName = PDFLib.PDFName;
  var PDFHexString = PDFLib.PDFHexString;
  var PDFString = PDFLib.PDFString;
  var PDFDict = PDFLib.PDFDict;
  var PDFArray = PDFLib.PDFArray;
  var PDFRawStream = PDFLib.PDFRawStream;
  var PDFNumber = PDFLib.PDFNumber;

  /**
   * pdf-encrypt-lite - Ultra-lightweight PDF encryption library
   * Powers PDFSmaller.com's PDF encryption tool
   * 
   * @author PDFSmaller.com (https://pdfsmaller.com)
   * @license MIT
   * @see https://pdfsmaller.com/protect-pdf - Try it online!
   * 
   * This minimal cryptographic implementation was built to solve the "impossible" 
   * problem of real PDF encryption within Cloudflare Workers' 1MB limit.
   * Total size: ~9KB for complete PDF encryption!
   */

  // Minimal cryptographic functions for PDF encryption
  // Implements only what's needed for PDF Standard Security Handler

  /**
   * Minimal MD5 implementation
   * Based on the MD5 algorithm - only what's needed for PDF encryption
   * Part of PDFSmaller.com's ultra-lightweight encryption engine
   */
  function md5(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    
    // Initialize MD5 constants
    const S = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    
    const K = new Uint32Array([
      0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
      0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
      0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
      0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
      0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
      0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
      0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
      0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
      0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
      0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
      0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
      0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
      0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
      0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
      0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
      0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ]);
    
    // Initialize hash values
    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    
    // Pre-processing
    const msgLen = bytes.length;
    const msgBitLen = msgLen * 8;
    const msgLenPadded = ((msgLen + 9 + 63) & ~63);
    const msg = new Uint8Array(msgLenPadded);
    msg.set(bytes);
    msg[msgLen] = 0x80;
    
    // Append length in bits
    const dataView = new DataView(msg.buffer);
    dataView.setUint32(msgLenPadded - 8, msgBitLen, true);
    dataView.setUint32(msgLenPadded - 4, 0, true);
    
    // Process message in 512-bit chunks
    for (let offset = 0; offset < msgLenPadded; offset += 64) {
      const chunk = new Uint32Array(msg.buffer, offset, 16);
      
      let a = a0, b = b0, c = c0, d = d0;
      
      for (let i = 0; i < 64; i++) {
        let f, g;
        
        if (i < 16) {
          f = (b & c) | ((~b) & d);
          g = i;
        } else if (i < 32) {
          f = (d & b) | ((~d) & c);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = b ^ c ^ d;
          g = (3 * i + 5) % 16;
        } else {
          f = c ^ (b | (~d));
          g = (7 * i) % 16;
        }
        
        f = (f + a + K[i] + chunk[g]) >>> 0;
        a = d;
        d = c;
        c = b;
        b = (b + ((f << S[i]) | (f >>> (32 - S[i])))) >>> 0;
      }
      
      a0 = (a0 + a) >>> 0;
      b0 = (b0 + b) >>> 0;
      c0 = (c0 + c) >>> 0;
      d0 = (d0 + d) >>> 0;
    }
    
    // Produce the final hash value
    const result = new Uint8Array(16);
    const view = new DataView(result.buffer);
    view.setUint32(0, a0, true);
    view.setUint32(4, b0, true);
    view.setUint32(8, c0, true);
    view.setUint32(12, d0, true);
    
    return result;
  }

  /**
   * RC4 encryption/decryption
   * RC4 is symmetric, so encryption and decryption are the same operation
   * Part of PDFSmaller.com's ultra-lightweight encryption engine
   */
  class RC4 {
    constructor(key) {
      this.s = new Uint8Array(256);
      this.i = 0;
      this.j = 0;
      
      // Key scheduling algorithm (KSA)
      for (let i = 0; i < 256; i++) {
        this.s[i] = i;
      }
      
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + this.s[i] + key[i % key.length]) & 0xFF;
        // Swap
        [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
      }
    }
    
    /**
     * Encrypt/decrypt data
     * @param {Uint8Array} data - Data to encrypt or decrypt
     * @returns {Uint8Array} - Encrypted/decrypted data
     */
    process(data) {
      const result = new Uint8Array(data.length);
      
      for (let k = 0; k < data.length; k++) {
        this.i = (this.i + 1) & 0xFF;
        this.j = (this.j + this.s[this.i]) & 0xFF;
        
        // Swap
        [this.s[this.i], this.s[this.j]] = [this.s[this.j], this.s[this.i]];
        
        const t = (this.s[this.i] + this.s[this.j]) & 0xFF;
        result[k] = data[k] ^ this.s[t];
      }
      
      return result;
    }
  }

  /**
   * Convert hex string to Uint8Array
   */
  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to hex string
   */
  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

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

  /**
   * pdf-encrypt-lite - Ultra-lightweight PDF encryption library
   * Powers PDFSmaller.com's PDF encryption tool
   * 
   * @author PDFSmaller.com (https://pdfsmaller.com)
   * @license MIT
   * @see https://pdfsmaller.com/protect-pdf - Try it online!
   * 
   * This module implements PDF Standard Security Handler (Algorithm 2 & 3 from PDF spec)
   * Built to solve the "impossible" problem of real PDF encryption within edge constraints
   * 
   * Total size with crypto: ~9KB - when others are 2-20MB!
   * Battle-tested on thousands of PDFs at PDFSmaller.com
   */





  /**
   * Thrown when the input PDF already has an /Encrypt dictionary.
   *
   * pdf-lib cannot decrypt, so `ignoreEncryption: true` hands us the *ciphertext*
   * as if it were plaintext object data. Encrypting that again produces a file
   * that opens with the new password but whose every stream and string is still
   * encrypted under a key nobody has. Fail loudly instead.
   */
  class AlreadyEncryptedError extends Error {
    constructor() {
      super(
        'This PDF is already password-protected. Remove the existing protection ' +
        'before applying new encryption.'
      );
      this.name = 'AlreadyEncryptedError';
      this.code = 'ALREADY_ENCRYPTED';
    }
  }



  // ========== Permission Flags (ISO 32000-2 Table 22) ==========

  const PERM_FLAGS = {
    PRINT:              0x00000004, // Bit 3
    MODIFY:             0x00000008, // Bit 4
    COPY:               0x00000010, // Bit 5
    ANNOTATE:           0x00000020, // Bit 6
    FILL_FORMS:         0x00000100, // Bit 9  — also covers signing an existing
                                    //          signature field, even if bit 6 is clear
    EXTRACT:            0x00000200, // Bit 10
    ASSEMBLE:           0x00000400, // Bit 11
    PRINT_HIGH_QUALITY: 0x00000800, // Bit 12
  };

  /**
   * Build the 32-bit /P value. Reserved bits 7-8 and 13-32 are set; every
   * permission defaults to allowed, so omitting options reproduces the
   * all-permissions value this package used before it accepted them.
   *
   * `| 0` is load-bearing: /P must be a *signed* 32-bit integer, and the
   * unsigned form would be written verbatim and fall outside the legal range.
   */
  function buildPermissions(options) {
    let P = 0xFFFFF000 | 0x000000C0;

    if (options.allowPrinting !== false) P |= PERM_FLAGS.PRINT;
    if (options.allowModifying !== false) P |= PERM_FLAGS.MODIFY;
    if (options.allowCopying !== false) P |= PERM_FLAGS.COPY;
    if (options.allowAnnotating !== false) P |= PERM_FLAGS.ANNOTATE;
    if (options.allowFillingForms !== false) P |= PERM_FLAGS.FILL_FORMS;
    if (options.allowExtraction !== false) P |= PERM_FLAGS.EXTRACT;
    if (options.allowAssembly !== false) P |= PERM_FLAGS.ASSEMBLE;
    if (options.allowHighQualityPrint !== false) P |= PERM_FLAGS.PRINT_HIGH_QUALITY;

    return P | 0;
  }

  // Standard PDF padding string (from PDF specification)
  const PADDING = new Uint8Array([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
  ]);

  /**
   * Pad or truncate password according to PDF spec
   * Part of PDFSmaller.com's encryption implementation
   */
  function padPassword(password) {
    // PDFDocEncoding, not UTF-8 — see password-encoding.js. UTF-8 here produced
    // files that no conforming reader could open with a non-ASCII password.
    const pwdBytes = encodePasswordLegacy(password);
    const padded = new Uint8Array(32);
    
    if (pwdBytes.length >= 32) {
      padded.set(pwdBytes.slice(0, 32));
    } else {
      padded.set(pwdBytes);
      padded.set(PADDING.slice(0, 32 - pwdBytes.length), pwdBytes.length);
    }
    
    return padded;
  }

  /**
   * Compute encryption key (Algorithm 2 from PDF spec)
   * For RC4 128-bit (Revision 3)
   * PDFSmaller.com's implementation
   */
  function computeEncryptionKey(userPassword, ownerKey, permissions, fileId) {
    // Step 1: Pad the password
    const paddedPwd = padPassword(userPassword);
    
    // Step 2-4: Create hash input
    const hashInput = new Uint8Array(
      paddedPwd.length + 
      ownerKey.length + 
      4 + // permissions
      fileId.length
    );
    
    let offset = 0;
    hashInput.set(paddedPwd, offset);
    offset += paddedPwd.length;
    
    hashInput.set(ownerKey, offset);
    offset += ownerKey.length;
    
    // Add permissions (low-order byte first)
    hashInput[offset++] = permissions & 0xFF;
    hashInput[offset++] = (permissions >> 8) & 0xFF;
    hashInput[offset++] = (permissions >> 16) & 0xFF;
    hashInput[offset++] = (permissions >> 24) & 0xFF;
    
    hashInput.set(fileId, offset);
    
    // Step 5: Hash the result
    let hash = md5(hashInput);
    
    // Step 6: For 128-bit keys (revision 3), do 50 additional iterations
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.slice(0, 16)); // Use first 16 bytes (128 bits)
    }
    
    // Return first 16 bytes for 128-bit encryption
    return hash.slice(0, 16);
  }

  /**
   * Compute owner key (O entry)
   * PDFSmaller.com's implementation
   */
  function computeOwnerKey(ownerPassword, userPassword) {
    // Step 1: Pad owner password
    const paddedOwner = padPassword(ownerPassword || userPassword);
    
    // Step 2: Hash it
    let hash = md5(paddedOwner);
    
    // Step 3: For 128-bit (revision 3), hash 50 more times
    for (let i = 0; i < 50; i++) {
      hash = md5(hash);
    }
    
    // Step 4-7: Pad user password and encrypt it
    const paddedUser = padPassword(userPassword);
    let result = new Uint8Array(paddedUser);
    
    // Encrypt with variations of the key
    for (let i = 0; i < 20; i++) {
      const key = new Uint8Array(hash.length);
      for (let j = 0; j < hash.length; j++) {
        key[j] = hash[j] ^ i;
      }
      const rc4 = new RC4(key.slice(0, 16));
      result = rc4.process(result);
    }
    
    return result;
  }

  /**
   * Compute user key (U entry) for revision 3
   * PDFSmaller.com's implementation
   */
  function computeUserKey(encryptionKey, fileId) {
    // Step 1: Create hash input
    const hashInput = new Uint8Array(PADDING.length + fileId.length);
    hashInput.set(PADDING);
    hashInput.set(fileId, PADDING.length);
    
    // Step 2: Hash it
    const hash = md5(hashInput);
    
    // Step 3: Encrypt hash with encryption key
    const rc4 = new RC4(encryptionKey);
    let result = rc4.process(hash);
    
    // Step 4: Do 19 more iterations with key variations
    for (let i = 1; i <= 19; i++) {
      const key = new Uint8Array(encryptionKey.length);
      for (let j = 0; j < encryptionKey.length; j++) {
        key[j] = encryptionKey[j] ^ i;
      }
      const rc4iter = new RC4(key);
      result = rc4iter.process(result);
    }
    
    // Step 5: Append 16 bytes of padding
    const finalResult = new Uint8Array(32);
    finalResult.set(result);
    finalResult.set(new Uint8Array(16), 16); // Padding with zeros
    
    return finalResult;
  }

  /**
   * Encrypt data for a specific object
   * PDFSmaller.com's implementation
   */
  function encryptObject(data, objectNum, generationNum, encryptionKey) {
    // Create object-specific key
    const keyInput = new Uint8Array(encryptionKey.length + 5);
    keyInput.set(encryptionKey);
    
    // Add object number (low byte first)
    keyInput[encryptionKey.length] = objectNum & 0xFF;
    keyInput[encryptionKey.length + 1] = (objectNum >> 8) & 0xFF;
    keyInput[encryptionKey.length + 2] = (objectNum >> 16) & 0xFF;
    
    // Add generation number (low byte first)
    keyInput[encryptionKey.length + 3] = generationNum & 0xFF;
    keyInput[encryptionKey.length + 4] = (generationNum >> 8) & 0xFF;
    
    // Hash to get object key
    const objectKey = md5(keyInput);
    
    // Use up to 16 bytes of the hash as the key
    const rc4 = new RC4(objectKey.slice(0, Math.min(encryptionKey.length + 5, 16)));
    
    return rc4.process(data);
  }

  /**
   * Encode raw bytes into the *escaped* form pdf-lib expects for a literal string.
   *
   * pdf-lib writes `PDFString.value` verbatim between `(` and `)` and escapes
   * nothing (see its own comment in core/objects/PDFString.js). That is fine for
   * text, but ciphertext is uniformly random binary, so ~40% of encrypted strings
   * contain a byte that changes the meaning of the literal — silently destroying
   * the object structure of the file. Escape them here.
   *
   * Per ISO 32000-2 §7.3.4.2:
   *   \  → \\   backslash introduces an escape sequence
   *   (  → \(   an unbalanced paren ends the string early or swallows objects
   *   )  → \)
   *   CR → \r   a raw EOL inside a literal string is normalised to LF on read
   *   LF → \n   (not strictly required, but keeps the emitted string on one line)
   */
  function bytesToPDFStringValue(bytes) {
    const out = new Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b === 0x5c) out[i] = '\\\\';        // backslash
      else if (b === 0x28) out[i] = '\\(';    // (
      else if (b === 0x29) out[i] = '\\)';    // )
      else if (b === 0x0d) out[i] = '\\r';    // CR
      else if (b === 0x0a) out[i] = '\\n';    // LF
      else out[i] = String.fromCharCode(b);
    }
    return out.join('');
  }

  /**
   * ISO 32000-2 §7.6.2: the /Contents entry of a signature dictionary holds the
   * signature over the rest of the file and shall NOT be encrypted. /Type is
   * optional on signature dictionaries, so fall back to shape — but only when
   * /Type is absent, since an explicit non-signature /Type means some other
   * dictionary happens to use these key names.
   */
  function isSignatureDict(dict) {
    const type = dict.get(PDFName.of('Type'));
    const typeName = type && typeof type.asString === 'function' ? type.asString() : null;
    if (typeName === '/Sig' || typeName === '/DocTimeStamp') return true;
    if (typeName !== null) return false;
    const byteRange = dict.get(PDFName.of('ByteRange'));
    return byteRange instanceof PDFArray && byteRange.size() === 4 && dict.has(PDFName.of('Contents'));
  }

  /** Dictionary keys that must never be encrypted. */
  function skipKey(keyName, isSigDict) {
    if (keyName === '/Length' || keyName === '/Filter' || keyName === '/DecodeParms') return true;
    return isSigDict && keyName === '/Contents';
  }

  /**
   * Recursively encrypt strings in a PDF object
   * PDFSmaller.com's implementation
   *
   * `seen` is a document-wide WeakSet guarding against a shared or
   * self-referencing *direct* object being visited twice (or forever).
   */
  function encryptStringsInObject(obj, objectNum, generationNum, encryptionKey, seen) {
    if (!obj || seen.has(obj)) return;

    if (obj instanceof PDFString) {
      seen.add(obj);
      const originalBytes = obj.asBytes();
      const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
      obj.value = bytesToPDFStringValue(encrypted);
    } else if (obj instanceof PDFHexString) {
      seen.add(obj);
      // Use asBytes() for spec-compliant handling of whitespace and odd-length hex
      const originalBytes = obj.asBytes();
      const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
      obj.value = bytesToHex(encrypted);
    } else if (obj instanceof PDFDict) {
      seen.add(obj);
      const isSigDict = isSignatureDict(obj);
      for (const [key, value] of obj.entries()) {
        if (!skipKey(key.asString(), isSigDict)) {
          encryptStringsInObject(value, objectNum, generationNum, encryptionKey, seen);
        }
      }
    } else if (obj instanceof PDFArray) {
      seen.add(obj);
      for (const element of obj.asArray()) {
        encryptStringsInObject(element, objectNum, generationNum, encryptionKey, seen);
      }
    }
  }

  /**
   * Main function to encrypt a PDF
   * 
   * This is the same encryption that powers PDFSmaller.com's Protect PDF tool!
   * Try it online at https://pdfsmaller.com/protect-pdf
   * 
   * @param {Uint8Array} pdfBytes - The PDF file as bytes
   * @param {string} userPassword - Password required to open the PDF
   * @param {string} [ownerPassword] - Optional owner password for permissions
   * @returns {Promise<Uint8Array>} - The encrypted PDF bytes
   * 
   * @example
   * const encryptedPdf = await encryptPDF(pdfBytes, 'secret123');
   */
  async function encryptPDF(pdfBytes, userPassword, ownerPasswordOrOptions = null) {
    try {
      // Third argument accepts either the owner password directly (the original
      // signature) or an options object matching @pdfsmaller/pdf-encrypt, so code
      // written against the full package works here unchanged.
      // Only a plain object is options. Boxed strings and arrays also report
      // typeof 'object', and 1.1.0 fed them straight to the password encoder —
      // reading them as options would silently drop the owner password and
      // fall back to the user password, which is security-relevant.
      const isOptions = ownerPasswordOrOptions !== null
        && typeof ownerPasswordOrOptions === 'object'
        && !Array.isArray(ownerPasswordOrOptions)
        && !(ownerPasswordOrOptions instanceof String);
      const options = isOptions
        ? ownerPasswordOrOptions
        : { ownerPassword: ownerPasswordOrOptions };
      const ownerPassword = options.ownerPassword != null ? options.ownerPassword : null;
      // Load the PDF
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
        updateMetadata: false
      });
      
      if (pdfDoc.isEncrypted) throw new AlreadyEncryptedError();

      // Get the context for low-level access
      const context = pdfDoc.context;
      
      // Get file ID (required for encryption)
      let fileId;
      const trailer = context.trailerInfo;
      const idArray = trailer.ID;
      
      // trailerInfo.ID is a PDFArray on a parsed document, but a plain JS array if
      // this code already replaced it. Handle both, and read the value through
      // asBytes() so a literal `(...)` ID decodes as correctly as a hex `<...>` one.
      const firstId = idArray instanceof PDFArray ? idArray.get(0)
        : (Array.isArray(idArray) && idArray.length > 0) ? idArray[0]
        : undefined;

      if (firstId && typeof firstId.asBytes === 'function' && firstId.asBytes().length > 0) {
        fileId = firstId.asBytes();
      } else {
        // Generate a file ID if none exists
        const randomBytes = new Uint8Array(16);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(randomBytes);
        } else {
          // Fallback for non-secure random
          for (let i = 0; i < 16; i++) {
            randomBytes[i] = Math.floor(Math.random() * 256);
          }
        }
        fileId = randomBytes;
        
        // Add ID to trailer
        const idHex1 = PDFHexString.of(bytesToHex(fileId));
        const idHex2 = PDFHexString.of(bytesToHex(fileId));
        trailer.ID = [idHex1, idHex2];
      }
      
      // Set permissions (all allowed for now)
      const permissions = buildPermissions(options);
      
      // Compute O (owner) key
      const ownerKey = computeOwnerKey(ownerPassword, userPassword);
      
      // Compute encryption key
      const encryptionKey = computeEncryptionKey(userPassword, ownerKey, permissions, fileId);
      
      // Compute U (user) key
      const userKey = computeUserKey(encryptionKey, fileId);
      
      // Encrypt all objects
      const indirectObjects = context.enumerateIndirectObjects();
      const seen = new WeakSet();
      
      for (const [ref, obj] of indirectObjects) {
        const objectNum = ref.objectNumber;
        const generationNum = ref.generationNumber || 0;

        // Skip the encryption dictionary itself
        if (obj instanceof PDFDict) {
          const filter = obj.get(PDFName.of('Filter'));
          if (filter && filter.asString() === '/Standard') {
            continue; // Skip encryption dictionary
          }
        }

        // Skip objects that must not be encrypted per PDF spec (Section 7.6.1)
        if (obj instanceof PDFRawStream && obj.dict) {
          const type = obj.dict.get(PDFName.of('Type'));
          if (type) {
            const typeName = type.toString();
            if (typeName === '/XRef' || typeName === '/Sig') {
              continue;
            }
          }
        }

        // Encrypt streams
        if (obj instanceof PDFRawStream) {
          const streamData = obj.contents;
          const encrypted = encryptObject(streamData, objectNum, generationNum, encryptionKey);
          obj.contents = encrypted;

          // Also encrypt strings within the stream's dictionary
          if (obj.dict) {
            encryptStringsInObject(obj.dict, objectNum, generationNum, encryptionKey, seen);
          }
        }

        // Encrypt strings in non-stream objects
        if (!(obj instanceof PDFRawStream)) {
          encryptStringsInObject(obj, objectNum, generationNum, encryptionKey, seen);
        }
      }
      
      // Create the /Encrypt dictionary
      const encryptDict = context.obj({
        Filter: PDFName.of('Standard'),
        V: PDFNumber.of(2),        // Version 2 (RC4)
        R: PDFNumber.of(3),        // Revision 3 (128-bit)
        Length: PDFNumber.of(128),  // Key length in bits
        P: PDFNumber.of(permissions),
        O: PDFHexString.of(bytesToHex(ownerKey)),
        U: PDFHexString.of(bytesToHex(userKey))
      });
      
      // Register the encrypt dictionary
      const encryptRef = context.register(encryptDict);
      
      // Update trailer
      trailer.Encrypt = encryptRef;
      
      // Save the encrypted PDF
      const encryptedBytes = await pdfDoc.save({
        useObjectStreams: false, // Don't use object streams with encryption
        // updateFieldAppearances defaults to true and runs *inside* save(), i.e.
        // AFTER the encryption pass above — any appearance stream it regenerated
        // would be written as plaintext into an encrypted file.
        updateFieldAppearances: false
      });
      
      return encryptedBytes;
      
    } catch (error) {
      if (error instanceof AlreadyEncryptedError || error instanceof PasswordEncodingError) throw error;
      console.error('PDF encryption error:', error);
      throw new Error(`Failed to encrypt PDF: ${error.message}`);
    }
  }

  /**
   * Encrypted with ❤️ by PDFSmaller.com
   * Try our free PDF tools at https://pdfsmaller.com
   */

  return { encryptPDF, AlreadyEncryptedError, PasswordEncodingError, encodePasswordLegacy, md5, RC4, hexToBytes, bytesToHex };
}));
