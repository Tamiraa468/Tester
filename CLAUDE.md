@AGENTS.md

# Project: doctoral entrance exam test-prep (Mongolian)

## Stack
Next.js 16 App Router (TypeScript strict), Prisma ORM 7 + PostgreSQL (driver adapter @prisma/adapter-pg), Clerk (@clerk/nextjs, proxy.ts), Tailwind CSS + shadcn/ui, Zod, Vitest, Playwright.

## Non-negotiable rules
- All user-facing text is Mongolian (Cyrillic). Code, identifiers and comments are English.
- Option shuffling happens ONLY on the server when an attempt is created, and the order is persisted in AttemptItem.optionOrder. Never call Math.random in components or during render.
- Never send Option.isCorrect or the correct option id to the browser before the user has answered that item (practice) or submitted the attempt (exam).
- Display letters are a b c d e f (Latin, as in the printed book), derived from the display position and never stored.
- Every server action and route handler must: authenticate (requireUser / requireAdmin), check ownership, validate input with Zod. Never rely on proxy.ts alone.
- Zod 4 idioms (`z.cuid()`, `z.strictObject`, `{ error }`). Use `z.cuid()` ONLY for ids Prisma generates (`@default(cuid())`). Hand-set ids are validated as plain non-empty strings: seeded ExamPreset ids such as "seed-preset-trial" are not cuids, so `presetId` uses `z.string().min(1)`.
- Never accept question ids from the client. A retry sends `fromAttemptId`; the server checks ownership and derives the questions (src/server/queries/questions.ts).
- Mutations use Server Actions in src/server/actions. Reads live in src/server/queries and are called from Server Components.
- src/server/mutations holds internal write helpers (`import "server-only"`, no `"use server"`). They do no auth checks, so they are never exported from a `"use server"` file; only server actions call them, passing the authenticated user's id.
- QuestionProgress is written ONLY through `applyProgress()` (src/server/mutations/progress.ts): INSERT ... ON CONFLICT DO NOTHING, then SELECT ... FOR UPDATE ordered by questionId, then one UPDATE, all inside the caller's transaction.
- `startExam()` is the only code path that creates EXAM attempts. It holds `pg_advisory_xact_lock(hashtext('exam:' || userId))`, so a user never has two exams in progress. Exam saves lock the attempt row FOR SHARE and submit/finalize lock it FOR UPDATE, so no answer is saved after grading.
- Any page that shows a user's attempts or progress (/practice, /exam, and the step 8 dashboard) first calls `finalizeMyExpiredExam()`, so an expired open exam is graded before anything is listed.
- Attempt, exam and progress timestamps come from `now()` in src/lib/clock.ts (never `new Date()` or the database default), so the database suite can move the clock.
- App code imports Prisma only from src/lib/db.ts. Standalone scripts use createPrismaClient() from src/lib/prisma.ts.
- Per-user pages are dynamic; never cache per-user data.
- Real question bank files in data/ are never committed (only data/template.xlsx).
- Stay on Prisma ORM 7.10.x: prisma, @prisma/client and @prisma/adapter-pg are pinned to exact 7.10.x versions. Ignore Prisma's "Update available ... 8.x" notice (npm's "latest" tag currently points to the v8 release candidate).
- Never upgrade any dependency to a new major version without asking the user first.
- Never run git commit, git push or any command that rewrites git history. The user reviews and commits every step; git status and git diff are fine.

