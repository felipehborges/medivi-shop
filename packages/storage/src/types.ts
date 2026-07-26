export type UploadInput = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

export type UploadResult = {
  url: string;
};

/**
 * `VercelBlobProvider` (prod) / `S3Provider` pointed at MinIO (local) are
 * selected via `STORAGE_PROVIDER` — see docs/plan.md §23. `delete` takes the
 * URL `upload` returned, not a separately-tracked key, so callers never need
 * to remember provider-specific addressing.
 */
export interface StorageProvider {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(url: string): Promise<void>;
}
