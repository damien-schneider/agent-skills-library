import { api } from "@skills-agent-library/backend/convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Download, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 overflow-auto px-8 py-8">
      <div>
        <h1 className="font-semibold text-lg">Registry</h1>
        <p className="text-muted-foreground text-sm">
          Skills published on agents-library.dev.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border px-3">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <Input
          className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search skills"
          value={search}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => setCategory(undefined)}
          size="sm"
          variant={category === undefined ? "default" : "outline"}
        >
          All
        </Button>
        {categories?.map((item) => (
          <Button
            key={item._id}
            onClick={() => setCategory(item.slug)}
            size="sm"
            variant={category === item.slug ? "default" : "outline"}
          >
            {item.name}
          </Button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {skills.results.map((skill) => (
          <li
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
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

      {skills.status === "CanLoadMore" ? (
        <Button
          onClick={() => skills.loadMore(PAGE_SIZE)}
          size="sm"
          variant="outline"
        >
          Load more
        </Button>
      ) : null}

      {skills.status === "LoadingFirstPage" ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : null}

      {skills.status === "Exhausted" && skills.results.length === 0 ? (
        <p className="text-muted-foreground text-sm">No skills found.</p>
      ) : null}

      <InstallSkillDialog
        onOpenChange={(open) => setSelected(open ? selected : null)}
        open={selected !== null}
        skill={selected}
      />
    </div>
  );
}
