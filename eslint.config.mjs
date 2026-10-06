import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Dropping fields while copying an object (`const { payments: _payments, ...rest } = x`) is deliberate here, and a
  // name starting with "_" marks a value as intentionally unused.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, varsIgnorePattern: "^_", argsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  // Known debt, frozen when CI started (3 Oct 2026): these older screens set state synchronously inside an effect (15 places).
  // Rewriting them is its own change; until then the rule is a warning HERE ONLY, and stays an error for every other file, so no
  // new code adds to it. Remove a file from this list when it is fixed — never add one.
  {
    files: [
      "components/AdminBlogClient.tsx",
      "components/AdminCategoryDetailClient.tsx",
      "components/AdminClient.tsx",
      "components/AdminVendorFormClient.tsx",
      "components/AdminVendorListClient.tsx",
      "components/AdminVendorProspectsClient.tsx",
      "components/CategoryPageClient.tsx",
      "components/PlanPageClient.tsx",
      "components/admin/EventAdminClient.tsx",
      "components/homepage/FeaturedVendorsSection.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
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
