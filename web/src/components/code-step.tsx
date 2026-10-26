import { Field, Input } from "@/components/ui";

/** The 6-digit code box, with the code shown on screen only in local test mode. */
export function CodeStep({ devCode }: { devCode?: string }) {
  return (
    <>
      {devCode && (
        <p className="rounded-lg border border-brand/20 bg-brand-soft px-3 py-2.5 text-sm">
          Test mode — your code is <span className="font-mono text-base font-semibold">{devCode}</span>
        </p>
      )}
      <Field label="6-digit code">
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="text-center font-mono text-lg tracking-[0.35em]" />
      </Field>
    </>
  );
}
