@AGENTS.md

# Project: doctoral entrance exam test-prep (Mongolian)

## Stack
Next.js 16 App Router (TypeScript strict), Prisma ORM 7 + PostgreSQL (driver adapter @prisma/adapter-pg), Clerk (@clerk/nextjs, proxy.ts), Tailwind CSS + shadcn/ui, Zod, Vitest, Playwright.

## Non-negotiable rules
- All user-facing text is Mongolian (Cyrillic). Code, identifiers and comments are English.
- Option shuffling happens ONLY on the server when an attempt is created, and the order is persisted in AttemptItem.optionOrder. Never call Math.random in components or during render.
- Never send Option.isCorrect or the correct option id to the browser before the user has answered that item (practice) or submitted the attempt (exam).
- Display letters (А Б В Г Д Е) are derived from the display position and never stored.
- Every server action and route handler must: authenticate (requireUser / requireAdmin), check ownership, validate input with Zod. Never rely on proxy.ts alone.
- Mutations use Server Actions in src/server/actions. Reads live in src/server/queries and are called from Server Components.
- App code imports Prisma only from src/lib/db.ts. Standalone scripts use createPrismaClient() from src/lib/prisma.ts.
- Per-user pages are dynamic; never cache per-user data.
- Real question bank files in data/ are never committed (only data/template.xlsx).

## Commands
pnpm dev | build | lint | typecheck | test | db:up | db:migrate | db:generate | db:seed | db:studio | import:questions
(Add each script when the step that needs it is implemented.)
