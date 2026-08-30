import { env } from 'cloudflare:workers';
import canonicalize from 'canonicalize';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';

import { requireChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';
import { getDb } from '@/db';
import {
  auditEvents,
  capabilities,
  executorHandoffs,
  lifecycleEvents,
  memberships,
  organizationBootstrapClaims,
  organizationInvites,
  organizations,
  principals,
  protocolObjects as protocolObjectRows,
  trustGates,
  workflowTransitions,
  workItems,
} from '@/db/schema';
import {
  CAPABILITY_ID,
  ORGANIZATION_ID,
  capabilityObject,
  lifecycleFixture,
  objectR2Key,
  protocolObjects,
  trustGateFixture,
  type ProtocolObject,
} from '@/lib/protocol-fixtures';

export const roles = ['buyer', 'contributor', 'evaluator', 'operator'] as const;
export type PlatformRole = (typeof roles)[number];

export type PlatformSession = {
  user: ChatGPTUser;
  organization: typeof organizations.$inferSelect;
  membership: typeof memberships.$inferSelect;
};

const seededAt = '2026-08-30T20:00:00.000Z';

async function commandDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')}`;
}

async function verifyProtocolObjectIntegrity(
  object: ProtocolObject,
): Promise<void> {
  if (
    object.integrity.canonicalization !== 'RFC8785' ||
    object.integrity.hash_algorithm !== 'sha-256' ||
    object.integrity.digest_scope !== 'object-without-integrity-or-signatures'
  ) {
    throw new Error(`unsupported integrity contract for ${object.object_id}`);
  }
  const {
    integrity: _integrity,
    signatures: _signatures,
    ...digestTarget
  } = object;
  const canonical = canonicalize(digestTarget);
  if (canonical === undefined) {
    throw new Error(`protocol object ${object.object_id} cannot be canonicalized`);
  }
  const computed = await commandDigest(canonical);
  if (computed !== object.integrity.object_digest) {
    throw new Error(`protocol object digest mismatch for ${object.object_id}`);
  }
  if (
    object.signatures.some(
      (signature) => signature.signed_digest !== computed,
    )
  ) {
    throw new Error(`protocol signature digest mismatch for ${object.object_id}`);
  }
}

const workItemFixture = [
  {
    id: 'work-buyer-fund-fixed-insertion-v1',
    requiredRole: 'buyer',
    actionType: 'buyer.authorize_collection_reserve',
    title: 'authorize the collection reserve',
    description:
      'approve the sandbox budget envelope after inspecting the capability contract and aggregate evidence terms.',
    state: 'pending',
    dependsOnWorkItemId: null,
    precondition: { protocolObjectType: 'capability_manifest', network: 'solana-devnet' },
  },
  {
    id: 'work-contributor-accept-fixed-insertion-v1',
    requiredRole: 'contributor',
    actionType: 'contributor.accept_collection_brief',
    title: 'accept the camera-free collection brief',
    description:
      'acknowledge the embodiment, safety boundary, evidence profile, and contribution terms before any local run begins.',
    state: 'blocked',
    dependsOnWorkItemId: 'work-buyer-fund-fixed-insertion-v1',
    precondition: { captureProfile: 'direct_i2rt', cameraStreams: 0 },
  },
  {
    id: 'work-evaluator-conflict-fixed-insertion-v1',
    requiredRole: 'evaluator',
    actionType: 'evaluator.declare_no_conflict',
    title: 'declare conflicts before unsealing',
    description:
      'record an evaluator conflict declaration while the hidden trial contents and attribution mapping remain sealed.',
    state: 'blocked',
    dependsOnWorkItemId: 'work-contributor-accept-fixed-insertion-v1',
    precondition: { hiddenSetState: 'committed', treatmentLabelsVisible: false },
  },
  {
    id: 'work-operator-settle-fixed-insertion-v1',
    requiredRole: 'operator',
    actionType: 'operator.authorize_settlement',
    title: 'authorize settlement handoff',
    description:
      'release the signed, memo-less payout intent to the isolated Solana executor only after every trust gate allows it.',
    state: 'blocked',
    dependsOnWorkItemId: 'work-evaluator-conflict-fixed-insertion-v1',
    precondition: { allTrustGates: 'allow', executionNetwork: 'solana-devnet' },
  },
] as const;

