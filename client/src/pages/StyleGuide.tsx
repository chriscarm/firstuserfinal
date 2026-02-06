import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import {
  Search, Bell, Menu, X, User, Settings, LogOut, MessageSquare, LayoutGrid,
  Users, Award, Shield, Plus, Image, Trash2, Send, Lock, Hash, AlertTriangle,
  CheckCircle2, Zap, Phone, Copy, Link, ChevronRight, ChevronDown, Eye, EyeOff,
  Trophy, Palette, Type, MousePointerClick, Layers, ToggleLeft, Loader, Grid3X3, RulerIcon, Circle,
  Pin, MessageCircle, BarChart3, ChevronUp, ThumbsUp, Paperclip, TrendingUp, Home, Compass,
  Reply, Vote, Check, Inbox, XCircle
} from "lucide-react";

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
    </div>
  );
}

function ColorSwatch({ color, name, hex }: { color: string; name: string; hex: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-16 w-16 rounded-lg ${color}`} />
      <div className="text-center">
        <div className="text-xs font-medium text-white">{name}</div>
        <div className="text-[10px] text-violet-300/60">{hex}</div>
      </div>
    </div>
  );
}

export default function StyleGuide() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      <main className="mx-auto max-w-[1200px] px-4 py-16 md:px-8">
        {/* Page Header */}
        <header className="mb-16 text-center">
          <h1 className="mb-4 font-display text-5xl font-bold tracking-tight md:text-6xl">
            FirstUser <span className="text-gradient">Style Guide</span>
          </h1>
          <p className="text-lg text-violet-200/70">
            Complete design system reference for the FirstUser platform
          </p>
        </header>

        {/* Colors Section */}
        <section className="mb-16">
          <SectionHeader icon={Palette} title="Colors" />
          <Card>
            <CardHeader>
              <CardTitle>Core Palette</CardTitle>
              <CardDescription>The violet and fuchsia color system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 flex flex-wrap gap-4">
                <ColorSwatch color="bg-void" name="Void" hex="#000000" />
                <ColorSwatch color="bg-violet-950" name="Violet 950" hex="#0a0510" />
                <ColorSwatch color="bg-violet-900" name="Violet 900" hex="#2a0a4a" />
                <ColorSwatch color="bg-violet-800" name="Violet 800" hex="#1a0530" />
                <ColorSwatch color="bg-violet-600" name="Violet 600" hex="#7c3aed" />
                <ColorSwatch color="bg-violet-500" name="Violet 500" hex="#8b5cf6" />
                <ColorSwatch color="bg-violet-400" name="Violet 400" hex="#a78bfa" />
                <ColorSwatch color="bg-violet-300" name="Violet 300" hex="#c4b5fd" />
                <ColorSwatch color="bg-fuchsia-600" name="Fuchsia 600" hex="#c026d3" />
                <ColorSwatch color="bg-fuchsia-500" name="Fuchsia 500" hex="#d946ef" />
                <ColorSwatch color="bg-fuchsia-400" name="Fuchsia 400" hex="#e879f9" />
                <div className="flex flex-col items-center gap-2">
                  <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500" />
                  <div className="text-center">
                    <div className="text-xs font-medium text-white">Gradient</div>
                    <div className="text-[10px] text-violet-300/60">Primary</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h4 className="mb-4 text-sm font-medium text-white">Text Colors</h4>
                <div className="space-y-2">
                  <p className="text-white/90">Primary text color (white/90)</p>
                  <p className="text-white/70">Secondary text color (white/70)</p>
                  <p className="text-white/30">Muted text color (white/30)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Typography Section */}
        <section className="mb-16">
          <SectionHeader icon={Type} title="Typography" />
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h4 className="mb-4 text-sm font-medium text-violet-300">Headlines (Space Grotesk)</h4>
                  <div className="space-y-3">
                    <div><h1 className="text-5xl font-bold">Heading 1</h1><span className="text-xs text-violet-300/60">text-5xl</span></div>
                    <div><h2 className="text-4xl font-bold">Heading 2</h2><span className="text-xs text-violet-300/60">text-4xl</span></div>
                    <div><h3 className="text-3xl font-bold">Heading 3</h3><span className="text-xs text-violet-300/60">text-3xl</span></div>
                    <div><h4 className="text-2xl font-bold">Heading 4</h4><span className="text-xs text-violet-300/60">text-2xl</span></div>
                    <div><h5 className="text-xl font-bold">Heading 5</h5><span className="text-xs text-violet-300/60">text-xl</span></div>
                    <div><h6 className="text-lg font-bold">Heading 6</h6><span className="text-xs text-violet-300/60">text-lg</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-4 text-sm font-medium text-violet-300">Body Text (Inter)</h4>
                  <div className="space-y-3 font-sans">
                    <div><p className="text-xl">Extra Large body text</p><span className="text-xs text-violet-300/60">text-xl</span></div>
                    <div><p className="text-lg">Large body text</p><span className="text-xs text-violet-300/60">text-lg</span></div>
                    <div><p className="text-base">Base body text</p><span className="text-xs text-violet-300/60">text-base</span></div>
                    <div><p className="text-sm">Small body text</p><span className="text-xs text-violet-300/60">text-sm</span></div>
                    <div><p className="text-xs">Extra small text</p><span className="text-xs text-violet-300/60">text-xs</span></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wider">Badge / Label</p><span className="text-xs text-violet-300/60">10px uppercase</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-8 border-t border-white/10 pt-6">
                <h4 className="mb-4 text-sm font-medium text-violet-300">Gradient Text</h4>
                <p className="text-gradient font-display text-3xl font-bold">Where communities become legends.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Buttons Section */}
        <section className="mb-16">
          <SectionHeader icon={MousePointerClick} title="Buttons" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Button>Primary (Gradient)</Button>
                  <Button variant="secondary">Secondary (Glass)</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Sizes</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default (44px)</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">States</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button disabled><Spinner className="mr-2" /> Loading</Button>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">With Icons</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Continue <ChevronRight className="ml-2 h-4 w-4" /></Button>
                  <Button variant="secondary"><Plus className="mr-2 h-4 w-4" /> Create New</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Badges Section */}
        <section className="mb-16">
          <SectionHeader icon={Award} title="Badges" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Badge Tiers</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                  {[
                    { variant: "first" as const, label: "1st", name: "First User", desc: "Gold gradient with glow" },
                    { variant: "silver" as const, label: "10¹", name: "Top 10", desc: "Silver solid" },
                    { variant: "bronze" as const, label: "10²", name: "Top 100", desc: "Bronze solid" },
                    { variant: "default" as const, label: "10³", name: "Top 1,000", desc: "Violet with glow" },
                    { variant: "glass" as const, label: "10⁴", name: "Top 10,000", desc: "Glass border" },
                    { variant: "founder" as const, label: "F", name: "Founder", desc: "Black with shadow" },
                    { variant: "active" as const, label: "Active", name: "Approved", desc: "Green with glow" },
                  ].map((badge) => (
                    <div key={badge.variant} className="flex flex-col items-center gap-2 text-center">
                      <Badge variant={badge.variant} className="text-sm px-3 py-1">{badge.label}</Badge>
                      <div className="text-xs font-medium text-white">{badge.name}</div>
                      <div className="text-[10px] text-violet-300/60">{badge.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Badge Sizes</h4>
                <div className="flex items-center gap-4">
                  <Badge variant="first" className="text-[8px] px-1.5 py-0.5">1st</Badge>
                  <Badge variant="first" className="text-[10px] px-2 py-0.5">1st</Badge>
                  <Badge variant="first" className="text-sm px-3 py-1">1st</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Avatars Section */}
        <section className="mb-16">
          <SectionHeader icon={User} title="Avatars" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Sizes</h4>
                <div className="mb-4 flex items-end gap-4">
                  <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">SM</AvatarFallback></Avatar>
                  <Avatar className="h-10 w-10"><AvatarFallback className="text-sm">DF</AvatarFallback></Avatar>
                  <Avatar className="h-12 w-12"><AvatarFallback>LG</AvatarFallback></Avatar>
                  <Avatar className="h-16 w-16"><AvatarFallback className="text-lg">XL</AvatarFallback></Avatar>
                  <Avatar className="h-20 w-20"><AvatarFallback className="text-xl">2X</AvatarFallback></Avatar>
                </div>
                <p className="text-xs text-amber-400/80">Note: Avatars are SQUARE with rounded corners, NOT circular</p>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Online Status</h4>
                <div className="flex items-center gap-4">
                  <Avatar online><AvatarFallback>ON</AvatarFallback></Avatar>
                  <Avatar><AvatarFallback>OF</AvatarFallback></Avatar>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Avatar Stack</h4>
                <div className="flex -space-x-3">
                  <Avatar className="border-2 border-void"><AvatarFallback>JD</AvatarFallback></Avatar>
                  <Avatar className="border-2 border-void"><AvatarFallback className="from-fuchsia-600 to-pink-600">AS</AvatarFallback></Avatar>
                  <Avatar className="border-2 border-void"><AvatarFallback className="from-blue-600 to-cyan-600">MK</AvatarFallback></Avatar>
                  <Avatar className="border-2 border-void"><AvatarFallback className="from-green-600 to-emerald-600">TL</AvatarFallback></Avatar>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-void bg-void/60 text-xs font-medium text-white backdrop-blur-sm">+4k</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Inputs Section */}
        <section className="mb-16">
          <SectionHeader icon={Hash} title="Inputs" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Standard Inputs</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="mb-2 block text-xs text-violet-300/60">Default</Label>
                    <Input placeholder="Enter text..." />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-violet-300/60">Focused State</Label>
                    <Input placeholder="Focused input" className="bg-void/70 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)]" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-violet-300/60">Disabled</Label>
                    <Input placeholder="Disabled" disabled />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">With Icons</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300/40" />
                    <Input placeholder="Search..." className="pl-10" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-violet-300/60">firstuser.co/</span>
                    <Input placeholder="your-project" className="flex-1" />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Error State</h4>
                <div className="max-w-sm">
                  <Input placeholder="Email" className="border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]" />
                  <p className="mt-1 text-xs text-red-400">Please enter a valid email address</p>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Textarea</h4>
                <Textarea placeholder="Write your message here..." />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards Section */}
        <section className="mb-16">
          <SectionHeader icon={Layers} title="Cards" />
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <CardTitle>Badge System</CardTitle>
                <CardDescription>Reward early adopters automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="first">1st</Badge>
                  <Badge variant="silver">10¹</Badge>
                  <Badge variant="bronze">10²</Badge>
                  <Badge variant="default">10³</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle>Community First</CardTitle>
                <CardDescription>Built for founders and early users.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex -space-x-3">
                  <Avatar className="border-2 border-void"><AvatarFallback>JD</AvatarFallback></Avatar>
                  <Avatar className="border-2 border-void"><AvatarFallback className="from-fuchsia-600 to-pink-600">AS</AvatarFallback></Avatar>
                  <Avatar className="border-2 border-void" online><AvatarFallback className="from-blue-600 to-cyan-600">MK</AvatarFallback></Avatar>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-void bg-void/60 text-xs font-medium text-white">+4k</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Zap className="h-6 w-6" />
                </div>
                <CardTitle>Instant Setup</CardTitle>
                <CardDescription>Launch your waitlist in seconds.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input placeholder="your-project" className="bg-void/60" />
                  <Button size="icon" variant="secondary"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Switches & Toggles Section */}
        <section className="mb-16">
          <SectionHeader icon={ToggleLeft} title="Switches & Toggles" />
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Switch />
                  <span className="text-sm text-violet-300/60">Off</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked />
                  <span className="text-sm text-violet-300/60">On</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch disabled />
                  <span className="text-sm text-violet-300/60">Disabled</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Progress Bars Section */}
        <section className="mb-16">
          <SectionHeader icon={Loader} title="Progress Bars" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <span className="mb-2 block text-xs text-violet-300/60">25%</span>
                <Progress value={25} />
              </div>
              <div>
                <span className="mb-2 block text-xs text-violet-300/60">50%</span>
                <Progress value={50} />
              </div>
              <div>
                <span className="mb-2 block text-xs text-violet-300/60">75%</span>
                <Progress value={75} />
              </div>
              <div>
                <span className="mb-2 block text-xs text-violet-300/60">100%</span>
                <Progress value={100} />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Loading States Section */}
        <section className="mb-16">
          <SectionHeader icon={Loader} title="Loading States" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Spinners</h4>
                <div className="flex items-center gap-6">
                  <Spinner className="h-4 w-4" />
                  <Spinner className="h-6 w-6" />
                  <Spinner className="h-8 w-8" />
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Skeleton Shimmer</h4>
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-4 w-full rounded" />
                  <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                  <div className="skeleton-shimmer h-4 w-1/2 rounded" />
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Skeleton Card</h4>
                <div className="max-w-sm rounded-2xl border border-white/8 bg-white/3 p-6">
                  <div className="flex items-center gap-4">
                    <div className="skeleton-shimmer h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton-shimmer h-4 w-24 rounded" />
                      <div className="skeleton-shimmer h-3 w-16 rounded" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="skeleton-shimmer h-3 w-full rounded" />
                    <div className="skeleton-shimmer h-3 w-5/6 rounded" />
                    <div className="skeleton-shimmer h-3 w-3/4 rounded" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Icons Section */}
        <section className="mb-16">
          <SectionHeader icon={Grid3X3} title="Icons" />
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-14">
                {[
                  Search, Bell, Menu, X, User, Settings, LogOut, MessageSquare, LayoutGrid,
                  Users, Award, Shield, Plus, Image, Trash2, Send, Lock, Hash, AlertTriangle,
                  CheckCircle2, Zap, Phone, Copy, Link, ChevronRight, ChevronDown, Eye, EyeOff
                ].map((Icon, i) => (
                  <div key={i} className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/5">
                    <Icon className="h-5 w-5 text-violet-300" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Spacing Section */}
        <section className="mb-16">
          <SectionHeader icon={RulerIcon} title="Spacing" />
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {[
                  { name: "xs", value: "4px", width: "w-1" },
                  { name: "sm", value: "8px", width: "w-2" },
                  { name: "md", value: "16px", width: "w-4" },
                  { name: "lg", value: "24px", width: "w-6" },
                  { name: "xl", value: "32px", width: "w-8" },
                  { name: "2xl", value: "48px", width: "w-12" },
                  { name: "3xl", value: "64px", width: "w-16" },
                ].map((space) => (
                  <div key={space.name} className="flex items-center gap-4">
                    <div className={`h-4 ${space.width} rounded bg-violet-500`} />
                    <span className="text-sm text-white">{space.name}</span>
                    <span className="text-xs text-violet-300/60">{space.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Border Radius Section */}
        <section className="mb-16">
          <SectionHeader icon={Circle} title="Border Radius" />
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                {[
                  { name: "rounded-md", value: "6px", radius: "rounded-md" },
                  { name: "rounded-lg", value: "8px", radius: "rounded-lg" },
                  { name: "rounded-xl", value: "12px", radius: "rounded-xl" },
                  { name: "rounded-2xl", value: "16px", radius: "rounded-2xl" },
                  { name: "rounded-3xl", value: "24px", radius: "rounded-3xl" },
                  { name: "rounded-full", value: "circle", radius: "rounded-full" },
                ].map((r) => (
                  <div key={r.name} className="flex flex-col items-center gap-2">
                    <div className={`h-16 w-16 bg-violet-500 ${r.radius}`} />
                    <div className="text-xs font-medium text-white">{r.name}</div>
                    <div className="text-[10px] text-violet-300/60">{r.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Error States Section */}
        <section className="mb-16">
          <SectionHeader icon={XCircle} title="Error States" />
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Input with Error</h4>
                <div className="max-w-sm">
                  <Input 
                    placeholder="Email address" 
                    defaultValue="invalid-email"
                    className="border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                  />
                  <p className="mt-2 text-xs text-red-400">Please enter a valid email address</p>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Multiple Field Errors</h4>
                <div className="max-w-sm space-y-4">
                  <div>
                    <Label className="mb-2 block text-xs text-violet-300/60">Username</Label>
                    <Input 
                      placeholder="Username" 
                      defaultValue="ab"
                      className="border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                    />
                    <p className="mt-2 text-xs text-red-400">Username must be at least 3 characters</p>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs text-violet-300/60">Password</Label>
                    <Input 
                      type="password"
                      placeholder="Password" 
                      className="border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                    />
                    <p className="mt-2 text-xs text-red-400">Password is required</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Interactive Cards Section */}
        <section className="mb-16">
          <SectionHeader icon={MousePointerClick} title="Interactive Cards" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Clickable Card</h4>
                <div className="max-w-sm glass-panel p-4 cursor-pointer transition-all hover:border-violet-500/40 group">
                  <h5 className="font-display font-bold text-white group-hover:text-fuchsia-400 transition-colors">Clickable Card Title</h5>
                  <p className="text-sm text-violet-300/70 mt-1">Click anywhere on this card to navigate</p>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Accent Cards (Left Border)</h4>
                <div className="space-y-3 max-w-md">
                  <div className="border-l-4 border-amber-500 bg-amber-500/5 p-4 rounded-r-xl">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                      <Pin className="h-4 w-4" />
                      Pinned Message
                    </div>
                    <p className="text-sm text-violet-300/70 mt-1">This is a pinned announcement for all users</p>
                  </div>
                  <div className="border-l-4 border-green-500 bg-green-500/5 p-4 rounded-r-xl">
                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Resolved
                    </div>
                    <p className="text-sm text-violet-300/70 mt-1">This issue has been marked as resolved</p>
                  </div>
                  <div className="border-l-4 border-red-500 bg-red-500/5 p-4 rounded-r-xl">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Warning
                    </div>
                    <p className="text-sm text-violet-300/70 mt-1">This action cannot be undone</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Message & Chat Patterns Section */}
        <section className="mb-16">
          <SectionHeader icon={MessageCircle} title="Message & Chat Patterns" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Message Bubbles</h4>
                <div className="max-w-md space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-violet-600 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-[80%]">
                      Hey! How's the new feature coming along?
                      <div className="text-xs text-violet-300/50 mt-1 text-right">2:34 PM</div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="glass-panel px-4 py-2 rounded-2xl rounded-bl-md max-w-[80%]">
                      Almost done! Just finishing up the final touches 🚀
                      <div className="text-xs text-violet-500/50 mt-1">2:35 PM</div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-violet-600 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-[80%]">
                      Awesome! Can't wait to see it
                      <div className="text-xs text-violet-300/50 mt-1 text-right">2:36 PM</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Message Input Bar</h4>
                <div className="max-w-md glass-panel p-2 flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-white/5 text-violet-400 transition-colors">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20"
                  />
                  <button className="h-10 w-10 rounded-full bg-violet-600 flex items-center justify-center text-white hover:bg-violet-500 transition-colors">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Threaded Reply Pattern Section */}
        <section className="mb-16">
          <SectionHeader icon={Reply} title="Threaded Reply Pattern" />
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Reply Thread</h4>
                <div className="max-w-md space-y-3">
                  <div className="glass-panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">JD</AvatarFallback></Avatar>
                      <span className="text-sm font-medium text-white">John Doe</span>
                      <span className="text-xs text-violet-500/50">2h ago</span>
                    </div>
                    <p className="text-sm text-violet-300/80">Has anyone tried the new beta feature? Curious to hear your thoughts!</p>
                    
                    <div className="mt-3 pl-4 border-l-2 border-violet-500/20 space-y-3">
                      <div className="flex items-start gap-2">
                        <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">AS</AvatarFallback></Avatar>
                        <div>
                          <span className="text-xs font-medium text-white">Anna Smith</span>
                          <span className="text-xs text-violet-500/50 ml-2">1h ago</span>
                          <p className="text-sm text-violet-300/70 mt-0.5">Yes! It's amazing, the UI is so smooth</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pl-4">
                    <div className="flex -space-x-2">
                      <Avatar className="h-5 w-5 border border-void"><AvatarFallback className="text-[8px]">MK</AvatarFallback></Avatar>
                      <Avatar className="h-5 w-5 border border-void"><AvatarFallback className="text-[8px]">TL</AvatarFallback></Avatar>
                    </div>
                    <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                      View 5 replies <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-violet-400 pl-4">
                    <button className="hover:text-violet-300 flex items-center gap-1 transition-colors">
                      <Reply className="h-3 w-3" /> Reply
                    </button>
                    <button className="hover:text-violet-300 flex items-center gap-1 transition-colors">
                      <ThumbsUp className="h-3 w-3" /> 12
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Poll Component Section */}
        <section className="mb-16">
          <SectionHeader icon={Vote} title="Poll Component" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Poll Before Voting</h4>
                <div className="max-w-md glass-panel border-violet-500/30 p-4">
                  <h5 className="font-display font-bold text-white mb-3">What feature should we build next?</h5>
                  <div className="space-y-2">
                    {["Dark mode themes", "Mobile app", "API integrations", "Team collaboration"].map((option, i) => (
                      <div key={i} className="p-3 rounded-xl border border-white/10 hover:border-violet-500/40 hover:bg-white/2 cursor-pointer transition-all flex items-center gap-3 group">
                        <div className="h-5 w-5 rounded-full border-2 border-violet-500/40 group-hover:border-violet-500 transition-colors" />
                        <span className="text-sm text-white">{option}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-violet-500/50">127 votes</span>
                    <Button size="sm">Vote</Button>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Poll Results</h4>
                <div className="max-w-md glass-panel border-violet-500/30 p-4">
                  <h5 className="font-display font-bold text-white mb-3">What feature should we build next?</h5>
                  <div className="space-y-3">
                    {[
                      { option: "Dark mode themes", votes: 45, percent: 35 },
                      { option: "Mobile app", votes: 52, percent: 41, winner: true },
                      { option: "API integrations", votes: 20, percent: 16 },
                      { option: "Team collaboration", votes: 10, percent: 8 },
                    ].map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={item.winner ? "text-white font-medium" : "text-violet-300/70"}>{item.option}</span>
                          <span className={item.winner ? "text-violet-400" : "text-violet-500/50"}>{item.percent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${item.winner ? "bg-gradient-to-r from-violet-600 to-fuchsia-500" : "bg-white/10"}`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-violet-500/50">You voted · 127 total votes</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Dashboard Sidebar Layout Section */}
        <section className="mb-16">
          <SectionHeader icon={LayoutGrid} title="Dashboard Sidebar Layout" />
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-0 rounded-xl overflow-hidden border border-white/10 max-w-lg h-[300px]">
                <div className="w-[72px] bg-black/80 border-r border-white/5 p-2 flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center text-white">
                    <Home className="h-5 w-5" />
                  </div>
                  <div className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-violet-400 cursor-pointer transition-colors">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-violet-400 cursor-pointer transition-colors">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div className="h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-violet-400 cursor-pointer transition-colors">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="mt-auto h-10 w-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-violet-400 cursor-pointer transition-colors">
                    <Settings className="h-5 w-5" />
                  </div>
                </div>
                <div className="w-[240px] bg-black/60 border-r border-white/5 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-500/50 mb-2 px-2">Channels</div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-violet-600/20 text-white">
                      <Hash className="h-4 w-4 text-violet-400" />
                      <span className="text-sm">general</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-violet-300/70 cursor-pointer transition-colors">
                      <Hash className="h-4 w-4" />
                      <span className="text-sm">announcements</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-violet-300/70 cursor-pointer transition-colors">
                      <Hash className="h-4 w-4" />
                      <span className="text-sm">feedback</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-500/50 mt-4 mb-2 px-2">Direct Messages</div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-violet-300/70 cursor-pointer transition-colors">
                      <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">JD</AvatarFallback></Avatar>
                      <span className="text-sm">John Doe</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-void p-4 flex items-center justify-center">
                  <span className="text-sm text-violet-500/50">Main Content Area</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Mobile Navigation Section */}
        <section className="mb-16">
          <SectionHeader icon={Phone} title="Mobile Navigation" />
          <Card>
            <CardContent className="pt-6">
              <div className="max-w-sm mx-auto">
                <div className="relative h-[120px] bg-void rounded-xl border border-white/10 overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 glass-panel-dark border-t border-white/10 px-4 py-2">
                    <div className="flex items-center justify-around">
                      {[
                        { icon: Home, label: "Home", active: true },
                        { icon: Compass, label: "Explore", active: false },
                        { icon: MessageSquare, label: "Chat", active: false },
                        { icon: Bell, label: "Alerts", active: false },
                        { icon: User, label: "Profile", active: false },
                      ].map((item, i) => (
                        <button key={i} className={`flex flex-col items-center gap-1 py-1 px-3 ${item.active ? "text-violet-400" : "text-violet-300/50"}`}>
                          <item.icon className="h-5 w-5" />
                          <span className="text-[10px]">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Empty States Section */}
        <section className="mb-16">
          <SectionHeader icon={Inbox} title="Empty States" />
          <Card>
            <CardContent className="pt-6">
              <div className="max-w-sm mx-auto text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📭</div>
                <h4 className="font-display text-lg font-bold text-white mb-2">No messages yet</h4>
                <p className="text-sm text-violet-300/60 mb-6">Start a conversation or wait for someone to reach out</p>
                <Button>Send First Message</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Status Indicators Section */}
        <section className="mb-16">
          <SectionHeader icon={Circle} title="Status Indicators" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Online Status on Avatar</h4>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-void bg-green-500" />
                  </div>
                  <span className="text-sm text-violet-300/60">Online</span>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Unread Count Badge</h4>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-violet-400" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">3</span>
                  </div>
                  <div className="relative">
                    <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-violet-400" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">12</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Status Pills</h4>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Active
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Waiting
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    Offline
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Pinned & Featured Content Section */}
        <section className="mb-16">
          <SectionHeader icon={Pin} title="Pinned & Featured Content" />
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Pinned Message</h4>
                <div className="max-w-md border-l-4 border-amber-500 bg-amber-500/5 p-4 rounded-r-xl">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-2">
                    <Pin className="h-3 w-3" />
                    Pinned by Founder
                  </div>
                  <p className="text-sm text-white">Welcome to FirstUser! Check out our latest updates and features in the announcements channel.</p>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Resolved Block</h4>
                <div className="max-w-md border-l-4 border-green-500 bg-green-500/5 p-4 rounded-r-xl">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-medium mb-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Resolved
                  </div>
                  <p className="text-sm text-violet-300/70">This issue has been resolved and marked as complete.</p>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Founder-Only Pill</h4>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-400 text-xs font-medium">
                  <Shield className="h-3 w-3" />
                  Founder Only
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Loading Button State Section */}
        <section className="mb-16">
          <SectionHeader icon={Loader} title="Loading Button State" />
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="space-y-2 text-center">
                  <Button>Submit</Button>
                  <p className="text-xs text-violet-500/50">Normal</p>
                </div>
                <div className="space-y-2 text-center">
                  <Button disabled className="opacity-50 cursor-not-allowed">
                    <Spinner className="mr-2 h-4 w-4" />
                    Loading...
                  </Button>
                  <p className="text-xs text-violet-500/50">Loading</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Character Counter Section */}
        <section className="mb-16">
          <SectionHeader icon={Type} title="Character Counter" />
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Normal (50/100)</h4>
                <div className="max-w-sm">
                  <Input defaultValue="This is some example text" />
                  <div className="mt-1 text-right">
                    <span className="text-xs text-violet-500/50">50/100</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Warning (90/100)</h4>
                <div className="max-w-sm">
                  <Input defaultValue="This text is getting close to the character limit for this field" />
                  <div className="mt-1 text-right">
                    <span className="text-xs text-amber-400">90/100</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Over Limit (105/100)</h4>
                <div className="max-w-sm">
                  <Input 
                    defaultValue="This text has exceeded the maximum character limit allowed for this input" 
                    className="border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                  />
                  <div className="mt-1 text-right">
                    <span className="text-xs text-red-400">105/100</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Expandable Row Section */}
        <section className="mb-16">
          <SectionHeader icon={ChevronDown} title="Expandable Row" />
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Collapsed State</h4>
                <div className="max-w-md glass-panel p-4">
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">JD</AvatarFallback></Avatar>
                      <span className="text-sm font-medium text-white">John Doe</span>
                    </div>
                    <ChevronDown className="h-5 w-5 text-violet-400 transition-transform" />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Expanded State</h4>
                <div className="max-w-md glass-panel p-4">
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">JD</AvatarFallback></Avatar>
                      <span className="text-sm font-medium text-white">John Doe</span>
                    </div>
                    <ChevronDown className="h-5 w-5 text-violet-400 transition-transform rotate-180" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 bg-white/2 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
                    <p className="text-sm text-violet-300/70 mb-3">Additional details and content shown when expanded</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary">Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300">Remove</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tab Switcher Section */}
        <section className="mb-16">
          <SectionHeader icon={Layers} title="Tab Switcher" />
          <Card>
            <CardContent className="pt-6">
              <div className="max-w-md">
                <div className="inline-flex items-center p-1 rounded-xl bg-white/5">
                  <button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium transition-colors">
                    Overview
                  </button>
                  <button className="px-4 py-2 rounded-lg text-violet-400 text-sm font-medium hover:text-white transition-colors">
                    Members
                  </button>
                  <button className="px-4 py-2 rounded-lg text-violet-400 text-sm font-medium hover:text-white transition-colors">
                    Settings
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Metric Cards Section */}
        <section className="mb-16">
          <SectionHeader icon={BarChart3} title="Metric Cards" />
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Users, label: "USERS", value: "1,234", trend: "+12%", color: "violet" },
                  { icon: CheckCircle2, label: "ACTIVE", value: "892", trend: "+8%", color: "green" },
                  { icon: Award, label: "BADGES", value: "456", trend: "+24%", color: "amber" },
                  { icon: MessageSquare, label: "MESSAGES", value: "5.2K", trend: "+18%", color: "fuchsia" },
                ].map((metric, i) => (
                  <div key={i} className="glass-panel p-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${
                      metric.color === "violet" ? "bg-violet-500/20 text-violet-400" :
                      metric.color === "green" ? "bg-green-500/20 text-green-400" :
                      metric.color === "amber" ? "bg-amber-500/20 text-amber-400" :
                      "bg-fuchsia-500/20 text-fuchsia-400"
                    }`}>
                      <metric.icon className="h-5 w-5" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-violet-500/50 mb-1">{metric.label}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold text-white">{metric.value}</span>
                      <span className="text-xs text-green-400 flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" />
                        {metric.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Action Button Groups Section */}
        <section className="mb-16">
          <SectionHeader icon={MousePointerClick} title="Action Button Groups" />
          <Card>
            <CardContent className="pt-6 space-y-8">
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Approve/Reject Row</h4>
                <div className="max-w-md flex items-center justify-between glass-panel p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">JD</AvatarFallback></Avatar>
                    <span className="text-sm font-medium text-white">John Doe requested access</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary">Skip</Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-500">Approve</Button>
                    <button className="p-2 rounded-lg text-violet-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="mb-4 text-sm font-medium text-violet-300">Primary + Secondary Pair</h4>
                <div className="max-w-md flex items-center justify-end gap-3">
                  <Button variant="secondary">Cancel</Button>
                  <Button>Submit</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-8 text-center">
          <p className="text-sm text-violet-300/60">FirstUser Design System v1.0</p>
        </footer>
      </main>
    </div>
  );
}
