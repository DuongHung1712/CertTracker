"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword } from "@/features/auth/actions";

export function SetPasswordForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, formAction, pending] = useActionState(setPassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tokenHash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-body font-medium">
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-9"
          aria-describedby={state && !state.ok ? "set-password-error password-hint" : "password-hint"}
          aria-invalid={state && !state.ok ? true : undefined}
        />
        <p id="password-hint" className="text-caption text-muted-foreground">At least 8 characters</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-body font-medium">
          Confirm password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="h-9"
          aria-describedby={state && !state.ok ? "set-password-error" : undefined}
          aria-invalid={state && !state.ok ? true : undefined}
        />
      </div>
      {state && !state.ok && (
        <p id="set-password-error" role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full h-9 font-medium transition-colors"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
