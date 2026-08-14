import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Download, Search, Store, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  EmptyState,
  ListSkeleton,
  ViewHeader,
  ViewLayout,
} from "@/shared/components/view-layout";
import {
  type InstallableSkill,
  InstallSkillDialog,
} from "./install-skill-dialog";

const PAGE_SIZE = 30;

export function RegistryView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<InstallableSkill | null>(null);

  const categories = useQuery(api.categories.list, {});
  const skills = usePaginatedQuery(
    api.skills.listPaginated,
    { search: search.trim() || undefined, category },
    { initialNumItems: PAGE_SIZE }
  );

  return (
    <ViewLayout>
      <ViewHeader
        description="Browse skills published on agents-library.dev and install them locally."
        title="Registry"
      />

      <div className="flex items-center gap-2 rounded-xl border border-border px-3">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <Input
          aria-label="Search skills"
          className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && search.length > 0) {
              event.preventDefault();
              setSearch("");
            }
          }}
          placeholder="Search skills"
          value={search}
        />
        {search.length > 0 ? (
          <button
            aria-label="Clear skill search"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            onClick={() => setSearch("")}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Skill category</legend>
        <Button
          aria-pressed={category === undefined}
          onClick={() => setCategory(undefined)}
          size="sm"
          variant={category === undefined ? "default" : "outline"}
        >
          All
        </Button>
        {categories?.map((item) => (
          <Button
            aria-pressed={category === item.slug}
            key={item._id}
            onClick={() => setCategory(item.slug)}
            size="sm"
            variant={category === item.slug ? "default" : "outline"}
          >
            {item.name}
          </Button>
        ))}
      </fieldset>

      {skills.status === "LoadingFirstPage" ? (
        <ListSkeleton rows={5} />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {skills.results.map((skill) => (
            <li
              className="flex items-center gap-3 border-border border-b px-4 py-3 last:border-b-0"
              key={skill._id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{skill.name}</p>
                <p className="line-clamp-2 text-muted-foreground text-xs">
                  {skill.description}
                </p>
              </div>
              <Button
                onClick={() =>
                  setSelected({
                    name: skill.name,
                    markdown: skill.markdown,
                    githubOwner: skill.githubOwner,
                    githubRepo: skill.githubRepo,
                    skillSlug: skill.skillSlug,
                  })
                }
                size="sm"
                variant="outline"
              >
                <Download />
                Install
              </Button>
            </li>
          ))}
        </ul>
      )}

      {skills.status === "CanLoadMore" ? (
        <Button
          onClick={() => skills.loadMore(PAGE_SIZE)}
          size="sm"
          variant="outline"
        >
          Load more
        </Button>
      ) : null}

      {skills.status === "Exhausted" && skills.results.length === 0 ? (
        <EmptyState
          description="Try a different search term or category."
          icon={Store}
          title="No skills found"
        />
      ) : null}

      <InstallSkillDialog
        onOpenChange={(open) => setSelected(open ? selected : null)}
        open={selected !== null}
        skill={selected}
      />
    </ViewLayout>
  );
}
