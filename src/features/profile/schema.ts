import { z } from "zod";

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(200, "Name can have at most 200 characters"),
});
