"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/features/auth/actions";

const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "password", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const form = useRef<HTMLFormElement>(null);
  const failed = state !== null && !state.ok;

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      toast.success("Password changed");
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={form} action={formAction} className="flex max-w-sm flex-col gap-4">
          {FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <Label htmlFor={field.name} className="text-body font-medium">
                {field.label}
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete={field.autoComplete}
                required
                className="h-9"
                aria-invalid={failed || undefined}
                aria-describedby={failed ? "change-password-error" : undefined}
              />
            </div>
          ))}
          {failed && (
            <p id="change-password-error" role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" className="h-9 w-fit font-medium" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
