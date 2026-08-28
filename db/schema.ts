import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  inviteHash: text('invite_hash'),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_rooms_invite_hash').on(table.inviteHash)]);

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  slot: integer('slot').notNull(),
  joinedAt: text('joined_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_members_room_slot').on(table.roomId, table.slot),
  index('idx_members_room_id').on(table.roomId),
]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_sessions_member_id').on(table.memberId)]);

export const legacyImports = sqliteTable('legacy_imports', {
  id: integer('id').primaryKey(),
  roomId: text('room_id').notNull(),
  importedAt: text('imported_at').notNull(),
});

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
  roomId: text('room_id'),
  creatorMemberId: text('creator_member_id'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_dishes_room_id').on(table.roomId)]);

// Kept so the original two-person data can be imported once into a private room.
export const legacyVotes = sqliteTable('votes', {
  dishId: text('dish_id').notNull().references(() => dishes.id, { onDelete: 'cascade' }),
  voter: text('voter').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [primaryKey({ columns: [table.dishId, table.voter] })]);

export const roomVotes = sqliteTable('room_votes', {
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  dishId: text('dish_id').notNull().references(() => dishes.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.dishId, table.memberId] }),
  index('idx_room_votes_room_dish').on(table.roomId, table.dishId),
]);
