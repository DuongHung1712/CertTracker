import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const validLink = Boolean(tokenHash) && (type === "invite" || type === "recovery");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            {validLink ? "Choose a password for your CertTracker account" : "This link is not valid. Ask your admin for a new one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validLink ? (
            <SetPasswordForm tokenHash={tokenHash!} type={type!} />
          ) : (
            <Link href="/login" className="text-body underline">
              Go to sign in
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
