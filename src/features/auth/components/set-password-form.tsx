"use client";

import { useActionState, useState } from "react";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { setPassword } from "@/features/auth/actions";
import { setPasswordSchema } from "@/features/auth/schema";

type SetPasswordField = "password" | "confirmPassword";
type SetPasswordState = { ok: true; data: null } | { ok: false; error: string; field?: SetPasswordField } | null;

async function submitSetPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse({
    tokenHash: formData.get("tokenHash"),
    type: formData.get("type"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "Check your password and try again.",
      field: key === "password" || key === "confirmPassword" ? key : undefined,
    };
  }
  return setPassword(null, formData);
}

export function SetPasswordForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, formAction, pending] = useActionState(submitSetPassword, null);
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPasswordValue] = useState("");
  const failure = state && !state.ok ? state : null;
  const passwordInvalid = Boolean(failure && (!failure.field || failure.field === "password"));
  const confirmInvalid = Boolean(failure && (!failure.field || failure.field === "confirmPassword"));

  return (
    <form action={formAction} noValidate className="space-y-4">
      <p className="text-caption text-muted-foreground">* Required</p>
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-body font-medium">
          New password <RequiredMark />
        </Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPasswordValue(event.target.value)}
          aria-required="true"
          className="h-9"
          aria-describedby={passwordInvalid ? "set-password-error password-hint" : "password-hint"}
          aria-invalid={passwordInvalid || undefined}
        />
        <p id="password-hint" className="text-caption text-muted-foreground">At least 8 characters</p>
        {failure?.field === "password" && <FieldError id="set-password-error">{failure.error}</FieldError>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-body font-medium">
          Confirm password <RequiredMark />
        </Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPasswordValue(event.target.value)}
          aria-required="true"
          className="h-9"
          aria-describedby={confirmInvalid ? "set-password-error" : undefined}
          aria-invalid={confirmInvalid || undefined}
        />
        {failure?.field === "confirmPassword" && <FieldError id="set-password-error">{failure.error}</FieldError>}
      </div>
      {failure && !failure.field && (
        <p id="set-password-error" role="alert" className="text-body font-medium text-destructive">
          {failure.error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full font-medium transition-colors"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save password"}
      </Button>
      <p className="text-caption text-center text-muted-foreground">
        After setting your password, you will be redirected to sign in with your new password.
      </p>
    </form>
  );
}
