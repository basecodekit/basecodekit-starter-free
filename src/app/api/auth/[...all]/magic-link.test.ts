import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";
import { sendMagicLinkEmail } from "@/lib/email";
import { APP_URL } from "@/lib/env";
import { authConfig } from "@/config/auth.config";

function requestMagicLink(email: string) {
  return POST(
    new Request(`${APP_URL}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: "/" }),
    }),
  );
}

// Off in authConfig: the plugin isn't loaded, so there is nothing to test.
describe.skipIf(!authConfig.magicLink)("POST /api/auth/sign-in/magic-link", () => {
  beforeEach(() => {
    vi.mocked(sendMagicLinkEmail).mockClear();
  });

  it("sends a magic link on request", async () => {
    const response = await requestMagicLink(`rate-limit-ok-${crypto.randomUUID()}@example.com`);

    expect(response.status).toBe(200);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
  });

  it("rate-limits repeated requests for the same email", async () => {
    const email = `rate-limit-trip-${crypto.randomUUID()}@example.com`;

    for (let i = 0; i < 5; i++) {
      const response = await requestMagicLink(email);
      expect(response.status).toBe(200);
    }

    const blocked = await requestMagicLink(email);
    expect(blocked.status).toBe(429);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(5);
  });
});
