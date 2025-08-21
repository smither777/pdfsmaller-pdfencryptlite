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
 * Total size with crypto: ~7KB - when others are 2-20MB!
 * Battle-tested on thousands of PDFs at PDFSmaller.com
 */

import { PDFDocument, PDFName, PDFHexString, PDFString, PDFDict, PDFArray, PDFRawStream, PDFNumber } from 'pdf-lib';
import { md5, RC4, hexToBytes, bytesToHex } from './crypto-minimal.js';

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
  const pwdBytes = new TextEncoder().encode(password);
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
 * Recursively encrypt strings in a PDF object
 * PDFSmaller.com's implementation
 */
function encryptStringsInObject(obj, objectNum, generationNum, encryptionKey) {
  if (!obj) return;
  
  if (obj instanceof PDFString) {
    const originalBytes = obj.asBytes();
    const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
    // Replace the string's value with encrypted hex
    obj.value = bytesToHex(encrypted);
  } else if (obj instanceof PDFHexString) {
    const originalBytes = hexToBytes(obj.asString());
    const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
    obj.value = bytesToHex(encrypted);
  } else if (obj instanceof PDFDict) {
    // Don't encrypt certain dictionary entries
    const entries = obj.entries();
    for (const [key, value] of entries) {
      const keyName = key.asString();
      // Skip encryption-related entries
      if (keyName !== '/Length' && keyName !== '/Filter' && keyName !== '/DecodeParms') {
        encryptStringsInObject(value, objectNum, generationNum, encryptionKey);
      }
    }
  } else if (obj instanceof PDFArray) {
    const array = obj.asArray();
    for (const element of array) {
      encryptStringsInObject(element, objectNum, generationNum, encryptionKey);
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
export async function encryptPDF(pdfBytes, userPassword, ownerPassword = null) {
  try {
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    
    // Get the context for low-level access
    const context = pdfDoc.context;
    
    // Get file ID (required for encryption)
    let fileId;
    const trailer = context.trailerInfo;
    const idArray = trailer.ID;
    
    if (idArray && Array.isArray(idArray) && idArray.length > 0) {
      // Extract hex string and convert to bytes
      const idString = idArray[0].toString();
      // Remove angle brackets if present
      const hexStr = idString.replace(/^<|>$/g, '');
      fileId = hexToBytes(hexStr);
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
    const permissions = 0xFFFFFFFC; // -4 in signed 32-bit
    
    // Compute O (owner) key
    const ownerKey = computeOwnerKey(ownerPassword, userPassword);
    
    // Compute encryption key
    const encryptionKey = computeEncryptionKey(userPassword, ownerKey, permissions, fileId);
    
    // Compute U (user) key
    const userKey = computeUserKey(encryptionKey, fileId);
    
    // Encrypt all objects
    const indirectObjects = context.enumerateIndirectObjects();
    
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
      
      // Encrypt streams
      if (obj instanceof PDFRawStream) {
        const streamData = obj.contents;
        const encrypted = encryptObject(streamData, objectNum, generationNum, encryptionKey);
        obj.contents = encrypted;
      }
      
      // Encrypt strings in the object
      encryptStringsInObject(obj, objectNum, generationNum, encryptionKey);
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
      useObjectStreams: false // Don't use object streams with encryption
    });
    
    return encryptedBytes;
    
  } catch (error) {
    console.error('PDF encryption error:', error);
    throw new Error(`Failed to encrypt PDF: ${error.message}`);
  }
}

/**
 * Encrypted with ❤️ by PDFSmaller.com
 * Try our free PDF tools at https://pdfsmaller.com
 */