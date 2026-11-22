import "server-only";
import { createAiGateway } from "@/lib/ai/gateway";
import { createUsageStore } from "@/lib/ai/usage-store";

/** Whether the "Fill from file" button is shown: the gateway is configured and the feature flag is on. Never throws. */
export async function isAiReaderEnabled(): Promise<boolean> {
  try {
    createAiGateway();
  } catch {
    return false;
  }
  return createUsageStore().isEnabled("certificate-reader");
}