export async function seedSandboxPlatform(): Promise<void> {
  const db = getDb();

  await db
    .insert(organizations)
    .values({
      id: ORGANIZATION_ID,
      slug: 'capy-lab-sandbox',
      name: 'capy lab',
      environment: 'sandbox',
      createdAt: seededAt,
    })
    .onConflictDoNothing();

  await db
    .insert(capabilities)
    .values({
      id: CAPABILITY_ID,
      organizationId: ORGANIZATION_ID,
      protocolObjectId: capabilityObject.object_id,
      title: capabilityObject.payload.title,
      summary: capabilityObject.payload.summary,
      status: 'payout_planned',
      dataClass: 'synthetic_fixture',
      environment: 'sandbox',
      embodiment: `${capabilityObject.payload.embodiment.manufacturer} ${capabilityObject.payload.embodiment.model}`,
      payoutNetwork: 'solana-devnet',
      createdAt: capabilityObject.issued_at,
      updatedAt: protocolObjects.at(-1)?.issued_at ?? capabilityObject.issued_at,
    })
    .onConflictDoUpdate({
      target: capabilities.id,
      set: {
        title: capabilityObject.payload.title,
        summary: capabilityObject.payload.summary,
      },
    });

  for (const [sequence, object] of protocolObjects.entries()) {
    const r2Key = objectR2Key(object);
    await verifyProtocolObjectIntegrity(object);
    const storedBytes = JSON.stringify(object);
    const storageDigest = await commandDigest(storedBytes);
    const existing = await env.FILES.head(r2Key);
    if (existing?.customMetadata?.storageDigest) {
      if (existing.customMetadata.storageDigest !== storageDigest) {
        throw new Error(`immutable R2 object collision at ${r2Key}`);
      }
    } else if (existing) {
      const existingBody = await env.FILES.get(r2Key);
      if (
        !existingBody ||
        (await commandDigest(await existingBody.text())) !== storageDigest
      ) {
        throw new Error(`immutable R2 object collision at ${r2Key}`);
      }
    } else if (!existing) {
      await env.FILES.put(r2Key, storedBytes, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: {
          objectType: object.object_type,
          objectId: object.object_id,
          digest: object.integrity.object_digest,
          storageDigest,
          dataClass: 'synthetic_fixture',
        },
      });
    }

    await db
      .insert(protocolObjectRows)
      .values({
        id: object.object_id,
        capabilityId: CAPABILITY_ID,
        objectType: object.object_type,
        schemaVersion: object.schema_version,
        issuedAt: object.issued_at,
        digest: object.integrity.object_digest,
        signerKeyId: object.signatures[0]?.key_id ?? 'missing',
        signatureState: 'shape_valid_fixture',
        artifactState: 'available',
        trustState: object.object_type === 'solana_payout_manifest' ? 'pending' : 'accepted',
        sequence,
        r2Key,
        storageDigest,
        synthetic: true,
      })
      .onConflictDoUpdate({
        target: protocolObjectRows.id,
        set: {
          digest: object.integrity.object_digest,
          signerKeyId: object.signatures[0]?.key_id ?? 'missing',
          r2Key,
          storageDigest,
          sequence,
        },
      });
  }

  for (const [sequence, event] of lifecycleFixture.entries()) {
    await db
      .insert(lifecycleEvents)
      .values({
        id: event.id,
        capabilityId: CAPABILITY_ID,
        stage: event.stage,
        label: event.label,
        state: event.state,
        occurredAt: protocolObjects[Math.min(sequence, protocolObjects.length - 1)]?.issued_at ?? seededAt,
        objectId: event.objectId,
        sequence,
      })
      .onConflictDoUpdate({
        target: lifecycleEvents.id,
        set: { label: event.label, state: event.state, objectId: event.objectId, sequence },
      });
  }

  for (const gate of trustGateFixture) {
    await db
      .insert(trustGates)
      .values({
        id: gate.id,
        capabilityId: CAPABILITY_ID,
        gateType: gate.gateType,
        label: gate.label,
        state: gate.state,
        evidenceRef: gate.evidenceRef,
      })
      .onConflictDoNothing();
  }

  for (const item of workItemFixture) {
    await db
      .insert(workItems)
      .values({
        id: item.id,
        organizationId: ORGANIZATION_ID,
        capabilityId: CAPABILITY_ID,
        requiredRole: item.requiredRole,
        actionType: item.actionType,
        title: item.title,
        description: item.description,
        state: item.state,
        preconditionJson: JSON.stringify(item.precondition),
        dependsOnWorkItemId: item.dependsOnWorkItemId,
        createdAt: seededAt,
        updatedAt: seededAt,
      })
      .onConflictDoUpdate({
        target: workItems.id,
        set: {
          title: item.title,
          description: item.description,
          preconditionJson: JSON.stringify(item.precondition),
          dependsOnWorkItemId: item.dependsOnWorkItemId,
        },
      });
  }
}

