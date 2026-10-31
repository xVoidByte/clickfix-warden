import { verifyAsync } from '@noble/ed25519';
import { FEED_PUBLIC_KEY } from './public-key';

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const PUBLIC_KEY: string = (import.meta.env.WXT_FEED_PUBKEY as string | undefined) || FEED_PUBLIC_KEY;

/** True only when the signature was made by the project key over these exact bytes. */
export async function verifySignature(data: Uint8Array, signatureB64: string, publicKeyB64 = PUBLIC_KEY): Promise<boolean> {
  try {
    const sig = fromBase64(signatureB64);
    const pub = fromBase64(publicKeyB64);
    if (sig.length !== 64 || pub.length !== 32) return false;
    return await verifyAsync(sig, data, pub);
  } catch {
    return false;
  }
}
