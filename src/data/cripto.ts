import * as Crypto from 'expo-crypto';

export const nuevoId = () => Crypto.randomUUID();

export async function hashSecreto(secreto: string, sal: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${sal}:${secreto}`);
}

export async function crearSecreto(secreto: string) {
  const sal = nuevoId();
  return { secretoSal: sal, secretoHash: await hashSecreto(secreto, sal) };
}

export async function verificarSecreto(secreto: string, sal: string, hash: string) {
  return (await hashSecreto(secreto, sal)) === hash;
}

/** Código numérico de 6 dígitos para invitaciones. */
export function codigoSeisDigitos(): string {
  const bytes = Crypto.getRandomBytes(4);
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, '0');
}
