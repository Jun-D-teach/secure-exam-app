import { CheckCircle2, ClipboardCopy, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_IMPORT = 200;

type ImportedAccount = { name: string; username: string; password: string };

type Row = { name: string; username?: string; password?: string };

/**
 * One name per line. Optional suffix after "|" for username and password:
 *   Budi Santoso            → username & password dibuat otomatis
 *   Budi Santoso|budi.s     → username dipakai, password otomatis
 *   Budi Santoso|budi.s|rahasia123
 */
function parseLines(raw: string): Row[] {
  const rows: Row[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, username, password] = trimmed.split("|").map((part) => part.trim());
    if (!name) continue;
    rows.push({
      name,
      username: username || undefined,
      password: password || undefined,
    });
  }
  return rows;
}

export function ImportUsersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importUsers = useAction(api.users.importUsers);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportedAccount[] | null>(null);

  const reset = () => {
    setRole("student");
    setText("");
    setError(null);
    setIsSubmitting(false);
    setResult(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items = parseLines(text);
    if (items.length === 0) {
      setError("Isi minimal satu baris nama.");
      return;
    }
    if (items.length > MAX_IMPORT) {
      setError(`Maksimal ${MAX_IMPORT} akun dalam satu import.`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await importUsers({ role, items });
      setResult(created);
      toast.success(`${created.length} akun berhasil diimpor`, {
        description: "Username & password awal tampil di tabel berikut.",
      });
    } catch (err) {
      console.error("Import users error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengimpor akun. Pastikan format baris sudah benar.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAll = async () => {
    if (!result) return;
    const text = result.map((row) => `${row.username}\t${row.password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Username & password disalin", {
        description: "Tempel ke spreadsheet atau chat untuk dibagikan.",
      });
    } catch {
      toast.error("Gagal menyalin. Salin manual dari tabel.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
        {result === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Import Guru & Siswa</DialogTitle>
              <DialogDescription>
                Tempel daftar nama — satu nama per baris. Username dan password
                awal dibuat otomatis dan bisa langsung dibagikan.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label className="text-xs">Peran *</Label>
                <Select
                  value={role}
                  onValueChange={(value) =>
                    setRole(value as "student" | "teacher")
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Siswa</SelectItem>
                    <SelectItem value="teacher">Guru</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="import-text" className="text-xs">
                  Daftar nama (maks. {MAX_IMPORT}) *
                </Label>
                <Textarea
                  id="import-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={10}
                  placeholder={
                    "Budi Santoso\nSiti Aminah\nDewi Lestari|dewi.lestari\nAndi Pratama|andi.p|rahasia123"
                  }
                  className="rounded-lg font-mono text-sm"
                  disabled={isSubmitting}
                  required
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Format per baris: <span className="font-medium">Nama</span>{" "}
                  (username & password otomatis), atau{" "}
                  <span className="font-medium">Nama|username</span>, atau{" "}
                  <span className="font-medium">Nama|username|password</span>.
                  Username otomatis diturunkan dari nama; password otomatis 8
                  karakter acak.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-lg">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Mengimpor...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" /> Import {role === "student" ? "Siswa" : "Guru"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                {result.length} akun berhasil dibuat
              </DialogTitle>
              <DialogDescription>
                Bagikan username & password awal ke pemilik akun. Mereka bisa
                mengubah password sendiri setelah masuk.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Total {result.length} akun {role === "student" ? "siswa" : "guru"}.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={handleCopyAll}
              >
                <ClipboardCopy className="size-4" /> Salin Semua
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0">
                  <tr className="border-b bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Password awal</th>
                  </tr>
                </thead>
                <tbody>
                  {result.map((row) => (
                    <tr key={row.username} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">{row.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {row.username}
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {row.password}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Akun sudah langsung bisa dipakai login. Jika ada yang salah,
              hapus akunnya dari tabel di atas lalu impor ulang.
            </p>

            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="rounded-lg">
                Selesai
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
