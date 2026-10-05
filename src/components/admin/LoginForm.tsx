"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { signInAction, type SignInState } from "@/app/admin/auth-actions";
import { TextField } from "@/components/ui/Field";

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, { error: notice });

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <TextField id="email" name="email" label="Email" type="email" autoComplete="username" required inputMode="email" />
      <TextField id="password" name="password" label="Password" type="password" autoComplete="current-password" required />
      {state.error && (
        <p role="alert" className="rounded-2xl bg-berry/10 px-4 py-3 text-sm font-medium text-berry">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-13 items-center justify-center gap-2 rounded-full bg-espresso font-semibold text-foam shadow-lift transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <LogIn className="size-5" />
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
