import { NextResponse } from "next/server";
import { getSignedTrailerUrl, getSignedTrailerMobileUrl } from "@/lib/r2";

export async function GET() {
  try {
    const [url, mobileUrl] = await Promise.all([
      getSignedTrailerUrl(),
      getSignedTrailerMobileUrl(),
    ]);
    return NextResponse.json({ url, mobileUrl });
  } catch (err) {
    console.error("Erreur génération lien bande-annonce R2 :", err);
    return NextResponse.json({ error: "Bande-annonce indisponible." }, { status: 500 });
  }
}
