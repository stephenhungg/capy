import test from "node:test";
import assert from "node:assert/strict";

import { constructCohorts } from "../src/index.js";

const UNITS = [
  {
    contributionId: "clip-a",
    independenceGroupId: "operator-and-device-1",
    acceptedUnits: 2,
    stratum: { embodiment: "arm", object: "glass" },
  },
  {
    contributionId: "clip-b",
    independenceGroupId: "operator-and-device-1",
    acceptedUnits: 1,
    stratum: { embodiment: "arm", object: "ceramic" },
  },
  {
    contributionId: "clip-c",
    independenceGroupId: "operator-and-device-2",
    acceptedUnits: 2,
    stratum: { embodiment: "arm", object: "glass" },
  },
  {
    contributionId: "clip-d",
    independenceGroupId: "operator-and-device-3",
    acceptedUnits: 1,
    stratum: { embodiment: "arm", object: "ceramic" },
  },
];

test("cohort assignment is order-independent and keeps independence groups intact", () => {
  const options = { cohortCount: 2, seed: "revealed-seed-42", protocolHash: "protocol-7" };
  const first = constructCohorts({ ...options, units: UNITS });
  const second = constructCohorts({ ...options, units: [...UNITS].reverse() });

  assert.deepEqual(first, second);
  const containingA = first.find((cohort) => cohort.contributionIds.includes("clip-a"));
  assert.ok(containingA.contributionIds.includes("clip-b"));
  assert.equal(new Set(first.flatMap((cohort) => cohort.contributionIds)).size, UNITS.length);
});

test("cohort assignment refuses a split with too few independent groups", () => {
  assert.throws(
    () => constructCohorts({ units: UNITS.slice(0, 2), cohortCount: 2, seed: "seed", protocolHash: "protocol" }),
    /independence groups/,
  );
});