export async function ensureSandboxMembership(user: ChatGPTUser): Promise<PlatformSession> {
  await seedSandboxPlatform();
  const db = getDb();
  const now = new Date().toISOString();
  const normalizedEmail = user.email.trim().toLowerCase();
  await db
    .insert(principals)
    .values({
      id: user.userId,
      email: normalizedEmail,
      displayName: user.displayName,
      createdAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: principals.id,
      set: { email: normalizedEmail, displayName: user.displayName, lastSeenAt: now },
    });

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, ORGANIZATION_ID))
    .limit(1);
  if (!organization) throw new Error('sandbox organization is unavailable');

  let [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, ORGANIZATION_ID),
        eq(memberships.principalId, user.userId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);
  if (membership) {
    if (membership.role === 'operator') {
      await db
        .insert(organizationBootstrapClaims)
        .values({
          organizationId: ORGANIZATION_ID,
          claimedByPrincipalId: user.userId,
          claimedAt: membership.createdAt,
        })
        .onConflictDoNothing();
    }
    return { user, organization, membership };
  }

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, ORGANIZATION_ID),
        eq(organizationInvites.email, normalizedEmail),
        eq(organizationInvites.status, 'pending'),
      ),
    )
    .limit(1);

  if (invite) {
    try {
      await db.batch([
        db.insert(memberships).values({
          organizationId: ORGANIZATION_ID,
          principalId: user.userId,
          role: invite.role,
          status: 'active',
          createdAt: now,
        }),
        db
          .update(organizationInvites)
          .set({ status: 'accepted', acceptedAt: now })
          .where(
            and(
              eq(organizationInvites.id, invite.id),
              eq(organizationInvites.status, 'pending'),
            ),
          ),
        db.insert(auditEvents).values({
          id: `audit:invite-accept:${invite.id}`,
          organizationId: ORGANIZATION_ID,
          capabilityId: null,
          actorPrincipalId: user.userId,
          action: 'membership.invite_accepted',
          targetType: 'membership',
          targetId: `${ORGANIZATION_ID}:${user.userId}`,
          detailJson: JSON.stringify({ role: invite.role }),
          createdAt: now,
        }),
      ]);
    } catch {
      // A concurrent callback may have accepted the same invite. Reload below.
    }
  } else {
    const [bootstrapClaim] = await db
      .select()
      .from(organizationBootstrapClaims)
      .where(eq(organizationBootstrapClaims.organizationId, ORGANIZATION_ID))
      .limit(1);
    if (!bootstrapClaim) {
      try {
        await db.batch([
          db.insert(organizationBootstrapClaims).values({
            organizationId: ORGANIZATION_ID,
            claimedByPrincipalId: user.userId,
            claimedAt: now,
          }),
          db.insert(memberships).values({
            organizationId: ORGANIZATION_ID,
            principalId: user.userId,
            role: 'operator',
            status: 'active',
            createdAt: now,
          }),
          db.insert(auditEvents).values({
            id: `audit:bootstrap:${ORGANIZATION_ID}`,
            organizationId: ORGANIZATION_ID,
            capabilityId: null,
            actorPrincipalId: user.userId,
            action: 'organization.bootstrap_claimed',
            targetType: 'organization',
            targetId: ORGANIZATION_ID,
            detailJson: JSON.stringify({ role: 'operator' }),
            createdAt: now,
          }),
        ]);
      } catch {
        // Only one first user can claim the organization. Reload below.
      }
    }
  }

  [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, ORGANIZATION_ID),
        eq(memberships.principalId, user.userId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);
  if (!membership) throw new Error('organization membership required');
  return { user, organization, membership };
}

