import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Org-scoped-query discipline (Step 2.4, per the blueprint's Security
 * Checklist: "every org-scoped query enforces org_id server-side ... this
 * is the single most damaging bug class for a boilerplate resold to many
 * end-customers"). No custom ESLint plugin infra exists in this repo yet,
 * and building one just to author a single rule would be disproportionate
 * — `no-restricted-imports` (a built-in rule) gets the same enforcement for
 * free: route/page code under `src/app/**` may not import
 * `getCurrentOrgMembership`/`getMembershipForOrg` directly from
 * `@/lib/current-org`, forcing it through `requireOrgAccess()`
 * (`@/lib/require-org-access`) instead, which is built on top of those same
 * two functions but adds the minimum-role check and a consistent
 * 401/403/404 error contract.
 *
 * Legitimate exceptions are listed in `ignores` below, and each one MUST
 * also carry an explanatory `// ORG-SCOPED-QUERY: exempt because ...`
 * comment at its own call site (see those files) — the two together are
 * this repo's reviewable "why is this route allowed to bypass the helper"
 * trail, in lieu of a separate checklist document.
 */
const orgScopedQueryDiscipline = {
  files: ["src/app/**/*.{ts,tsx}"],
  ignores: [
    // Checks for the ABSENCE of an org membership (to decide whether org
    // creation is allowed), not access to an existing one — see this
    // file's own ORG-SCOPED-QUERY comment.
    "src/app/api/org/route.ts",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/lib/current-org",
            importNames: ["getCurrentOrgMembership", "getMembershipForOrg"],
            message:
              "Org-scoped queries must go through requireOrgAccess() from '@/lib/require-org-access' instead of calling current-org's building blocks directly. If this call site is a genuine exception, add it to this rule's `ignores` in eslint.config.mjs with a matching '// ORG-SCOPED-QUERY: exempt because ...' comment at the call site.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  orgScopedQueryDiscipline,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
