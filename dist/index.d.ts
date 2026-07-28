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
export interface EncryptPDFOptions {
  ownerPassword?: string | null;
  /** Allow printing. Default true. */
  allowPrinting?: boolean;
  /** Allow document modification. Default true. */
  allowModifying?: boolean;
  /** Allow copying text and images. Default true. */
  allowCopying?: boolean;
  /** Allow annotations and markup. Default true. */
  allowAnnotating?: boolean;
  /**
   * Allow filling existing form fields — including signing an existing
   * signature field (ISO 32000-2 Table 22, bit 9, which applies even when
   * allowAnnotating is false). Default true.
   */
  allowFillingForms?: boolean;
  /** Allow accessibility text extraction. Default true. */
  allowExtraction?: boolean;
  /** Allow page insert/rotate/delete. Default true. */
  allowAssembly?: boolean;
  /** Allow full-resolution printing. Default true. */
  allowHighQualityPrint?: boolean;
}

/**
 * Encrypt a PDF with RC4 128-bit.
 *
 * The third argument accepts either the owner password directly (original
 * signature) or an options object matching @pdfsmaller/pdf-encrypt.
 *
 * Passing an empty string as userPassword produces a PDF that opens without a
 * prompt but still declares its permissions.
 */
export function encryptPDF(
  pdfBytes: Uint8Array, 
  userPassword: string, 
  ownerPasswordOrOptions?: string | null | EncryptPDFOptions
): Promise<Uint8Array>;

/** Thrown when the input PDF already has an /Encrypt dictionary. */
export class AlreadyEncryptedError extends Error {
  readonly name: 'AlreadyEncryptedError';
  readonly code: 'ALREADY_ENCRYPTED';
}

/** Thrown when a password cannot be encoded for the legacy security handler. */
export class PasswordEncodingError extends Error {
  readonly name: 'PasswordEncodingError';
  readonly code: 'UNSUPPORTED_PASSWORD_CHARACTER';
}

/**
 * Encode a password as PDFDocEncoding, as the R<=4 security handler requires.
 * @throws {PasswordEncodingError} for characters outside PDFDocEncoding.
 */
export function encodePasswordLegacy(password: string): Uint8Array;

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
