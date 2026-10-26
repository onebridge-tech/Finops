import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ResetForm />
    </AuthShell>
  );
}
