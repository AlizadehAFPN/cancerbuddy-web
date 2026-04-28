"use server";

import { redirect } from "next/navigation";
import { loginSchema, forgotPasswordSchema } from "@/lib/validations";
import { createSession } from "@/lib/auth";

/* ── Shared types ── */

export type FieldErrors = Partial<Record<string, string[]>>;

export type ActionState<T = void> =
  | { status: "idle" }
  | { status: "error"; errors: FieldErrors; rootError?: string }
  | { status: "success"; data?: T };

/* ── Login ── */

export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = {
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  try {
    // TODO: Replace with your auth provider call.
    // Example (AWS Cognito):
    //   const user = await Auth.signIn(email, password);
    //   await createSession(user.attributes.sub);
    //
    // Example (Supabase):
    //   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    //   if (error) throw error;
    //   await createSession(data.user.id);

    void email; void password; // remove when wiring up
    await createSession("stub-user-id");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid email or password.";
    return {
      status: "error",
      errors: {},
      rootError: message,
    };
  }

  redirect("/dashboard");
}

/* ── Forgot password ── */

export async function forgotPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = { email: formData.get("email") as string };

  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    // TODO: Trigger password reset via your auth provider.
    // Example (AWS Cognito):
    //   await Auth.forgotPassword(parsed.data.email);
    void parsed.data.email;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return {
      status: "error",
      errors: {},
      rootError: message,
    };
  }

  return { status: "success" };
}
