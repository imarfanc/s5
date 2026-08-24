-- Every query this app can run. The browser sends a name from this file and
-- its parameters; it cannot send SQL. One statement per name, `?` placeholders
-- filled in order, {todos} expanded to this app's physical table.

-- name: listTodos
SELECT id, text, done FROM {todos} ORDER BY done, id DESC;

-- name: addTodo
INSERT INTO {todos} (text) VALUES (?);

-- name: setDone
UPDATE {todos} SET done = ? WHERE id = ?;

-- name: deleteTodo
DELETE FROM {todos} WHERE id = ?;

-- name: clearDone
DELETE FROM {todos} WHERE done = 1;
