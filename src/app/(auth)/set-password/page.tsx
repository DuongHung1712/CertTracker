import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/app-shell/logo";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const validLink = Boolean(tokenHash) && (type === "invite" || type === "recovery");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-sm border-border bg-card shadow-sm">
        <CardHeader className="flex flex-col items-center space-y-2 text-center pb-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground mb-1">
            <Logo size={24} />
          </div>
          <CardTitle className="text-page-title font-semibold tracking-tight">Set your password</CardTitle>
          <CardDescription className="text-body text-muted-foreground text-balance">
            {validLink ? "Choose a password for your CertTracker account" : "This link is not valid. Ask your admin for a new one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validLink ? (
            <SetPasswordForm tokenHash={tokenHash!} type={type!} />
          ) : (
            <div className="text-center pt-2">
              <Link href="/login" className="text-body text-primary hover:underline font-medium">
                Go to sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
