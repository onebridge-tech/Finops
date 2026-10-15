import { Icon } from "@/components/icon";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="search" size={26} /></span>
      <h1 className="text-xl font-semibold tracking-tight">We couldn’t find that page</h1>
      <p className="mt-1.5 text-sm text-muted">The link may be old, or the item may have been removed.</p>
      <LinkButton href="/dashboard" className="mt-6">Back to home</LinkButton>
    </main>
  );
}
