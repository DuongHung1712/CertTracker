// Copied from the :root tokens in src/app/globals.css. theme.test.ts fails when they drift apart.
// Mail clients do not understand CSS variables, so this is the only place outside globals.css where hex is allowed.
export const EMAIL_THEME = {
  background: "#F6F7F5",
  card: "#FFFFFF",
  foreground: "#15212B",
  mutedForeground: "#56636C",
  primary: "#0E5C58",
  primaryForeground: "#FFFFFF",
  border: "#D8DEDB",
  expiringSoonFg: "#9A3D0B",
  expiringSoonBg: "#FDEADD",
  expiring60Fg: "#7A5200",
  expiring60Bg: "#FFF5DC",
  expiredFg: "#B42318",
  expiredBg: "#FDE8E6",
} as const;
