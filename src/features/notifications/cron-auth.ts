import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unauthorized" | "misconfigured";
const MIN_SECRET_LENGTH = 16;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time comparison of equal-length digests; a missing or weak secret never authorises anything. */
export function checkCronAuth(authorization: string | null, secret: string | undefined): CronAuth {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return "misconfigured";
  const token = /^Bearer (.+)$/.exec(authorization ?? "")?.[1];
  if (!token) return "unauthorized";
  return timingSafeEqual(digest(token), digest(secret)) ? "ok" : "unauthorized";
}
