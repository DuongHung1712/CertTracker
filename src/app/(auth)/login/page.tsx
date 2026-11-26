import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/app-shell/logo";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginForm } from "@/features/auth/components/login-form";
import { PasswordSetFeedback } from "@/features/auth/components/password-set-feedback";
import { StyleToggle } from "@/components/app-shell/style-toggle";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ passwordSet?: string; next?: string; email?: string }> }) {
  const { passwordSet, next, email } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="absolute top-4 right-4">
        <StyleToggle />
      </div>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="flex flex-col items-center space-y-2 text-center pb-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground mb-1">
            <Logo size={24} />
          </div>
          <CardTitle className="text-page-title font-semibold tracking-tight">
            <h1>CertTracker</h1>
          </CardTitle>
          <CardDescription className="text-body text-muted-foreground text-balance">
            Sign in with the account you were given
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {passwordSet && <PasswordSetFeedback />}
          <LoginForm next={safeNextPath(next)} defaultEmail={email} />
        </CardContent>
      </Card>
    </main>
  );
}
