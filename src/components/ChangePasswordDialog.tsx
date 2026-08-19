import { KeyRound, Loader2 } from "lucide-react";
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

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      setIsSubmitting(false);
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success("Password berhasil diubah", {
        description: "Mulai sekarang gunakan password baru untuk masuk.",
      });
      event.currentTarget.reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Change password error:", err);
      setError(err instanceof Error ? err.message : "Gagal mengubah password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Password</DialogTitle>
          <DialogDescription>
            Masukkan password lama dan password baru kamu. Setelah diubah,
            perangkat lain yang masih login akan otomatis keluar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cp-current" className="text-xs">
              Password lama *
            </Label>
            <Input
              id="cp-current"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp-new" className="text-xs">
              Password baru (min. 8 karakter) *
            </Label>
            <Input
              id="cp-new"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="••••••••"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp-confirm" className="text-xs">
              Konfirmasi password baru *
            </Label>
            <Input
              id="cp-confirm"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="••••••••"
              required
              disabled={isSubmitting}
            />
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
                  <KeyRound className="size-4" /> Simpan Password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
