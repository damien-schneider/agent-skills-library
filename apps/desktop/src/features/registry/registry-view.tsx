import { Input } from "@ctrl-ui/react/ui/input";
import { InputGroup, InputGroupAddon } from "@ctrl-ui/react/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrl-ui/react/ui/select";
import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { LibraryIndex } from "@/features/library/use-library-index";
import { ErrorBoundary } from "@/shared/components/error-boundary";
import { IconButton } from "@/shared/components/icon-button";
import { ErrorState, ViewLayout } from "@/shared/components/view-layout";

import {
  type InstallableSkill,
  InstallSkillDialog,
} from "./install-skill-dialog";
import { RegistryResults } from "./registry-results";

const ALL_CATEGORIES = "__all__";
/** Long enough that typing a word is one search, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 200;

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function CategoryFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (category: string) => void;
}) {
  const categories = useQuery(api.categories.list, {});
  const sorted = useMemo(
    () =>
      [...(categories ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    [categories]
  );

  if (categories?.length === 0) {
    return null;
  }

  return (
    <Select
      disabled={categories === undefined}
      onValueChange={onChange}
      value={value}
    >
      <SelectTrigger aria-label="Category" className="w-48 shrink-0">
        <SelectValue>
          {(selected: string) =>
            sorted.find((category) => category.slug === selected)?.name ??
            "All categories"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
        {sorted.map((category) => (
          <SelectItem key={category._id} value={category.slug}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RegistryView({
  index,
  onInstalled,
}: {
  index: LibraryIndex;
  onInstalled: (fileId: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [selected, setSelected] = useState<InstallableSkill | null>(null);
  const [installOpen, setInstallOpen] = useState(false);

  const term = search.trim();
  const debouncedTerm = useDebouncedValue(term, SEARCH_DEBOUNCE_MS);
  // Emptying the field is a decision already made: the full list comes back at once.
  const query = term === "" ? "" : debouncedTerm;
  const filtered = query !== "" || category !== ALL_CATEGORIES;

  return (
    <ViewLayout
      description="Skills published on agents-library.dev."
      title="Registry"
    >
      <div className="flex items-center gap-2">
        <InputGroup className="min-w-0 flex-1" size="sm">
          <InputGroupAddon>
            <Search aria-hidden="true" className="size-3.5" />
          </InputGroupAddon>
          <Input
            aria-label="Search the registry"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search.length > 0) {
                event.preventDefault();
                setSearch("");
              }
            }}
            placeholder="Search skills by name"
            type="search"
            value={search}
          />
          {search.length > 0 ? (
            <InputGroupAddon>
              <IconButton
                label="Clear search"
                onClick={() => setSearch("")}
                size="xs"
              >
                <X />
              </IconButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {/* Convex reports a failed query by throwing while the component renders. */}
        <ErrorBoundary fallback={() => null} label="registry categories">
          <CategoryFilter onChange={setCategory} value={category} />
        </ErrorBoundary>
      </div>

      {/* Keyed by the query, so a new search is a fresh attempt after a failure. */}
      <ErrorBoundary
        fallback={(retry) => (
          <ErrorState
            message="The registry could not load these skills."
            onRetry={retry}
          />
        )}
        key={`${category}\n${query}`}
        label="registry search"
      >
        <RegistryResults
          category={category === ALL_CATEGORIES ? undefined : category}
          filtered={filtered}
          onInstall={(skill) => {
            setSelected(skill);
            setInstallOpen(true);
          }}
          onShowAll={() => {
            setSearch("");
            setCategory(ALL_CATEGORIES);
          }}
          search={query}
        />
      </ErrorBoundary>

      <InstallSkillDialog
        index={index}
        onInstalled={onInstalled}
        onOpenChange={setInstallOpen}
        open={installOpen}
        skill={selected}
      />
    </ViewLayout>
  );
}
