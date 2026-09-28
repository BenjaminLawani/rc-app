import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/types";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-only-insecure-secret");

export type JwtPayload = { sub: string; email: string; name: string; role: Role };

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function signToken(p: JwtPayload, ttl = TOKEN_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: p.email, name: p.name, role: p.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
