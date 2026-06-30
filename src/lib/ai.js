export function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine; }

export async function callClaude(content) {
  if (!isOnline()) throw new Error("offline");
  const url = import.meta.env.VITE_AI_PROXY_URL || "/api/ai";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error("Request failed (" + res.status + ")");
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
  if (!text) throw new Error("Empty response");
  return text;
}
