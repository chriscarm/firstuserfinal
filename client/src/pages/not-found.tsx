import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
        </div>

        <p className="mb-6 text-sm text-white/70">
          That page doesn't exist or has moved.
        </p>

        <div className="grid gap-3">
          <Link href="/">
            <a className="h-11 rounded-lg bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 text-sm font-semibold text-white flex items-center justify-center">
              Go Home
            </a>
          </Link>
          <Link href="/explore">
            <a className="h-11 rounded-lg border border-white/20 text-sm font-medium text-white/80 hover:bg-white/[0.05] flex items-center justify-center">
              Explore Communities
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
