import { assertNonEmpty, assertSafeInteger, sha256Hex } from "./canonical.js";

function stratumKey(stratum) {
  if (typeof stratum === "string") return stratum;
  return Object.keys(stratum)
    .sort()
    .map((key) => `${key}=${stratum[key]}`)
    .join("|");
}

function choiceScore(loads, groupWeights, strata) {
  let score = 0n;
  for (const stratum of strata) {
    const projected = BigInt(loads.get(stratum) ?? 0) + BigInt(groupWeights.get(stratum) ?? 0);
    score += projected * projected;
  }
  return score;
}

export function constructCohorts({ units, cohortCount, seed, protocolHash }) {
  assertSafeInteger(cohortCount, "cohortCount", 2, 64);
  assertNonEmpty(seed, "seed");
  assertNonEmpty(protocolHash, "protocolHash");
  if (!Array.isArray(units) || units.length < cohortCount) {
    throw new TypeError("units must contain at least one item per cohort");
  }

  const seenIds = new Set();
  const groups = new Map();
  for (const unit of units) {
    assertNonEmpty(unit.contributionId, "unit.contributionId");
    assertNonEmpty(unit.independenceGroupId, "unit.independenceGroupId");
    assertSafeInteger(unit.acceptedUnits, "unit.acceptedUnits", 1);
    if (seenIds.has(unit.contributionId)) {
      throw new TypeError(`duplicate contribution id: ${unit.contributionId}`);
    }
    seenIds.add(unit.contributionId);

    const group = groups.get(unit.independenceGroupId) ?? {
      id: unit.independenceGroupId,
      units: [],
      weights: new Map(),
    };
    const stratum = stratumKey(unit.stratum);
    group.units.push({ ...unit, stratumKey: stratum });
    group.weights.set(stratum, (group.weights.get(stratum) ?? 0) + unit.acceptedUnits);
    groups.set(group.id, group);
  }

  if (groups.size < cohortCount) {
    throw new TypeError("independence groups must contain at least one group per cohort");
  }

  const strata = [...new Set(units.map((unit) => stratumKey(unit.stratum)))].sort();
  const orderedGroups = [...groups.values()].sort((left, right) => {
    const leftKey = sha256Hex(`${protocolHash}:${seed}:group:${left.id}`);
    const rightKey = sha256Hex(`${protocolHash}:${seed}:group:${right.id}`);
    return leftKey.localeCompare(rightKey) || left.id.localeCompare(right.id);
  });

  const cohorts = Array.from({ length: cohortCount }, (_, index) => ({
    cohortId: `cohort-${String(index + 1).padStart(2, "0")}`,
    loads: new Map(),
    contributionIds: [],
    independenceGroupIds: [],
  }));

  for (const group of orderedGroups) {
    const ranked = cohorts
      .map((cohort) => ({
        cohort,
        balanceScore: choiceScore(cohort.loads, group.weights, strata),
        tieBreaker: sha256Hex(`${protocolHash}:${seed}:assign:${group.id}:${cohort.cohortId}`),
      }))
      .sort(
        (left, right) =>
          (left.balanceScore < right.balanceScore ? -1 : left.balanceScore > right.balanceScore ? 1 : 0) ||
          left.tieBreaker.localeCompare(right.tieBreaker),
      );
    const selected = ranked[0].cohort;
    selected.independenceGroupIds.push(group.id);
    for (const unit of group.units) {
      selected.contributionIds.push(unit.contributionId);
      selected.loads.set(unit.stratumKey, (selected.loads.get(unit.stratumKey) ?? 0) + unit.acceptedUnits);
    }
  }

  return cohorts.map((cohort) => ({
    cohortId: cohort.cohortId,
    contributionIds: cohort.contributionIds.sort(),
    independenceGroupIds: cohort.independenceGroupIds.sort(),
    stratumLoads: Object.fromEntries(strata.map((stratum) => [stratum, cohort.loads.get(stratum) ?? 0])),
  }));
}
