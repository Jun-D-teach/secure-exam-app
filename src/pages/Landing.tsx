import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  Megaphone,
  Newspaper,
  Search,
  ShieldCheck,
  Trophy,
  Users,
  Menu,
  X,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const iconMap: Record<string, any> = {
  newspaper: Newspaper,
  megaphone: Megaphone,
  calendar: Calendar,
  "graduation-cap": GraduationCap,
  trophy: Trophy,
  users: Users,
  "bar-chart": FileText,
  "pen-line": FileText,
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.08,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatViews(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "rb";
  return String(n);
}

export default function Landing() {
  const [articles, setArticles] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [artRes, catRes, annRes] = await Promise.all([
        api.listArticles({ limit: "12" }),
        api.listCategories(),
        api.listAnnouncements(),
      ]);
      setArticles(artRes.articles || []);
      setFeatured((artRes.articles || []).filter((a: any) => a.is_featured || a.is_pinned).slice(0, 3));
      setCategories(catRes || []);
      setAnnouncements(annRes || []);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/berita?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar - Government Style */}
      <div className="bg-primary text-primary-foreground text-xs py-1.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
          <span className="font-medium">Kementerian Agama RI — Madrasah Aliyah Negeri 2 Palembang</span>
          <div className="hidden items-center gap-4 sm:flex">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              M2
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold tracking-tight">MAN 2 Palembang</div>
              <div className="text-[10px] text-muted-foreground">Portal Berita & Informasi</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
            <Link to="/" className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground">
              Beranda
            </Link>
            <Link to="/berita" className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground">
              Berita
            </Link>
            <Link to="/berita?category=pengumuman" className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground">
              Pengumuman
            </Link>
            <Link to="/berita?category=kegiatan" className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground">
              Kegiatan
            </Link>
            <Link to="/berita?category=prestasi" className="rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground">
              Prestasi
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="rounded-lg">
              <Link to="/auth">
                <ShieldCheck className="size-4" /> Masuk
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border/60 bg-background px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1 text-sm font-medium">
              <Link to="/" className="rounded-lg px-3 py-2 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>Beranda</Link>
              <Link to="/berita" className="rounded-lg px-3 py-2 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>Berita</Link>
              <Link to="/berita?category=pengumuman" className="rounded-lg px-3 py-2 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>Pengumuman</Link>
              <Link to="/berita?category=kegiatan" className="rounded-lg px-3 py-2 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>Kegiatan</Link>
              <Link to="/berita?category=prestasi" className="rounded-lg px-3 py-2 hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>Prestasi</Link>
            </nav>
          </div>
        )}
      </header>

      {/* Announcement Banner */}
      {announcements.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
            <Megaphone className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="overflow-hidden">
              <span className="font-semibold text-amber-800 dark:text-amber-300 text-xs">
                Pengumuman:
              </span>
              <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                {announcements[0]?.title}
              </span>
            </div>
            <Link
              to="/berita?category=pengumuman"
              className="ml-auto shrink-0 text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400"
            >
              Lihat →
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.915_0.006_240/0.3)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.915_0.006_240/0.3)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-20 lg:py-28">
          <div className="max-w-3xl">
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
                <GraduationCap className="size-3.5" />
                Madrasah Aliyah Negeri 2 Palembang
              </span>
            </motion.div>
            <motion.h1
              variants={fadeUp} initial="hidden" animate="show" custom={1}
              className="mt-6 text-balance text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl"
            >
              Portal Berita & Informasi{" "}
              <span className="bg-gradient-to-r from-primary to-teal-500 bg-clip-text text-transparent">
                MAN 2 Palembang
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp} initial="hidden" animate="show" custom={2}
              className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Sumber informasi resmi madrasah — berita terkini, pengumuman penting,
              kegiatan, prestasi, dan seluruh aktivitas MAN 2 Palembang.
            </motion.p>

            {/* Search */}
            <motion.form
              variants={fadeUp} initial="hidden" animate="show" custom={3}
              onSubmit={handleSearch}
              className="mt-8 flex max-w-md gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari berita, pengumuman..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Button type="submit" className="rounded-lg px-5">
                Cari
              </Button>
            </motion.form>

            <motion.div
              variants={fadeUp} initial="hidden" animate="show" custom={4}
              className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Newspaper className="size-4 text-primary" /> {articles.length} Berita
              </span>
              <span className="flex items-center gap-1.5">
                <Megaphone className="size-4 text-primary" /> {announcements.length} Pengumuman
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4 text-primary" /> {categories.length} Kategori
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Articles */}
      {featured.length > 0 && (
        <section className="border-b border-border/60 py-10">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Unggulan
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                  Berita Utama
                </h2>
              </div>
              <Link to="/berita" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Lihat Semua <ChevronRight className="size-4" />
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((article: any, i: number) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                >
                  <Link
                    to={`/berita/${article.slug}`}
                    className="group block overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                  >
                    <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      {article.featured_image ? (
                        <img src={article.featured_image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Newspaper className="size-12 text-primary/30" />
                      )}
                    </div>
                    <div className="p-4">
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
                      </div>
                      <h3 className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-primary transition-colors">
                        {article.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {article.excerpt}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(article.published_at)}
                        </span>
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
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Kategori
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
            Jelajahi Berita
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat: any, i: number) => {
              const Icon = iconMap[cat.icon] || Newspaper;
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <Link
                    to={`/berita?category=${cat.slug}`}
                    className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                  >
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: cat.color || "#0d9488" }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                        {cat.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {cat.article_count || 0} artikel
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Latest Articles */}
      <section className="border-t border-border/60 bg-muted/30 py-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Terbaru
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                Berita Terkini
              </h2>
            </div>
            <Link to="/berita" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Lihat Semua <ChevronRight className="size-4" />
            </Link>
          </div>

          {loading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="animate-pulse rounded-xl border border-border/70 bg-card p-4">
                  <div className="mb-3 h-3 w-20 rounded bg-muted" />
                  <div className="mb-2 h-4 w-full rounded bg-muted" />
                  <div className="mb-1 h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-3 h-2 w-1/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article: any, i: number) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
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
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {formatViews(article.views)}
                      </span>
                    </div>
                    {article.author_name && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Oleh: <span className="font-medium">{article.author_name}</span>
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA / Info */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-xl sm:px-12"
          >
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/10 blur-2xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-teal-300/20 blur-2xl" />
            <h2 className="relative text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">
              MAN 2 Palembang
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-pretty text-sm text-primary-foreground/80">
              Unggul dalam Prestasi, Berkarakter Islam — Madrasah Aliyah Negeri 2 Palembang
              berkomitmen mencetak generasi Qur'ani yang kompeten dan berakhlak mulia.
            </p>
            <div className="relative mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="rounded-lg bg-white text-primary shadow-md hover:bg-white/90">
                <Link to="/auth">
                  Masuk ke Dashboard <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-lg border-white/30 text-white hover:bg-white/10">
                <Link to="/berita">
                  Baca Berita <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-muted/30 py-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                  M2
                </div>
                <span className="font-bold">MAN 2 Palembang</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Madrasah Aliyah Negeri 2 Palembang — Portal Berita dan Informasi Resmi.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold">Tautan</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-foreground transition-colors">Beranda</Link></li>
                <li><Link to="/berita" className="hover:text-foreground transition-colors">Berita</Link></li>
                <li><Link to="/berita?category=pengumuman" className="hover:text-foreground transition-colors">Pengumuman</Link></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">Masuk</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">Kategori</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {categories.slice(0, 5).map((cat: any) => (
                  <li key={cat.id}>
                    <Link to={`/berita?category=${cat.slug}`} className="hover:text-foreground transition-colors">
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">Kontak</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Jl. Demang Lebar Daun No. 1</li>
                <li>Palembang, Sumatera Selatan</li>
                <li>Telp: (0711) 123456</li>
                <li>Email: info@man2palembang.sch.id</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} MAN 2 Palembang. Hak Cipta Dilindungi.
          </div>
        </div>
      </footer>
    </div>
  );
}