## UI
- Question and explanation text is set in Literata (`font-serif`); the interface is Inter (`font-sans`). Both load cyrillic-ext, which Ө ө Ү ү need.
- The answer list is an ARIA **listbox** (`role="listbox"` / `role="option"`, roving tabindex), not a radio group: arrow keys move focus ONLY. Choosing is deliberate — click/tap, Enter/Space, or the digit 1-6 of the display position. In practice mode choosing submits the answer, so selection must never follow focus.
- Shortcuts match `event.code`, never `event.key` (the Mongolian layout's number row does not type digits, and letter keys type Cyrillic): `Digit1-6`/`Numpad1-6` choose an option, `Enter`/`NumpadEnter`/`Space` choose the FOCUSED option only, `KeyF` flags (exam), `Shift+Slash` (or key "?") opens the shortcut help. The mapping lives in src/lib/quiz/keyboard.ts and is unit-tested.
- Enter is never a page-level shortcut. After a practice answer, focus moves to "Дараагийн асуулт", so the next Enter is a deliberate press on it. Auto-repeat (`event.repeat`) is ignored everywhere, so holding Enter never skips feedback. No shortcut fires while a dialog is open or focus is in a text field.
- Wording: "Эргэж харах" (flag icon, shortcut F) is the exam flag on AttemptItem.flagged. "Тэмдэглэх" / "Тэмдэглэсэн" (bookmark icon) is the Bookmark model, used in practice and on /review. They are never mixed.
- Correct/wrong/flagged use the `success`, `destructive` and `warning` tokens, and are always spelled out in text as well as colour.
- /dev/ui is a developer-only showcase of the quiz UI built from fixtures (src/app/dev/ui). It has no auth and no database, and `notFound()`s in production.

## Auth (Clerk)
- src/proxy.ts only runs clerkMiddleware() with no auth or role checks (createRouteMatcher is deprecated). Protection lives in each resource: pages, layouts, route handlers and server actions call requireUser() / requireAdmin() from src/lib/auth.ts (requireUser() calls auth.protect()). Check in pages as well as layouts, since layouts don't re-run on client navigation.
- Every new page, layout, route handler and server action must pass the ESLint rule @clerk/next/require-auth-protection (@clerk/eslint-plugin, pinned exactly because the rule is experimental). Never silence it with eslint-disable comments.
- Signed-in/out UI uses <Show when="signed-in|signed-out"> from @clerk/nextjs (SignedIn/SignedOut/Protect are removed in v7).
- Admin role = Clerk user publicMetadata { "role": "admin" }. The session token must be customized in the Clerk Dashboard (Sessions) with { "metadata": "{{user.public_metadata}}" }, otherwise sessionClaims.metadata is missing and nobody is admin.
- Never print the values of Clerk keys from .env.

## Commands
pnpm dev | build | lint | typecheck | test | test:db | test:db:setup | db:up | db:migrate | db:generate | db:seed | db:studio | db:reset | import:questions
(Add each script when the step that needs it is implemented.)

## Question bank data
- Source files live in data/source/ and are never committed (only data/template.xlsx is; regenerate it with `pnpm template:make`).
- In the printed book the correct answer is ALWAYS the last option. A future book -> template converter must therefore set `correct` to the last option's letter, and flag every question whose option count is not 4 for manual review (the assumption is only verified for 4-option questions).
- Import pipeline: src/lib/import (read -> parse -> validate -> commit), independent of Next.js so the admin panel can reuse it. CLI: `pnpm import:questions <file> [--dry-run]`.
- commit() updates existing options IN PLACE by sortOrder so Option ids stay stable for AttemptItem.optionOrder; it never deletes options of a question that already has attempts.

## Database
- Node 24 (.nvmrc). Local PostgreSQL 17 runs in Docker (compose project "phd-prep"): `pnpm db:up`. It listens on host port 5433, not 5432 (5432 is used by another local project).
- Prisma 7 `migrate dev` does NOT run `prisma generate` or the seed. After editing prisma/schema.prisma run `pnpm db:migrate`, then `pnpm db:generate`, then `pnpm db:seed` if needed.
- DATABASE_URL is the app's runtime connection (pooled in production). DIRECT_URL (direct, non-pooled) is required only for migrate, seed and import commands; prisma.config.ts falls back to "" so `prisma generate` (postinstall) works without it.
- Database suite: `pnpm test:db` runs `src/**/*.db.test.ts` (vitest.db.config.mts) ONLY against `TEST_DATABASE_URL`, a separate `phd_prep_test` database in the same container (`pnpm test:db:setup` creates it). It never falls back to DATABASE_URL / DIRECT_URL, refuses any database whose name does not end with `_test`, applies migrations first, and fails if a test leaves rows behind. Tests create their data through `TestScope` (src/test/db/fixtures.ts) and clean it up in `afterEach`. `pnpm test` excludes these files.
- The generated client lives in src/generated/prisma (gitignored). Import types and enums from "@/generated/prisma/client" or "@/generated/prisma/enums", never from "@prisma/client".
