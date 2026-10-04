"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/features/auth/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-caption font-medium text-foreground">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ten@congty.com"
          className="h-9 bg-card"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-caption font-medium text-foreground">
          Mật khẩu
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="h-9 bg-card"
          required
        />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-caption text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full mt-2 font-medium" disabled={pending}>
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
