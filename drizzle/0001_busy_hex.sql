CREATE TABLE `legacy_imports` (
	`id` integer PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`display_name` text NOT NULL,
	`slot` integer NOT NULL,
	`joined_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_room_slot` ON `members` (`room_id`,`slot`);--> statement-breakpoint
CREATE INDEX `idx_members_room_id` ON `members` (`room_id`);--> statement-breakpoint
CREATE TABLE `room_votes` (
	`room_id` text NOT NULL,
	`dish_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`room_id`, `dish_id`, `member_id`),
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_room_votes_room_dish` ON `room_votes` (`room_id`,`dish_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`invite_hash` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_invite_hash` ON `rooms` (`invite_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_member_id` ON `sessions` (`member_id`);--> statement-breakpoint
ALTER TABLE `dishes` ADD `room_id` text;--> statement-breakpoint
ALTER TABLE `dishes` ADD `creator_member_id` text;--> statement-breakpoint
CREATE INDEX `idx_dishes_room_id` ON `dishes` (`room_id`);