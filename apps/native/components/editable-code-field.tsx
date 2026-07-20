import { detectCodeLanguage } from "@/lib/detect-language";
import { SYNTAX_CANVAS } from "@/lib/syntax-theme";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  value: string;
  onChangeText: (next: string) => void;
  language?: string | null;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
};

/**
 * Editable code with live syntax coloring.
 * Transparent textarea over highlighted <pre> inside a WebView (reliable multiline).
 */
export function EditableCodeField({
  value,
  onChangeText,
  language,
  style,
  minHeight = 280,
}: Props) {
  const detected = useMemo(() => detectCodeLanguage(value, language), [value, language]);
  const [height, setHeight] = useState(minHeight);
  const webRef = useRef<WebView>(null);
  const lastSent = useRef(value);

  const html = useMemo(() => buildEditorHtml(value, detected.id), [detected.id]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type: string;
        value?: string;
        height?: number;
      };
      if (msg.type === "change" && typeof msg.value === "string") {
        lastSent.current = msg.value;
        onChangeText(msg.value);
      }
      if (typeof msg.height === "number" && Number.isFinite(msg.height)) {
        setHeight(Math.max(minHeight, Math.ceil(msg.height)));
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (value === lastSent.current) return;
    lastSent.current = value;
    const js = `window.__setCode && window.__setCode(${JSON.stringify(value)}); true;`;
    webRef.current?.injectJavaScript(js);
  }, [value]);

  return (
    <View style={[styles.wrap, { height, minHeight }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        style={styles.web}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
      />
    </View>
  );
}

function buildEditorHtml(initial: string, language: string) {
  const safeLang = JSON.stringify(language);
  const safeInitial = JSON.stringify(initial);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
<style>
  html, body {
    margin: 0; padding: 0;
    background: ${SYNTAX_CANVAS};
    color: #e6edf3;
  }
  /* Kill theme backgrounds — colors only */
  .hljs { background: transparent !important; padding: 0 !important; }
  .hljs span { background: transparent !important; }
  #wrap {
    position: relative;
    min-height: 100%;
    background: ${SYNTAX_CANVAS};
  }
  pre, textarea {
    box-sizing: border-box;
    margin: 0;
    padding: 12px;
    width: 100%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 19px;
    white-space: pre-wrap;
    word-break: break-word;
    tab-size: 2;
    border: 0;
    outline: none;
  }
  pre {
    pointer-events: none;
    background: transparent !important;
    min-height: 256px;
  }
  code.hljs {
    background: transparent !important;
    padding: 0 !important;
    display: block;
  }
  textarea {
    position: absolute;
    left: 0; top: 0; right: 0;
    bottom: 0;
    color: transparent;
    caret-color: #58A6FF;
    background: transparent;
    resize: none;
    overflow: hidden;
    z-index: 2;
  }
</style>
</head>
<body>
  <div id="wrap">
    <pre><code id="pre" class="hljs"></code></pre>
    <textarea id="ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>
    (function () {
      var lang = ${safeLang};
      var ta = document.getElementById('ta');
      var pre = document.getElementById('pre');
      var wrap = document.getElementById('wrap');

      function paint() {
        var code = ta.value;
        var html;
        try {
          if (lang && lang !== 'plaintext' && hljs.getLanguage(lang)) {
            html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
          } else {
            html = hljs.highlightAuto(code).value;
          }
        } catch (e) {
          html = escapeHtml(code);
        }
        pre.innerHTML = html + '\\n';
        resize();
      }

      function escapeHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }

      function resize() {
        ta.style.height = '0px';
        var h = Math.max(256, ta.scrollHeight);
        ta.style.height = h + 'px';
        wrap.style.height = h + 'px';
        document.body.style.height = h + 'px';
        post({ type: 'change', value: ta.value, height: h + 4 });
      }

      function post(payload) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      window.__setCode = function (next) {
        if (ta.value === next) return;
        ta.value = next;
        paint();
      };

      ta.addEventListener('input', paint);
      ta.value = ${safeInitial};
      paint();
    })();
  </script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: SYNTAX_CANVAS,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  web: {
    flex: 1,
    backgroundColor: SYNTAX_CANVAS,
  },
});
