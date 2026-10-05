import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { partiesWithBalance } from "@/lib/queries";
import { Balance, Card, EmptyState, Input, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Parties" };

const TYPE_LABEL: Record<string, string> = { CUSTOMER: "Customer", SUPPLIER: "Supplier", BOTH: "Customer & supplier" };

export default async function Parties({ searchParams }: PageProps<"/parties">) {
  const { business } = await requireBusiness();
  const q = String((await searchParams).q ?? "").trim();
  const parties = await partiesWithBalance(business.id, q || undefined);

  return (
    <>
      <PageHeader title="Parties" sub={`${parties.length} ${q ? "matching" : "total"}`} action={<LinkButton href="/parties/new">Add party</LinkButton>} />
      <form className="mb-4">
        <Input name="q" defaultValue={q} placeholder="Search by name or phone" />
      </form>
      {parties.length === 0 ? (
        <EmptyState title={q ? "No parties match your search" : "No parties yet"}>
          {!q && "Add customers and suppliers to start recording what they owe you."}
        </EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0">
          {parties.map((p) => (
            <Link key={p.id} href={`/parties/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted">{TYPE_LABEL[p.type]}{p.phone ? ` · +${p.phone}` : ""}</span>
              </span>
              <Balance paise={p.balance} className="shrink-0 text-right" />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