export async function requirePlatformSession(returnTo: string): Promise<PlatformSession> {
  return ensureSandboxMembership(await requireChatGPTUser(returnTo));
}

export async function getCapabilityBundle(
  capabilityId: string,
  organizationId: string,
) {
  const db = getDb();
  const [capability] = await db
    .select()
    .from(capabilities)
    .where(
      and(
        eq(capabilities.id, capabilityId),
        eq(capabilities.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!capability) return null;
  const [objects, lifecycle, gates, queue, audits] = await Promise.all([
    db
      .select()
      .from(protocolObjectRows)
      .where(eq(protocolObjectRows.capabilityId, capabilityId))
      .orderBy(asc(protocolObjectRows.sequence)),
    db
      .select()
      .from(lifecycleEvents)
      .where(eq(lifecycleEvents.capabilityId, capabilityId))
      .orderBy(asc(lifecycleEvents.sequence)),
    db.select().from(trustGates).where(eq(trustGates.capabilityId, capabilityId)).orderBy(asc(trustGates.gateType)),
    db.select().from(workItems).where(eq(workItems.capabilityId, capabilityId)).orderBy(asc(workItems.requiredRole)),
    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.capabilityId, capabilityId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(20),
  ]);
  return { capability, objects, lifecycle, gates, workItems: queue, audits };
}

export async function getProtocolObject(
  objectId: string,
  organizationId: string,
): Promise<{
  row: typeof protocolObjectRows.$inferSelect;
  object: ProtocolObject;
} | null> {
  const db = getDb();
  const [row] = await db.select().from(protocolObjectRows).where(eq(protocolObjectRows.id, objectId)).limit(1);
  if (!row) return null;
  const [capability] = await db
    .select({ id: capabilities.id })
    .from(capabilities)
    .where(
      and(
        eq(capabilities.id, row.capabilityId),
        eq(capabilities.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!capability) return null;
  const stored = await env.FILES.get(row.r2Key);
  if (!stored) throw new Error(`protocol object bytes are unavailable at ${row.r2Key}`);
  const storedBytes = await stored.text();
  const storageDigest = await commandDigest(storedBytes);
  if (storageDigest !== row.storageDigest) {
    throw new Error(`protocol object storage digest mismatch for ${row.id}`);
  }
  let object: ProtocolObject;
  try {
    object = JSON.parse(storedBytes) as ProtocolObject;
  } catch {
    throw new Error(`protocol object JSON is malformed for ${row.id}`);
  }
  await verifyProtocolObjectIntegrity(object);
  if (
    object.object_id !== row.id ||
    object.object_type !== row.objectType ||
    object.integrity.object_digest !== row.digest
  ) {
    throw new Error(`protocol object projection mismatch for ${row.id}`);
  }
  return { row, object };
}

export async function getPublicReceiptBundle(receiptId: string) {
  if (receiptId !== CAPABILITY_ID) return null;
  await seedSandboxPlatform();
  const db = getDb();
  const [capability] = await db
    .select()
    .from(capabilities)
    .where(
      and(
        eq(capabilities.id, receiptId),
        eq(capabilities.organizationId, ORGANIZATION_ID),
        eq(capabilities.dataClass, 'synthetic_fixture'),
      ),
    )
    .limit(1);
  if (!capability) return null;
  const rows = await db
    .select()
    .from(protocolObjectRows)
    .where(eq(protocolObjectRows.capabilityId, capability.id))
    .orderBy(asc(protocolObjectRows.sequence));
  const verifiedObjects = await Promise.all(
    rows.map((row) => getProtocolObject(row.id, capability.organizationId)),
  );
  if (verifiedObjects.some((entry) => !entry)) {
    throw new Error('public receipt object chain is incomplete');
  }
  return { capability, objects: rows };
}

export function resolveRoleLens(requested: string | undefined, membershipRole: string): PlatformRole {
  const ownRole = roles.includes(membershipRole as PlatformRole) ? (membershipRole as PlatformRole) : 'contributor';
  if (ownRole === 'operator' && requested && roles.includes(requested as PlatformRole)) {
    return requested as PlatformRole;
  }
  return ownRole;
}

export async function decideTrustGate(input: {
  gateId: string;
  decision: 'allow' | 'quarantine' | 'deny';
  reason: string;
  expectedVersion: number;
  idempotencyKey: string;
  session: PlatformSession;
}): Promise<{ idempotent: boolean }> {
  if (input.session.membership.role !== 'operator') throw new Error('operator role required');
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new Error('a non-negative expected version is required');
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) {
    throw new Error('a valid idempotency key is required');
  }
  if (input.reason.trim().length < 8 || input.reason.length > 500) {
    throw new Error('decision reason must be 8–500 characters');
  }
  const reason = input.reason.trim();
  const requestDigest = await commandDigest(
    JSON.stringify({
      organizationId: input.session.organization.id,
      actorPrincipalId: input.session.user.userId,
      gateId: input.gateId,
      decision: input.decision,
      reason,
      expectedVersion: input.expectedVersion,
    }),
  );
  const db = getDb();
  const [gate] = await db.select().from(trustGates).where(eq(trustGates.id, input.gateId)).limit(1);
  if (!gate) throw new Error('trust gate not found');
  const [capability] = await db
    .select({ id: capabilities.id })
    .from(capabilities)
    .where(
      and(
        eq(capabilities.id, gate.capabilityId),
        eq(capabilities.organizationId, input.session.organization.id),
      ),
    )
    .limit(1);
  if (!capability) throw new Error('trust gate not found');
  if (gate.idempotencyKey === input.idempotencyKey) {
    if (
      gate.decidedBy === input.session.user.userId &&
      gate.requestDigest === requestDigest
    ) {
      return { idempotent: true };
    }
    throw new Error('idempotency key reused with a different command');
  }
  if (gate.version !== input.expectedVersion) {
    throw new Error('trust gate version conflict');
  }
  if (!['pending', 'quarantine'].includes(gate.state)) {
    throw new Error('trust gate is already finalized');
  }
  const [settlementItem] = await db
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.capabilityId, gate.capabilityId),
        eq(workItems.actionType, 'operator.authorize_settlement'),
      ),
    )
    .limit(1);
  if (!settlementItem) throw new Error('settlement work item not found');
  if (settlementItem.state === 'completed') {
    throw new Error('settlement already authorized; reconciliation is required');
  }
  const now = new Date().toISOString();
  const nextVersion = gate.version + 1;
  try {
    await db.batch([
      db
        .update(trustGates)
        .set({
          state: input.decision,
          reason,
          decidedBy: input.session.user.userId,
          decidedAt: now,
          version: nextVersion,
          idempotencyKey: input.idempotencyKey,
          requestDigest,
        })
        .where(
          and(
            eq(trustGates.id, gate.id),
            eq(trustGates.state, gate.state),
            eq(trustGates.version, gate.version),
          ),
        ),
      db
        .update(workItems)
        .set({
          state: sql<string>`case
            when not exists (
              select 1 from trust_gates
              where capability_id = ${gate.capabilityId} and state <> 'allow'
            ) and not exists (
              select 1 from work_items
              where capability_id = ${gate.capabilityId}
                and action_type <> 'operator.authorize_settlement'
                and state <> 'completed'
            ) then 'pending'
            else 'blocked'
          end`,
          updatedAt: now,
        })
        .where(eq(workItems.id, settlementItem.id)),
      db.insert(auditEvents).values({
        id: `audit:trust:${gate.id}:${gate.version}`,
        organizationId: input.session.organization.id,
        capabilityId: gate.capabilityId,
        actorPrincipalId: input.session.user.userId,
        action: `trust_gate.${input.decision}`,
        targetType: 'trust_gate',
        targetId: gate.id,
        detailJson: JSON.stringify({
          previousState: gate.state,
          fromVersion: gate.version,
          toVersion: nextVersion,
          reason,
        }),
        createdAt: now,
      }),
    ]);
  } catch (error) {
    const [current] = await db
      .select()
      .from(trustGates)
      .where(eq(trustGates.id, gate.id))
      .limit(1);
    if (current?.idempotencyKey === input.idempotencyKey) {
      if (
        current.decidedBy === input.session.user.userId &&
        current.requestDigest === requestDigest
      ) {
        return { idempotent: true };
      }
      throw new Error('idempotency key reused with a different command');
    }
    throw error;
  }

  const [decided] = await db
    .select()
    .from(trustGates)
    .where(eq(trustGates.id, gate.id))
    .limit(1);
  if (
    decided?.version !== nextVersion ||
    decided.idempotencyKey !== input.idempotencyKey
  ) {
    throw new Error('trust gate version conflict');
  }
  return { idempotent: false };
}

