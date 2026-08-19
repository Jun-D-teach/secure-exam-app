import { Loader2, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditProfileDialog({
  open,
  onOpenChange,
  currentName,
  currentUsername,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  currentUsername: string;
  onUpdated: (name: string, username: string, token?: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const username = String(formData.get("username") || "").trim();

    if (!name) {
      setError("Nama tidak boleh kosong.");
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await api.updateProfile({
        name: name || undefined,
        username: username !== currentUsername ? username : undefined,
      });

      // If username changed, API returns a new token
      if (result.token) {
        api.setToken(result.token);
        localStorage.setItem("ujiankita_token", result.token);
      }

      toast.success("Profil berhasil diubah");
      onUpdated(name, username, result.token);
      onOpenChange(false);
    } catch (err) {
      console.error("Update profile error:", err);
      setError(err instanceof Error ? err.message : "Gagal mengubah profil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5" /> Edit Profil
          </DialogTitle>
          <DialogDescription>
            Ubah nama lengkap atau username akun kamu. Jika username diubah,
            token login akan diperbarui.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ep-name" className="text-xs">
              Nama lengkap *
            </Label>
            <Input
              id="ep-name"
              name="name"
              defaultValue={currentName}
              placeholder="Nama lengkap"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ep-username" className="text-xs">
              Username *
            </Label>
            <Input
              id="ep-username"
              name="username"
              defaultValue={currentUsername}
              pattern="[a-z0-9_.-]{3,32}"
              title="3–32 karakter: huruf kecil, angka, . _ -"
              required
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Username harus unik. Huruf kecil, angka, titik, underscore, atau
              strip.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-lg">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <UserCog className="size-4" /> Simpan Profil
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
