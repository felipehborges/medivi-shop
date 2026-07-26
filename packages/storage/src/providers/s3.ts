import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { StorageProvider, UploadInput, UploadResult } from "../types";

export type S3ProviderConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "-");
}

/**
 * Points at MinIO locally (S3-compatible, path-style addressing) via
 * `STORAGE_PROVIDER=s3` — same client code targets a real S3-compatible
 * bucket in production if ever needed, only the endpoint/credentials differ
 * (see docs/architecture.md §10).
 */
export class S3Provider implements StorageProvider {
  private readonly client: S3Client;
  private readonly endpoint: string;
  private readonly bucket: string;

  constructor(config: S3ProviderConfig) {
    this.endpoint = config.endpoint;
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const key = `${randomUUID()}-${sanitizeFilename(input.filename)}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );
    return { url: `${this.endpoint}/${this.bucket}/${key}` };
  }

  async delete(url: string): Promise<void> {
    const key = new URL(url).pathname.replace(`/${this.bucket}/`, "");
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
