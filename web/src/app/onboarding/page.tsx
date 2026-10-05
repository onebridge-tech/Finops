import { requireUser } from "@/lib/auth";
import { createBusiness } from "@/app/actions/business";
import { BusinessForm } from "@/components/business-form";
import { Card } from "@/components/ui";

export const metadata = { title: "Set up your business" };

export default async function Onboarding() {
  await requireUser();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Set up your business</h1>
      <p className="mb-6 mt-1 text-sm text-muted">This appears on your statements, invoices and reminders. You can change it later.</p>
      <Card><BusinessForm action={createBusiness} submitLabel="Create business" /></Card>
    </main>
  );
}
