import { NextResponse } from "next/server";
import { getSignedTrailerUrl } from "@/lib/b2";

export async function GET() {
  try {
    const url = await getSignedTrailerUrl();
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Erreur génération lien bande-annonce B2 :", err);
    return NextResponse.json({ error: "Bande-annonce indisponible." }, { status: 500 });
  }
}
