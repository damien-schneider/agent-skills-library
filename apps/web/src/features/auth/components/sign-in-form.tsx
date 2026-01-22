"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { FieldError } from "@/shared/components/ui/field-error";
import { authClient } from "@/shared/lib/auth-client";

interface SignInFormProps {
  onSwitchToSignUp: () => void;
  onSuccess?: () => void;
  inDialog?: boolean;
}

export function SignInForm({
  onSwitchToSignUp,
  onSuccess,
  inDialog = false,
}: SignInFormProps) {
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            router.push("/");
            toast.success("Welcome back!");
            onSuccess?.();
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  const content = (
    <>
      <div className="mb-8 text-center">
        <h1
          className="mb-2 text-3xl text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Welcome back
        </h1>
        <p className="text-muted-foreground">Sign in to your account</p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <label
                className="block font-medium text-foreground/70 text-sm"
                htmlFor={field.name}
              >
                Email
              </label>
              <input
                className="w-full rounded-2xl border-none bg-muted/50 px-5 py-3.5 text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="you@example.com"
                type="email"
                value={field.state.value}
              />
              <FieldError error={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-2">
              <label
                className="block font-medium text-foreground/70 text-sm"
                htmlFor={field.name}
              >
                Password
              </label>
              <input
                className="w-full rounded-2xl border-none bg-muted/50 px-5 py-3.5 text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="••••••••"
                type="password"
                value={field.state.value}
              />
              <FieldError error={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Subscribe>
          {(state) => (
            <button
              className="mt-2 w-full rounded-2xl bg-foreground py-4 font-medium text-background text-lg shadow-foreground/10 shadow-lg hover:-translate-y-0.5 hover:scale-101 active:scale-99 disabled:opacity-50"
              disabled={!state.canSubmit || state.isSubmitting}
              type="submit"
            >
              <span className="flex items-center justify-center gap-2">
                {state.isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Sign In
                  </>
                )}
              </span>
            </button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-6 text-center">
        <button
          className="text-foreground/60 text-sm transition-colors hover:text-foreground"
          onClick={onSwitchToSignUp}
          type="button"
        >
          Need an account?{" "}
          <span className="font-medium text-foreground">Sign Up</span>
        </button>
      </div>
    </>
  );

  if (inDialog) {
    return content;
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-md"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <div className="rounded-3xl border border-border bg-card/50 p-8 shadow-xl">
        {content}
      </div>
    </motion.div>
  );
}
