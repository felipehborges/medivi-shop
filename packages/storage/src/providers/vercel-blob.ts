import { del, put } from "@vercel/blob";

import type { StorageProvider, UploadInput, UploadResult } from "../types";

export type VercelBlobProviderConfig = {
  token: string;
};

export class VercelBlobProvider implements StorageProvider {
  private readonly token: string;

  constructor(config: VercelBlobProviderConfig) {
    this.token = config.token;
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const blob = await put(input.filename, input.buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: input.contentType,
      token: this.token,
    });
    return { url: blob.url };
  }

  async delete(url: string): Promise<void> {
    await del(url, { token: this.token });
  }
}
