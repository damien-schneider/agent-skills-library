"use client";

import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function SignInDialog({
  open,
  onOpenChange,
  title = "Sign in to continue",
  description = "You need to be signed in to perform this action.",
}: SignInDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 font-medium text-background transition-all hover:opacity-90"
            href="/dashboard"
            onClick={() => onOpenChange(false)}
          >
            <LogIn className="h-5 w-5" />
            Sign In
          </Link>
          <Link
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 font-medium text-foreground transition-all hover:bg-gray-50"
            href="/dashboard"
            onClick={() => onOpenChange(false)}
          >
            <UserPlus className="h-5 w-5" />
            Create Account
          </Link>
        </div>

        <p className="mt-4 text-center text-muted-foreground text-xs">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </DialogContent>
    </Dialog>
  );
}
