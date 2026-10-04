import { Logo } from "@/components/app-shell/logo";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center px-6 pt-6 pb-2">
          <Logo size={44} className="mb-3" />
          <h1 className="text-page-title font-semibold text-foreground tracking-tight">
            CertTracker
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Đăng nhập bằng tài khoản được cấp
          </p>
        </div>
        <CardContent className="px-6 pb-6 pt-2">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
