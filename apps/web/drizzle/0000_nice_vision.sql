CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`capability_id` text,
	`actor_principal_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_organization_idx` ON `audit_events` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`protocol_object_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`status` text NOT NULL,
	`data_class` text NOT NULL,
	`environment` text NOT NULL,
	`embodiment` text NOT NULL,
	`payout_network` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `capabilities_organization_idx` ON `capabilities` (`organization_id`);--> statement-breakpoint
CREATE TABLE `lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`capability_id` text NOT NULL,
	`stage` text NOT NULL,
	`label` text NOT NULL,
	`state` text NOT NULL,
	`occurred_at` text NOT NULL,
	`object_id` text,
	`sequence` integer NOT NULL,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`object_id`) REFERENCES `protocol_objects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lifecycle_events_capability_idx` ON `lifecycle_events` (`capability_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lifecycle_events_sequence_unique` ON `lifecycle_events` (`capability_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`organization_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`organization_id`, `principal_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`principal_id`) REFERENCES `principals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `memberships_principal_idx` ON `memberships` (`principal_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`environment` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `principals` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `principals_email_unique` ON `principals` (`email`);--> statement-breakpoint
CREATE TABLE `protocol_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`capability_id` text NOT NULL,
	`object_type` text NOT NULL,
	`schema_version` text NOT NULL,
	`issued_at` text NOT NULL,
	`digest` text NOT NULL,
	`signer_key_id` text NOT NULL,
	`signature_state` text NOT NULL,
	`artifact_state` text NOT NULL,
	`trust_state` text NOT NULL,
	`sequence` integer NOT NULL,
	`r2_key` text NOT NULL,
	`synthetic` integer NOT NULL,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `protocol_objects_capability_idx` ON `protocol_objects` (`capability_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `protocol_objects_sequence_unique` ON `protocol_objects` (`capability_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `protocol_objects_digest_unique` ON `protocol_objects` (`digest`);--> statement-breakpoint
CREATE TABLE `trust_gates` (
	`id` text PRIMARY KEY NOT NULL,
	`capability_id` text NOT NULL,
	`gate_type` text NOT NULL,
	`label` text NOT NULL,
	`state` text NOT NULL,
	`evidence_ref` text NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`reason` text,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trust_gates_capability_idx` ON `trust_gates` (`capability_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trust_gates_type_unique` ON `trust_gates` (`capability_id`,`gate_type`);