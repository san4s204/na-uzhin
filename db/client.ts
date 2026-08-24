import { env } from 'cloudflare:workers';
import { seedDishes } from '@/lib/dishes';

export function getDb(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

export async function ensureDatabase() {
  const db = getDb();
  await db.batch([
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
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS votes (
      dish_id TEXT NOT NULL,
      voter TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (dish_id, voter),
      FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
    )`),
  ]);

  const count = await db.prepare('SELECT COUNT(*) AS count FROM dishes').first<{ count: number }>();
  if (!count?.count) {
    await db.batch(seedDishes.map((dish) => db.prepare(`
      INSERT OR IGNORE INTO dishes
      (id, name, meta, minutes, category, note, image, color, price_band, created_by, is_custom, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(dish.id, dish.name, dish.meta, dish.minutes, dish.category, dish.note, dish.image, dish.color, dish.priceBand, dish.createdBy, dish.isCustom ? 1 : 0, dish.createdAt)));
  }
  return db;
}
