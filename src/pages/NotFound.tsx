import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center px-4">
        <div className="text-6xl font-extrabold text-muted-foreground/20">404</div>
        <h1 className="mt-4 text-xl font-extrabold">Halaman Tidak Ditemukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/"><Home className="size-4" /> Beranda</Link>
          </Button>
          <Button asChild className="rounded-lg">
            <Link to="/berita"><ArrowLeft className="size-4" /> Berita</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