export async function completeWorkItem(input: {
  workItemId: string;
  expectedVersion: number;
  idempotencyKey: string;
  note: string;
  actedAsRole: PlatformRole;
  session: PlatformSession;
}): Promise<{ idempotent: boolean }> {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
    throw new Error('a non-negative expected version is required');
  }
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey)) {
    throw new Error('a valid idempotency key is required');
  }
  const note = input.note.trim();
  if (note.length < 8 || note.length > 500) {
    throw new Error('completion note must be 8–500 characters');
  }
  const requestDigest = await commandDigest(
    JSON.stringify({
      organizationId: input.session.organization.id,
      actorPrincipalId: input.session.user.userId,
      workItemId: input.workItemId,
      actedAsRole: input.actedAsRole,
      note,
      expectedVersion: input.expectedVersion,
    }),
  );

  const db = getDb();
  const [item] = await db.select().from(workItems).where(eq(workItems.id, input.workItemId)).limit(1);
  if (!item || item.organizationId !== input.session.organization.id) {
    throw new Error('work item not found');
  }

  const [capability] = await db
    .select()
    .from(capabilities)
    .where(eq(capabilities.id, item.capabilityId))
    .limit(1);
  if (!capability) throw new Error('capability not found');
  if (item.requiredRole !== input.actedAsRole) throw new Error('role does not match work item');

  const membershipRole = input.session.membership.role as PlatformRole;
  const isLocalSimulator =
    input.session.user.userId === 'local_seedy' &&
    input.session.user.email.endsWith('@sites.test');
  if (membershipRole !== input.actedAsRole && !isLocalSimulator) {
    throw new Error('membership role required');
  }

  if (item.state === 'completed' && item.idempotencyKey === input.idempotencyKey) {
    if (
      item.completedBy === input.session.user.userId &&
      item.requestDigest === requestDigest
    ) {
      return { idempotent: true };
    }
    throw new Error('idempotency key reused with a different command');
  }
  if (item.state !== 'pending') throw new Error(`work item is ${item.state}`);
  if (item.version !== input.expectedVersion) throw new Error('work item version conflict');

  if (item.dependsOnWorkItemId) {
    const [dependency] = await db
      .select()
      .from(workItems)
      .where(eq(workItems.id, item.dependsOnWorkItemId))
      .limit(1);
    if (
      !dependency ||
      dependency.organizationId !== item.organizationId ||
      dependency.capabilityId !== item.capabilityId ||
      dependency.state !== 'completed'
    ) {
      throw new Error('work item dependency is not completed');
    }
  }

  let payoutAuthorization:
    | { objectId: string; digest: string }
    | undefined;
  if (item.actionType === 'operator.authorize_settlement') {
    const [gates, prerequisiteItems, payoutObjects] = await Promise.all([
      db.select().from(trustGates).where(eq(trustGates.capabilityId, item.capabilityId)),
      db.select().from(workItems).where(eq(workItems.capabilityId, item.capabilityId)),
      db
        .select()
        .from(protocolObjectRows)
        .where(
          and(
            eq(protocolObjectRows.capabilityId, item.capabilityId),
            eq(protocolObjectRows.objectType, 'solana_payout_manifest'),
          ),
        ),
    ]);
    if (gates.length === 0 || gates.some((gate) => gate.state !== 'allow')) {
      throw new Error('all trust gates must allow settlement');
    }
    if (
      prerequisiteItems.some(
        (candidate) =>
          candidate.id !== item.id && candidate.state !== 'completed',
      )
    ) {
      throw new Error('all role workflow prerequisites must be completed');
    }
    if (payoutObjects.length !== 1) {
      throw new Error('exactly one payout authorization object is required');
    }
    payoutAuthorization = {
      objectId: payoutObjects[0]!.id,
      digest: payoutObjects[0]!.digest,
    };
  }

  const now = new Date().toISOString();
  const nextVersion = item.version + 1;
  const result = {
    event: item.actionType,
    note,
    actedAsRole: input.actedAsRole,
    synthetic: true,
  };
  const coreStatements = [
    db
      .update(workItems)
      .set({
        state: 'completed',
        resultJson: JSON.stringify(result),
        version: nextVersion,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
        completedBy: input.session.user.userId,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workItems.id, item.id),
          eq(workItems.state, 'pending'),
          eq(workItems.version, item.version),
        ),
      ),
    db.insert(workflowTransitions).values({
      id: `transition:${item.id}:${item.version}`,
      workItemId: item.id,
      fromVersion: item.version,
      toVersion: nextVersion,
      actorPrincipalId: input.session.user.userId,
      actedAsRole: input.actedAsRole,
      event: item.actionType,
      detailJson: JSON.stringify({
        note,
        idempotencyKey: input.idempotencyKey,
        requestDigest,
      }),
      createdAt: now,
    }),
    db.insert(auditEvents).values({
      id: `audit:${item.id}:${item.version}`,
      organizationId: item.organizationId,
      capabilityId: item.capabilityId,
      actorPrincipalId: input.session.user.userId,
      action: item.actionType,
      targetType: 'work_item',
      targetId: item.id,
      detailJson: JSON.stringify({
        fromState: item.state,
        toState: 'completed',
        fromVersion: item.version,
        toVersion: nextVersion,
        actedAsRole: input.actedAsRole,
        note,
        requestDigest,
      }),
      createdAt: now,
    }),
    db
      .update(workItems)
      .set({
        state: sql<string>`case
          when action_type = 'operator.authorize_settlement'
            and exists (
              select 1 from trust_gates
              where capability_id = ${item.capabilityId} and state <> 'allow'
            ) then 'blocked'
          else 'pending'
        end`,
        updatedAt: now,
      })
      .where(
        and(
          eq(workItems.dependsOnWorkItemId, item.id),
          eq(workItems.state, 'blocked'),
        ),
      ),
    db
      .update(capabilities)
      .set({
        status:
          item.actionType === 'operator.authorize_settlement'
            ? 'settlement_authorized'
            : capability.status,
        updatedAt: now,
      })
      .where(eq(capabilities.id, capability.id)),
  ] as const;
  try {
    if (payoutAuthorization) {
      await db.batch([
        ...coreStatements,
        db.insert(executorHandoffs).values({
          id: `handoff:${item.id}:${item.version}`,
          organizationId: item.organizationId,
          capabilityId: item.capabilityId,
          workItemId: item.id,
          authorizationObjectId: payoutAuthorization.objectId,
          authorizationDigest: payoutAuthorization.digest,
          network: capability.payoutNetwork,
          state: 'queued',
          createdByPrincipalId: input.session.user.userId,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .update(protocolObjectRows)
          .set({ trustState: 'accepted' })
          .where(eq(protocolObjectRows.id, payoutAuthorization.objectId)),
      ]);
    } else {
      await db.batch(coreStatements);
    }
  } catch (error) {
    const [current] = await db.select().from(workItems).where(eq(workItems.id, item.id)).limit(1);
    if (current?.state === 'completed' && current.idempotencyKey === input.idempotencyKey) {
      if (
        current.completedBy === input.session.user.userId &&
        current.requestDigest === requestDigest
      ) {
        return { idempotent: true };
      }
      throw new Error('idempotency key reused with a different command');
    }
    throw error;
  }

  const [completed] = await db.select().from(workItems).where(eq(workItems.id, item.id)).limit(1);
  if (
    completed?.state !== 'completed' ||
    completed.idempotencyKey !== input.idempotencyKey ||
    completed.requestDigest !== requestDigest ||
    completed.completedBy !== input.session.user.userId
  ) {
    throw new Error('work item version conflict');
  }
  return { idempotent: false };
}

export async function inviteOrganizationMember(input: {
  email: string;
  role: PlatformRole;
  session: PlatformSession;
}): Promise<{ id: string; email: string; role: string; status: string }> {
  if (input.session.membership.role !== 'operator') {
    throw new Error('operator role required');
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('a valid member email is required');
  }
  if (!roles.includes(input.role)) throw new Error('a valid member role is required');

  const db = getDb();
  const [existing] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, input.session.organization.id),
        eq(organizationInvites.email, email),
      ),
    )
    .limit(1);
  if (existing?.status === 'accepted') {
    throw new Error('this member has already accepted an invite');
  }

  const now = new Date().toISOString();
  const inviteId = existing?.id ?? crypto.randomUUID();
  await db.batch([
    db
      .insert(organizationInvites)
      .values({
        id: inviteId,
        organizationId: input.session.organization.id,
        email,
        role: input.role,
        status: 'pending',
        invitedByPrincipalId: input.session.user.userId,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [organizationInvites.organizationId, organizationInvites.email],
        set: {
          role: input.role,
          status: 'pending',
          invitedByPrincipalId: input.session.user.userId,
          createdAt: now,
          acceptedAt: null,
        },
      }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organizationId: input.session.organization.id,
      capabilityId: null,
      actorPrincipalId: input.session.user.userId,
      action: 'membership.invited',
      targetType: 'organization_invite',
      targetId: inviteId,
      detailJson: JSON.stringify({ email, role: input.role }),
      createdAt: now,
    }),
  ]);
  return { id: inviteId, email, role: input.role, status: 'pending' };
}

