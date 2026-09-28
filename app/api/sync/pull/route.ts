import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/session";
import { pullChanges } from "@/lib/db/sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const result = await pullChanges(Number.isFinite(since) ? since : 0);
  return NextResponse.json(result);
}
