import { Badge, Card, PageHeader } from "@/components/ui";
import { connectionStates } from "@/lib/integrations";
import { ConnectionForm } from "./connection-form";

export const metadata = { title: "Connections · Platform admin" };
export const dynamic = "force-dynamic";

const TONE = { connected: "good", partial: "warn", off: "neutral" } as const;
const WORD = { connected: "Connected", partial: "Set up partly", off: "Not connected" } as const;

export default async function Connections() {
  const { list, unreadable } = await connectionStates();
  return (
    <>
      <PageHeader title="Connections" sub="The outside services FinOps can use. Add the keys here and they are used straight away. No change to the server is needed." />
      <Card className="mb-5 space-y-1 text-sm">
        <p className="font-medium">How this works</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Keys are stored encrypted and shown only as their last four characters. They are never written to the admin log.</li>
          <li>A value set here is used instead of the server’s own setting. Clear it and the server’s setting is used again.</li>
          <li>Leave a key box empty to keep the key that is already saved.</li>
        </ul>
      </Card>
      {unreadable.length > 0 && (
        <Card className="mb-5 border-warn/30 bg-warn/5 text-sm">
          <p className="font-medium">{unreadable.length} saved value{unreadable.length === 1 ? "" : "s"} could not be read</p>
          <p className="text-muted">The server’s SESSION_SECRET has changed since they were saved: {unreadable.join(", ")}. Enter them again.</p>
        </Card>
      )}
      <div className="space-y-4">
        {list.map((i) => (
          <details key={i.id} open={i.id === "ai"} className="group rounded-xl border border-line bg-card shadow-[var(--shadow)]">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">{i.label}</span>
              <Badge tone={TONE[i.status]}>{WORD[i.status]}</Badge>
              <span className="ml-auto text-xs text-muted group-open:hidden">Open</span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <p className="text-sm text-muted">{i.about}{i.docs && <> <a href={i.docs.href} target="_blank" rel="noreferrer" className="font-medium text-brand underline">{i.docs.label}</a></>}</p>
              <ConnectionForm integration={{ id: i.id, testable: !!i.testable, fields: i.fields.map(({ env, label, hint, kind, options, placeholder, source, shown }) => ({ env, label, hint, kind, options, placeholder, source, shown })) }} />
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
