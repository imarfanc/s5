-- Only needed when `db:` moves past v1. Copy to `migrate.sql` in the app folder.
--
-- The new generation's tables have just been created and are empty; `{prev.x}`
-- names the same table in the generation before. This runs once — the server
-- records it in `sites5_migrations` in the same transaction, so a failure
-- leaves neither copied rows nor a bookkeeping row and the next request retries
-- the whole thing.
--
-- The old tables are left in place. Drop them by hand once the new generation
-- has proved itself.

INSERT INTO {items} (id, name, created_at)
SELECT id, name, created_at FROM {prev.items};
