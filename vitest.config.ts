import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Many tests hit the real dev database; when lint, typecheck and every
    // workspace's tests share the machine (`turbo run lint typecheck test`),
    // those calls can pass the default 5s and fail as false negatives.
    testTimeout: 15_000,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
