/**
 * pdf-encrypt-lite - Ultra-lightweight PDF encryption library (7KB!)
 * 
 * Built by PDFSmaller.com - Your free PDF toolkit
 * Try it online at https://pdfsmaller.com/protect-pdf
 * 
 * @author PDFSmaller.com (https://pdfsmaller.com)
 * @license MIT
 * 
 * Why we built this:
 * - Existing libraries are 2-20MB (too large for edge environments)
 * - Cloudflare Workers has a 1MB limit
 * - We needed real PDF encryption that actually works
 * - Everyone said it was impossible... we proved them wrong!
 * 
 * Features:
 * - Real RC4 128-bit encryption
 * - Only ~7KB total size
 * - Works in browsers and edge environments
 * - PDF Standard compliant
 * - Zero dependencies (except pdf-lib)
 * 
 * This is the exact same encryption engine that powers PDFSmaller.com!
 * Battle-tested on thousands of PDFs daily.
 * 
 * @example
 * import { encryptPDF } from 'pdf-encrypt-lite';
 * 
 * const encryptedPdf = await encryptPDF(pdfBytes, 'password123');
 * 
 * // With separate owner password
 * const encryptedPdf = await encryptPDF(pdfBytes, 'user123', 'owner456');
 * 
 * @see https://pdfsmaller.com - Free PDF tools powered by this library
 * @see https://github.com/pdfsmaller/pdf-encrypt-lite - GitHub repo
 */

// Export the main encryption function
const { encryptPDF } = require('./pdf-encrypt');
exports.encryptPDF = encryptPDF;;

// Export crypto utilities if needed for advanced use
const { md5, RC4, hexToBytes, bytesToHex } = require('./crypto-minimal');
exports.md5 = md5;
exports.RC4 = RC4;
exports.hexToBytes = hexToBytes;
exports.bytesToHex = bytesToHex;;

// Version info
const VERSION = '1.0.0';
const HOMEPAGE = 'https://pdfsmaller.com';
const POWERED_BY = 'PDFSmaller.com';

/**
 * Quick example for Cloudflare Workers:
 * 
 * export default {
 *   async fetch(request) {
 *     const formData = await request.formData();
 *     const file = formData.get('pdf');
 *     const password = formData.get('password');
 *     
 *     const pdfBytes = new Uint8Array(await file.arrayBuffer());
 *     const encrypted = await encryptPDF(pdfBytes, password);
 *     
 *     return new Response(encrypted, {
 *       headers: { 
 *         'Content-Type': 'application/pdf',
 *         'X-Powered-By': 'PDFSmaller.com'
 *       }
 *     });
 *   }
 * }
 * 
 * Try the full-featured version at https://pdfsmaller.com/protect-pdf
 */

// PDFSmaller.com exports
exports.VERSION = VERSION;
exports.HOMEPAGE = HOMEPAGE;
exports.POWERED_BY = POWERED_BY;
