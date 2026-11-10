import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ctrl-ui/react/ui/alert-dialog";
import { Button } from "@ctrl-ui/react/ui/button";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";

import type { UseAppUpdate } from "@/features/updates/use-app-update";

import { SettingsSection } from "./settings-section";

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** A check made today reads as a time; an older one needs its date. */
function checkedAt(timestamp: number): string {
  const date = new Date(timestamp);
  const today = date.toDateString() === new Date().toDateString();
  return today
    ? `at ${TIME_FORMAT.format(date)}`
    : `on ${DATE_TIME_FORMAT.format(date)}`;
}

function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const resolved = await getVersion();
        if (active) {
          setVersion(resolved);
        }
      } catch {
        // the version is a courtesy: without it the row still offers the update check
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return version;
}

function updateStatus(
  update: UseAppUpdate,
  failure: string | null
): { text: string; failed: boolean } | null {
  if (update.pending) {
    return {
      text: `Version ${update.pending.version} is available.`,
      failed: false,
    };
  }
  if (failure !== null) {
    return { text: `Could not check for updates: ${failure}`, failed: true };
  }
  if (update.lastCheckedAt !== null) {
    return {
      text: `Up to date. Last checked ${checkedAt(update.lastCheckedAt)}.`,
      failed: false,
    };
  }
  return null;
}

function InstallUpdateDialog({
  update,
  open,
  onOpenChange,
}: {
  update: UseAppUpdate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!update.installing) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Install version {update.pending?.version}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The app restarts to finish updating. Changes you have not saved will
            be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose disabled={update.installing}>
            Not now
          </AlertDialogClose>
          <Button
            disabled={update.installing}
            onClick={() => {
              update.install();
            }}
            tone="primary"
            variant="solid"
          >
            {update.installing ? "Installing…" : "Install and restart"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The version that is running, and the one place to ask whether a newer one exists. */
export function AboutSection({ update }: { update: UseAppUpdate }) {
  const version = useAppVersion();
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const status = updateStatus(update, failure);

  const handleCheck = async () => {
    setFailure(null);
    const result = await update.check();
    if (result.status === "failed") {
      setFailure(result.message);
    }
  };

  return (
    <SettingsSection title="About">
      <div className="flex min-h-8 items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Text as="p" numeric>
            {version === null ? "Version" : `Version ${version}`}
          </Text>
          {status === null ? null : (
            <Text
              as="p"
              numeric
              role={status.failed ? "alert" : "status"}
              tone={status.failed ? "destructive" : "muted"}
            >
              {status.text}
            </Text>
          )}
        </div>
        {update.pending ? (
          <Button
            className="shrink-0"
            onClick={() => setConfirming(true)}
            tone="primary"
            variant="solid"
          >
            Install and restart
          </Button>
        ) : (
          <Button
            className="shrink-0"
            disabled={update.checking}
            onClick={() => {
              handleCheck();
            }}
            variant="surface"
          >
            {update.checking ? <Spinner label="Checking for updates" /> : null}
            Check for updates
          </Button>
        )}
      </div>
      <InstallUpdateDialog
        onOpenChange={setConfirming}
        open={confirming}
        update={update}
      />
    </SettingsSection>
  );
}
