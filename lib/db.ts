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

    match_reasons TEXT,
    risks TEXT,

    greeting_message TEXT,

    status TEXT DEFAULT 'ANALYZED',

    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);