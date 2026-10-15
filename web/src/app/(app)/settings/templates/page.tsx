import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultTemplateText, TEMPLATE_KINDS, TEMPLATE_TOKENS } from "@/lib/messaging/templates";
import { UI_LANGUAGES } from "@/lib/i18n";
import { Card, PageHeader } from "@/components/ui";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Message wording" };

export default async function Templates({ searchParams }: PageProps<"/settings/templates">) {
  const ctx = await requireBusiness("settings:write");
  const sp = await searchParams;
  const lang = typeof sp.lang === "string" && sp.lang in UI_LANGUAGES ? sp.lang : "en";
  const custom = await db.messageTemplate.findMany({ where: { businessId: ctx.business.id, lang } });
  const byKind = new Map(custom.map((c) => [c.kind, c.body]));
  const sample = { party: "Ravi Traders", business: ctx.business.name, amount: "₹1,250.00", balance: "₹4,500.00", balanceText: "₹4,500.00 due", date: "14 Oct 2026", number: "INV-12", link: "https://…/s/abc123" };

  return (
    <>
      <PageHeader
        title="Message wording"
        sub="The words your customers get on WhatsApp. Change them to sound like you. Each customer’s message is picked by their language."
        action={<Link href="/settings#messages" className="text-sm text-muted hover:text-ink">← Settings</Link>}
      />
      <nav className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-lg bg-line/50 p-1" aria-label="Language">
        {Object.entries(UI_LANGUAGES).map(([code, name]) => (
          <Link key={code} href={`/settings/templates?lang=${code}`} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${lang === code ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{name}</Link>
        ))}
      </nav>

      <Card className="mb-5 text-sm">
        <p className="font-medium">Words you can put in curly brackets</p>
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-muted sm:grid-cols-2">
          {TEMPLATE_TOKENS.map((t) => <li key={t.token}><code className="rounded bg-bg px-1 text-ink">{`{${t.token}}`}</code> {t.about}</li>)}
        </ul>
        <p className="mt-2 text-muted">Always keep <code className="rounded bg-bg px-1 text-ink">{"{link}"}</code> so the customer can open it. A “Stop messages” line is added by itself.</p>
      </Card>

      <div className="space-y-4">
        {TEMPLATE_KINDS.map((k) => (
          <TemplateEditor
            key={`${lang}-${k.kind}`}
            kind={k.kind} label={k.label} about={k.about} lang={lang}
            initial={byKind.get(k.kind) ?? defaultTemplateText(k.kind, lang)}
            isCustom={byKind.has(k.kind)}
            builtIn={defaultTemplateText(k.kind, lang)}
            sample={sample}
          />
        ))}
      </div>
    </>
  );
}
