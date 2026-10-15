import { Icon } from "@/components/icon";
import { LinkButton } from "@/components/ui";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-warn/10 text-warn"><Icon name="lock" size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">This part is not available for your role</h1>
      <p className="mt-1.5 text-sm text-muted">Ask the owner of the shop if you need access.</p>
      <LinkButton href="/dashboard" className="mt-6">Back to home</LinkButton>
    </main>
  );
}
