import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 text-center">
      <h1 className="text-xl font-bold">Not available for your role</h1>
      <p className="mt-2 text-sm text-muted">Ask the business owner if you need access to this.</p>
      <Link href="/dashboard" className="mt-6 text-sm font-medium text-brand underline">Back to home</Link>
    </main>
  );
}
