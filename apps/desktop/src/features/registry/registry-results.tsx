import { Button } from "@ctrl-ui/react/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@ctrl-ui/react/ui/item";
import { Spinner } from "@ctrl-ui/react/ui/spinner";
import { Text } from "@ctrl-ui/react/ui/typography";
import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useConvexConnectionState, usePaginatedQuery } from "convex/react";
import { Download, SearchX, WifiOff } from "lucide-react";

import { EmptyState, ListSkeleton } from "@/shared/components/view-layout";

import type { InstallableSkill } from "./install-skill-dialog";

const PAGE_SIZE = 30;

const INSTALL_COUNT_FORMAT = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Rows sit flush with the search field and are told apart by a hairline, not a box. */
const ROW_STYLE = {
  "--cui-item-padding-inline": "0px",
  "--cui-item-padding-block": "calc(var(--spacing) * 2.5)",
} as const;

interface RegistrySkill extends InstallableSkill {
  _id: string;
  description: string;
  installCount?: number;
}

function SkillRow({
  skill,
  onInstall,
}: {
  skill: RegistrySkill;
  onInstall: (skill: InstallableSkill) => void;
}) {
  const source =
    skill.githubOwner && skill.githubRepo
      ? `${skill.githubOwner}/${skill.githubRepo}`
      : null;
  const installs = skill.installCount ?? 0;

  return (
    <li>
      <Item style={ROW_STYLE}>
        <ItemContent>
          <ItemTitle className="max-w-full">
            <Text className="min-w-0 truncate">{skill.name}</Text>
            {source === null ? null : (
              <Text
                className="min-w-0 truncate"
                mono
                size="label"
                tone="muted"
                weight="normal"
              >
                {source}
              </Text>
            )}
          </ItemTitle>
          <ItemDescription className="line-clamp-1">
            {skill.description}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="gap-3">
          {installs > 0 ? (
            <Text numeric size="label" tone="muted">
              {INSTALL_COUNT_FORMAT.format(installs)}{" "}
              {installs === 1 ? "install" : "installs"}
            </Text>
          ) : null}
          <Button
            aria-label={`Install ${skill.name}`}
            onClick={() => onInstall(skill)}
            variant="surface"
          >
            <Download />
            Install
          </Button>
        </ItemActions>
      </Item>
    </li>
  );
}

/** One search of the registry, page by page. A failed query throws to the boundary above. */
export function RegistryResults({
  search,
  category,
  filtered,
  onInstall,
  onShowAll,
}: {
  search: string;
  category: string | undefined;
  /** Whether a search term or category narrows the list. */
  filtered: boolean;
  onInstall: (skill: InstallableSkill) => void;
  onShowAll: () => void;
}) {
  const skills = usePaginatedQuery(
    api.skills.listPaginated,
    { search: search === "" ? undefined : search, category },
    { initialNumItems: PAGE_SIZE }
  );
  const connection = useConvexConnectionState();

  if (skills.status === "LoadingFirstPage") {
    // Convex keeps retrying on its own, so there is nothing to retry by hand.
    const unreachable =
      !connection.isWebSocketConnected && connection.connectionRetries > 0;
    return unreachable ? (
      <EmptyState
        description="Check your internet connection. The list loads by itself once it is back."
        icon={WifiOff}
        title="The registry is out of reach"
      />
    ) : (
      <ListSkeleton rows={6} />
    );
  }

  if (skills.status === "Exhausted" && skills.results.length === 0) {
    return filtered ? (
      <EmptyState
        action={
          <Button onClick={onShowAll} variant="surface">
            Show all skills
          </Button>
        }
        description="Search looks at skill names. Try a shorter term or another category."
        icon={SearchX}
        title="No matching skills"
      />
    ) : (
      <EmptyState
        description="Nothing has been published to the registry yet."
        icon={SearchX}
        title="No skills"
      />
    );
  }

  const loadingMore = skills.status === "LoadingMore";

  return (
    <>
      <ul
        aria-label="Registry skills"
        className="flex flex-col divide-y divide-border"
      >
        {skills.results.map((skill) => (
          <SkillRow key={skill._id} onInstall={onInstall} skill={skill} />
        ))}
      </ul>
      {skills.status === "Exhausted" ? null : (
        <Button
          className="self-center"
          disabled={loadingMore}
          onClick={() => skills.loadMore(PAGE_SIZE)}
          variant="surface"
        >
          {loadingMore ? <Spinner label="Loading more skills" /> : null}
          Show more
        </Button>
      )}
    </>
  );
}
