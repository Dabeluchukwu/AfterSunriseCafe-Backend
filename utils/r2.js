import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const buildKey = (originalName) => {
  const ext = originalName.includes(".")
    ? originalName.split(".").pop().toLowerCase()
    : "jpg";
  return `products/${randomUUID()}.${ext}`;
};

/**
 * Upload a buffer to R2.
 * @param {Buffer} buffer
 * @param {string} originalName - to preserve extension
 * @param {string} mimetype
 * @returns {Promise<{ url: string, key: string }>}
 */
export const uploadToR2 = async (buffer, originalName, mimetype) => {
  const key = buildKey(originalName);

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    })
  );

  // Public URL — requires your R2 bucket to have a public domain / r2.dev URL
  const url = `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return { url, key };
};

/**
 * Delete an object from R2 by its key.
 */
export const deleteFromR2 = async (key) => {
  if (!key) return;
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );
};