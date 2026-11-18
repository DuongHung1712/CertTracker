"use client";

import * as React from "react";
import { Award, Box, Check, Layers, Monitor, Moon, Palette, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeStyle, type ThemeStyle } from "@/components/style-provider";
import { SpotlightCard } from "@/components/vault/spotlight-card";

export function StyleSwitcherDemo() {
  const { theme, setTheme } = useTheme();
  const { style, setStyle, styles } = useThemeStyle();
  const [testInput, setTestInput] = React.useState("Typed sample value");
  const [clickCount, setClickCount] = React.useState(0);

  const styleIcons: Record<ThemeStyle, React.ReactNode> = {
    classic: <Layers className="size-5 text-primary" />,
    aurora: <Sparkles className="size-5 text-primary" />,
    tactile: <Box className="size-5 text-primary" />,
    vault: <ShieldCheck className="size-5 text-primary" />,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick Switcher Control Bar */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-primary" />
            <h3 className="text-section-title font-semibold">Dual-Axis Theme Engine</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              PoC Active
            </span>
          </div>
          <p className="text-caption text-muted-foreground">
            Current mode: <strong className="text-foreground">{style.toUpperCase()}</strong> style &times;{" "}
            <strong className="text-foreground">{theme?.toUpperCase() || "SYSTEM"}</strong> color mode
          </p>
        </div>

        {/* Color Mode Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-caption font-medium text-muted-foreground mr-1">Color:</span>
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                theme === "light"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sun className="size-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                theme === "dark"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Moon className="size-3.5" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                theme === "system"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="size-3.5" />
              <span>System</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Visual Style Selection Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {styles.map((item) => {
          const isSelected = style === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStyle(item.id)}
              className={`group flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-primary bg-accent/40 ring-2 ring-primary/40 shadow-sm"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg border bg-card shadow-xs">
                    {styleIcons[item.id]}
                  </div>
                  <div>
                    <h4 className="text-body font-semibold text-foreground">{item.label}</h4>
                    <span className="text-[11px] font-medium text-muted-foreground">{item.tagline}</span>
                  </div>
                </div>
                {isSelected && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" />
                  </span>
                )}
              </div>

              <p className="text-caption text-muted-foreground">{item.description}</p>

              {/* Style Feature Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.id === "classic" && (
                  <>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Flat borders
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Warm paper white
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      High data density
                    </span>
                  </>
                )}
                {item.id === "aurora" && (
                  <>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Backdrop blur (14px)
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Ambient glow
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Solid sticky cells
                    </span>
                  </>
                )}
                {item.id === "tactile" && (
                  <>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Dual layered shadow
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Concave inner shadow
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Push-down button feel
                    </span>
                  </>
                )}
                {item.id === "vault" && (
                  <>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Cursor spotlight
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Hologram sheen
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Border beam pulse
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                      Live status dots
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Interactive Feature Comparison Showcase */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Component Touchpoint 1: Tactile Push Buttons & Glow */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h4 className="text-body font-semibold">Interactive Button Behavior</h4>
              <p className="text-caption text-muted-foreground">
                Notice {style === "tactile" ? "the physical 3D push-down elevation" : style === "aurora" ? "the soft iridescent hover glow" : "the clean flat Swiss click state"}
              </p>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-caption text-muted-foreground">
              Clicks: {clickCount}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => setClickCount((c) => c + 1)}
              className="font-medium"
            >
              Primary Action (Click me)
            </Button>
            <Button
              variant="secondary"
              onClick={() => setClickCount((c) => c + 1)}
            >
              Secondary
            </Button>
            <Button
              variant="outline"
              onClick={() => setClickCount((c) => c + 1)}
            >
              Outline
            </Button>
            <Button
              variant="destructive"
              onClick={() => setClickCount((c) => c + 1)}
            >
              Destructive
            </Button>
            <Button
              variant="ghost"
              onClick={() => setClickCount((c) => c + 1)}
            >
              Ghost (Flat)
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {style === "tactile" && "Tactile rule active: active:translate-y-[1.5px] with compressed bottom shadow on action buttons; ghost buttons stay completely flat."}
            {style === "aurora" && "Aurora rule active: soft teal radial glow on hover with frosted edge accents."}
            {style === "classic" && "Classic rule active: crisp flat tokens, strict 6px radius, no drop shadow."}
          </p>
        </div>

        {/* Component Touchpoint 2: Concave Form Inputs */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="border-b pb-3">
            <h4 className="text-body font-semibold">Concave Input & Form Feel</h4>
            <p className="text-caption text-muted-foreground">
              Notice {style === "tactile" ? "the recessed inner inset shadow creating tangible depth" : style === "aurora" ? "the translucent frosted background and focus glow" : "the functional flat border"}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poc-interactive-input">Test Text Input</Label>
              <Input
                id="poc-interactive-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Click and type here to inspect input depth..."
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {style === "tactile" && "Tactile concave rule active: inset 0 2px 4px rgba(15, 23, 42, 0.07)."}
              {style === "aurora" && "Aurora rule active: translucent background with ring accent glow."}
              {style === "classic" && "Classic rule active: standard neutral border-input token."}
            </p>
          </div>
        </div>
      </div>

      {/* Component Touchpoint 3: Solid Sticky Table Cells (Aurora Proof) */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-1 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-body font-semibold">Solid Sticky Table Cells & Headers</h4>
            <p className="text-caption text-muted-foreground">
              Critical Glassmorphism safety: Table headers and sticky columns remain <strong>100% solid & opaque</strong> so scrolled content underneath never bleeds through.
            </p>
          </div>
          <span className="rounded bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
            Scroll horizontally & vertically
          </span>
        </div>

        <div className="relative max-h-52 overflow-auto rounded-lg border">
          <table className="w-full min-w-[700px] text-left text-table">
            <thead className="sticky top-0 z-10 border-b border-border shadow-xs">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-20 px-4 py-2 text-label uppercase text-muted-foreground">
                  Member (Sticky Left)
                </th>
                <th className="px-4 py-2 text-label uppercase text-muted-foreground">
                  Certificate
                </th>
                <th className="px-4 py-2 text-label uppercase text-muted-foreground">
                  Issued Date
                </th>
                <th className="px-4 py-2 text-label uppercase text-muted-foreground">
                  Expiry Date
                </th>
                <th className="px-4 py-2 text-label uppercase text-muted-foreground">
                  Score
                </th>
                <th className="sticky right-0 z-20 px-4 py-2 text-label uppercase text-muted-foreground">
                  Status (Sticky Right)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { name: "Nguyen Van A", cert: "AWS Solutions Architect", date: "15/01/2026", exp: "15/01/2029", score: "920/1000", st: "Active" },
                { name: "Tran Thi B", cert: "PMP Project Management", date: "10/02/2025", exp: "10/02/2028", score: "Proficient", st: "Active" },
                { name: "Le Hoang C", cert: "Cisco CCNA Routing", date: "05/03/2024", exp: "05/03/2027", score: "840/1000", st: "Expiring in 60d" },
                { name: "Pham Minh D", cert: "CKA Kubernetes Admin", date: "20/04/2024", exp: "20/04/2026", score: "88%", st: "Expiring soon" },
                { name: "Hoang Quoc E", cert: "Scrum Master PSM I", date: "12/05/2023", exp: "12/05/2025", score: "95%", st: "Expired" },
                { name: "Vu Thu F", cert: "ITIL 4 Foundation", date: "01/06/2024", exp: "Permanent", score: "34/40", st: "No Expiry" },
                { name: "Do Manh G", cert: "Azure Fundamentals AZ-900", date: "14/07/2025", exp: "14/07/2028", score: "910/1000", st: "Active" },
              ].map((row, idx) => (
                <tr key={idx} className="group hover:bg-accent/40">
                  <td className="sticky left-0 z-10 px-4 py-2 font-medium text-foreground">{row.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.cert}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.date}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.exp}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.score}</td>
                  <td className="sticky right-0 z-10 px-4 py-2 font-mono text-caption text-foreground">{row.st}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Component Touchpoints 4 & 5: Credential Vault Showcase */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Touchpoint 4: Interactive Mouse-Tracking Spotlight & Border Beam */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-body font-semibold">Spotlight & Border Beam (Vault)</h4>
            </div>
            <p className="text-caption text-muted-foreground">
              Move cursor over the certificate card below. Notice the dynamic spotlight following your mouse and the perimeter border beam on verified credentials.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <SpotlightCard
              hasSpotlight
              hasBorderBeam
              isVerified
              className="cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    CRYPTOGRAPHICALLY VERIFIED
                  </span>
                  <h5 className="mt-1.5 text-body font-bold text-foreground">
                    AWS Certified Solutions Architect - Professional
                  </h5>
                  <p className="text-caption text-muted-foreground">Credential ID: AWS-PSA-90821-VN</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <Award className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <div className="flex items-center gap-2">
                  <span className="vault-live-dot vault-dot-emerald" aria-hidden />
                  <span className="font-mono text-caption text-foreground">Valid through Oct 2028</span>
                </div>
                <span className="font-mono text-caption text-muted-foreground">Score: 940/1000</span>
              </div>
            </SpotlightCard>

            <p className="text-[11px] text-muted-foreground">
              {style === "vault"
                ? "Vault mode active: Interactive cursor tracking coordinates (--mouse-x, --mouse-y) with animated 360-degree border beam."
                : "Switch to 'Credential Vault' style above to activate the mouse-tracking spotlight and border beam."}
            </p>
          </div>
        </div>

        {/* Touchpoint 5: Holographic Security Sheen & Live Pulsing Status Dots */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="border-b pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h4 className="text-body font-semibold">Holographic Sheen & Live Dots</h4>
            </div>
            <p className="text-caption text-muted-foreground">
              Hover over the credential below to reveal the prismatic holographic reflection. Observe the live emerald (valid) and amber (expiring) pulsing status dots.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <SpotlightCard
              hasSpotlight
              hasHologram
              className="group cursor-pointer border-emerald-500/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5">
                    <span className="vault-holo-foil size-2 rounded-full" />
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-primary">
                      Hologram Security Seal
                    </span>
                  </div>
                  <h5 className="mt-2 text-body font-bold text-foreground">
                    Certified Information Systems Security Professional (CISSP)
                  </h5>
                  <p className="text-caption text-muted-foreground">Official Security Credential · (ISC)2</p>
                </div>
                <div className="vault-holo-foil flex size-9 items-center justify-center rounded-full text-white shadow-xs">
                  <ShieldCheck className="size-4 drop-shadow-xs" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                <div className="flex items-center gap-1.5" data-status-tone="active">
                  <span className="vault-live-dot" aria-hidden />
                  <span className="rounded border border-status-active-border bg-status-active-bg px-2 py-0.5 font-mono text-[11px] font-medium text-status-active-fg">
                    Active (Live Pulse)
                  </span>
                </div>
                <div className="flex items-center gap-1.5" data-status-tone="expiring-60">
                  <span className="vault-live-dot" aria-hidden />
                  <span className="rounded border border-status-expiring-60-border bg-status-expiring-60-bg px-2 py-0.5 font-mono text-[11px] font-medium text-status-expiring-60-fg">
                    Expiring (Amber Pulse)
                  </span>
                </div>
                <div className="flex items-center gap-1.5" data-status-tone="expired">
                  <span className="vault-live-dot" aria-hidden />
                  <span className="rounded border border-status-expired-border bg-status-expired-bg px-2 py-0.5 font-mono text-[11px] font-medium text-status-expired-fg">
                    Expired
                  </span>
                </div>
              </div>
            </SpotlightCard>

            <p className="text-[11px] text-muted-foreground">
              {style === "vault"
                ? "Vault mode active: Multi-spectral holographic sheen sweeps across on hover with live status indicator pulses."
                : "Switch to 'Credential Vault' style above to test the holographic sheen and pulsing live status dots."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
