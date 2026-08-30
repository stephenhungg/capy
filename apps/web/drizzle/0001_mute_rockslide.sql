CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`required_role` text NOT NULL,
	`action_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`state` text NOT NULL,
	`precondition_json` text NOT NULL,
	`result_json` text,
	`version` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text,
	`completed_by` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `work_items_queue_idx` ON `work_items` (`organization_id`,`required_role`,`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_items_action_unique` ON `work_items` (`capability_id`,`action_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_items_idempotency_unique` ON `work_items` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `workflow_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`work_item_id` text NOT NULL,
	`from_version` integer NOT NULL,
	`to_version` integer NOT NULL,
	`actor_principal_id` text NOT NULL,
	`acted_as_role` text NOT NULL,
	`event` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_transitions_version_unique` ON `workflow_transitions` (`work_item_id`,`from_version`);--> statement-breakpoint
CREATE INDEX `workflow_transitions_item_idx` ON `workflow_transitions` (`work_item_id`,`created_at`);