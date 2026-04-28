import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { MOCK_POSTS } from "@/lib/mockPosts";
import { PostCard } from "@/components/PostCard";

const Search = () => {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => { setQ(params.get("q") ?? ""); }, [params]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return MOCK_POSTS.filter(p =>
      p.title.toLowerCase().includes(term) ||
      p.content.toLowerCase().includes(term) ||
      p.tags.some(t => t.toLowerCase().includes(term)) ||
      p.channelName.toLowerCase().includes(term)
    );
  }, [q]);

  return (
    <div className="container py-16">
      <h1 className="font-serif text-5xl md:text-6xl font-semibold text-balance">Search</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); setParams(q ? { q } : {}); }}
        className="mt-8 relative max-w-2xl"
      >
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search devotionals, teachings, books..."
          className="w-full pl-12 pr-5 py-4 rounded-2xl bg-card border border-border text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-soft"
        />
      </form>

      <div className="mt-10">
        {!q.trim() ? (
          <p className="text-muted-foreground">Type something to begin searching.</p>
        ) : results.length === 0 ? (
          <p className="text-muted-foreground">No results for “{q}”.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-6">{results.length} result{results.length !== 1 && "s"}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Search;
