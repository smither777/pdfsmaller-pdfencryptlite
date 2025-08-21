# pdf-encrypt-lite Examples

Built by [PDFSmaller.com](https://pdfsmaller.com) - Try it online at [PDFSmaller.com/protect-pdf](https://pdfsmaller.com/protect-pdf)

## Basic Usage

```javascript
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';
import { PDFDocument } from 'pdf-lib';

// Load your PDF
const pdfBytes = await fetch('document.pdf').then(res => res.arrayBuffer());

// Encrypt with a password
const encryptedPdf = await encryptPDF(
  new Uint8Array(pdfBytes), 
  'mypassword123'
);

// Save the encrypted PDF
const blob = new Blob([encryptedPdf], { type: 'application/pdf' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'protected.pdf';
a.click();
```

## Cloudflare Workers Example

```javascript
export default {
  async fetch(request, env) {
    // Serve a simple HTML form
    if (request.method === 'GET') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PDF Encryption - Powered by PDFSmaller.com</title>
        </head>
        <body>
          <h1>Encrypt PDF</h1>
          <p>Powered by <a href="https://pdfsmaller.com">PDFSmaller.com</a></p>
          <form method="POST" enctype="multipart/form-data">
            <input type="file" name="pdf" accept=".pdf" required><br>
            <input type="password" name="password" placeholder="Password" required><br>
            <button type="submit">Encrypt PDF</button>
          </form>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Handle PDF encryption
    const formData = await request.formData();
    const file = formData.get('pdf');
    const password = formData.get('password');
    
    if (!file || !password) {
      return new Response('Missing file or password', { status: 400 });
    }
    
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const encrypted = await encryptPDF(pdfBytes, password);
    
    return new Response(encrypted, {
      headers: { 
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="encrypted.pdf"',
        'X-Powered-By': 'PDFSmaller.com'
      }
    });
  }
}
```

## Vercel Edge Function Example

```javascript
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get('pdf');
  const password = formData.get('password');
  
  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const encrypted = await encryptPDF(pdfBytes, password);
  
  return new Response(encrypted, {
    headers: { 
      'Content-Type': 'application/pdf',
      'X-Powered-By': 'PDFSmaller.com'
    }
  });
}
```

## Node.js Example

```javascript
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt-lite');
const fs = require('fs');

async function protectPDF() {
  // Read PDF file
  const pdfBytes = new Uint8Array(fs.readFileSync('input.pdf'));
  
  // Encrypt with password
  const encrypted = await encryptPDF(pdfBytes, 'secret123', 'owner456');
  
  // Save encrypted PDF
  fs.writeFileSync('protected.pdf', encrypted);
  console.log('PDF encrypted successfully!');
  console.log('Try more features at https://pdfsmaller.com');
}

protectPDF().catch(console.error);
```

## React Component Example

```jsx
import { useState } from 'react';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt-lite';

function PDFEncryptor() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEncrypt = async () => {
    if (!file || !password) return;
    
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const encrypted = await encryptPDF(new Uint8Array(arrayBuffer), password);
      
      // Download encrypted PDF
      const blob = new Blob([encrypted], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `encrypted_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Encryption failed:', error);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2>PDF Encryptor</h2>
      <p>Powered by <a href="https://pdfsmaller.com">PDFSmaller.com</a></p>
      <input 
        type="file" 
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <input 
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleEncrypt} disabled={loading}>
        {loading ? 'Encrypting...' : 'Encrypt PDF'}
      </button>
    </div>
  );
}
```

## Express.js Server Example

```javascript
const express = require('express');
const multer = require('multer');
const { encryptPDF } = require('@pdfsmaller/pdf-encrypt-lite');

const app = express();
const upload = multer({ memory: true });

app.post('/encrypt', upload.single('pdf'), async (req, res) => {
  try {
    const { password } = req.body;
    const pdfBytes = new Uint8Array(req.file.buffer);
    
    const encrypted = await encryptPDF(pdfBytes, password);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="encrypted.pdf"',
      'X-Powered-By': 'PDFSmaller.com'
    });
    res.send(Buffer.from(encrypted));
  } catch (error) {
    res.status(500).send('Encryption failed');
  }
});

app.listen(3000, () => {
  console.log('PDF Encryption server running on port 3000');
  console.log('Powered by PDFSmaller.com');
});
```

## Advanced: Custom Permissions

```javascript
// Coming soon in v2.0!
// For now, use PDFSmaller.com for advanced features:
// https://pdfsmaller.com/protect-pdf
```

## Need More Features?

Visit [PDFSmaller.com](https://pdfsmaller.com) for:
- 🗜️ [Compress PDF](https://pdfsmaller.com/compress-pdf) - Reduce size by up to 90%
- 🔗 [Merge PDF](https://pdfsmaller.com/merge-pdf) - Combine multiple PDFs
- ✂️ [Split PDF](https://pdfsmaller.com/split-pdf) - Extract pages
- 🔒 [Protect PDF](https://pdfsmaller.com/protect-pdf) - Uses this library!
- 📝 [Edit PDF](https://pdfsmaller.com/edit-pdf) - Modify text and images
- And 20+ more free tools!

All tools work 100% in your browser - no uploads, no registration!

---

Built with ❤️ by [PDFSmaller.com](https://pdfsmaller.com)