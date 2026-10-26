import { googleEnabled } from "@/lib/google";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <AuthShell>
      <LoginForm google={googleEnabled()} error={error} invited={sp.invited === "1"} />
    </AuthShell>
  );
}
