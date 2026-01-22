"use client";

import { useState } from "react";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import {
  Dialog,
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
  title,
  description,
}: SignInDialogProps) {
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSwitchToSignUp = () => {
    setIsSignUp(true);
  };

  const handleSwitchToSignIn = () => {
    setIsSignUp(false);
  };

  const handleSuccess = () => {
    onOpenChange(false);
    setIsSignUp(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
        )}
        {isSignUp ? (
          <SignUpForm
            inDialog={true}
            onSuccess={handleSuccess}
            onSwitchToSignIn={handleSwitchToSignIn}
          />
        ) : (
          <SignInForm
            inDialog={true}
            onSuccess={handleSuccess}
            onSwitchToSignUp={handleSwitchToSignUp}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
