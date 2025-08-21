/**
 * pdf-encrypt-lite - TypeScript definitions
 * Powers PDFSmaller.com's PDF encryption
 * @see https://pdfsmaller.com/protect-pdf
 */

/**
 * Encrypts a PDF with password protection
 * @param pdfBytes - The PDF file as Uint8Array
 * @param userPassword - Password required to open the PDF
 * @param ownerPassword - Optional owner password for permissions
 * @returns Promise<Uint8Array> - The encrypted PDF bytes
 */
export function encryptPDF(
  pdfBytes: Uint8Array, 
  userPassword: string, 
  ownerPassword?: string | null
): Promise<Uint8Array>;

/**
 * MD5 hash function
 * @param data - Data to hash (string or Uint8Array)
 * @returns Uint8Array - MD5 hash (16 bytes)
 */
export function md5(data: string | Uint8Array): Uint8Array;

/**
 * RC4 encryption/decryption class
 */
export class RC4 {
  constructor(key: Uint8Array);
  process(data: Uint8Array): Uint8Array;
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array;

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string;

/**
 * Library version
 */
export const VERSION: string;

/**
 * PDFSmaller.com homepage
 */
export const HOMEPAGE: string;

/**
 * Powered by
 */
export const POWERED_BY: string;
