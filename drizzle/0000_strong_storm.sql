CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`item_type` text,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`channel` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`request_key` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_request_key_unique` ON `events` (`request_key`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_ref` text NOT NULL,
	`nickname` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`drive_ref` text DEFAULT '' NOT NULL,
	`due_at` text,
	`specialist_id` text,
	`audio_received` integer DEFAULT 0 NOT NULL,
	`delivered_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_order_ref_unique` ON `jobs` (`order_ref`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`asset_ref` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_items_job_type_unique` ON `work_items` (`job_id`,`type`);