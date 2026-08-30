import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ArtifactManifest } from "./domain.js";

export class ObjectMissingError extends Error {
  constructor(readonly objectKey: string) {
    super("object is missing from storage");
    this.name = "ObjectMissingError";
  }
}

export type SignedUpload = {
  url: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
};

export type SignedDownload = {
  url: string;
  expiresInSeconds: number;
};

export interface ObjectStorage {
  ping(): Promise<void>;
  createUploadUrl(
    objectKey: string,
    artifact: ArtifactManifest,
    expiresInSeconds: number,
  ): Promise<SignedUpload>;
  createDownloadUrl(objectKey: string, expiresInSeconds: number): Promise<SignedDownload>;
  readObject(objectKey: string): Promise<AsyncIterable<Uint8Array>>;
  close(): void;
}

export type S3StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }

  async createUploadUrl(
    objectKey: string,
    artifact: ArtifactManifest,
    expiresInSeconds: number,
  ): Promise<SignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: artifact.mediaType,
      ContentLength: artifact.byteLength,
      IfNoneMatch: "*",
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      expiresInSeconds,
      requiredHeaders: {
        "content-type": artifact.mediaType,
        "content-length": String(artifact.byteLength),
        "if-none-match": "*",
      },
    };
  }

  async createDownloadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<SignedDownload> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresInSeconds };
  }

  async readObject(objectKey: string): Promise<AsyncIterable<Uint8Array>> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey }),
      );
      const body = response.Body;
      if (!body || !(Symbol.asyncIterator in body)) {
        throw new Error("object storage returned a non-streaming body");
      }
      return body as AsyncIterable<Uint8Array>;
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
      ) {
        throw new ObjectMissingError(objectKey);
      }
      throw error;
    }
  }

  close(): void {
    this.client.destroy();
  }
}
