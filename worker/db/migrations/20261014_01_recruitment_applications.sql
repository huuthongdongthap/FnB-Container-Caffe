-- Migration: Add recruitment_applications and contact_messages tables
-- Date: 2026-10-14

CREATE TABLE IF NOT EXISTS recruitment_applications (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  birth_year TEXT,
  position TEXT NOT NULL DEFAULT 'barista',
  shifts TEXT NOT NULL DEFAULT '[]',
  experience TEXT DEFAULT 'none',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  category TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'unread',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recruitment_status ON recruitment_applications(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_created ON recruitment_applications(created_at);
