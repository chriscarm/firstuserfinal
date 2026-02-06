import { Badge } from "@/components/ui/badge";

export default function ComingSoon() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black text-white">
      <main className="px-4 text-center">
        <Badge variant="glass" className="mb-8 backdrop-blur-md" data-testid="badge-coming-soon">
          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse"></span>
          In Development
        </Badge>
        
        <h1 className="mb-6 font-display text-6xl font-bold tracking-tight md:text-8xl" data-testid="text-title">
          <span className="text-gradient">FirstUser</span>
        </h1>
        
        <p className="mb-8 max-w-md mx-auto text-xl text-violet-200/70" data-testid="text-subtitle">
          Coming Soon
        </p>
        
        <p className="text-sm text-violet-300/50">
          Where communities become legends.
        </p>
      </main>
    </div>
  );
}
