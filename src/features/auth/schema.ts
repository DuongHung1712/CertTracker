import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid e-mail address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const setPasswordSchema = z
  .object({
    tokenHash: z.string().min(1, "This link is not valid."),
    type: z.enum(["invite", "recovery"], "This link is not valid."),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "The two passwords do not match",
    path: ["confirmPassword"],
  });
