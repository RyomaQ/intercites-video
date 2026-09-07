import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Requête légère appelée quotidiennement (cf. .github/workflows/supabase-ping.yml)
// pour éviter la mise en pause du projet Supabase gratuit après 1 semaine d'inactivité.
export async function GET() {
  await prisma.code.count();
  return NextResponse.json({ ok: true });
}
