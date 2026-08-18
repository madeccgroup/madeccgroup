import crypto from "node:crypto";

export interface CloudinarySignedUploadTicket {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export function createCloudinarySignedUploadTicket(): CloudinarySignedUploadTicket {
  const cloudName = requiredEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = requiredEnv("CLOUDINARY_API_KEY");
  const apiSecret = requiredEnv("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);

  const folder =
    process.env.CLOUDINARY_AI_FOLDER?.trim() ||
    process.env.CLOUDINARY_AI_BUCKET?.trim() ||
    "madecc/ai-studio";

  const paramsToSign = [
    `folder=${folder}`,
    `timestamp=${timestamp}`,
  ].join("&");

  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
  };
}
