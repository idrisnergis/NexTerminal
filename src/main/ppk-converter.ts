import { readFileSync } from 'fs';
import crypto from 'crypto';

/**
 * Convert PuTTY PPK v2 (unencrypted, ssh-rsa) to OpenSSH PEM format.
 * ssh2 library should handle PPK natively, but some edge cases fail.
 * This is a fallback converter for PPK v2 unencrypted RSA keys.
 */
export function convertPPKtoOpenSSH(ppkPath: string): string {
  const content = readFileSync(ppkPath, 'utf8');
  const lines = content.split(/\r?\n/);

  // Check if it's actually a PPK file
  if (!lines[0]?.startsWith('PuTTY-User-Key-File-')) {
    // Not a PPK file, return as-is (might be OpenSSH already)
    return content;
  }

  const encryption = getField(lines, 'Encryption');
  if (encryption && encryption !== 'none') {
    // Encrypted PPK — return as-is, let ssh2 handle it with passphrase
    return content;
  }

  const keyType = lines[0].replace('PuTTY-User-Key-File-2: ', '').replace('PuTTY-User-Key-File-3: ', '').trim();

  if (keyType !== 'ssh-rsa') {
    // Non-RSA key, return as-is for ssh2 to handle
    return content;
  }

  try {
    const publicLinesCount = parseInt(getField(lines, 'Public-Lines') || '0', 10);
    const publicStartIdx = lines.findIndex(l => l.startsWith('Public-Lines:')) + 1;
    const publicB64 = lines.slice(publicStartIdx, publicStartIdx + publicLinesCount).join('');

    const privateLinesCount = parseInt(getField(lines, 'Private-Lines') || '0', 10);
    const privateStartIdx = lines.findIndex(l => l.startsWith('Private-Lines:')) + 1;
    const privateB64 = lines.slice(privateStartIdx, privateStartIdx + privateLinesCount).join('');

    const publicBuf = Buffer.from(publicB64, 'base64');
    const privateBuf = Buffer.from(privateB64, 'base64');

    // Parse public key components
    let offset = 0;
    const readString = (buf: Buffer, off: number): [Buffer, number] => {
      const len = buf.readUInt32BE(off);
      return [buf.slice(off + 4, off + 4 + len), off + 4 + len];
    };

    let typeBuf: Buffer;
    [typeBuf, offset] = readString(publicBuf, offset);
    
    let eBuf: Buffer;
    [eBuf, offset] = readString(publicBuf, offset);
    
    let nBuf: Buffer;
    [nBuf, offset] = readString(publicBuf, offset);

    // Parse private key components
    offset = 0;
    let dBuf: Buffer;
    [dBuf, offset] = readString(privateBuf, offset);
    
    let pBuf: Buffer;
    [pBuf, offset] = readString(privateBuf, offset);
    
    let qBuf: Buffer;
    [qBuf, offset] = readString(privateBuf, offset);
    
    let iqmpBuf: Buffer;
    [iqmpBuf, offset] = readString(privateBuf, offset);

    // Build RSA key using Node.js crypto
    const keyObject = crypto.createPrivateKey({
      key: {
        kty: 'RSA',
        n: toBase64Url(nBuf),
        e: toBase64Url(eBuf),
        d: toBase64Url(dBuf),
        p: toBase64Url(pBuf),
        q: toBase64Url(qBuf),
        qi: toBase64Url(iqmpBuf),
        dp: toBase64Url(bigIntMod(dBuf, subtractOne(pBuf))),
        dq: toBase64Url(bigIntMod(dBuf, subtractOne(qBuf))),
      },
      format: 'jwk',
    });

    return keyObject.export({ type: 'pkcs1', format: 'pem' }) as string;
  } catch {
    // If conversion fails, return original content for ssh2 to try
    return content;
  }
}

function getField(lines: string[], field: string): string | null {
  const line = lines.find(l => l.startsWith(`${field}:`));
  return line ? line.substring(field.length + 1).trim() : null;
}

function toBase64Url(buf: Buffer): string {
  // Remove leading zero bytes that are just padding for unsigned representation
  let start = 0;
  while (start < buf.length - 1 && buf[start] === 0) start++;
  return buf.slice(start).toString('base64url');
}

function subtractOne(buf: Buffer): Buffer {
  const result = Buffer.from(buf);
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i] > 0) {
      result[i]--;
      break;
    }
    result[i] = 0xff;
  }
  return result;
}

function bigIntMod(a: Buffer, m: Buffer): Buffer {
  const aBig = bufToBigInt(a);
  const mBig = bufToBigInt(m);
  if (mBig === 0n) return Buffer.from([0]);
  const result = aBig % mBig;
  return bigIntToBuf(result);
}

function bufToBigInt(buf: Buffer): bigint {
  let hex = '';
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, '0');
  }
  return hex.length > 0 ? BigInt('0x' + hex) : 0n;
}

function bigIntToBuf(n: bigint): Buffer {
  if (n === 0n) return Buffer.from([0]);
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return Buffer.from(hex, 'hex');
}
