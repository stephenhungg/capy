import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import canonicalize from "canonicalize";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaDirectory = path.join(root, "schemas");
const exampleDirectory = path.join(root, "docs", "protocol", "examples");
const writeDigests = process.argv.includes("--write-digests");

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const listJson = async (directory) =>
  (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(directory, name));

const digestObject = (object) => {
  const digestTarget = structuredClone(object);
  delete digestTarget.integrity;
  delete digestTarget.signatures;
  const canonical = canonicalize(digestTarget);
  if (canonical === undefined) {
    throw new Error(`cannot canonicalize ${object.object_id}`);
  }
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
};

const walk = (value, visit) => {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit));
    return;
  }
  if (value && typeof value === "object") {
    visit(value);
    Object.values(value).forEach((item) => walk(item, visit));
  }
};

const schemaFiles = await listJson(schemaDirectory);
const exampleFiles = await listJson(exampleDirectory);
const schemas = await Promise.all(schemaFiles.map(readJson));
const examples = await Promise.all(exampleFiles.map(readJson));

if (writeDigests) {
  const knownDigests = new Map();
  for (let index = 0; index < examples.length; index += 1) {
    const example = examples[index];
    walk(example, (value) => {
      if (
        typeof value.object_id === "string" &&
        typeof value.object_type === "string" &&
        typeof value.object_digest === "string" &&
        knownDigests.has(value.object_id)
      ) {
        value.object_digest = knownDigests.get(value.object_id);
      }
    });
    const digest = digestObject(example);
    example.integrity.object_digest = digest;
    for (const signature of example.signatures) {
      signature.signed_digest = digest;
    }
    knownDigests.set(example.object_id, digest);
    await writeFile(exampleFiles[index], `${JSON.stringify(example, null, 2)}\n`);
  }
}

const refreshedExamples = await Promise.all(exampleFiles.map(readJson));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

for (const schema of schemas) {
  if (!ajv.validateSchema(schema)) {
    throw new Error(`invalid JSON Schema ${schema.$id}: ${ajv.errorsText(ajv.errors)}`);
  }
  ajv.addSchema(schema);
}

const byId = new Map(refreshedExamples.map((example) => [example.object_id, example]));
for (const [index, example] of refreshedExamples.entries()) {
  const validator = ajv.getSchema(example.$schema);
  if (!validator) {
    throw new Error(`${path.basename(exampleFiles[index])} names an unknown schema: ${example.$schema}`);
  }
  if (!validator(example)) {
    throw new Error(`${path.basename(exampleFiles[index])} failed validation:\n${ajv.errorsText(validator.errors, { separator: "\n" })}`);
  }
  const expectedDigest = digestObject(example);
  if (example.integrity.object_digest !== expectedDigest) {
    throw new Error(`${example.object_id} has stale integrity digest; run npm test -- --write-digests`);
  }
  for (const signature of example.signatures) {
    if (signature.signed_digest !== expectedDigest) {
      throw new Error(`${example.object_id} has a signature over the wrong digest`);
    }
  }
  walk(example, (value) => {
    if (
      typeof value.object_id === "string" &&
      typeof value.object_type === "string" &&
      typeof value.object_digest === "string" &&
      byId.has(value.object_id)
    ) {
      const target = byId.get(value.object_id);
      if (value.object_type !== target.object_type || value.object_digest !== target.integrity.object_digest) {
        throw new Error(`${example.object_id} has a stale or mistyped reference to ${value.object_id}`);
      }
    }
  });
}

