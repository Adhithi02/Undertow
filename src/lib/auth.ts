import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const AUTH_COOKIE_NAME = "undertow_user";

export type UserRecord = { id: string; email: string; lastVisit?: Date | null };

export interface UserStore {
  user: {
    upsert(args: {
      where: { email: string };
      update: { email: string };
      create: { email: string };
      select: { id: true; email: true };
    }): Promise<UserRecord>;
    findUnique(args: {
      where: { id: string };
      select: { id: true; email: true; lastVisit: true };
    }): Promise<UserRecord | null>;
  };
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.COOKIE_SECRET;
  if (!secret) throw new Error("AUTH_SECRET or COOKIE_SECRET environment variable is not set");
  return secret;
}

export function signUserId(userId: string, secret = getAuthSecret()): string {
  const signature = createHmac("sha256", secret).update(userId).digest("base64url");
  return `${userId}.${signature}`;
}

export function verifyUserId(value: string | undefined, secret = getAuthSecret()): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const userId = value.slice(0, separator);
  const received = Buffer.from(value.slice(separator + 1), "utf8");
  const expected = Buffer.from(createHmac("sha256", secret).update(userId).digest("base64url"), "utf8");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  return userId;
}

export async function getOrCreateUser(email: string, store: UserStore = prisma): Promise<UserRecord> {
  return store.user.upsert({
    where: { email },
    update: { email },
    create: { email },
    select: { id: true, email: true },
  });
}

export async function getCurrentUser(): Promise<UserRecord | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!cookieValue) return null;
  const userId = verifyUserId(cookieValue);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, lastVisit: true },
  });
}