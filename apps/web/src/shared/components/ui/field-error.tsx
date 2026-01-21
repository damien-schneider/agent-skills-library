import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface FieldErrorProps {
  error?: string | string[] | unknown;
  className?: string;
}

export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;

  const formatError = (err: unknown): string | null => {
    if (!err) return null;
    if (typeof err === "string") return err;
    if (typeof err === "object") {
      if ("message" in err && typeof err.message === "string") {
        return err.message;
      }
      // Handle cases where the error might be nested or just needs stringification
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    }
    return String(err);
  };

  const errorText = Array.isArray(error)
    ? error.map(formatError).filter(Boolean).join(", ")
    : formatError(error);

  return (
    <AnimatePresence>
      {errorText && (
        <motion.p
          animate={{ opacity: 1, height: "auto", marginTop: 8 }}
          className={cn(
            "flex items-start gap-1.5 text-red-500 text-sm leading-tight",
            className
          )}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{errorText}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
