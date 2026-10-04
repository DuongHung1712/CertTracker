import { signInAsSeedUser } from "./restore-seed";

/**
 * Specs whose numbers depend on the seed's relative dates call this in `beforeAll`: An's certificate expires
 * ~26 days after `supabase db reset`. On an older database it silently becomes Active/Expired, so fail with the real reason.
 */
export async function assertSeedFresh(): Promise<void> {
  const admin = await signInAsSeedUser("admin@certtracker.test");
  const { data, error } = await admin.from("v_training_records").select("expiry_status").eq("member_email", "an@certtracker.test");
  if (error) throw new Error(`Could not read the seed state: ${error.message}`);
  if (data?.length !== 1 || data[0].expiry_status !== "Expiring Soon") {
    throw new Error("The seed's relative dates have aged (An's certificate is no longer 'Expiring Soon'): run `pnpm supabase db reset`.");
  }
}
