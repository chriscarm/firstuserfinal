import { Moon, Palette, Sun } from "lucide-react";
import { useThemeMode, type ThemeMode } from "@/lib/theme";

const OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  Icon: typeof Moon;
}> = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "mid", label: "Mid", Icon: Palette },
  { value: "light", label: "Light", Icon: Sun },
];

export function ThemeModeSwitcher() {
  const { mode, setMode } = useThemeMode();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120]">
      <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/60 p-1.5 backdrop-blur-xl shadow-2xl">
        <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
          Theme
        </div>
        <div className="flex items-center gap-1">
          {OPTIONS.map(({ value, label, Icon }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:bg-white/[0.08] hover:text-white/90"
                }`}
                aria-pressed={active}
                aria-label={`Switch to ${label} mode`}
                title={`${label} mode`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
