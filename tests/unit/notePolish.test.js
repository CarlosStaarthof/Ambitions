import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the transport is mocked: polishText's own gating and key handling are what these
// tests exercise, so no network and no provider adapter is involved.
const callAI = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/ai.js", () => ({ callAI }));

import { polishText } from "../../src/lib/notePolish.js";

const ENABLED = {
  settings: { ai: { enabled: true, provider: "anthropic", model: "claude-opus-5" } },
  aiKeys: { anthropic: "sk-secret-key" }
};

beforeEach(() => {
  callAI.mockReset();
});

describe("polishText gating", () => {
  it("returns polish-disabled when AI is switched off", async () => {
    const ctx = { ...ENABLED, settings: { ai: { ...ENABLED.settings.ai, enabled: false } } };
    await expect(polishText("rough note", ctx)).resolves.toEqual({ error: "polish-disabled" });
    expect(callAI).not.toHaveBeenCalled();
  });

  it("returns polish-disabled when the provider is none", async () => {
    const ctx = { ...ENABLED, settings: { ai: { ...ENABLED.settings.ai, provider: "none" } } };
    await expect(polishText("rough note", ctx)).resolves.toEqual({ error: "polish-disabled" });
    expect(callAI).not.toHaveBeenCalled();
  });

  it("returns polish-disabled when the provider key is missing or empty", async () => {
    await expect(polishText("rough note", { ...ENABLED, aiKeys: {} }))
      .resolves.toEqual({ error: "polish-disabled" });
    await expect(polishText("rough note", { ...ENABLED, aiKeys: { anthropic: "   " } }))
      .resolves.toEqual({ error: "polish-disabled" });
    expect(callAI).not.toHaveBeenCalled();
  });

  it("returns polish-disabled when the text is blank", async () => {
    await expect(polishText("", ENABLED)).resolves.toEqual({ error: "polish-disabled" });
    await expect(polishText("   ", ENABLED)).resolves.toEqual({ error: "polish-disabled" });
    expect(callAI).not.toHaveBeenCalled();
  });
});

describe("polishText call", () => {
  it("returns the polished text and passes the key only in the call context", async () => {
    callAI.mockResolvedValue("  Clean note.  ");
    const result = await polishText("  rough note  ", ENABLED);

    expect(result).toEqual({ text: "Clean note." });
    expect(Object.keys(result)).toEqual(["text"]);
    expect(JSON.stringify(result)).not.toContain("sk-secret-key");

    expect(callAI).toHaveBeenCalledTimes(1);
    const [content, context] = callAI.mock.calls[0];
    expect(content).toContain("rough note");
    expect(context).toEqual({
      enabled: true,
      provider: "anthropic",
      model: "claude-opus-5",
      keys: { anthropic: "sk-secret-key" }
    });
  });

  it("returns polish-failed when the transport rejects or answers empty", async () => {
    callAI.mockRejectedValueOnce(new Error("offline"));
    await expect(polishText("rough note", ENABLED)).resolves.toEqual({ error: "polish-failed" });

    callAI.mockResolvedValueOnce("   ");
    await expect(polishText("rough note", ENABLED)).resolves.toEqual({ error: "polish-failed" });
  });
});
