/**
 * Test suite for @pdfsmaller/pdf-encrypt-lite
 * Runs against the built dist/ — i.e. exactly what gets published.
 */

const {
  encryptPDF, AlreadyEncryptedError, PasswordEncodingError,
  encodePasswordLegacy, bytesToHex, md5, RC4, VERSION,
} = require('./dist/index.js');
const { PDFDocument } = require('pdf-lib');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    console.log(`${name}`);
    await fn();
    console.log('  ✅ PASSED\n');
    passed++;
  } catch (e) {
    console.log('  ❌ FAILED:', e.message, '\n');
    failed++;
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

/** Find /P inside the /Encrypt dictionary (not a page reference). */
function encryptDictP(bytes) {
  const s = Buffer.from(bytes).toString('latin1');
  const dict = s.match(/\/Filter \/Standard[\s\S]{0,400}?>>/);
  const p = dict && dict[0].match(/\/P (-?\d+)/);
  return p ? Number(p[1]) : null;
}

async function makePDF(title) {
  const doc = await PDFDocument.create();
  doc.addPage();
  if (title) doc.setTitle(title);
  return doc.save({ useObjectStreams: false });
}

async function run() {
  console.log('Testing @pdfsmaller/pdf-encrypt-lite\n' + '━'.repeat(40) + '\n');

  await test('Test 1: Exports resolve', async () => {
    for (const [name, fn] of Object.entries({ encryptPDF, encodePasswordLegacy, bytesToHex, md5 })) {
      assert(typeof fn === 'function', `${name} should be a function`);
    }
    assert(typeof RC4 === 'function', 'RC4 should be a class');
    const pkgVersion = require('./package.json').version;
    assert(VERSION === pkgVersion, `VERSION ${VERSION} should match package.json ${pkgVersion}`);
  });

  await test('Test 2: Encrypts a PDF', async () => {
    const enc = await encryptPDF(new Uint8Array(await makePDF('Hello')), 'secret');
    assert(enc.length > 0, 'should produce bytes');
    assert(Buffer.from(enc).toString('latin1').includes('/Filter /Standard'), 'should have an /Encrypt dict');
  });

  await test('Test 3: /P is a signed 32-bit integer', async () => {
    // 0xFFFFFFFC is the positive number 4294967292 in JavaScript; writing it
    // verbatim puts /P outside the range ISO 32000 permits.
    const enc = await encryptPDF(new Uint8Array(await makePDF()), 'pw');
    const p = encryptDictP(enc);
    assert(p !== null, '/P should be present in the encryption dictionary');
    assert(p === -4, `/P should be -4, got ${p}`);
    assert(p >= -2147483648 && p <= 2147483647, `/P ${p} outside signed 32-bit range`);
  });

  await test('Test 4: Output re-parses (literal-string escaping)', async () => {
    // Titles full of bytes that become ( ) \ CR once encrypted are what
    // destroyed the object structure in 1.0.x.
    const bytes = await makePDF('Title (parens) and \\backslash plus \r return');
    for (let i = 0; i < 20; i++) {
      const enc = await encryptPDF(new Uint8Array(bytes), `pw${i}`);
      const reloaded = await PDFDocument.load(enc, { ignoreEncryption: true });
      assert(reloaded.getPageCount() === 1, `run ${i}: document corrupted`);
    }
    console.log('  20 encryptions all re-parsed intact');
  });

  await test('Test 5: Passwords use PDFDocEncoding, not UTF-8', async () => {
    assert(Buffer.from(encodePasswordLegacy('userpw')).toString() === 'userpw', 'ASCII unchanged');
    const cafe = encodePasswordLegacy('café');
    assert(cafe.length === 4, `should be 1 byte per char, got ${cafe.length}`);
    assert(cafe[3] === 0xe9, `e-acute should be 0xE9, got 0x${cafe[3].toString(16)}`);
    assert(encodePasswordLegacy('€')[0] === 0xa0, 'Euro should be 0xA0 in PDFDocEncoding');
  });

  await test('Test 6: Rejects characters the handler cannot represent', async () => {
    let err = null;
    try { encodePasswordLegacy('pass中'); } catch (e) { err = e; }
    assert(err instanceof PasswordEncodingError, 'should throw PasswordEncodingError');
    assert(err.code === 'UNSUPPORTED_PASSWORD_CHARACTER', `unexpected code ${err && err.code}`);
  });

  await test('Test 7: Rejects already-encrypted input', async () => {
    const once = await encryptPDF(new Uint8Array(await makePDF()), 'first');
    let err = null;
    try { await encryptPDF(new Uint8Array(once), 'second'); } catch (e) { err = e; }
    assert(err instanceof AlreadyEncryptedError, `should throw AlreadyEncryptedError, got ${err}`);
    assert(err.code === 'ALREADY_ENCRYPTED', `unexpected code ${err && err.code}`);
  });

  await test('Test 8: Preserves an existing file /ID', async () => {
    // pdf-lib does not give a newly-created document a trailer /ID, so stamp a
    // known one first — otherwise there is nothing to preserve.
    const { PDFHexString } = require('pdf-lib');
    const seed = await PDFDocument.load(await makePDF(), { ignoreEncryption: true });
    const originalId = '0123456789abcdef0123456789abcdef';
    seed.context.trailerInfo.ID = [PDFHexString.of(originalId), PDFHexString.of(originalId)];
    const bytes = await seed.save({ useObjectStreams: false });

    const enc = await encryptPDF(new Uint8Array(bytes), 'pw');
    const after = await PDFDocument.load(enc, { ignoreEncryption: true });
    const raw = after.context.trailerInfo.ID;
    const newId = Buffer.from((raw.get ? raw.get(0) : raw[0]).asBytes()).toString('hex');
    assert(originalId === newId, `file /ID changed: ${originalId} -> ${newId}`);
  });

  await test('Test 9: Third argument accepts a string (original signature)', async () => {
    const bytes = await makePDF();
    const a = await encryptPDF(new Uint8Array(bytes), 'pw', 'ownerpw');
    const b = await encryptPDF(new Uint8Array(bytes), 'pw');
    assert(encryptDictP(a) === -4, `string form should keep all permissions, got ${encryptDictP(a)}`);
    assert(encryptDictP(b) === -4, `omitted form should keep all permissions, got ${encryptDictP(b)}`);
  });

  await test('Test 10: Third argument accepts an options object', async () => {
    const enc = await encryptPDF(new Uint8Array(await makePDF()), '', {
      ownerPassword: 'ownerpw',
      allowPrinting: true, allowFillingForms: true, allowAnnotating: false,
      allowModifying: false, allowCopying: false, allowExtraction: false,
      allowAssembly: false, allowHighQualityPrint: false,
    });
    const P = encryptDictP(enc);
    const on = (bit) => (P & (1 << (bit - 1))) !== 0;
    assert(on(3), 'printing should be allowed');
    assert(on(9), 'form filling (and signing) should be allowed');
    assert(!on(6), 'annotations should be denied');
    assert(!on(4), 'modification should be denied');
    assert(!on(5), 'copying should be denied');
    assert(P >= -2147483648 && P <= 2147483647, `/P ${P} outside signed 32-bit range`);
  });

  await test('Test 11: UMD build loads as a browser script tag', async () => {
    const vm = require('vm');
    const PDFLib = require('pdf-lib');
    const sandbox = {
      PDFLib, console, crypto: globalThis.crypto, TextEncoder, TextDecoder,
      Uint8Array, WeakSet, Map, Set, Array, Error, Buffer, String, Object,
      Math, JSON, Promise, Number, ArrayBuffer,
    };
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(require('fs').readFileSync('./dist/pdf-encrypt-lite.umd.js', 'utf8'), sandbox);
    assert(typeof sandbox.PDFEncryptLite === 'object', 'should set the PDFEncryptLite global');
    assert(typeof sandbox.PDFEncryptLite.encryptPDF === 'function', 'should expose encryptPDF');
    const out = await sandbox.PDFEncryptLite.encryptPDF(new Uint8Array(await makePDF()), 'pw');
    assert(out.length > 0, 'UMD build should encrypt');
    // and it must fail loudly without pdf-lib
    const bare = { console }; bare.self = bare; vm.createContext(bare);
    let guarded = false;
    try { vm.runInContext(require('fs').readFileSync('./dist/pdf-encrypt-lite.umd.js', 'utf8'), bare); }
    catch (e) { guarded = /global "PDFLib" not found/.test(e.message); }
    assert(guarded, 'should give a clear error when pdf-lib is absent');
  });

  console.log('━'.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('━'.repeat(40));

  if (failed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  }
  console.log('\n✅ All tests passed!');
  console.log('📦 Ready to publish: npm publish --access public');
}

run().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
