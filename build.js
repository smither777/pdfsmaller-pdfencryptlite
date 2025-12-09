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
const srcFiles = ['index.js', 'pdf-encrypt.js', 'crypto-minimal.js'];

srcFiles.forEach(file => {
  const content = fs.readFileSync(path.join('src', file), 'utf8');
  
  // Write ES module version (.mjs)
  fs.writeFileSync(path.join('dist', file.replace('.js', '.mjs')), content);
  
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