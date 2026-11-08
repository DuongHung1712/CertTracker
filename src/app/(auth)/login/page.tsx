import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/app-shell/logo";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ passwordSet?: string }> }) {
  const { passwordSet } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="flex flex-col items-center space-y-2 text-center pb-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground mb-1">
            <Logo size={24} />
          </div>
          <CardTitle className="text-page-title font-semibold tracking-tight">CertTracker</CardTitle>
          <CardDescription className="text-body text-muted-foreground text-balance">
            {passwordSet ? "Password saved. Sign in with your new password." : "Sign in with the account you were given"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
