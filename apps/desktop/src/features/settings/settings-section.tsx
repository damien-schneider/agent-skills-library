import { Heading, Text } from "@ctrl-ui/react/ui/typography";
import { type ReactNode, useId } from "react";

/** One titled group of settings; `action` is the group's own command, beside its title. */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading id={headingId} level={2} size="heading-4">
            {title}
          </Heading>
          {description ? (
            <Text as="p" tone="muted">
              {description}
            </Text>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
