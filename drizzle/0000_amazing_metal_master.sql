CREATE TABLE `dishes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`meta` text NOT NULL,
	`minutes` integer NOT NULL,
	`category` text NOT NULL,
	`note` text NOT NULL,
	`image` text NOT NULL,
	`color` text NOT NULL,
	`price_band` text DEFAULT '₽₽' NOT NULL,
	`created_by` text DEFAULT 'На ужин' NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`dish_id` text NOT NULL,
	`voter` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`dish_id`, `voter`),
	FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON UPDATE no action ON DELETE cascade
);
