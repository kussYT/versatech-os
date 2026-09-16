import { z } from "zod";
import { fieldErrorsFromZod } from "@/lib/validations/company";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("E-mail invalide")),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
  from: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export { fieldErrorsFromZod };
