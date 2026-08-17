import {
  decryptToken,
  SocialTokenReconnectRequiredError,
} from "./security";

export type SocialTokenResult =
  | {
      ok: true;
      token: string;
      source: "database" | "environment";
    }
  | {
      ok: false;
      code: "RECONNECT_REQUIRED" | "TOKEN_MISSING";
      token: null;
      reason: string;
    };

export function resolveSocialToken(
  encryptedToken?: string | null,
  environmentToken?: string | null
): SocialTokenResult {
  if (encryptedToken) {
    try {
      const token = decryptToken(encryptedToken);

      if (token) {
        return {
          ok: true,
          token,
          source: "database",
        };
      }
    } catch (error) {
      if (error instanceof SocialTokenReconnectRequiredError) {
        return {
          ok: false,
          code: "RECONNECT_REQUIRED",
          token: null,
          reason:
            "The stored OAuth token was encrypted with an unavailable encryption key. Reconnect this social account.",
        };
      }

      return {
        ok: false,
        code: "RECONNECT_REQUIRED",
        token: null,
        reason:
          "The stored OAuth credential could not be decrypted. Reconnect this social account.",
      };
    }
  }

  if (environmentToken) {
    return {
      ok: true,
      token: environmentToken,
      source: "environment",
    };
  }

  return {
    ok: false,
    code: "TOKEN_MISSING",
    token: null,
    reason: "No social OAuth access token is configured.",
  };
}
