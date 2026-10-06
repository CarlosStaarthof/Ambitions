import { registerPlugin, Capacitor } from "@capacitor/core";

// On device the browser download path is a no-op: an Android WebView drops
// `<a download>` clicks on blob URLs because Capacitor registers no
// DownloadListener. FileSaverPlugin writes into the public Downloads folder
// instead. In a desktop browser the ordinary blob download still works.
const FileSaver = registerPlugin("FileSaver");

export async function download(name, content, type) {
  if (Capacitor.isNativePlatform()) {
    const res = await FileSaver.save({ name, content, mime: type });
    return (res && res.location) || name;
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return name;
}
