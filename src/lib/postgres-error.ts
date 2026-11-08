/** Postgres SQLSTATE codes this app maps to a message. */
const DUPLICATE = "23505";
const RESTRICTED = "23503";
const FORBIDDEN = "42501";
const INVALID = "23514";

/** Never show a raw Postgres/PostgREST error message to a user. */
export function mapPostgresError(
  error: { code?: string | null; message: string },
  messages: { duplicate?: string; restricted?: string; invalid?: string } = {},
): string {
  switch (error.code) {
    case DUPLICATE:
      return messages.duplicate ?? "This already exists.";
    case RESTRICTED:
      return messages.restricted ?? "This cannot be deleted because other data still uses it.";
    case INVALID:
      return messages.invalid ?? "These values break a rule of the system. Check them and try again.";
    case FORBIDDEN:
      return "You do not have permission to do this.";
    default:
      return "Something went wrong. Try again.";
  }
}
