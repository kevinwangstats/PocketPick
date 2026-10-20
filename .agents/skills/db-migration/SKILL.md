---
name: db-migration
description: Step-by-step instructions for managing and verifying SQLite schema migrations with Drizzle ORM in PocketPick.
---

# Database Migration Workflow

When modifying the relational schema for PocketPick:

## 1. Schema Editing

1. Edit `src/db/schema.ts` to add or modify tables, columns, or indexes.
2. Ensure foreign key constraints define appropriate cascade rules (e.g., `onDelete: 'cascade'`).
3. Keep timestamp fields typed with `{ mode: 'timestamp' }`.

## 2. Generating Migration Files

Run Drizzle Kit to generate SQL migration files:

```bash
npx drizzle-kit generate
```

Verify the generated SQL files in `src/db/migrations/`. Check that no table drops or unintended column renames occurred.

## 3. Testing Migrations

Run database schema tests:

```bash
npm test -- __tests__/db/schema.test.ts
```

## 4. Migration Rollback & Recovery

If a migration fails during runtime:

- SQLCipher transactions ensure database state is rolled back cleanly.
- Verify migrations run inside a `BEGIN IMMEDIATE` / `COMMIT` transaction block in `src/db/client.ts`.