export async function getOrganizationDirectory(session: PlatformSession) {
  if (session.membership.role !== 'operator') {
    throw new Error('operator role required');
  }
  const db = getDb();
  const [memberRows, inviteRows] = await Promise.all([
    db
      .select({
        principalId: principals.id,
        displayName: principals.displayName,
        email: principals.email,
        role: memberships.role,
        status: memberships.status,
        createdAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(principals, eq(principals.id, memberships.principalId))
      .where(eq(memberships.organizationId, session.organization.id))
      .orderBy(asc(principals.email)),
    db
      .select()
      .from(organizationInvites)
      .where(eq(organizationInvites.organizationId, session.organization.id))
      .orderBy(desc(organizationInvites.createdAt)),
  ]);
  return { members: memberRows, invites: inviteRows };
}

export async function searchPlatform(query: string, organizationId: string) {
  const normalized = query.trim().slice(0, 100);
  if (!normalized) return { capabilities: [], objects: [] };
  const pattern = `%${normalized}%`;
  const db = getDb();
  const [capabilityRows, objectRows] = await Promise.all([
    db
      .select()
      .from(capabilities)
      .where(
        and(
          eq(capabilities.organizationId, organizationId),
          or(
            like(capabilities.id, pattern),
            like(capabilities.title, pattern),
            like(capabilities.summary, pattern),
          ),
        ),
      )
      .limit(25),
    db
      .select({
        id: protocolObjectRows.id,
        capabilityId: protocolObjectRows.capabilityId,
        objectType: protocolObjectRows.objectType,
        digest: protocolObjectRows.digest,
        trustState: protocolObjectRows.trustState,
      })
      .from(protocolObjectRows)
      .innerJoin(
        capabilities,
        eq(capabilities.id, protocolObjectRows.capabilityId),
      )
      .where(
        and(
          eq(capabilities.organizationId, organizationId),
          or(
            like(protocolObjectRows.id, pattern),
            like(protocolObjectRows.objectType, pattern),
            like(protocolObjectRows.digest, pattern),
          ),
        ),
      )
      .limit(25),
  ]);
  return { capabilities: capabilityRows, objects: objectRows };
}
