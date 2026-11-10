import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;

const passwordFields = {
  password: z.string().min(8, "Use at least 8 characters"),
  confirmPassword: z.string(),
};

const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword,
  params: { message: "The two passwords do not match", path: ["confirmPassword"] },
};

export const setPasswordSchema = z
  .object({
    tokenHash: z.string().min(1, "This link is not valid."),
    type: z.enum(["invite", "recovery"], "This link is not valid."),
    ...passwordFields,
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    ...passwordFields,
  })
  .refine(passwordsMatch.check, passwordsMatch.params);
