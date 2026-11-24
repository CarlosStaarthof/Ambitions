import { registerPlugin, Capacitor } from "@capacitor/core";

// The phone's own speech-to-text. It returns text and never retains audio: no blob,
// no object URL, no data: URI and no file write. On Android this talks to
// DictationPlugin (platform SpeechRecognizer); the desktop dev build falls back to
// the browser SpeechRecognition when it exists.
const Native = registerPlugin("Dictation");

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const webCtor = () => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

let webRec = null;
let webFinish = null;

export function dictationSupported() {
  return isNative() || !!webCtor();
}

function mapWebError(code) {
  if (code === "not-allowed" || code === "service-not-allowed") return "dictation-denied";
  if (code === "no-speech") return "dictation-no-speech";
  return "dictation-unsupported";
}

export function startDictation() {
  if (isNative()) {
    return Native.start()
      .then((r) => (r && r.error ? { error: r.error } : { text: String((r && r.text) || "") }))
      .catch(() => ({ error: "dictation-unsupported" }));
  }

  const Ctor = webCtor();
  if (!Ctor) return Promise.resolve({ error: "dictation-unsupported" });

  return new Promise((resolve) => {
    try {
      const rec = new Ctor();
      webRec = rec;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        webRec = null;
        webFinish = null;
        try { rec.stop(); } catch { /* already stopped */ }
        resolve(result);
      };
      webFinish = finish;
      rec.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let text = "";
        try { text = e.results[0][0].transcript || ""; } catch { /* malformed result */ }
        finish(text.trim() ? { text } : { error: "dictation-no-speech" });
      };
      rec.onerror = (e) => finish({ error: mapWebError(e && e.error) });
      rec.onend = () => finish({ error: "dictation-no-speech" });
      rec.start();
    } catch {
      webRec = null;
      webFinish = null;
      resolve({ error: "dictation-unsupported" });
    }
  });
}

export async function cancelDictation() {
  if (isNative()) {
    try { await Native.cancel(); } catch { /* already stopped */ }
    return;
  }
  if (!webRec) return;
  const finish = webFinish;
  const rec = webRec;
  webRec = null;
  webFinish = null;
  try { rec.abort(); } catch { /* already stopped */ }
  if (finish) finish({ error: "dictation-no-speech" });
}
