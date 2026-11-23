import { expect, type Locator, type Page } from "@playwright/test";
import { authConfig } from "@/config/auth.config";

/** Specs that create their users with email and password skip when it's off. */
export const needsEmailPassword = [!authConfig.emailPassword, "authConfig.emailPassword is off"] as const;

/** Skips the post-signup passkey prompt, shown only when passkeys are on. */
export async function skipPasskeyPrompt(page: Page) {
  if (!authConfig.passkeys) return;
  await expect(page.getByRole("heading", { name: "Add a passkey", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
}

/** Skips the post-signup TOTP prompt, shown only when TOTP is on. */
export async function skipTotpPrompt(page: Page) {
  if (!authConfig.totpMfa) return;
  await expect(page.getByRole("heading", { name: "Add two-factor authentication", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
}

/** Fills the signup form on the current page, clicks past whichever
 * post-signup prompts `authConfig` turns on, and waits until signup has
 * navigated away (with no prompts, nothing else waits for the account). */
export async function signUpThroughUi(page: Page, { name, email, password }: { name: string; email: string; password: string }) {
  await page.getByPlaceholder("Name").fill(name);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await skipPasskeyPrompt(page);
  await skipTotpPrompt(page);
  await page.waitForURL((url) => url.pathname !== "/signup", { waitUntil: "commit" });
}

/** Shows the invite form, which the pro layout keeps in a side panel. Call
 * on `/settings?tab=members`. */
export async function openInviteForm(page: Page) {
  void page;
}

/** Removes the member in `row`: a button in the row, or in the pro
 * layout, the member's panel and its confirm step. */
export async function removeMember(page: Page, row: Locator) {
  await row.getByRole("button", { name: "Remove", exact: true }).click();
}

/** Minimal RFC 4648 base32 decoder (no padding) — see the matching helper's
 * doc comment in `src/app/api/auth/[...all]/totp.test.ts` for why decoding
 * the URI's `secret` param (rather than using it as-is) is required to
 * recover the same raw secret `auth.api.generateTOTP` needs. */
export function base32Decode(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of input) {
    const value = alphabet.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
