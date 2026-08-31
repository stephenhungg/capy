import "server-only";

import publicDemoFixture from "@/lib/public-demo-fixture.json";

/**
 * A deliberately small, checked-in projection of the canonical synthetic fixtures.
 * The repository validator fails if this safe projection drifts from those objects.
 * Internal ids, people, wallets, artifact locations, digests, and timestamps stay out.
 */
export const publicDemo = publicDemoFixture;
