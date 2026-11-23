import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { APP_URL } from "@/lib/env";

describe("GET /api/auth/get-session", () => {
  it("returns null with a 200 when no session cookie is present", async () => {
    const request = new Request(`${APP_URL}/api/auth/get-session`);
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBeNull();
  });
});
