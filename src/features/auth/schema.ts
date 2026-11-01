import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid e-mail address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
