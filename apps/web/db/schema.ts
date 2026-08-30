import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const organizations = sqliteTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    environment: text('environment').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('organizations_slug_unique').on(table.slug)],
);

export const principals = sqliteTable(
  'principals',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [uniqueIndex('principals_email_unique').on(table.email)],
);

export const memberships = sqliteTable(
  'memberships',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    principalId: text('principal_id')
      .notNull()
      .references(() => principals.id),
    role: text('role').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.principalId] }),
    index('memberships_principal_idx').on(table.principalId),
  ],
);

export const capabilities = sqliteTable(
  'capabilities',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    protocolObjectId: text('protocol_object_id').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    status: text('status').notNull(),
    dataClass: text('data_class').notNull(),
    environment: text('environment').notNull(),
    embodiment: text('embodiment').notNull(),
    payoutNetwork: text('payout_network').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('capabilities_organization_idx').on(table.organizationId)],
);

export const protocolObjects = sqliteTable(
  'protocol_objects',
  {
    id: text('id').primaryKey(),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id),
    objectType: text('object_type').notNull(),
    schemaVersion: text('schema_version').notNull(),
    issuedAt: text('issued_at').notNull(),
    digest: text('digest').notNull(),
    signerKeyId: text('signer_key_id').notNull(),
    signatureState: text('signature_state').notNull(),
    artifactState: text('artifact_state').notNull(),
    trustState: text('trust_state').notNull(),
    sequence: integer('sequence').notNull(),
    r2Key: text('r2_key').notNull(),
    storageDigest: text('storage_digest'),
    synthetic: integer('synthetic', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    index('protocol_objects_capability_idx').on(table.capabilityId),
    uniqueIndex('protocol_objects_sequence_unique').on(table.capabilityId, table.sequence),
    uniqueIndex('protocol_objects_digest_unique').on(table.digest),
  ],
);

export const lifecycleEvents = sqliteTable(
  'lifecycle_events',
  {
    id: text('id').primaryKey(),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id),
    stage: text('stage').notNull(),
    label: text('label').notNull(),
    state: text('state').notNull(),
    occurredAt: text('occurred_at').notNull(),
    objectId: text('object_id').references(() => protocolObjects.id),
    sequence: integer('sequence').notNull(),
  },
  (table) => [
    index('lifecycle_events_capability_idx').on(table.capabilityId),
    uniqueIndex('lifecycle_events_sequence_unique').on(table.capabilityId, table.sequence),
  ],
);

export const trustGates = sqliteTable(
  'trust_gates',
  {
    id: text('id').primaryKey(),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id),
    gateType: text('gate_type').notNull(),
    label: text('label').notNull(),
    state: text('state').notNull(),
    evidenceRef: text('evidence_ref').notNull(),
    decidedBy: text('decided_by'),
    decidedAt: text('decided_at'),
    reason: text('reason'),
    version: integer('version').notNull().default(0),
    idempotencyKey: text('idempotency_key'),
    requestDigest: text('request_digest'),
  },
  (table) => [
    index('trust_gates_capability_idx').on(table.capabilityId),
    uniqueIndex('trust_gates_type_unique').on(table.capabilityId, table.gateType),
    uniqueIndex('trust_gates_idempotency_unique').on(table.idempotencyKey),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    capabilityId: text('capability_id'),
    actorPrincipalId: text('actor_principal_id').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    detailJson: text('detail_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_events_organization_idx').on(table.organizationId, table.createdAt)],
);

export const workItems = sqliteTable(
  'work_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id),
    requiredRole: text('required_role').notNull(),
    actionType: text('action_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    state: text('state').notNull(),
    preconditionJson: text('precondition_json').notNull(),
    dependsOnWorkItemId: text('depends_on_work_item_id'),
    resultJson: text('result_json'),
    version: integer('version').notNull().default(0),
    idempotencyKey: text('idempotency_key'),
    requestDigest: text('request_digest'),
    completedBy: text('completed_by').references(() => principals.id),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('work_items_queue_idx').on(
      table.organizationId,
      table.requiredRole,
      table.state,
    ),
    uniqueIndex('work_items_action_unique').on(
      table.capabilityId,
      table.actionType,
    ),
    uniqueIndex('work_items_idempotency_unique').on(table.idempotencyKey),
  ],
);

export const organizationBootstrapClaims = sqliteTable(
  'organization_bootstrap_claims',
  {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => organizations.id),
    claimedByPrincipalId: text('claimed_by_principal_id')
      .notNull()
      .references(() => principals.id),
    claimedAt: text('claimed_at').notNull(),
  },
);

export const organizationInvites = sqliteTable(
  'organization_invites',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull(),
    invitedByPrincipalId: text('invited_by_principal_id')
      .notNull()
      .references(() => principals.id),
    createdAt: text('created_at').notNull(),
    acceptedAt: text('accepted_at'),
  },
  (table) => [
    uniqueIndex('organization_invites_email_unique').on(
      table.organizationId,
      table.email,
    ),
    index('organization_invites_status_idx').on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const executorHandoffs = sqliteTable(
  'executor_handoffs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    capabilityId: text('capability_id')
      .notNull()
      .references(() => capabilities.id),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => workItems.id),
    authorizationObjectId: text('authorization_object_id').notNull(),
    authorizationDigest: text('authorization_digest').notNull(),
    network: text('network').notNull(),
    state: text('state').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    createdByPrincipalId: text('created_by_principal_id')
      .notNull()
      .references(() => principals.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('executor_handoffs_work_item_unique').on(table.workItemId),
    index('executor_handoffs_queue_idx').on(
      table.organizationId,
      table.state,
      table.createdAt,
    ),
  ],
);

export const workflowTransitions = sqliteTable(
  'workflow_transitions',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .notNull()
      .references(() => workItems.id),
    fromVersion: integer('from_version').notNull(),
    toVersion: integer('to_version').notNull(),
    actorPrincipalId: text('actor_principal_id')
      .notNull()
      .references(() => principals.id),
    actedAsRole: text('acted_as_role').notNull(),
    event: text('event').notNull(),
    detailJson: text('detail_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('workflow_transitions_version_unique').on(
      table.workItemId,
      table.fromVersion,
    ),
    index('workflow_transitions_item_idx').on(table.workItemId, table.createdAt),
  ],
);
