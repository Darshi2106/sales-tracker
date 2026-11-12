CREATE TABLE IF NOT EXISTS tracker_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tracker_roles (email TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('sales','ops','management','admin')));
