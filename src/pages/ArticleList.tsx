import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Megaphone,
  Newspaper,
  Search,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatViews(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "rb";
  return String(n);
}

export default function ArticleList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const currentCategory = searchParams.get("category") || "";
  const currentSearch = searchParams.get("search") || "";
  const currentPage = parseInt(searchParams.get("page") || "1");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "12", page: String(currentPage) };
      if (currentCategory) params.category = currentCategory;
      if (currentSearch) params.search = currentSearch;

      const [artRes, catRes] = await Promise.all([
        api.listArticles(params),
        api.listCategories(),
      ]);
      setArticles(artRes.articles || []);
      setTotal(artRes.total || 0);
      setPages(artRes.pages || 1);
      setCategories(catRes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentCategory, currentSearch, currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set("search", searchInput.trim());
    } else {
      params.delete("search");
    }
    params.delete("page");
    setSearchParams(params);
  }

  function handleCategory(slug: string) {
    const params = new URLSearchParams(searchParams);
    if (slug === currentCategory) {
      params.delete("category");
    } else {
      params.set("category", slug);
    }
    params.delete("page");
    setSearchParams(params);
  }

  function handlePage(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeCategory = categories.find((c: any) => c.slug === currentCategory);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Beranda</Link>
            <ChevronRight className="size-3" />
            <span className="font-medium text-foreground">
              {activeCategory ? activeCategory.name : currentSearch ? `Pencarian: "${currentSearch}"` : "Semua Berita"}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {activeCategory ? activeCategory.name : currentSearch ? `Hasil Pencarian` : "Semua Berita"}
          </h1>
          {activeCategory?.description && (
            <p className="mt-2 text-sm text-muted-foreground">{activeCategory.description}</p>
          )}
          <div className="mt-1 text-xs text-muted-foreground">{total} artikel ditemukan</div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Main Content */}
          <div>
            {/* Search */}
            <form onSubmit={handleSearch} className="mb-6 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari berita..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Button type="submit" className="rounded-lg">
                Cari
              </Button>
              {(currentSearch || currentCategory) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-lg"
                  onClick={() => {
                    setSearchParams({});
                    setSearchInput("");
                  }}
                >
                  <X className="size-4" /> Reset
                </Button>
              )}
            </form>

            {/* Articles Grid */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="animate-pulse rounded-xl border border-border/70 bg-card p-4">
                    <div className="mb-3 h-3 w-20 rounded bg-muted" />
                    <div className="mb-2 h-4 w-full rounded bg-muted" />
                    <div className="mb-1 h-4 w-3/4 rounded bg-muted" />
                    <div className="mt-3 h-2 w-1/3 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
                <Newspaper className="mx-auto size-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">Tidak ada artikel ditemukan</p>
                <p className="mt-1 text-xs text-muted-foreground">Coba ubah filter atau kata kunci pencarian</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {articles.map((article: any, i: number) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                  >
                    <Link
                      to={`/berita/${article.slug}`}
                      className="group block rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {article.category_name && (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                            style={{ backgroundColor: article.category_color || "#0d9488" }}
                          >
                            {article.category_name}
                          </span>
                        )}
                        {article.is_pinned ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Pin
                          </span>
                        ) : null}
                        {article.is_featured && !article.is_pinned ? (
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Unggulan
                          </span>
                        ) : null}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {article.excerpt}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(article.published_at)}
                        </span>
                        <div className="flex items-center gap-3">
                          {article.author_name && (
                            <span>Oleh {article.author_name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Eye className="size-3" />
                            {formatViews(article.views)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === currentPage ? "default" : "outline"}
                    size="sm"
                    className="rounded-lg"
                    onClick={() => handlePage(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Categories */}
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Filter className="size-4" /> Kategori
              </h3>
              <div className="mt-3 space-y-1">
                <button
                  onClick={() => handleCategory("")}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    !currentCategory ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
                  }`}
                >
                  <Newspaper className="size-4" />
                  Semua
                </button>
                {categories.map((cat: any) => {
                  const Icon = cat.icon === "megaphone" ? Megaphone : Newspaper;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategory(cat.slug)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        currentCategory === cat.slug ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent"
                      }`}
                    >
                      <div className="size-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 truncate">{cat.name}</span>
                      <span className="text-[11px] opacity-70">{cat.article_count || 0}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-bold text-primary">MAN 2 Palembang</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Portal berita resmi Madrasah Aliyah Negeri 2 Palembang.
                Informasi terkini seputar kegiatan, prestasi, dan pengumuman madrasah.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 rounded-lg w-full">
                <Link to="/auth">Masuk ke Dashboard</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
