import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { createHostedCheckout } from "@/lib/sumup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRICE_EUR = Number(process.env.NEXT_PUBLIC_DIGITAL_PRICE_EUR ?? "4");

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    console.error("SITE_URL manquant");
    return NextResponse.json({ error: "Purchases are unavailable right now." }, { status: 500 });
  }

  try {
    const checkout = await createHostedCheckout({
      reference: randomUUID(),
      amount: PRICE_EUR,
      currency: "EUR",
      description: "Intercités - Digital video",
      returnUrl: `${siteUrl}/api/checkout/webhook`,
    });

    await prisma.order.create({
      data: {
        sumupCheckoutId: checkout.id,
        email,
        status: "pending",
      },
    });

    return NextResponse.json({ url: checkout.hosted_checkout_url });
  } catch (err) {
    console.error("Erreur création checkout SumUp :", err);
    return NextResponse.json(
      { error: "The payment couldn't be started. Please try again in a moment." },
      { status: 500 }
    );
  }
}
