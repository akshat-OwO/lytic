# AGENTS.md

Lytic is a web performance monitor in a pnpm/Turbo monorepo.

Monorepo layout

- apps/web: TanStack Start (React) frontend
- apps/observer: Puppeteer + Lighthouse observer service
- packages/backend: Convex backend (exports `api.ts`)
- packages/ui: shared shadcn/ui components
- packages/eslint-config: shared ESLint configs

Agent behavior requirements

- Use `frontend-design` skill for frontend UI work or styling tasks
- Use `convex` skill and Convex MCP tools for any Convex development

Cursor/Copilot rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.

Docs

- Convex: https://docs.convex.dev/home
- TanStack Start: https://tanstack.com/start/latest/docs/framework/react/overview
- TanStack Router: https://tanstack.com/router/latest/docs/framework/react/overview
- TanStack Query: https://tanstack.com/router/latest/docs/framework/react/overview

Tooling basics

- Package manager: pnpm (see `package.json` and `pnpm-workspace.yaml`)
- Root scripts use Turbo (`turbo dev/build/lint`)
- Node >= 20

Install / dev / build / lint / format (root)

- Install: `pnpm install`
- Dev (all apps): `pnpm dev`
- Build (all): `pnpm build`
- Lint (all): `pnpm lint`
- Format (root only): `pnpm format`

Web app (apps/web)

- Dev: `pnpm --filter web dev`
- Build: `pnpm --filter web build`
- Preview: `pnpm --filter web preview`
- Lint: `pnpm --filter web lint`
- Format: `pnpm --filter web format`
- Fix format + lint: `pnpm --filter web check`
- Tests (Vitest): `pnpm --filter web test`
- Single test file: `pnpm --filter web test path/to/test.ts`
- Single test by name: `pnpm --filter web test -t "test name"`

Observer app (apps/observer)

- Dev: `pnpm --filter observer dev`
- Build: `pnpm --filter observer build`
- Start: `pnpm --filter observer start`
- Lint: `pnpm --filter observer lint`
- Tests: none configured in package.json

Backend (packages/backend)

- Dev (Convex): `pnpm --filter @workspace/backend dev`
- Typecheck Convex: `pnpm --filter @workspace/backend typecheck`
- Generate api.ts: `pnpm --filter @workspace/backend ts-spec`
    - Run this after backend schema or function changes (updates `packages/backend/api.ts` used by web/observer)

UI package (packages/ui)

- Lint: `pnpm --filter @workspace/ui lint`
- Tests/build: none configured in package.json

Common workflows

- Backend schema or function change -> run `pnpm --filter @workspace/backend ts-spec`
- Add shadcn/ui component: `cd apps/web` then `pnpx shadcn@latest add <component>`
- New env var -> update `.env.example` files and check lint warnings

Environment files

- `apps/web/.env.example`
- `apps/observer/.env.example`
- `packages/backend/.env.example`

Formatting (Prettier)

- Config in `prettier.config.js`
- Tabs for indentation (`useTabs: true`, `tabWidth: 4`)
- Semicolons enabled
- Double quotes for strings
- Trailing commas enabled

Linting (ESLint)

- Shared configs in `packages/eslint-config`
- Web uses `@workspace/eslint-config/start` via `apps/web/eslint.config.js`
- Observer uses `@workspace/eslint-config/base` with strict unused vars rules
- UI uses `@workspace/eslint-config/react-internal`
- Root `.eslintrc.js` only applies at repo root
- `simple-import-sort` is enabled in shared configs

TypeScript rules

- ESM modules everywhere (`"type": "module"` in packages)
- Strict mode enabled via shared TS config
- `noUncheckedIndexedAccess: true`
- `jsx: react-jsx` across React code
- Convex TS config uses `moduleResolution: "Bundler"`

Import conventions

- Group imports by package/absolute/local (auto-sorted by simple-import-sort)
- Use type-only imports when possible (`import type { Foo }`)
- Use workspace aliases
- `@/` in `apps/web` for `src`
- `@workspace/ui/*` for shared UI
- `@workspace/backend` for Convex API types

Naming conventions

- React components: PascalCase (`Button`, `DashboardHeader`)
- Files: lower-case with hyphens unless feature conventions differ
- Convex functions: camelCase (`createJob`, `updateJobStatus`)
- Branded types use Zod brands (`JobId`)

Error handling and validation

- Observer uses Effect and tagged errors (see `apps/observer/src/lib/monitor.ts`)
- Prefer `Data.TaggedError` for operational failures
- Log errors with context fields (jobId, url, deviceType, status codes)
- Convex call failures in observer wrap as `ConvexRequestError`
- Use Zod for validation in observer and env handling

Convex backend notes

- Schema in `packages/backend/convex/schema.ts`
- Queries/mutations in `packages/backend/convex/*.ts`
- Do not edit generated files in `packages/backend/convex/_generated`

TanStack Start notes

- Router in `apps/web/src/router.tsx`
- Root route in `apps/web/src/routes/__root.tsx`
- Use `createFileRoute` for new pages

UI package notes

- Components in `packages/ui/src/components`
- Utilities in `packages/ui/src/lib`
- `cn` helper uses clsx + tailwind-merge
- Variants use class-variance-authority

Do not

- Do not commit secrets from `.env` files
