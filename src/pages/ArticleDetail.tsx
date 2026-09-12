import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  MessageSquare,
  Send,
  Share2,
  Tag,
  User,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatViews(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "rb";
  return String(n);
}

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (slug) loadArticle();
  }, [slug]);

  async function loadArticle() {
    try {
      const data = await api.getArticle(slug!);
      setArticle(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !article) return;
    setSubmittingComment(true);
    try {
      await api.addComment(article.id, commentText.trim());
      setCommentText("");
      await loadArticle();
    } catch (err: any) {
      alert(err.message || "Gagal mengirim komentar");
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: article?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link berhasil disalin!");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-8 w-3/4 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="mt-8 space-y-3">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold">Artikel tidak ditemukan</p>
          <Button asChild variant="outline" className="mt-4 rounded-lg">
            <Link to="/berita">
              <ArrowLeft className="size-4" /> Kembali ke Berita
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Breadcrumb */}
      <div className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Beranda</Link>
            <ChevronRight className="size-3" />
            <Link to="/berita" className="hover:text-foreground">Berita</Link>
            <ChevronRight className="size-3" />
            {article.category_name && (
              <>
                <Link to={`/berita?category=${article.category_slug}`} className="hover:text-foreground">
                  {article.category_name}
                </Link>
                <ChevronRight className="size-3" />
              </>
            )}
            <span className="font-medium text-foreground truncate max-w-[200px]">{article.title}</span>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-4xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Category & Meta */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {article.category_name && (
              <Link
                to={`/berita?category=${article.category_slug}`}
                className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: article.category_color || "#0d9488" }}
              >
                {article.category_name}
              </Link>
            )}
            {article.is_pinned && (
              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Pin
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight sm:text-3xl lg:text-4xl">
            {article.title}
          </h1>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {article.author_name && (
              <span className="flex items-center gap-1.5">
                <User className="size-4" />
                {article.author_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4" />
              {formatDate(article.published_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="size-4" />
              {formatViews(article.views)} dilihat
            </span>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Share2 className="size-4" />
              Bagikan
            </button>
          </div>

          {/* Featured Image */}
          {article.featured_image && (
            <div className="mt-6 overflow-hidden rounded-xl">
              <img src={article.featured_image} alt="" className="w-full object-cover" />
            </div>
          )}

          {/* Content */}
          <div
            className="mt-8 prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Tag className="size-4 text-muted-foreground" />
              {article.tags.map((tag: any) => (
                <span
                  key={tag.slug}
                  className="inline-flex rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Author Card */}
          <div className="mt-8 rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                {article.author_name?.charAt(0) || "A"}
              </div>
              <div>
                <div className="text-sm font-bold">{article.author_name}</div>
                <div className="text-xs text-muted-foreground">
                  {article.author_role === "admin" ? "Administrator" : article.author_role === "teacher" ? "Guru" : "Siswa"}
                </div>
              </div>
            </div>
          </div>

          {/* Related Articles */}
          {article.related && article.related.length > 0 && (
            <div className="mt-10">
              <h3 className="text-lg font-extrabold">Berita Terkait</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {article.related.map((rel: any) => (
                  <Link
                    key={rel.id}
                    to={`/berita/${rel.slug}`}
                    className="group rounded-xl border border-border/70 bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                  >
                    {rel.category_name && (
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: rel.category_color || "#0d9488" }}
                      >
                        {rel.category_name}
                      </span>
                    )}
                    <h4 className="mt-2 line-clamp-2 text-sm font-bold group-hover:text-primary transition-colors">
                      {rel.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(rel.published_at)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="mt-10 border-t border-border/60 pt-8">
            <h3 className="flex items-center gap-2 text-lg font-extrabold">
              <MessageSquare className="size-5" />
              Komentar ({article.comments?.length || 0})
            </h3>

            {/* Comment Form */}
            {isAuthenticated ? (
              <form onSubmit={handleComment} className="mt-4 flex gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {user?.name?.charAt(0) || "U"}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Tulis komentar..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-none"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button type="submit" size="sm" disabled={!commentText.trim() || submittingComment} className="rounded-lg">
                      <Send className="size-3.5" /> {submittingComment ? "Mengirim..." : "Kirim"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary hover:underline">
                  Masuk
                </Link>{" "}
                untuk menulis komentar
              </div>
            )}

            {/* Comments List */}
            <div className="mt-6 space-y-4">
              {article.comments?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada komentar</p>
              ) : (
                article.comments?.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {comment.user_name?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 rounded-lg border border-border/70 bg-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{comment.user_name}</span>
                        {comment.user_role === "admin" && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Admin</span>
                        )}
                        {comment.user_role === "teacher" && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Guru</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </article>
    </div>
  );
}
