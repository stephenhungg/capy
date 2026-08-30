import { describe, expect, it } from "vitest";
import { S3ObjectStorage } from "../src/storage.js";

describe("s3 upload signing", () => {
  it("signs write-once length constraints without an empty-payload checksum", async () => {
    const storage = new S3ObjectStorage({
      endpoint: "https://bucket.example.com",
      region: "auto",
      bucket: "test",
      accessKeyId: "access",
      secretAccessKey: "secret",
      forcePathStyle: true,
    });
    try {
      const signed = await storage.createUploadUrl(
        "sessions/digest/journal/events.ndjson",
        {
          id: "journal",
          name: "events.ndjson",
          kind: "journal",
          mediaType: "application/x-ndjson",
          byteLength: 42,
          sha256: "a".repeat(64),
        },
        600,
      );
      const url = new URL(signed.url);
      expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
        "content-length;host;if-none-match",
      );
      expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
      expect(signed.requiredHeaders).toEqual({
        "content-type": "application/x-ndjson",
        "content-length": "42",
        "if-none-match": "*",
      });
    } finally {
      storage.close();
    }
  });
});
