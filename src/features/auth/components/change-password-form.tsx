"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/features/auth/actions";

const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "password", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const;

function ErrorText({ message }: { message: string }) {
  return (
    <p id="change-password-error" role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);
  const form = useRef<HTMLFormElement>(null);
  const failure = state && !state.ok ? state : null;
  const errorField = failure?.field;

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
          {FIELDS.map((field) => {
            const invalid = errorField === field.name;
            const isNewPassword = field.name === "password";
            const describedBy = [
              invalid ? "change-password-error" : null,
              isNewPassword ? "change-password-hint" : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined;
            return (
              <div key={field.name} className="flex flex-col gap-1.5">
                <Label htmlFor={field.name} className="text-body font-medium">
                  {field.label}
                </Label>
                <PasswordInput
                  id={field.name}
                  name={field.name}
                  autoComplete={field.autoComplete}
                  minLength={isNewPassword ? 8 : undefined}
                  required
                  className="h-9"
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                />
                {isNewPassword && (
                  <p id="change-password-hint" className="text-caption text-muted-foreground">
                    At least 8 characters
                  </p>
                )}
                {invalid && failure && <ErrorText message={failure.error} />}
              </div>
            );
          })}
          {failure && !errorField && <ErrorText message={failure.error} />}
          <Button type="submit" className="h-9 w-fit font-medium" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
