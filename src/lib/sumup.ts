const API_BASE = "https://api.sumup.com";

interface CreateCheckoutResult {
  id: string;
  hosted_checkout_url: string;
}

interface CheckoutStatusResult {
  id: string;
  checkout_reference: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
}

function authHeaders() {
  const apiKey = process.env.SUMUP_API_KEY;
  if (!apiKey) throw new Error("SUMUP_API_KEY manquant");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function createHostedCheckout(params: {
  reference: string;
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  redirectUrl: string;
}): Promise<CreateCheckoutResult> {
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;
  if (!merchantCode) throw new Error("SUMUP_MERCHANT_CODE manquant");

  const res = await fetch(`${API_BASE}/v0.1/checkouts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      checkout_reference: params.reference,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      merchant_code: merchantCode,
      return_url: params.returnUrl,
      redirect_url: params.redirectUrl,
      hosted_checkout: { enabled: true },
    }),
  });

  if (!res.ok) {
    throw new Error(`SumUp create checkout a échoué (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

// Ne jamais faire confiance au corps du callback return_url : on relit toujours
// le statut via l'API pour l'utiliser comme source de vérité.
export async function getCheckoutStatus(checkoutId: string): Promise<CheckoutStatusResult> {
  const res = await fetch(`${API_BASE}/v0.1/checkouts/${checkoutId}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`SumUp get checkout a échoué (${res.status}): ${await res.text()}`);
  }

  return res.json();
}
