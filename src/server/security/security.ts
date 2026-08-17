import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const rawKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;

if (!rawKey) {
  throw new Error(
    "SOCIAL_TOKEN_ENCRYPTION_KEY is required."
  );
}

if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error(
    "SOCIAL_TOKEN_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters."
  );
}

const SECRET_KEY = Buffer.from(rawKey, "hex");
export class SocialTokenReconnectRequiredError extends Error {
  code = "RECONNECT_REQUIRED";

  constructor(message = "Stored social token cannot be decrypted with the current encryption key.") {
    super(message);
    this.name = "SocialTokenReconnectRequiredError";
  }
}

export function encryptToken(value: string): string {
  if (!value) return "";

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    SECRET_KEY,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(value, "utf8")),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptToken(value: string): string {
  if (!value) return "";

  const parts = value.split(":");

  if (parts.length !== 3) {
    throw new Error("INVALID_ENCRYPTED_TOKEN_FORMAT");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  if (
    !/^[0-9a-fA-F]+$/.test(ivHex) ||
    !/^[0-9a-fA-F]+$/.test(authTagHex) ||
    !/^[0-9a-fA-F]+$/.test(encryptedHex)
  ) {
    throw new Error("INVALID_ENCRYPTED_TOKEN_ENCODING");
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      SECRET_KEY,
      iv
    );

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "SOCIAL_TOKEN_DECRYPTION_FAILED_RECONNECT_REQUIRED"
    );
  }
}

