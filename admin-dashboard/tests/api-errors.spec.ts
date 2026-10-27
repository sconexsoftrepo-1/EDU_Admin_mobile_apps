import { expect, test } from "@playwright/test";
import { apiRequest } from "../src/services/api/client";

test("validation feedback shows field messages without echoing submitted file data", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        detail: [
          {
            loc: ["body", "content_base64"],
            msg: "String should have at most 950000 characters",
            input: "PRIVATE-FILE-CONTENT",
          },
        ],
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  try {
    await expect(apiRequest("imports/excel/validate")).rejects.toThrow(
      "content base64: String should have at most 950000 characters",
    );
    try {
      await apiRequest("imports/excel/validate");
    } catch (error) {
      expect((error as Error).message).not.toContain("PRIVATE-FILE-CONTENT");
    }
  } finally {
    globalThis.fetch = previous;
  }
});
