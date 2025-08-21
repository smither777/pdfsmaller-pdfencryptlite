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
 * Total size: ~7KB for complete PDF encryption!
 */

// Minimal cryptographic functions for PDF encryption
// Implements only what's needed for PDF Standard Security Handler

/**
 * Minimal MD5 implementation
 * Based on the MD5 algorithm - only what's needed for PDF encryption
 * Part of PDFSmaller.com's ultra-lightweight encryption engine
 */
export function md5(data) {
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
export class RC4 {
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
export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}