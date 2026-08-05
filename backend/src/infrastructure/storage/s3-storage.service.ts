import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next || undefined;
}

class S3StorageService {
  private client: S3Client | null = null;
  private bucket = "";
  private publicBaseUrl = "";
  private configured = false;

  constructor() {
    const endpoint = trim(env.S3_ENDPOINT);
    const accessKeyId = trim(env.S3_ACCESS_KEY);
    const secretAccessKey = trim(env.S3_SECRET_KEY);
    const bucket = trim(env.S3_BUCKET);
    const forcePathStyle = env.S3_FORCE_PATH_STYLE !== "false";

    if (endpoint && accessKeyId && secretAccessKey && bucket) {
      this.client = new S3Client({
        region: trim(env.S3_REGION) || "us-east-1",
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle,
      });
      this.bucket = bucket;
      this.publicBaseUrl = (trim(env.S3_PUBLIC_URL) || endpoint).replace(/\/$/, "");
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getBucket(): string {
    return this.bucket;
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.client) {
      throw new Error("Almacenamiento S3/MinIO no configurado");
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || "application/octet-stream",
      })
    );
  }

  async copyObject(
    sourceKey: string,
    destKey: string,
    contentType?: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error("Almacenamiento S3/MinIO no configurado");
    }

    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destKey,
        ...(contentType ? { ContentType: contentType } : {}),
        MetadataDirective: contentType ? "REPLACE" : "COPY",
      })
    );
  }

  async getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.client) {
      throw new Error("Almacenamiento S3/MinIO no configurado");
    }

    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!result.Body) {
      throw new Error("Archivo no encontrado en almacenamiento");
    }

    const bytes = await result.Body.transformToByteArray();

    return {
      buffer: Buffer.from(bytes),
      contentType: result.ContentType || "application/octet-stream",
    };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.client) {
      throw new Error("Almacenamiento S3/MinIO no configurado");
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}

export const s3Storage = new S3StorageService();