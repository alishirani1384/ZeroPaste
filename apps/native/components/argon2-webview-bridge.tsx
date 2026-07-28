import { ARGON2_OPTS, setArgon2idDerive, toB64, fromB64, type Argon2Opts } from "@paste/crypto";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { HASH_WASM_UMD } from "@/components/argon2-umd.gen";

type Pending = {
  id: string;
  passwordB64: string;
  saltB64: string;
  resolve: (hash: Uint8Array) => void;
  reject: (err: Error) => void;
};

const pending = new Map<string, Pending>();
let requestId = 0;
let sendToWebView: ((js: string) => void) | null = null;
let bridgeReady = false;
const readyWaiters: Array<() => void> = [];

function whenBridgeReady(): Promise<void> {
  if (bridgeReady) return Promise.resolve();
  return new Promise((resolve) => readyWaiters.push(resolve));
}

async function deriveViaWebView(
  password: Uint8Array,
  salt: Uint8Array,
  opts: Argon2Opts = ARGON2_OPTS,
): Promise<Uint8Array> {
  await whenBridgeReady();
  if (!sendToWebView) {
    throw new Error("Argon2 WebView bridge is not mounted");
  }

  const id = `a${++requestId}`;
  const passwordB64 = toB64(password);
  const saltB64 = toB64(salt);

  return new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Argon2 WebView unlock timed out"));
    }, 90_000);

    pending.set(id, {
      id,
      passwordB64,
      saltB64,
      resolve: (hash) => {
        clearTimeout(timer);
        resolve(hash);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });

    const payload = JSON.stringify({
      type: "argon2id",
      id,
      passwordB64,
      saltB64,
      t: opts.t,
      m: opts.m,
      p: opts.p,
      dkLen: opts.dkLen,
    });

    sendToWebView!(
      `window.__zeropasteArgon2 && window.__zeropasteArgon2(${JSON.stringify(payload)}); true;`,
    );
  });
}

/**
 * Hidden System WebView that runs Argon2id via WASM (Android/iOS WebView has WASM;
 * Hermes in Expo Go often does not).
 */
export function Argon2WebViewBridge() {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setArgon2idDerive(deriveViaWebView);
    return () => {
      setArgon2idDerive(null);
      bridgeReady = false;
      sendToWebView = null;
    };
  }, []);

  useEffect(() => {
    sendToWebView = (js: string) => {
      ref.current?.injectJavaScript(js);
    };
  }, [ready]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        id?: string;
        ok?: boolean;
        hashB64?: string;
        error?: string;
      };

      if (msg.type === "ready") {
        bridgeReady = true;
        setReady(true);
        for (const w of readyWaiters.splice(0)) w();
        return;
      }

      if (msg.type !== "argon2id-result" || !msg.id) return;
      const job = pending.get(msg.id);
      if (!job) return;
      pending.delete(msg.id);
      if (msg.ok && msg.hashB64) {
        job.resolve(fromB64(msg.hashB64));
      } else {
        job.reject(new Error(msg.error || "Argon2 WebView failed"));
      }
    } catch (err) {
      console.warn("[argon2-webview] bad message", err);
    }
  };

  return (
    <View style={styles.hide} pointerEvents="none">
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={{ html: ARGON2_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        style={styles.hide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hide: { width: 0, height: 0, opacity: 0, position: "absolute" },
});

/** Self-contained page: System WebView has WASM; hash-wasm UMD is bundled inline (no CDN). */
const ARGON2_HTML = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>${HASH_WASM_UMD}</script>
    <script>
      function b64ToBytes(b64) {
        var bin = atob(b64);
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      function bytesToB64(bytes) {
        var s = "";
        for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
      }
      function post(obj) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }

      window.__zeropasteArgon2 = function (raw) {
        var msg = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!window.hashwasm || !window.hashwasm.argon2id) {
          post({ type: "argon2id-result", id: msg.id, ok: false, error: "hash-wasm failed to initialize" });
          return;
        }
        window.hashwasm.argon2id({
          password: b64ToBytes(msg.passwordB64),
          salt: b64ToBytes(msg.saltB64),
          parallelism: msg.p,
          iterations: msg.t,
          memorySize: msg.m,
          hashLength: msg.dkLen,
          outputType: "binary"
        }).then(function (hash) {
          var bytes = hash instanceof Uint8Array ? hash : new Uint8Array(hash);
          post({ type: "argon2id-result", id: msg.id, ok: true, hashB64: bytesToB64(bytes) });
        }).catch(function (err) {
          post({ type: "argon2id-result", id: msg.id, ok: false, error: String(err && err.message ? err.message : err) });
        });
      };

      post({ type: "ready" });
    </script>
  </body>
</html>`;
