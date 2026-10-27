"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { newShareToken } from "@/lib/session";
import { appUrl } from "@/lib/share";
import { balanceOf } from "@/lib/ledger";
import { invoicePayments } from "@/lib/queries";
import { createOrder, gatewayMode } from "@/lib/payments/gateway";
import { settleFromGateway } from "@/lib/payments/settle";
import { formatINR } from "@/lib/money";

export type PayState = { error?: string };

/**
 * Starts an online payment from a public invoice or statement link (CP-05). The share
 * token is the only identity; the amount always comes from our books, never the browser.
 */
export async function startPayment(_prev: PayState, form: FormData): Promise<PayState> {
  const g = gatewayMode();
  if (!g) return { error: "Online payment isn’t available right now." };
  const kind = String(form.get("kind") ?? "");
  const token = String(form.get("token") ?? "");

  let businessId: string;
  let partyId: string;
  let invoiceId: string | null = null;
  let amount = 0;
  let label = "";
  if (kind === "invoice") {
    const inv = await db.invoice.findUnique({ where: { shareToken: token } });
    if (!inv || inv.status === "CANCELLED") return { error: "This invoice can’t be paid online." };
    const pay = (await invoicePayments(inv.businessId, [inv])).get(inv.id);
    amount = pay?.open ?? 0;
    businessId = inv.businessId;
    partyId = inv.partyId;
    invoiceId = inv.id;
    label = `Invoice ${inv.number}`;
  } else if (kind === "party") {
    const party = await db.party.findUnique({ where: { shareToken: token } });
    if (!party || party.archivedAt) return { error: "This link can’t be paid online." };
    amount = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));
    businessId = party.businessId;
    partyId = party.id;
    label = "Account balance";
  } else {
    return { error: "Nothing to pay." };
  }
  if (amount < 100) return { error: "Nothing is due. Thank you!" };

  // A link can not be used to flood the gateway with orders.
  const recent = await db.payment.count({ where: { partyId, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 10) return { error: "Too many attempts. Please try again later." };

  const [business, party] = await Promise.all([db.business.findUniqueOrThrow({ where: { id: businessId } }), db.party.findUniqueOrThrow({ where: { id: partyId } })]);
  if (business.suspendedAt || business.closingAt) return { error: "Online payment is not available for this shop right now." };
  const payToken = newShareToken();
  let created;
  try {
    created = await createOrder(g, {
      amountPaise: amount, reference: payToken.slice(0, 30), description: `${business.name} · ${label} · ${formatINR(amount)}`,
      phone: party.phone, returnUrl: appUrl(`/pay/${payToken}`),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn’t start the payment." };
  }
  await db.payment.create({
    data: { businessId, partyId, invoiceId, amountPaise: BigInt(amount), provider: g, providerOrderId: created.providerOrderId, token: payToken },
  });
  redirect(created.checkoutUrl ?? `/pay/${payToken}`);
}

/** Test-mode only: stands in for the gateway telling us the customer paid. */
export async function completeTestPayment(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const pay = await db.payment.findUnique({ where: { token } });
  if (!pay || pay.provider !== "test" || gatewayMode() !== "test") redirect(`/pay/${token}`);
  await settleFromGateway({ providerOrderId: pay.providerOrderId, providerPaymentId: `test_pay_${pay.id.slice(-8)}`, status: "PAID", amountPaise: Number(pay.amountPaise) });
  redirect(`/pay/${token}`);
}
