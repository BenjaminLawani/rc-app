import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { applyPush } from "@/lib/db/sync-server";
import type { PushOp } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const ops = body?.ops;
  if (!Array.isArray(ops)) {
    return NextResponse.json({ error: "Expected { ops: [...] }" }, { status: 400 });
  }

  // Staff may write sessions & entries; only admins may write the catalog.
  const isAdmin = user.role === "admin";
  const safe = (ops as PushOp[]).filter((op) => {
    if (!op?.row?.id) return false;
    if (op.entity === "session" || op.entity === "entry") return true;
    if (op.entity === "item" || op.entity === "category") return isAdmin;
    return false;
  });

  await applyPush(safe, user.sub);
  return NextResponse.json({ ok: true });
}
