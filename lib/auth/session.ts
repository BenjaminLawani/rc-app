import { cookies } from "next/headers";
import { verifyToken, type JwtPayload } from "./jwt";

export const AUTH_COOKIE = "rc_token";

/** Resolve the authenticated user from an Authorization: Bearer header or the auth cookie. */
export async function getUserFromRequest(req: Request): Promise<JwtPayload | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const user = await verifyToken(auth.slice(7));
    if (user) return user;
  }
  const store = await cookies();
  const cookieToken = store.get(AUTH_COOKIE)?.value;
  if (cookieToken) return verifyToken(cookieToken);
  return null;
}