const objectOfType = (type) => {
  const matches = refreshedExamples.filter((example) => example.object_type === type);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${type} example, found ${matches.length}`);
  }
  return matches[0];
};

const capability = objectOfType("capability_manifest");
const cohort = objectOfType("episode_cohort");
const evaluation = objectOfType("evaluation_receipt");
const attribution = objectOfType("attribution_result");
const payout = objectOfType("solana_payout_manifest");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectSchemaRejection = (object, label) => {
  const validator = ajv.getSchema(object.$schema);
  if (validator(object)) {
    throw new Error(`schema accepted invalid negative fixture: ${label}`);
  }
};

const visualCapability = structuredClone(capability);
visualCapability.payload.interfaces.normalized_training.features[0].dtype = "image";
expectSchemaRejection(visualCapability, "visual feature in camera-free capability");

const mistypedCohort = structuredClone(cohort);
mistypedCohort.payload.capability.object_type = "attribution_result";
expectSchemaRejection(mistypedCohort, "mistyped capability reference");

const ineligiblePaidAllocation = structuredClone(attribution);
ineligiblePaidAllocation.payload.allocations[0].eligibility.eligible = false;
expectSchemaRejection(ineligiblePaidAllocation, "nonzero payment to ineligible allocation");

const plannedWithTransaction = structuredClone(payout);
plannedWithTransaction.payload.settlement.transactions.push({
  batch_id: "batch-001",
  signature: "1".repeat(80),
  slot: "1",
  commitment: "finalized",
  observed_at: "2026-09-05T22:01:00Z",
});
expectSchemaRejection(plannedWithTransaction, "transaction evidence on planned payout");

assert(capability.payload.interfaces.normalized_training.visual_features_allowed === false, "camera-free capability allows visual features");
assert(capability.payload.collection_requirements.prohibited_modalities.includes("camera"), "camera-free capability does not prohibit cameras");
assert(cohort.payload.normalized_dataset.use_videos === false, "camera-free cohort enables video");
assert(cohort.payload.privacy.camera_free === true, "camera-free cohort privacy flag is false");
assert(
  !cohort.payload.normalized_dataset.features.some((feature) => feature.dtype === "image" || feature.dtype === "video" || feature.key.startsWith("observation.images.")),
  "camera-free cohort contains a visual feature"
);
assert(
  capability.payload.evaluation_protocol.hidden_set.manifest_commitment === evaluation.payload.hidden_set.manifest_commitment,
  "hidden-set commitment changed between capability and evaluation"
);

const allocations = attribution.payload.allocations;
const allocationAmount = allocations.reduce((sum, allocation) => sum + BigInt(allocation.payout_amount_base_units), 0n);
assert(allocations.reduce((sum, allocation) => sum + allocation.weight_ppm, 0) === 1_000_000, "attribution weights do not sum to 1,000,000 ppm");
assert(allocationAmount === BigInt(attribution.payload.conservation.allocated_base_units), "allocated amount does not match conservation record");
assert(
  allocationAmount + BigInt(attribution.payload.conservation.unallocated_base_units) === BigInt(attribution.payload.payout_pool.amount_base_units),
  "attribution pool does not conserve base units"
);

const allocationsById = new Map(allocations.map((allocation) => [allocation.allocation_id, allocation]));
for (const transfer of payout.payload.transfers) {
  const allocation = allocationsById.get(transfer.allocation_id);
  assert(allocation, `payout transfer ${transfer.transfer_id} names an unknown allocation`);
  assert(transfer.contributor_id === allocation.contributor_id, `payout transfer ${transfer.transfer_id} changes contributor`);
  assert(transfer.amount_base_units === allocation.payout_amount_base_units, `payout transfer ${transfer.transfer_id} changes amount`);
}
const transferAmount = payout.payload.transfers.reduce((sum, transfer) => sum + BigInt(transfer.amount_base_units), 0n);
assert(transferAmount === BigInt(payout.payload.totals.amount_base_units), "payout transfer total is inconsistent");
assert(payout.payload.totals.transfer_count === payout.payload.transfers.length, "payout transfer count is inconsistent");
const plannedTransferIds = payout.payload.transaction_plan.flatMap((batch) => batch.transfer_ids).sort();
const transferIds = payout.payload.transfers.map((transfer) => transfer.transfer_id).sort();
assert(JSON.stringify(plannedTransferIds) === JSON.stringify(transferIds), "transaction batches do not cover each transfer exactly once");

console.log(`validated ${schemas.length} schemas, ${refreshedExamples.length} linked examples, and 4 negative fixtures`);
