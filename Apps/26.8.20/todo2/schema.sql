-- The tables for this app, in generation v1.
--
-- {todos} is a token, not a table name: the server expands it to
-- todo2_v1_todos, so this app's rows cannot collide with another app's
-- in the one database they share. Declare every table here — queries.sql may
-- only name tokens that appear in this file.
--
-- Statements run on the app's first request and must be idempotent, hence
-- IF NOT EXISTS. Changing a column in place is not supported: bump `db:` in
-- _app.yaml to v2, edit this file, and copy the old rows in migrate.sql.

CREATE TABLE IF NOT EXISTS {todos} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index names share the same flat namespace as table names, so name one after
-- its table's token rather than inventing a bare name that another app could
-- also pick.
CREATE INDEX IF NOT EXISTS {todos}_done ON {todos} (done, id DESC);
