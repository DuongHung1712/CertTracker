import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function PasswordSetFeedback() {
  return (
    <Alert role="status" className="border-status-active-border bg-status-active-bg text-status-active-fg">
      <CheckCircle2 className="size-4 text-status-active-fg" aria-hidden="true" />
      <AlertTitle className="font-semibold text-status-active-fg">
        Password set successfully
      </AlertTitle>
      <AlertDescription className="text-body text-status-active-fg/90">
        Your password has been saved. Please sign in below with your email and new password to access your CertTracker account.
      </AlertDescription>
    </Alert>
  );
}
