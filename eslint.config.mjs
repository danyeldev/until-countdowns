import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const NO_WALL_CLOCK_MESSAGE =
  "Server-rendered catalog code must not read the wall clock: day arithmetic belongs in SQL " +
  "(events_public.days_until, passed as initialDays) and live ticking in the client via useNow() (src/lib/use-now.ts).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // Catalog reads and server components: no Date.now() / new Date() so that cached and
    // prerendered output never bakes in a render-time clock. Client components, route
    // handlers, time.ts and use-now.ts are exempt.
    files: [
      "src/lib/catalog.ts",
      "src/components/EventCard.tsx",
      "src/components/FeaturedHero.tsx",
      "src/components/CatalogExplorer.tsx",
      "src/components/CategoryBar.tsx",
      "src/components/Footer.tsx",
      "src/app/**/page.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: NO_WALL_CLOCK_MESSAGE,
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: NO_WALL_CLOCK_MESSAGE,
        },
      ],
    },
  },
]);

export default eslintConfig;
