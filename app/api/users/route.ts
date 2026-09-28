import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getUserFromRequest } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(asc(users.createdAt));
  return NextResponse.json({ users: rows });
}

const CreateBody = z.object({
  email: z.string().min(3),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "staff"]).default("staff"),
});

export async function POST(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name, email and a 6+ char password are required." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const now = Date.now();
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email,
    name: parsed.data.name.trim(),
    passwordHash: await hashPassword(parsed.data.password),
    role: parsed.data.role,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ user: { id, email, name: parsed.data.name.trim(), role: parsed.data.role } });
}

const PatchBody = z.object({
  id: z.string().min(1),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "staff"]).optional(),
});

export async function PATCH(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (parsed.data.password) patch.passwordHash = await hashPassword(parsed.data.password);
  if (parsed.data.role) patch.role = parsed.data.role;
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await db.update(users).set(patch).where(eq(users.id, parsed.data.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  if (id === me.sub) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
