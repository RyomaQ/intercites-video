import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCodeValue } from "@/lib/codes";
import { getCheckoutStatus } from "@/lib/sumup";
import { sendCodeEmail } from "@/lib/email";

// Appelé par SumUp (return_url) quand un checkout atteint un état final.
// On ne fait jamais confiance au corps de la requête : on relit le statut
// via l'API SumUp avec l'id reçu avant d'agir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const checkoutId = typeof body?.id === "string" ? body.id : "";

  if (!checkoutId) {
    return NextResponse.json({ error: "id manquant." }, { status: 400 });
  }

  let status: string;
  try {
    status = (await getCheckoutStatus(checkoutId)).status;
  } catch (err) {
    console.error("Erreur vérification checkout SumUp :", err);
    return NextResponse.json({ error: "Vérification impossible." }, { status: 502 });
  }

  if (status !== "PAID") {
    await prisma.order.updateMany({
      where: { sumupCheckoutId: checkoutId, status: "pending" },
      data: { status: "failed" },
    });
    return NextResponse.json({ ok: true });
  }

  let order = await prisma.order.findUnique({
    where: { sumupCheckoutId: checkoutId },
    include: { code: true },
  });

  if (!order) {
    console.error("Commande introuvable pour checkout :", checkoutId);
    return NextResponse.json({ ok: true });
  }

  // Marquage atomique : ne génère un code que pour la requête qui gagne la course
  // entre webhook et éventuels retries de SumUp.
  if (order.status !== "paid") {
    const { count } = await prisma.order.updateMany({
      where: { sumupCheckoutId: checkoutId, status: "pending" },
      data: { status: "paid" },
    });

    if (count === 1) {
      let codeValue: string;
      do {
        codeValue = generateCodeValue();
      } while (await prisma.code.findUnique({ where: { codeValue } }));

      const code = await prisma.code.create({ data: { codeValue, origin: "digital" } });
      order = await prisma.order.update({
        where: { sumupCheckoutId: checkoutId },
        data: { codeId: code.id },
        include: { code: true },
      });
    } else {
      order = await prisma.order.findUniqueOrThrow({
        where: { sumupCheckoutId: checkoutId },
        include: { code: true },
      });
    }
  }

  // Le retry SumUp reprend ici si l'envoi d'email précédent avait échoué.
  if (order.code) {
    try {
      await sendCodeEmail(order.email, order.code.codeValue);
    } catch (err) {
      console.error("Erreur envoi email Resend :", err);
      return NextResponse.json({ error: "Envoi de l'email échoué." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
