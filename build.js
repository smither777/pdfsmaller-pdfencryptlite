/**
 * Simple build script for pdf-encrypt-lite
 * Creates CommonJS and ES module builds
 */

const fs = require('fs');
const path = require('path');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Copy source files to dist (ES modules)
const srcFiles = ['index.js', 'pdf-encrypt.js', 'crypto-minimal.js', 'password-encoding.js'];

const PKG_VERSION = require('./package.json').version;

srcFiles.forEach(file => {
  let content = fs.readFileSync(path.join('src', file), 'utf8');

  // Keep the exported VERSION in lockstep with package.json — it silently drifted
  // to a stale value once already, which would misreport a patched install.
  content = content.replace(
    /(export const VERSION = ')[^']*(')/,
    `$1${PKG_VERSION}$2`
  );
  
  // Write ES module version (.mjs). Relative imports must point at the .mjs
  // siblings — otherwise dist/pdf-encrypt.mjs pulls in the CommonJS
  // dist/crypto-minimal.js and relies on Node's CJS-interop guesswork.
  const esmContent = content.replace(/(from\s*['"])(\.\/[^'"]+)\.js(['"])/g, '$1$2.mjs$3');
  fs.writeFileSync(path.join('dist', file.replace('.js', '.mjs')), esmContent);
  
  // Create CommonJS version
  let cjsContent = content;
  
  // Convert ES6 imports to CommonJS
  cjsContent = cjsContent.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm, 
    (match, imports, module) => {
      return `const {${imports}} = require('${module.replace('.js', '')}')`;
    });
  
  cjsContent = cjsContent.replace(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/gm,
    (match, name, module) => {
      return `const ${name} = require('${module.replace('.js', '')}')`;
    });
  
  // Convert ES6 exports to CommonJS
  // Handle re-exports: export { X, Y } from './module'
  cjsContent = cjsContent.replace(/^export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/gm,
    (match, exports, modulePath) => {
      // Clean up module path (remove .js extension for require)
      const cleanModule = modulePath.replace('.js', '');

      // Generate the require statement
      const requireStatement = `const {${exports}} = require('${cleanModule}');`;

      // Generate export statements
      const exportList = exports.split(',').map(e => {
        const trimmed = e.trim();
        const parts = trimmed.split(' as ');
        if (parts.length === 2) {
          return `exports.${parts[1].trim()} = ${parts[0].trim()};`;
        }
        return `exports.${trimmed} = ${trimmed};`;
      }).join('\n');

      return `${requireStatement}\n${exportList}`;
    });

  // Handle direct exports: export { X, Y }
  cjsContent = cjsContent.replace(/^export\s+\{([^}]+)\}(?!\s+from)/gm,
    (match, exports) => {
      const exportList = exports.split(',').map(e => {
        const trimmed = e.trim();
        const parts = trimmed.split(' as ');
        if (parts.length === 2) {
          return `exports.${parts[1].trim()} = ${parts[0].trim()};`;
        }
        return `exports.${trimmed} = ${trimmed};`;
      }).join('\n');
      return exportList;
    });
  
  cjsContent = cjsContent.replace(/^export\s+(const|let|var)\s+(\w+)/gm,
    (match, type, name) => {
      return `${type} ${name}`;
    });
  
  cjsContent = cjsContent.replace(/^export\s+(async\s+)?function\s+(\w+)/gm,
    (match, asyncKeyword, name) => {
      return `${asyncKeyword || ''}function ${name}`;
    });
  
  cjsContent = cjsContent.replace(/^export\s+class\s+(\w+)/gm,
    (match, name) => {
      return `class ${name}`;
    });
  
  // Add exports at the end for functions and classes
  const functionMatches = [...cjsContent.matchAll(/^(?:async\s+)?function\s+(\w+)/gm)];
  const classMatches = [...cjsContent.matchAll(/^class\s+(\w+)/gm)];
  const constMatches = [...cjsContent.matchAll(/^(?:const|let|var)\s+(\w+)\s*=/gm)];
  
  const exports = [];
  functionMatches.forEach(m => exports.push(m[1]));
  classMatches.forEach(m => exports.push(m[1]));
  
  // Only export specific constants from index.js
  if (file === 'index.js') {
    exports.push('VERSION', 'HOMEPAGE', 'POWERED_BY');
  }
  
  if (exports.length > 0 && !cjsContent.includes('module.exports')) {
    cjsContent += `\n\n// PDFSmaller.com exports\n`;
    exports.forEach(name => {
      if (!cjsContent.includes(`exports.${name}`)) {
        cjsContent += `exports.${name} = ${name};\n`;
      }
    });
  }
  
  // Write CommonJS version
  fs.writeFileSync(path.join('dist', file), cjsContent);
});

// ========== Browser (UMD) bundle ==========

/**
 * A single <script>-tag build, for environments with no bundler and no module
 * loader — SharePoint script editors, classic ASP.NET pages, plain HTML.
 *
 * pdf-lib is NOT bundled: it stays a peer dependency, read from the global
 * `PDFLib` that pdf-lib.min.js installs. Mirrors @pdfsmaller/pdf-encrypt so the
 * two packages are used the same way.
 */
(function buildUMD() {
  const PDF_LIB_NAMES = [
    'PDFDocument', 'PDFName', 'PDFHexString', 'PDFString',
    'PDFDict', 'PDFArray', 'PDFRawStream', 'PDFNumber',
  ];
  const PUBLIC_API = [
    'encryptPDF', 'AlreadyEncryptedError', 'PasswordEncodingError',
    'encodePasswordLegacy', 'md5', 'RC4', 'hexToBytes', 'bytesToHex',
  ];
  // Dependency order: crypto and password encoding before the engine.
  const ORDER = ['crypto-minimal.js', 'password-encoding.js', 'pdf-encrypt.js'];

  const bodies = ORDER.map((file) =>
    fs.readFileSync(path.join('src', file), 'utf8')
      .replace(/import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g, '')
      .replace(/^export\s+(async\s+function|function|class|const|let|var)\s+/gm, '$1 ')
      .replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, '')
      .trim()
  ).join('\n\n');

  const umd = `/**
 * @pdfsmaller/pdf-encrypt-lite v${PKG_VERSION} — browser (UMD) build
 *
 * Requires pdf-lib to be loaded first (it provides the global \`PDFLib\`):
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

${PDF_LIB_NAMES.map((n) => `  var ${n} = PDFLib.${n};`).join('\n')}

${bodies.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}

  return { ${PUBLIC_API.join(', ')} };
}));
`;
  fs.writeFileSync(path.join('dist', 'pdf-encrypt-lite.umd.js'), umd);
})();

// Create TypeScript definitions
const dtsContent = `/**
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
`;

fs.writeFileSync(path.join('dist', 'index.d.ts'), dtsContent);

console.log('✅ Build complete!');
console.log('📦 Files created in dist/');
console.log('');
console.log('🚀 Ready to publish to npm!');
console.log('   Run: npm publish');
console.log('');
console.log('💡 Powered by PDFSmaller.com');
console.log('   Try it online: https://pdfsmaller.com/protect-pdf');