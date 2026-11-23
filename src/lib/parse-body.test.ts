import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "./parse-body";

const schema = z.object({
  name: z.string({ error: "name is required." }).trim().min(1, "name is required."),
  count: z.number({ error: "count must be a number." }),
});

function post(body: string) {
  return new Request("http://localhost/api/test", { method: "POST", body });
}

async function errorOf(result: Awaited<ReturnType<typeof parseJsonBody>>) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a failure");
  expect(result.response.status).toBe(400);
  return ((await result.response.json()) as { error: string }).error;
}

describe("parseJsonBody", () => {
  it("returns the parsed data, with the schema's transforms applied", async () => {
    const result = await parseJsonBody(post(JSON.stringify({ name: "  Acme  ", count: 2, extra: true })), schema);

    expect(result).toEqual({ ok: true, data: { name: "Acme", count: 2 } });
  });

  it("refuses a body that isn't JSON", async () => {
    expect(await errorOf(await parseJsonBody(post("{not json"), schema))).toBe("Invalid request body.");
  });

  it.each(["null", "[]", '"Acme"', "42"])("treats %s as an empty object", async (body) => {
    expect(await errorOf(await parseJsonBody(post(body), schema))).toBe("name is required.");
  });

  it("reports the first invalid field in schema order", async () => {
    expect(await errorOf(await parseJsonBody(post(JSON.stringify({ count: "x" })), schema))).toBe("name is required.");
    expect(await errorOf(await parseJsonBody(post(JSON.stringify({ name: "Acme", count: "x" })), schema))).toBe(
      "count must be a number.",
    );
  });
});
