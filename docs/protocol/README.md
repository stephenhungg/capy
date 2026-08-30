# capy protocol

this directory contains the canonical capy protocol 1.0 specification and a complete linked example.

- [capy protocol 1.0](./capy-protocol-v1.md) is normative.
- [examples](./examples/) contains a camera-free I2RT YAM capability, cohort, evaluation receipt, attribution result, and Solana payout manifest.
- [schemas](../../schemas/) contains the JSON Schema draft 2020-12 contracts.
- [validation script](../../scripts/validate-protocol.mjs) checks every schema, validates every example, recomputes RFC 8785/SHA-256 object digests, resolves linked example references, and checks cross-object accounting invariants.

run the conformance fixture with:

```bash
npm install
npm test
```

the example signatures are intentionally non-verifying placeholders. they exercise the wire shape, digest binding, and key references without publishing private test keys. network acceptance additionally requires cryptographic signature verification and the semantic checks in the specification.
