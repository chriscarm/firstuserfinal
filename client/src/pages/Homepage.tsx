import { useState } from "react";
import { Sparkles } from "lucide-react";

export default function Homepage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      console.log("Email submitted:", email);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="max-w-lg w-full text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="text-3xl font-bold text-white font-display">F</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-bold text-white font-display mb-4">
          FirstUser
        </h1>

        {/* Tagline */}
        <p className="text-xl text-white/70 mb-2">
          Coming Soon
        </p>
        <p className="text-white/50 mb-10">
          The platform for early adopter communities. Join our waitlist to be notified when we launch.
        </p>

        {/* Email Form or Success Message */}
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
              data-testid="input-email"
              required
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              data-testid="button-notify"
            >
              <Sparkles className="w-4 h-4" />
              Notify Me
            </button>
          </form>
        ) : (
          <div className="bg-white/5 border border-green-500/30 rounded-xl p-6 max-w-md mx-auto">
            <div className="text-green-400 text-lg font-semibold mb-1">You're on the list!</div>
            <p className="text-white/50 text-sm">We'll notify you when FirstUser launches.</p>
          </div>
        )}

        {/* Footer */}
        <p className="mt-12 text-white/30 text-sm">
          Built by founders, for founders.
        </p>
      </div>
    </div>
  );
}
