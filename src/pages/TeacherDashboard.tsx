import { useState, useEffect } from "react";
import {
  BookOpen,
  Eye,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeacherDashboard() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", excerpt: "", category_id: "", status: "draft" });
  const [categories, setCategories] = useState<any[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [s, c] = await Promise.all([api.getTeacherStats(), api.listCategories()]);
      setStats(s);
      setCategories(c);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) {
        await api.updateArticle(editId, form);
      } else {
        await api.createArticle(form);
      }
      setShowForm(false);
      setForm({ title: "", content: "", excerpt: "", category_id: "", status: "draft" });
      setEditId(null);
      loadData();
    } catch (err: any) { alert(err.message); }
  }

  function startEdit(a: any) {
    setForm({ title: a.title, content: a.content, excerpt: a.excerpt || "", category_id: a.category_id || "", status: a.status });
    setEditId(a.id);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus artikel ini?")) return;
    try { await api.deleteArticle(id); loadData(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">G</div>
            <div>
              <div className="text-sm font-bold">Dashboard Guru</div>
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
        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Artikel Saya</span>
                <Newspaper className="size-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{stats.totalArticles}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Dipublikasikan</span>
                <BookOpen className="size-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{stats.publishedArticles}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Views</span>
                <Eye className="size-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{stats.totalViews.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Komentar</span>
                <MessageSquare className="size-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-extrabold">{stats.totalComments}</div>
            </div>
          </div>
        )}

        {/* New Article Button */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Artikel Saya</h2>
          <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ title: "", content: "", excerpt: "", category_id: "", status: "draft" }); }} className="rounded-lg">
            <Plus className="size-4" /> {showForm ? "Batal" : "Artikel Baru"}
          </Button>
        </div>

        {/* Article Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-border/70 bg-card p-4 space-y-3">
            <input type="text" placeholder="Judul artikel" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" required />
            <textarea placeholder="Konten artikel (HTML support)" value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[150px]" required />
            <input type="text" placeholder="Excerpt / ringkasan" value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option value="">Pilih Kategori</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
                <option value="draft">Draft</option>
                <option value="published">Publikasikan</option>
              </select>
            </div>
            <Button type="submit" className="rounded-lg">{editId ? "Update" : "Simpan"}</Button>
          </form>
        )}

        {/* Articles List */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((n) => <div key={n} className="h-16 rounded-xl bg-muted" />)}
            </div>
          ) : stats?.articles?.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
              <Newspaper className="mx-auto size-12 text-muted-foreground/30" />
              <p className="mt-4 text-sm font-medium text-muted-foreground">Belum ada artikel</p>
              <p className="mt-1 text-xs text-muted-foreground">Klik "Artikel Baru" untuk membuat artikel pertama</p>
            </div>
          ) : (
            stats?.articles?.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold truncate">{a.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>{a.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{a.category_name || "Tanpa kategori"}</span>
                    <span>{formatDate(a.created_at)}</span>
                    <span className="flex items-center gap-1"><Eye className="size-3" />{a.views}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => startEdit(a)}>
                    <PenLine className="size-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs text-destructive" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
