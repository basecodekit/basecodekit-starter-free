import type { z } from "zod";

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Reads a route's JSON body and validates it against `schema`: the one
 * input check at every API route boundary that takes a body.
 *
 * - Not JSON: 400 "Invalid request body."
 * - JSON that isn't an object (`null`, an array, a string): validated as
 *   `{}`, so it fails on the schema's first required field.
 * - Invalid: 400 with the first issue's message, in the schema's field
 *   order. Give every check its own message; Zod's defaults aren't meant
 *   for end users.
 */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<ParsedBody<z.output<S>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid request body." }, { status: 400 }) };
  }

  const input = typeof body === "object" && body !== null && !Array.isArray(body) ? body : {};
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body.";
    return { ok: false, response: Response.json({ error: message }, { status: 400 }) };
  }
  return { ok: true, data: result.data };
}
