# pdf-encrypt-lite 🔒

**Ultra-lightweight PDF encryption library (only 7KB!) with real RC4 128-bit encryption**

Built by [PDFSmaller.com](https://pdfsmaller.com) - Try our free online PDF tools with this encryption built-in!

[![NPM Version](https://img.shields.io/npm/v/@pdfsmaller/pdf-encrypt-lite.svg)](https://www.npmjs.com/package/@pdfsmaller/pdf-encrypt-lite)
[![Size](https://img.shields.io/badge/size-7KB-green)](https://bundlephobia.com/package/@pdfsmaller/pdf-encrypt-lite)
[![License](https://img.shields.io/npm/l/@pdfsmaller/pdf-encrypt-lite.svg)](https://github.com/smither777/pdfsmaller-pdfencryptlite/blob/main/LICENSE)
[![Powered by PDFSmaller](https://img.shields.io/badge/Powered%20by-PDFSmaller.com-blue)](https://pdfsmaller.com)

## 🚀 Why pdf-encrypt-lite?

When building [PDFSmaller.com](https://pdfsmaller.com/protect-pdf), we needed real PDF encryption that worked within Cloudflare Workers' 1MB limit. Every existing solution was 2-20MB+ in size. We were told it was "impossible" to implement proper PDF encryption in such a small package.

**We proved them wrong.**

This library is the exact encryption engine that powers [PDFSmaller.com's Protect PDF tool](https://pdfsmaller.com/protect-pdf) - battle-tested on thousands of PDFs daily.

### The Problem We Solved:
- ❌ **node-forge**: 1.7MB minified
- ❌ **crypto-js**: 234KB (still too large with pdf-lib)
- ❌ **Native crypto**: Not available in many edge environments
- ✅ **pdf-encrypt-lite**: Only 7KB! 🎉

## ✨ Features

- 🔐 **Real PDF encryption** - RC4 128-bit encryption that actually works
- 📦 **Tiny size** - Only ~7KB total (MD5 + RC4 implementations)
- ⚡ **Edge-ready** - Works in Cloudflare Workers, Vercel Edge, Deno Deploy
- 🌐 **Browser compatible** - No Node.js dependencies
- 📱 **Password protection** - PDFs prompt for password in any reader
- 🛡️ **PDF Standard compliant** - Implements Algorithm 2 & 3 from PDF spec
- 🚀 **Zero dependencies** - Just needs pdf-lib as peer dependency

## 📥 Installation

```bash
npm install @pdfsmaller/pdf-encrypt-lite pdf-lib
```

## 💻 Usage

```javascript
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import { PDFDocument } from 'pdf-lib';

// Basic usage
const encryptedPdfBytes = await encryptPDF(existingPdfBytes, 'user-password');

// With separate owner password
const encryptedPdfBytes = await encryptPDF(
  existingPdfBytes, 
  'user-password',
  'owner-password'
);

// Full example
async function protectPDF() {
  // Load your PDF
  const existingPdfBytes = await fetch('document.pdf').then(res => res.arrayBuffer());
  
  // Encrypt it with pdf-encrypt-lite
  const encryptedBytes = await encryptPDF(
    new Uint8Array(existingPdfBytes),
    'secret123',
    'owner456'
  );
  
  // Save the encrypted PDF
  const blob = new Blob([encryptedBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'protected.pdf';
  a.click();
}
```

## 🔥 Use Cases

Perfect for:
- **Edge Functions** (Cloudflare Workers, Vercel Edge, Netlify Edge)
- **Browser applications** (Like [PDFSmaller.com](https://pdfsmaller.com))
- **Serverless functions** with size limits
- **Client-side PDF protection** without server uploads
- **Lightweight Node.js applications**

## 🎯 Real-World Example

See it in action at [PDFSmaller.com/protect-pdf](https://pdfsmaller.com/protect-pdf) - our free online tool uses this exact library to encrypt PDFs directly in your browser. No uploads, no server processing, just pure client-side encryption!

## 🏗️ How It Works

We built custom implementations of:
1. **MD5 hashing** - For password processing per PDF spec
2. **RC4 encryption** - For content encryption
3. **PDF object traversal** - Encrypts all strings and streams
4. **Standard Security Handler** - Implements PDF encryption spec

Total size: ~7KB 🤯

## 📊 Comparison

| Library | Size | Real Encryption | Edge Compatible |
|---------|------|-----------------|-----------------|
| pdf-encrypt-lite | **7KB** ✅ | ✅ | ✅ |
| node-forge | 1,700KB | ✅ | ❌ |
| crypto-js | 234KB | ✅ | ⚠️ |
| pdf-lib alone | 0KB | ❌ | ✅ |

## 🤝 Contributing

We welcome contributions! This library powers [PDFSmaller.com](https://pdfsmaller.com), so we maintain high standards for security and compatibility.

## 📜 License

MIT License - Use it freely in your projects!

## 🙏 Credits

Built with ❤️ by [PDFSmaller.com](https://pdfsmaller.com) - Your free PDF toolkit

If this library helps you, check out our other free PDF tools:
- [Compress PDF](https://pdfsmaller.com/compress-pdf) - Reduce PDF size by up to 90%
- [Merge PDF](https://pdfsmaller.com/merge-pdf) - Combine multiple PDFs
- [Split PDF](https://pdfsmaller.com/split-pdf) - Extract pages from PDFs
- [Protect PDF](https://pdfsmaller.com/protect-pdf) - Uses this library!
- [20+ more tools](https://pdfsmaller.com) - All free, all private

## 🚀 Quick Start for Cloudflare Workers

```javascript
export default {
  async fetch(request, env) {
    const formData = await request.formData();
    const file = formData.get('pdf');
    const password = formData.get('password');
    
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const encrypted = await encryptPDF(pdfBytes, password);
    
    return new Response(encrypted, {
      headers: { 'Content-Type': 'application/pdf' }
    });
  }
}
```

## 📧 Support

- 🐛 [Report issues](https://github.com/smither777/pdfsmaller-pdfencryptlite/issues)
- 💡 [Request features](https://github.com/smither777/pdfsmaller-pdfencryptlite/issues)
- 🌐 [Visit PDFSmaller.com](https://pdfsmaller.com)
- 📧 [Contact us](https://pdfsmaller.com/contact)

---

**⭐ Star this repo if it helps you!**

*Built because we needed it. Shared because you might too.*

[PDFSmaller.com](https://pdfsmaller.com) - Free PDF Tools That Actually Work™