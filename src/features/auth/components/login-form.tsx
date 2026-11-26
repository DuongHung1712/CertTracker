"use client";

import { useActionState, useState } from "react";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/features/auth/actions";
import { loginSchema } from "@/features/auth/schema";

type LoginField = "email" | "password";
type LoginState = { ok: true; data: null } | { ok: false; error: string; field?: LoginField } | null;

async function submitLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "Enter a valid email and password.",
      field: key === "email" || key === "password" ? key : undefined,
    };
  }
  return signIn(null, formData);
}

// Autofocus on every size: /login has one job, and the keyboard on a phone is what the person needs next.
export function LoginForm({ next = null, defaultEmail = "" }: { next?: string | null; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(submitLogin, null);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const failure = state && !state.ok ? state : null;
  const emailInvalid = Boolean(failure && (!failure.field || failure.field === "email"));
  const passwordInvalid = Boolean(failure && (!failure.field || failure.field === "password"));

  return (
    <form action={formAction} noValidate className="space-y-4">
      <p className="text-caption text-muted-foreground">* Required</p>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-body font-medium">
          Email <RequiredMark />
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus={!defaultEmail}
          aria-required="true"
          className="h-9"
          aria-describedby={emailInvalid ? "login-error" : undefined}
          aria-invalid={emailInvalid || undefined}
        />
        {failure?.field === "email" && <FieldError id="login-error">{failure.error}</FieldError>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-body font-medium">
          Password <RequiredMark />
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus={!!defaultEmail}
          aria-required="true"
          className="h-9"
          aria-describedby={passwordInvalid ? "login-error" : undefined}
          aria-invalid={passwordInvalid || undefined}
        />
        {failure?.field === "password" && <FieldError id="login-error">{failure.error}</FieldError>}
      </div>
      {failure && !failure.field && (
        <p id="login-error" role="alert" className="text-body font-medium text-destructive">
          {failure.error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full font-medium transition-colors"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
