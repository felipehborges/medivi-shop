import "server-only";
import { S3Provider, VercelBlobProvider, type StorageProvider } from "@medivi/storage";
import { env } from "./env";

let cached: StorageProvider | null = null;

/** Selected by `STORAGE_PROVIDER` (see docs/plan.md §23), never inferred from `NODE_ENV`. */
export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  if (env.STORAGE_PROVIDER === "vercel-blob") {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is required when STORAGE_PROVIDER=vercel-blob");
    }
    cached = new VercelBlobProvider({ token: env.BLOB_READ_WRITE_TOKEN });
  } else {
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
      throw new Error(
        "S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET are required when STORAGE_PROVIDER=s3",
      );
    }
    cached = new S3Provider({
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      bucket: env.S3_BUCKET,
    });
  }
  return cached;
}
