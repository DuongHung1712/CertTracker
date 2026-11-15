"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/features/auth/actions";

// Autofocus on every size: /login has one job, and the keyboard on a phone is what the person needs next.
export function LoginForm({ next = null }: { next?: string | null }) {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-body font-medium">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          className="h-9"
          aria-describedby={state && !state.ok ? "login-error" : undefined}
          aria-invalid={state && !state.ok ? true : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-body font-medium">
          Password
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-9"
          aria-describedby={state && !state.ok ? "login-error" : undefined}
          aria-invalid={state && !state.ok ? true : undefined}
        />
      </div>
      {state && !state.ok && (
        <p id="login-error" role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full h-9 font-medium transition-colors"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
