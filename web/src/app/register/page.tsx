import { googleEnabled } from "@/lib/google";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create your account" };
// The Google button depends on settings that can change while the app runs.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm google={googleEnabled()} />
    </AuthShell>
  );
}
