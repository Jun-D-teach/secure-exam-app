import { useState, useEffect } from "react";
import {
  BookOpen,
  Clock,
  Eye,
  GraduationCap,
  MessageSquare,
  Newspaper,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function StudentDashboard() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, artRes, ann] = await Promise.all([
        api.getStudentStats(),
        api.listArticles({ limit: "6" }),
        api.listAnnouncements(),
      ]);
      setStats(s);
      setArticles(artRes.articles || []);
      setAnnouncements(ann || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">S</div>
            <div>
              <div className="text-sm font-bold">Dashboard Siswa</div>
              <div className="text-[10px] text-muted-foreground">MAN 2 Palembang</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.name}</span>
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={signOut}>Keluar</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Welcome */}
        <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-6">
          <h1 className="text-xl font-extrabold">Selamat Datang, {user?.name} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portal berita MAN 2 Palembang — baca berita terkini dan informasi penting.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Komentar Saya</span>
                <MessageSquare className="size-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{stats.totalComments}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Berita Tersedia</span>
                <Newspaper className="size-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{articles.length}+</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Pengumuman Aktif</span>
                <GraduationCap className="size-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{announcements.length}</div>
            </div>
          </div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-extrabold">📢 Pengumuman</h2>
            <div className="mt-3 space-y-2">
              {announcements.map((a: any) => (
                <div key={a.id} className={`rounded-xl border px-4 py-3 ${
                  a.priority === "urgent" ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30" :
                  a.priority === "high" ? "border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30" :
                  "border-border/70 bg-card"
                }`}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">{a.title}</h3>
                    {a.priority === "urgent" && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">URGENT</span>}
                    {a.priority === "high" && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">PENTING</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Articles */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">📰 Berita Terbaru</h2>
            <Link to="/berita" className="text-sm font-medium text-primary hover:underline">Lihat Semua →</Link>
          </div>

          {loading ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse rounded-xl border border-border/70 bg-card p-4">
                  <div className="mb-3 h-3 w-20 rounded bg-muted" />
                  <div className="mb-2 h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article: any) => (
                <Link
                  key={article.id}
                  to={`/berita/${article.slug}`}
                  className="group rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
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
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{article.excerpt}</p>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3" />{formatDate(article.published_at)}</span>
                    <span className="flex items-center gap-1"><Eye className="size-3" />{article.views}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Comments */}
        {stats?.recentComments && stats.recentComments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-extrabold">💬 Komentar Saya</h2>
            <div className="mt-3 space-y-2">
              {stats.recentComments.map((c: any) => (
                <div key={c.id} className="rounded-xl border border-border/70 bg-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <Link to={`/berita/${c.article_slug}`} className="text-sm font-bold hover:text-primary transition-colors">
                      {c.article_title}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      c.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{c.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
