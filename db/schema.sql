CREATE TABLE IF NOT EXISTS users (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  current_level integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS countries (
  id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            text    NOT NULL,
  iso_code        text    NOT NULL UNIQUE,
  flag_path       text    NOT NULL,
  difficulty_tier integer NOT NULL CHECK (difficulty_tier BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS user_progress (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_id  integer NOT NULL,
  completed integer NOT NULL DEFAULT 0,
  attempts  integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, level_id)
);
