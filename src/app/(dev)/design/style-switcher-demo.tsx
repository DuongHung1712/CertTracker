"use client";

import * as React from "react";
import { Box, Check, Layers, Monitor, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeStyle, type ThemeStyle } from "@/components/style-provider";

export function StyleSwitcherDemo() {
  const { theme, setTheme } = useTheme();
  const { style, setStyle, styles } = useThemeStyle();
  const [testInput, setTestInput] = React.useState("Typed sample value");
  const [clickCount, setClickCount] = React.useState(0);

  const styleIcons: Record<ThemeStyle, React.ReactNode> = {
    classic: <Layers className="size-5 text-primary" />,
    aurora: <Sparkles className="size-5 text-primary" />,
    tactile: <Box className="size-5 text-primary" />,
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

      {/* 3 Visual Style Selection Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          </div>
          <p className="text-[11px] text-muted-foreground">
            {style === "tactile" && "Tactile rule active: active:translate-y-[1.5px] with compressed bottom shadow."}
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
              Critical Glassmorphism safety: Table headers remain <strong>100% solid & opaque</strong> so scrolled content underneath never bleeds through.
            </p>
          </div>
          <span className="rounded bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
            Scroll table body to test
          </span>
        </div>

        <div className="relative max-h-52 overflow-y-auto rounded-lg border">
          <table className="w-full text-left text-table">
            <thead className="sticky top-0 z-10 border-b border-border shadow-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-label uppercase text-muted-foreground">
                  Member
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
                  Sticky Status Header (Solid)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { name: "Nguyen Van A", cert: "AWS Solutions Architect", date: "15/01/2026", exp: "15/01/2029", st: "Active" },
                { name: "Tran Thi B", cert: "PMP Project Management", date: "10/02/2025", exp: "10/02/2028", st: "Active" },
                { name: "Le Hoang C", cert: "Cisco CCNA Routing", date: "05/03/2024", exp: "05/03/2027", st: "Expiring in 60d" },
                { name: "Pham Minh D", cert: "CKA Kubernetes Admin", date: "20/04/2024", exp: "20/04/2026", st: "Expiring soon" },
                { name: "Hoang Quoc E", cert: "Scrum Master PSM I", date: "12/05/2023", exp: "12/05/2025", st: "Expired" },
                { name: "Vu Thu F", cert: "ITIL 4 Foundation", date: "01/06/2024", exp: "Permanent", st: "No Expiry" },
                { name: "Do Manh G", cert: "Azure Fundamentals AZ-900", date: "14/07/2025", exp: "14/07/2028", st: "Active" },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-accent/40">
                  <td className="px-4 py-2 font-medium text-foreground">{row.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.cert}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.date}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.exp}</td>
                  <td className="px-4 py-2 font-mono text-caption text-foreground">{row.st}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
