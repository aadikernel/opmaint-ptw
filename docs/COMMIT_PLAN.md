# Suggested commit order

Commit these yourself, one at a time, while you read and run each stage. Real history = you reviewing real work.

```bash
git init && git branch -M main
git add .gitignore README.md docs && git add server/package.json server/package-lock.json server/tsconfig*.json server/.env.example server/.gitignore client/package.json client/package-lock.json client/tsconfig.json client/vite.config.ts client/index.html client/.env.example client/.gitignore
git commit -m "chore: initialize monorepo, server and client scaffolds"

git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(db): add prisma schema, migrations and immutable audit trigger"

git add server/src/config server/src/db server/src/utils server/src/middleware server/src/controllers/authController.ts
git commit -m "feat(auth): add env config, JWT auth middleware and login"

git add server/src/stateMachine server/src/policies server/src/permitTypes
git commit -m "feat(permits): add state machine, permission policies and permit type registry"

git add server/src/services server/src/validators server/src/controllers server/src/routes server/src/app.ts server/src/server.ts server/src/jobs
git commit -m "feat(permits): add permit APIs, workflow service, audit logging and expiry job"

git add server/prisma/seed.ts
git commit -m "feat(db): add seed script"

git add server/tests server/vitest.config.mts
git commit -m "test: add state machine, permission and API tests"

git add client/src/index.css client/src/main.tsx client/src/App.tsx client/src/api client/src/auth client/src/lib client/src/components/ui.tsx client/src/components/AppShell.tsx client/src/components/StatusBadge.tsx client/src/components/Countdown.tsx client/src/components/PermitRow.tsx client/src/pages/LoginPage.tsx client/src/pages/DashboardPage.tsx client/src/pages/ApprovalsPage.tsx client/vercel.json
git commit -m "feat(ui): add layout, login and permit dashboard"

git add client/src/permitTypes client/src/components/permit-form client/src/pages/PermitFormPage.tsx
git commit -m "feat(ui): add dynamic multi-step permit form"

git add client/src/components/permit client/src/pages/PermitDetailPage.tsx client/src/pages/AdminPage.tsx
git commit -m "feat(ui): add permit detail, approvals, closure, audit timeline and admin"
```

Then keep committing real fixes (deployment problems, bugs you find) as separate `fix:` commits.
