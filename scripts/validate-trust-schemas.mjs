import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = resolve(import.meta.dirname, "..");
const schemaDir = join(root, "schemas", "trust");
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  validateFormats: true,
});
addFormats(ajv);

const schemaFiles = (await readdir(schemaDir))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();

if (schemaFiles.length === 0) throw new Error("no trust schemas found");

const schemas = new Map();
const ids = new Set();
for (const file of schemaFiles) {
  const schema = JSON.parse(await readFile(join(schemaDir, file), "utf8"));
  if (!ajv.validateSchema(schema)) {
    throw new Error(`${file} is not a valid schema:\n${ajv.errorsText(ajv.errors, { separator: "\n" })}`);
  }
  if (!schema.$id || ids.has(schema.$id)) throw new Error(`${file} has a missing or duplicate $id`);
  ids.add(schema.$id);
  schemas.set(file, schema);
  ajv.addSchema(schema, schema.$id);
}

for (const [file, schema] of schemas) {
  try {
    ajv.getSchema(schema.$id) ?? ajv.compile(schema);
  } catch (error) {
    throw new Error(`${file} did not compile: ${error.message}`);
  }
}

async function validateFixtures(kind, expected) {
  const dir = join(schemaDir, "examples", kind);
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`no ${kind} fixtures found`);
  const coveredSchemas = new Set();

  for (const file of files) {
    const fixture = JSON.parse(await readFile(join(dir, file), "utf8"));
    const schema = schemas.get(fixture.targetSchema);
    if (!schema) throw new Error(`${file} names unknown targetSchema ${fixture.targetSchema}`);
    coveredSchemas.add(fixture.targetSchema);
    let instance = fixture.instance;
    if (fixture.sourceFixture) {
      if (kind !== "invalid" || fixture.instance) {
        throw new Error(`${file} may use sourceFixture only for an invalid fixture without instance`);
      }
      if (!/^[a-z0-9-]+\.json$/.test(fixture.sourceFixture)) {
        throw new Error(`${file} has unsafe sourceFixture ${fixture.sourceFixture}`);
      }
      const source = JSON.parse(
        await readFile(join(schemaDir, "examples", "valid", fixture.sourceFixture), "utf8"),
      );
      if (source.targetSchema !== fixture.targetSchema) {
        throw new Error(`${file} targetSchema differs from ${fixture.sourceFixture}`);
      }
      instance = structuredClone(source.instance);
      if (!Array.isArray(fixture.mutations) || fixture.mutations.length === 0) {
        throw new Error(`${file} must declare at least one mutation`);
      }
      for (const mutation of fixture.mutations) applyMutation(instance, mutation, file);
    }
    if (instance === undefined) throw new Error(`${file} has no instance`);
    const validate = ajv.getSchema(schema.$id);
    const actual = validate(instance);
    if (actual !== expected) {
      throw new Error(
        `${file} expected valid=${expected}, got ${actual}:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`,
      );
    }
    if (expected) validateSemantics(fixture.targetSchema, instance, file);
  }
  return { count: files.length, coveredSchemas };
}

function applyMutation(instance, mutation, file) {
  if (!mutation || !["replace", "remove"].includes(mutation.operation)) {
    throw new Error(`${file} has an unsupported mutation operation`);
  }
  if (typeof mutation.path !== "string" || !mutation.path.startsWith("/")) {
    throw new Error(`${file} has an invalid JSON Pointer mutation path`);
  }
  const parts = mutation.path
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  const leaf = parts.pop();
  let target = instance;
  for (const part of parts) {
    if (target === null || !(part in target)) throw new Error(`${file} mutation path not found`);
    target = target[part];
  }
  if (target === null || !(leaf in target)) throw new Error(`${file} mutation path not found`);
  if (mutation.operation === "remove") {
    if (Array.isArray(target)) target.splice(Number(leaf), 1);
    else delete target[leaf];
  } else {
    if (!("value" in mutation)) throw new Error(`${file} replace mutation has no value`);
    target[leaf] = mutation.value;
  }
}

function semanticAssert(condition, file, message) {
  if (!condition) throw new Error(`${file} failed semantic validation: ${message}`);
}

function decodedBase58Length(value) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return -1;
    number = number * 58n + BigInt(digit);
  }
  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let length = number === 0n ? 0 : hex.length / 2;
  for (const character of value) {
    if (character !== "1") break;
    length += 1;
  }
  return length;
}

