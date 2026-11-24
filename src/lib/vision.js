// The Vision Board is a free-standing wall: pictures plus an open line of text,
// with no link to an Ambition task. These helpers keep the text bounded and let
// older boards carrying `taskId` load in the current shape without a rewrite.

export const VISION_TEXT_MAX = 280;

export function clampVisionText(text, max = VISION_TEXT_MAX) {
  const s = typeof text === "string" ? text : "";
  return s.length > max ? s.slice(0, max) : s;
}

export function normalizeVisionItem(item) {
  if (!item || typeof item !== "object") return item;
  const { taskId, ...rest } = item;
  return { ...rest, caption: clampVisionText(rest.caption) };
}

export function normalizeVision(vision) {
  const src = vision && typeof vision === "object" && !Array.isArray(vision) ? vision : {};
  const out = {};
  for (const [year, list] of Object.entries(src)) {
    out[year] = Array.isArray(list) ? list.map(normalizeVisionItem) : list;
  }
  return out;
}
