import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/r2";
import { isMobileUserAgent, MOBILE_BLOCKED_MESSAGE } from "@/lib/device";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawCode = typeof body?.code === "string" ? body.code : "";
  const codeValue = rawCode.trim().toUpperCase().replace(/\s+/g, "");

  if (!codeValue) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  // Filet de sécurité serveur (la page bloque déjà côté client) : refusé
  // avant l'UPDATE, donc le code reste "unused".
  if (
    isMobileUserAgent(req.headers.get("user-agent")) ||
    req.headers.get("sec-ch-ua-mobile") === "?1"
  ) {
    return NextResponse.json({ error: MOBILE_BLOCKED_MESSAGE }, { status: 400 });
  }

  // Le lien signé est préparé avant de consommer le code : générer une URL
  // R2 ne coûte rien tant qu'elle n'est pas utilisée, donc si l'appel R2
  // échoue le code reste "unused" et l'utilisateur peut simplement réessayer.
  let downloadUrl: string;
  try {
    downloadUrl = await getSignedDownloadUrl();
  } catch (err) {
    console.error("Erreur génération lien R2 :", err);
    return NextResponse.json(
      { error: "The download couldn't be prepared. Please try again in a moment." },
      { status: 500 }
    );
  }

  // Validation atomique : l'UPDATE ne réussit que si le code existe encore
  // au statut "unused" au moment de l'exécution — élimine toute course entre
  // deux validations simultanées du même code.
  const { count } = await prisma.code.updateMany({
    where: { codeValue, status: "unused" },
    data: {
      status: "used",
      downloadsUsed: { increment: 1 },
      redeemedAt: new Date(),
    },
  });

  if (count === 0) {
    const existing = await prisma.code.findUnique({ where: { codeValue } });
    const message = existing
      ? "This code has already been used."
      : "Invalid code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ downloadUrl });
}
