"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Result } from "@/lib/result";

/** State for a delete that asks first: `request` opens the confirmation, `confirm` runs it and reports the outcome in a toast. */
export function useConfirmedDelete<T>({
  remove,
  successMessage,
}: {
  remove: (item: T) => Promise<Result<null>>;
  successMessage: (item: T) => string;
}) {
  const [target, setTarget] = useState<T | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (!target) return;
    setPending(true);
    const result = await remove(target);
    setPending(false);
    if (result.ok) toast.success(successMessage(target));
    else toast.error(result.error);
    setTarget(null);
  }

  return { target, pending, request: setTarget, cancel: () => setTarget(null), confirm };
}
