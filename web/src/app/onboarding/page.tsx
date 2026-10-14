import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createBusiness } from "@/app/actions/business";
import { BusinessForm } from "@/components/business-form";
import { Card } from "@/components/ui";

export const metadata = { title: "Set up your business" };

export default async function Onboarding() {
  const { user } = await requireUser();
  const existing = await db.membership.count({ where: { userId: user.id } });
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {existing > 0 && <Link href="/dashboard" className="text-sm text-muted underline">← Back</Link>}
      <h1 className="text-2xl font-bold">{existing > 0 ? "Add another business" : "Set up your business"}</h1>
      <p className="mb-6 mt-1 text-sm text-muted">This appears on your statements, invoices and reminders. You can change it later.</p>
      <Card><BusinessForm action={createBusiness} submitLabel="Create business" /></Card>
    </main>
  );
}
