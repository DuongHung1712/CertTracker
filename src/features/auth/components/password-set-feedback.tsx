import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function PasswordSetFeedback() {
  return (
    <Alert role="status" className="border-border bg-accent text-accent-foreground">
      <CheckCircle2 className="size-4 text-accent-foreground" aria-hidden="true" />
      <AlertTitle className="font-semibold text-accent-foreground">
        Password set successfully
      </AlertTitle>
      <AlertDescription className="text-body text-accent-foreground">
        Your password has been saved. Sign in below with your email and new password.
      </AlertDescription>
    </Alert>
  );
}
