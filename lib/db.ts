import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(
  process.cwd(),
  "data"
);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true,
  });
}

const dbPath = path.join(
  dataDir,
  "jobpilot.db"
);

export const db =
  new Database(dbPath);

// =========================
// Applications
// =========================

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    job_id TEXT UNIQUE NOT NULL,

    company TEXT,
    contact_name TEXT,
    recruiter_title TEXT,

    title TEXT,
    salary TEXT,
    location TEXT,
    address TEXT,
    url TEXT,

    jd TEXT,

    job_family TEXT,
    role_type TEXT,
    seniority TEXT,
    industry TEXT,
    skills TEXT,

    score INTEGER,
    recommendation TEXT,

    match_summary TEXT,
    top_matches TEXT,
    main_gap TEXT,

    match_reasons TEXT,
    risks TEXT,

    greeting_message TEXT,

    status TEXT DEFAULT 'JOB_POOL',

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// =========================
// Settings
// =========================

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    skip_threshold INTEGER NOT NULL DEFAULT 60,
    greet_threshold INTEGER NOT NULL DEFAULT 80,

    updated_at TEXT NOT NULL
  )
`);

const existingSettings =
  db.prepare(`
    SELECT id
    FROM settings
    WHERE id = 1
  `).get();

if (!existingSettings) {
  db.prepare(`
    INSERT INTO settings (
      id,
      skip_threshold,
      greet_threshold,
      updated_at
    )
    VALUES (
      1,
      60,
      80,
      ?
    )
  `).run(
    new Date().toISOString()
  );
}

// =========================
// Lightweight migrations
// =========================

function columnExists(
  table: string,
  column: string
) {
  const columns =
    db.prepare(
      `PRAGMA table_info(${table})`
    ).all() as any[];

  return columns.some(
    (item) =>
      item.name === column
  );
}

function ensureColumn(
  table: string,
  column: string,
  definition: string
) {
  if (
    !columnExists(
      table,
      column
    )
  ) {
    db.exec(`
      ALTER TABLE ${table}
      ADD COLUMN ${column} ${definition}
    `);
  }
}

ensureColumn(
  "applications",
  "match_summary",
  "TEXT"
);

ensureColumn(
  "applications",
  "top_matches",
  "TEXT"
);

ensureColumn(
  "applications",
  "main_gap",
  "TEXT"
);