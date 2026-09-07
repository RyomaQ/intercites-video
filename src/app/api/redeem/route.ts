import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/b2";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawCode = typeof body?.code === "string" ? body.code : "";
  const codeValue = rawCode.trim().toUpperCase().replace(/\s+/g, "");

  if (!codeValue) {
    return NextResponse.json({ error: "Code manquant." }, { status: 400 });
  }

  // Le lien signé est préparé avant de consommer le code : générer une URL
  // B2 ne coûte rien tant qu'elle n'est pas utilisée, donc si l'appel B2
  // échoue le code reste "unused" et l'utilisateur peut simplement réessayer.
  let downloadUrl: string;
  try {
    downloadUrl = await getSignedDownloadUrl();
  } catch (err) {
    console.error("Erreur génération lien B2 :", err);
    return NextResponse.json(
      { error: "Le téléchargement n'a pas pu être préparé. Réessayez dans un instant." },
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
      ? "Ce code a déjà été utilisé."
      : "Code invalide.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ downloadUrl });
}
