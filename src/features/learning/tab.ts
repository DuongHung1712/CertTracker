/** Not in learning-tabs.tsx: that file is a client module, and the pages read ?tab= on the server. */
export type LearningTab = "certificates" | "learning";

export const parseLearningTab = (value: string | string[] | undefined): LearningTab =>
  (Array.isArray(value) ? value[0] : value) === "learning" ? "learning" : "certificates";
