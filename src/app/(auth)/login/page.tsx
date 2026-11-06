import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ passwordSet?: string }> }) {
  const { passwordSet } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>CertTracker</CardTitle>
          <CardDescription>
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
