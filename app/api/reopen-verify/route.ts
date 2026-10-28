import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { REOPEN_PASSWORD_HASH, getSetting } from "@/lib/db/app-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Any signed-in user may reopen a closed day, but only by supplying the
// admin-set reopen password. Verified here so the secret stays on the server.
const Body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the reopen password." }, { status: 400 });
  }

  const hash = await getSetting(REOPEN_PASSWORD_HASH);
  if (!hash) {
    return NextResponse.json(
      { error: "No reopen password is set. Ask an admin to set one in Settings." },
      { status: 400 },
    );
  }

  if (!(await verifyPassword(parsed.data.password, hash))) {
    return NextResponse.json({ error: "Incorrect reopen password." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
