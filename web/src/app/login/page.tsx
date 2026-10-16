import Link from "next/link";
import { googleEnabled } from "@/lib/google";
import { Icon, Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";
import { LoginForm } from "./login-form";
import { LegalLinks } from "@/components/legal-page";

export const metadata = { title: "Sign in" };

const POINTS = [
  ["wallet", "See who owes you, in one list"],
  ["send", "Ask for money on WhatsApp in one tap"],
  ["bill", "Make GST bills and share them"],
] as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand p-12 text-brand-ink lg:flex">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold"><span className="flex size-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">₹</span>{BRAND.NAME}</Link>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Know who owes you. Get paid faster.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/15"><Icon name={icon} size={18} /></span>{text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-80">Works on any phone, tablet or computer.</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <Link href="/" className="mx-auto mb-8 flex w-full max-w-sm items-center gap-2 font-semibold lg:hidden"><Logo size={30} />{BRAND.NAME}</Link>
        <LoginForm google={googleEnabled()} error={error} invited={sp.invited === "1"} />
        <div className="mx-auto mt-8 w-full max-w-sm space-y-2 text-xs text-muted">
          <p>By continuing you agree to our <Link href="/terms" className="font-medium text-brand underline">Terms of Use</Link> and <Link href="/privacy" className="font-medium text-brand underline">Privacy Policy</Link>.</p>
          <LegalLinks />
        </div>
      </section>
    </main>
  );
}
