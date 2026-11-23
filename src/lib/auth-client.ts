import { createAuthClient } from "better-auth/react";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    passkeyClient(),
    // No `onTwoFactorRedirect`/`twoFactorPage` option here on purpose: the
    // login page itself inspects `signIn.email()`'s returned `data` for
    // `twoFactorRedirect` and renders the second-step form inline, rather
    // than doing a full page redirect/reload for a single-page login flow.
    twoFactorClient(),
  ],
});
