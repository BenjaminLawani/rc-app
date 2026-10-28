import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import {
  REOPEN_PASSWORD_HASH,
  deleteSetting,
  getSetting,
  setSetting,
} from "@/lib/db/app-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-managed password required to reopen a closed day. Stored hashed and
// verified on the server (see /api/reopen-verify) so it never reaches a device.
export async function GET(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hash = await getSetting(REOPEN_PASSWORD_HASH);
  return NextResponse.json({ set: !!hash });
}

const Body = z.object({ password: z.string().min(4) });

export async function POST(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a reopen password of at least 4 characters." }, { status: 400 });
  }

  await setSetting(REOPEN_PASSWORD_HASH, await hashPassword(parsed.data.password));
  return NextResponse.json({ ok: true, set: true });
}

export async function DELETE(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteSetting(REOPEN_PASSWORD_HASH);
  return NextResponse.json({ ok: true, set: false });
}
