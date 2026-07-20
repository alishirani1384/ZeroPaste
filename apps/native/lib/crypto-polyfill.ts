/**
 * Hermes / Expo Go do not ship Web Crypto. Polyfill before @paste/crypto and
 * clipboard-core touch getRandomValues / randomUUID.
 */
import "react-native-get-random-values";
import * as ExpoCrypto from "expo-crypto";

const g = globalThis as typeof globalThis & {
  crypto?: Crypto & {
    randomUUID?: () => string;
    subtle?: SubtleCrypto;
  };
};

if (!g.crypto) {
  g.crypto = {} as Crypto;
}

if (typeof g.crypto.getRandomValues !== "function") {
  // react-native-get-random-values normally defines this; keep a hard fallback.
  g.crypto.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
    const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    view.set(bytes);
    return array;
  };
}

if (typeof g.crypto.randomUUID !== "function") {
  g.crypto.randomUUID = () => ExpoCrypto.randomUUID();
}
