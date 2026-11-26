"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { RequiredMark } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { changePassword, type ChangePasswordState } from "@/features/auth/actions";
import { changePasswordSchema, firstChangePasswordIssue } from "@/features/auth/schema";

const FIELDS = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "password", label: "New password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const;

const EMPTY_VALUES = { currentPassword: "", password: "", confirmPassword: "" };

function ErrorText({ message }: { message: string }) {
  return (
    <p id="change-password-error" role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

async function submitChangePassword(_prev: ChangePasswordState | null, formData: FormData): Promise<ChangePasswordState | null> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const { message, field } = firstChangePasswordIssue(parsed.error);
    return { ok: false, error: message, field };
  }
  return changePassword(null, formData);
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(submitChangePassword, null);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setValues(EMPTY_VALUES);
  }
  const failure = state && !state.ok ? state : null;
  const errorField = failure?.field;

  useEffect(() => {
    if (state?.ok) {
      toast.success("Password changed");
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-section-title">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="flex max-w-sm flex-col gap-4">
          <p className="text-caption text-muted-foreground">* Required</p>
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
                  {field.label} <RequiredMark />
                </Label>
                <PasswordInput
                  id={field.name}
                  name={field.name}
                  autoComplete={field.autoComplete}
                  value={values[field.name]}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
                  aria-required="true"
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
          <Button type="submit" size="lg" className="w-fit font-medium" disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
