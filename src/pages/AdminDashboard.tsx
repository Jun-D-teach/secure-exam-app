import { useState, useEffect } from "react";
import {
  BarChart3,
  BookOpen,
  Calendar,
  ChevronDown,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Newspaper,
  Plus,
  Settings,
  Tags,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

type Tab = "overview" | "articles" | "categories" | "users" | "comments" | "announcements";

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTab(); }, [tab]);

  async function loadTab() {
    setLoading(true);
    try {
      if (tab === "overview") {
        setStats(await api.getAdminStats());
      } else if (tab === "articles") {
        const res = await api.listAdminArticles({ limit: "50" });
        setArticles(res.articles || []);
      } else if (tab === "categories") {
        setCategories(await api.listCategories());
      } else if (tab === "users") {
        setUsers(await api.listUsers());
      } else if (tab === "comments") {
        setComments(await api.listAdminComments());
      } else if (tab === "announcements") {
        setAnnouncements(await api.listAdminAnnouncements());
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Ringkasan", icon: LayoutDashboard },
    { key: "articles", label: "Artikel", icon: Newspaper },
    { key: "categories", label: "Kategori", icon: Tags },
    { key: "users", label: "Pengguna", icon: Users },
    { key: "comments", label: "Komentar", icon: MessageSquare },
    { key: "announcements", label: "Pengumuman", icon: Megaphone },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">M2</div>
            <div>
              <div className="text-sm font-bold">Dashboard Admin</div>
              <div className="text-[10px] text-muted-foreground">MAN 2 Palembang</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.name}</span>
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={signOut}>
              Keluar
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Sidebar Nav */}
          <aside className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </aside>

          {/* Content */}
          <main>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-48 rounded bg-muted" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((n) => <div key={n} className="h-24 rounded-xl bg-muted" />)}
                </div>
              </div>
            ) : (
              <>
                {tab === "overview" && stats && <OverviewTab stats={stats} />}
                {tab === "articles" && <ArticlesTab articles={articles} onRefresh={loadTab} />}
                {tab === "categories" && <CategoriesTab categories={categories} onRefresh={loadTab} />}
                {tab === "users" && <UsersTab users={users} onRefresh={loadTab} />}
                {tab === "comments" && <CommentsTab comments={comments} onRefresh={loadTab} />}
                {tab === "announcements" && <AnnouncementsTab announcements={announcements} onRefresh={loadTab} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ========== OVERVIEW ==========
function OverviewTab({ stats }: { stats: any }) {
  const cards = [
    { label: "Total Artikel", value: stats.totalArticles, icon: Newspaper, color: "bg-primary" },
    { label: "Dipublikasikan", value: stats.publishedArticles, icon: BookOpen, color: "bg-emerald-500" },
    { label: "Total Views", value: stats.totalViews.toLocaleString(), icon: TrendingUp, color: "bg-blue-500" },
    { label: "Total Pengguna", value: stats.totalUsers, icon: Users, color: "bg-amber-500" },
    { label: "Guru", value: stats.totalTeachers, icon: GraduationCap, color: "bg-purple-500" },
    { label: "Siswa", value: stats.totalStudents, icon: Users, color: "bg-teal-500" },
    { label: "Kategori", value: stats.totalCategories, icon: Tags, color: "bg-orange-500" },
    { label: "Komentar Pending", value: stats.pendingComments, icon: MessageSquare, color: "bg-red-500" },
  ];

  return (
    <div>
      <h2 className="text-xl font-extrabold tracking-tight">Ringkasan Portal</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <div className={`flex size-8 items-center justify-center rounded-lg ${c.color} text-white`}>
                <c.icon className="size-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Articles */}
      <div className="mt-8">
        <h3 className="text-sm font-bold">Artikel Terbaru</h3>
        <div className="mt-3 space-y-2">
          {stats.recentArticles?.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-[11px] text-muted-foreground">{a.author_name} · {formatDate(a.created_at)}</div>
              </div>
              <span className={`shrink-0 ml-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                a.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                a.status === "draft" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Articles */}
      <div className="mt-8">
        <h3 className="text-sm font-bold">Artikel Terpopuler</h3>
        <div className="mt-3 space-y-2">
          {stats.topArticles?.map((a: any, i: number) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-4 py-3">
              <span className="text-lg font-extrabold text-muted-foreground/40">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-[11px] text-muted-foreground">{a.author_name}</div>
              </div>
              <span className="shrink-0 text-xs font-bold text-primary">{a.views} views</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== ARTICLES TAB ==========
function ArticlesTab({ articles, onRefresh }: { articles: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", excerpt: "", category_id: "", status: "draft" });
  const [categories, setCategories] = useState<any[]>([]);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => { api.listCategories().then(setCategories).catch(() => {}); }, []);

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
      onRefresh();
    } catch (err: any) { alert(err.message); }
  }

  function startEdit(a: any) {
    setForm({ title: a.title, content: a.content, excerpt: a.excerpt || "", category_id: a.category_id || "", status: a.status });
    setEditId(a.id);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus artikel ini?")) return;
    try { await api.deleteArticle(id); onRefresh(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">Manajemen Artikel</h2>
        <Button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ title: "", content: "", excerpt: "", category_id: "", status: "draft" }); }} className="rounded-lg">
          <Plus className="size-4" /> {showForm ? "Batal" : "Artikel Baru"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-border/70 bg-card p-4 space-y-3">
          <input
            type="text" placeholder="Judul artikel" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
          <textarea
            placeholder="Konten artikel (HTML support)" value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[150px]"
            required
          />
          <input
            type="text" placeholder="Excerpt / ringkasan" value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="">Pilih Kategori</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              <option value="draft">Draft</option>
              <option value="published">Publikasikan</option>
            </select>
          </div>
          <Button type="submit" className="rounded-lg">{editId ? "Update" : "Simpan"}</Button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {articles.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{a.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {a.author_name} · {a.category_name || "Tanpa kategori"} · {formatDate(a.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                a.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>{a.status}</span>
              <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => startEdit(a)}>Edit</Button>
              <Button variant="ghost" size="sm" className="rounded-lg text-xs text-destructive" onClick={() => handleDelete(a.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== CATEGORIES TAB ==========
function CategoriesTab({ categories, onRefresh }: { categories: any[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: "", description: "", color: "#0d9488" });
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createCategory(form);
      setForm({ name: "", description: "", color: "#0d9488" });
      setShowForm(false);
      onRefresh();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus kategori ini?")) return;
    try { await api.deleteCategory(id); onRefresh(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">Kategori</h2>
        <Button onClick={() => setShowForm(!showForm)} className="rounded-lg">
          <Plus className="size-4" /> {showForm ? "Batal" : "Tambah"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-border/70 bg-card p-4 space-y-3">
          <input type="text" placeholder="Nama kategori" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" required />
          <input type="text" placeholder="Deskripsi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="flex items-center gap-3">
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="size-8 rounded border" />
            <span className="text-xs text-muted-foreground">Warna kategori</span>
          </div>
          <Button type="submit" className="rounded-lg">Simpan</Button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="size-4 rounded-full" style={{ backgroundColor: c.color }} />
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{c.article_count || 0} artikel · {c.description}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="rounded-lg text-xs text-destructive" onClick={() => handleDelete(c.id)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== USERS TAB ==========
function UsersTab({ users, onRefresh }: { users: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "student", nip: "", nisn: "", class_name: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createUser(form);
      setForm({ name: "", username: "", password: "", role: "student", nip: "", nisn: "", class_name: "" });
      setShowForm(false);
      onRefresh();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus pengguna ini?")) return;
    try { await api.deleteUser(id); onRefresh(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">Pengguna</h2>
        <Button onClick={() => setShowForm(!showForm)} className="rounded-lg">
          <Plus className="size-4" /> {showForm ? "Batal" : "Tambah"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-border/70 bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" required />
            <input type="text" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="password" placeholder="Password (min 8 char)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" required />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
              <option value="student">Siswa</option>
              <option value="teacher">Guru</option>
            </select>
          </div>
          {form.role === "teacher" && <input type="text" placeholder="NIP" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />}
          {form.role === "student" && (
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="NISN" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
              <input type="text" placeholder="Nama Kelas (misal: X IPA 1)" value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            </div>
          )}
          <Button type="submit" className="rounded-lg">Simpan</Button>
        </form>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs font-bold text-muted-foreground">
              <th className="pb-2 pr-4">Nama</th>
              <th className="pb-2 pr-4">Username</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Detail</th>
              <th className="pb-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/40">
                <td className="py-2.5 pr-4 font-medium">{u.name}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">{u.username}</td>
                <td className="py-2.5 pr-4">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    u.role === "admin" ? "bg-primary/10 text-primary" :
                    u.role === "teacher" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  }`}>{u.role}</span>
                </td>
                <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                  {u.nip && `NIP: ${u.nip}`} {u.nisn && `NISN: ${u.nisn}`} {u.class_name && `· ${u.class_name}`}
                </td>
                <td className="py-2.5">
                  {u.role !== "admin" && (
                    <Button variant="ghost" size="sm" className="rounded-lg text-xs text-destructive" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========== COMMENTS TAB ==========
function CommentsTab({ comments, onRefresh }: { comments: any[]; onRefresh: () => void }) {
  async function updateStatus(id: number, status: string) {
    try { await api.updateCommentStatus(id, status); onRefresh(); } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus komentar ini?")) return;
    try { await api.deleteComment(id); onRefresh(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div>
      <h2 className="text-xl font-extrabold tracking-tight">Komentar</h2>
      <div className="mt-4 space-y-2">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Belum ada komentar</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-border/70 bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold">{c.user_name}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">pada "{c.article_title}"</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                c.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                c.status === "rejected" ? "bg-red-100 text-red-700" :
                "bg-amber-100 text-amber-700"
              }`}>{c.status}</span>
            </div>
            <p className="mt-1.5 text-sm">{c.content}</p>
            <div className="mt-2 flex gap-2">
              {c.status !== "approved" && <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => updateStatus(c.id, "approved")}>Setujui</Button>}
              {c.status !== "rejected" && <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => updateStatus(c.id, "rejected")}>Tolak</Button>}
              <Button size="sm" variant="ghost" className="rounded-lg text-xs text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="size-3" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== ANNOUNCEMENTS TAB ==========
function AnnouncementsTab({ announcements, onRefresh }: { announcements: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", priority: "normal" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createAnnouncement(form);
      setForm({ title: "", content: "", priority: "normal" });
      setShowForm(false);
      onRefresh();
    } catch (err: any) { alert(err.message); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus pengumuman ini?")) return;
    try { await api.deleteAnnouncement(id); onRefresh(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">Pengumuman</h2>
        <Button onClick={() => setShowForm(!showForm)} className="rounded-lg">
          <Plus className="size-4" /> {showForm ? "Batal" : "Baru"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-border/70 bg-card p-4 space-y-3">
          <input type="text" placeholder="Judul pengumuman" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" required />
          <textarea placeholder="Isi pengumuman" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none min-h-[100px]" required />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none">
            <option value="low">Rendah</option>
            <option value="normal">Normal</option>
            <option value="high">Tinggi</option>
            <option value="urgent">Mendesak</option>
          </select>
          <Button type="submit" className="rounded-lg">Simpan</Button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {announcements.map((a) => (
          <div key={a.id} className="rounded-lg border border-border/70 bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">{a.title}</div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  a.priority === "urgent" ? "bg-red-100 text-red-700" :
                  a.priority === "high" ? "bg-orange-100 text-orange-700" :
                  a.priority === "normal" ? "bg-blue-100 text-blue-700" :
                  "bg-muted text-muted-foreground"
                }`}>{a.priority}</span>
                <Button variant="ghost" size="sm" className="rounded-lg text-xs text-destructive" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.content}</p>
            <div className="mt-1 text-[11px] text-muted-foreground">{formatDate(a.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