function validateSemantics(schemaFile, instance, file) {
  if (schemaFile === "retention.schema.json") {
    if (instance.minimumDays !== undefined) {
      semanticAssert(instance.minimumDays <= instance.maximumDays, file, "minimumDays exceeds maximumDays");
    }
    const trigger = Date.parse(instance.triggerAt);
    const deletion = Date.parse(instance.deleteAt);
    semanticAssert(deletion >= trigger, file, "deleteAt precedes triggerAt");
    semanticAssert(
      deletion - trigger <= instance.maximumDays * 86_400_000,
      file,
      "deleteAt exceeds maximumDays",
    );
  }

  if (schemaFile === "redaction.schema.json" && instance.verification?.passed) {
    semanticAssert(
      instance.verification.measuredScore >= instance.verification.acceptanceThreshold,
      file,
      "passing measuredScore is below acceptanceThreshold",
    );
  }

  if (schemaFile === "evaluator-conflict.schema.json") {
    semanticAssert(
      instance.evaluatorRef !== instance.decidedBy.actorRef,
      file,
      "evaluator and decision maker must be different actors",
    );
  }

  if (schemaFile === "lineage.schema.json") {
    const entityIds = instance.entities.map((entity) => entity.entityId);
    const activityIds = instance.activities.map((activity) => activity.activityId);
    const allIds = new Set([...entityIds, ...activityIds]);
    semanticAssert(allIds.size === entityIds.length + activityIds.length, file, "duplicate graph id");
    for (const relation of instance.relations) {
      semanticAssert(allIds.has(relation.fromRef), file, `dangling relation fromRef ${relation.fromRef}`);
      semanticAssert(allIds.has(relation.toRef), file, `dangling relation toRef ${relation.toRef}`);
    }
    for (const activity of instance.activities) {
      for (const ref of [...activity.inputEntityRefs, ...activity.outputEntityRefs]) {
        semanticAssert(entityIds.includes(ref), file, `dangling activity entity ref ${ref}`);
      }
    }
  }

  if (["payout.schema.json", "wallet-binding.schema.json"].includes(schemaFile)) {
    const addresses = schemaFile === "payout.schema.json"
      ? [instance.recipientOwnerAddress, instance.destinationTokenAccount, instance.onchainReference]
      : [instance.ownerAddress];
    for (const address of addresses.filter(Boolean)) {
      semanticAssert(decodedBase58Length(address) === 32, file, "Solana address is not 32 bytes");
    }
    if (instance.transactionSignature) {
      semanticAssert(
        decodedBase58Length(instance.transactionSignature) === 64,
        file,
        "Solana signature is not 64 bytes",
      );
    }
  }

  if (schemaFile === "trust-gate.schema.json") {
    const evidenceRefs = new Set(
      Object.values(instance.evidenceVersions).map((snapshot) => snapshot.recordRef),
    );
    for (const check of Object.values(instance.checks)) {
      semanticAssert(evidenceRefs.has(check.evidenceRef), file, `unversioned check evidence ${check.evidenceRef}`);
    }
  }
}

async function verifyDocLinks() {
  const docsDir = join(root, "docs", "trust");
  const files = (await readdir(docsDir)).filter((name) => name.endsWith(".md"));
  const broken = [];
  for (const file of files) {
    const text = await readFile(join(docsDir, file), "utf8");
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const path = resolve(docsDir, href.split("#", 1)[0]);
      try {
        if (!(await stat(path)).isFile()) broken.push(`${file}: ${href}`);
      } catch {
        broken.push(`${file}: ${href}`);
      }
    }
  }
  if (broken.length) throw new Error(`broken local documentation links:\n${broken.join("\n")}`);
  return files.length;
}

const validFixtures = await validateFixtures("valid", true);
const instantiableSchemas = schemaFiles.filter((file) => file !== "common.schema.json");
const missingValidFixtures = instantiableSchemas.filter(
  (file) => !validFixtures.coveredSchemas.has(file),
);
if (missingValidFixtures.length) {
  throw new Error(`missing valid fixture coverage for:\n${missingValidFixtures.join("\n")}`);
}

const invalidFixtures = await validateFixtures("invalid", false);
const docCount = await verifyDocLinks();

console.log(
  `validated ${schemaFiles.length} schemas, ${validFixtures.count} valid fixtures, ${invalidFixtures.count} invalid fixtures, and ${docCount} trust documents`,
);
