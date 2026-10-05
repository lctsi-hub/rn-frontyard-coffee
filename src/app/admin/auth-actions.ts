"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

/** Staff sign-in. There is deliberately no sign-up: accounts are created by the owner in Supabase. */
export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email or password is incorrect." };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have staff access. Please ask the owner." };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
