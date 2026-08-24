import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dishes = sqliteTable('dishes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  meta: text('meta').notNull(),
  minutes: integer('minutes').notNull(),
  category: text('category').notNull(),
  note: text('note').notNull(),
  image: text('image').notNull(),
  color: text('color').notNull(),
  priceBand: text('price_band').notNull().default('₽₽'),
  createdBy: text('created_by').notNull().default('На ужин'),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const votes = sqliteTable('votes', {
  dishId: text('dish_id').notNull().references(() => dishes.id, { onDelete: 'cascade' }),
  voter: text('voter').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.dishId, table.voter] })]);
