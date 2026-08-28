import { env } from 'cloudflare:workers';
import { seedDishes } from '@/lib/dishes';

export function getDb(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

export async function ensureDatabase() {
  const db = getDb();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      invite_hash TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      room_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      slot INTEGER NOT NULL,
      joined_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS legacy_imports (
      id INTEGER PRIMARY KEY NOT NULL,
      room_id TEXT NOT NULL,
      imported_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS dishes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      meta TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      category TEXT NOT NULL,
      note TEXT NOT NULL,
      image TEXT NOT NULL,
      color TEXT NOT NULL,
      price_band TEXT DEFAULT '₽₽' NOT NULL,
      created_by TEXT DEFAULT 'На ужин' NOT NULL,
      is_custom INTEGER DEFAULT 0 NOT NULL,
      room_id TEXT,
      creator_member_id TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS votes (
      dish_id TEXT NOT NULL,
      voter TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (dish_id, voter),
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS room_votes (
      room_id TEXT NOT NULL,
      dish_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (room_id, dish_id, member_id),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )`),
  ]);

  const dishColumns = await db.prepare('PRAGMA table_info(dishes)').all<{ name: string }>();
  const names = new Set(dishColumns.results.map((column) => column.name));
  if (!names.has('room_id')) await db.prepare('ALTER TABLE dishes ADD COLUMN room_id TEXT').run();
  if (!names.has('creator_member_id')) await db.prepare('ALTER TABLE dishes ADD COLUMN creator_member_id TEXT').run();

  await db.batch([
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_invite_hash ON rooms(invite_hash)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_room_slot ON members(room_id, slot)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_members_room_id ON members(room_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON sessions(member_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_dishes_room_id ON dishes(room_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_room_votes_room_dish ON room_votes(room_id, dish_id)'),
  ]);

  const count = await db.prepare('SELECT COUNT(*) AS count FROM dishes').first<{ count: number }>();
  if (!count?.count) {
    await db.batch(seedDishes.map((dish) => db.prepare(`
      INSERT OR IGNORE INTO dishes
      (id, name, meta, minutes, category, note, image, color, price_band, created_by, is_custom, room_id, creator_member_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
    `).bind(dish.id, dish.name, dish.meta, dish.minutes, dish.category, dish.note, dish.image, dish.color, dish.priceBand, dish.createdBy, dish.isCustom ? 1 : 0, dish.createdAt)));
  }
  await db.prepare('PRAGMA optimize').run();
  return db;
}
