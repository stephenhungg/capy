CREATE TABLE `executor_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`work_item_id` text NOT NULL,
	`authorization_object_id` text NOT NULL,
	`authorization_digest` text NOT NULL,
	`network` text NOT NULL,
	`state` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_by_principal_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `executor_handoffs_work_item_unique` ON `executor_handoffs` (`work_item_id`);--> statement-breakpoint
CREATE INDEX `executor_handoffs_queue_idx` ON `executor_handoffs` (`organization_id`,`state`,`created_at`);--> statement-breakpoint
CREATE TABLE `organization_bootstrap_claims` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`claimed_by_principal_id` text NOT NULL,
	`claimed_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`claimed_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organization_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`invited_by_principal_id` text NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invites_email_unique` ON `organization_invites` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `organization_invites_status_idx` ON `organization_invites` (`organization_id`,`status`);--> statement-breakpoint
ALTER TABLE `protocol_objects` ADD `storage_digest` text;--> statement-breakpoint
ALTER TABLE `trust_gates` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trust_gates` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `trust_gates` ADD `request_digest` text;--> statement-breakpoint
CREATE UNIQUE INDEX `trust_gates_idempotency_unique` ON `trust_gates` (`idempotency_key`);--> statement-breakpoint
ALTER TABLE `work_items` ADD `depends_on_work_item_id` text;--> statement-breakpoint
ALTER TABLE `work_items` ADD `request_digest` text;
