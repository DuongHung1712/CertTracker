"use client";

import * as React from "react";
import { Award, Check, Layers, Monitor, Moon, Palette, RefreshCw, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useThemeStyle, type ThemeStyle } from "@/components/style-provider";
import { VaultCard } from "@/components/vault/vault-card";

export function StyleSwitcherDemo() {
  const { theme, setTheme } = useTheme();
  const { style, setStyle, toggleStyle, styles } = useThemeStyle();
  const [testInput, setTestInput] = React.useState("CERT-2026-AWS-90821");
  const [clickCount, setClickCount] = React.useState(0);

  const styleIcons: Record<ThemeStyle, React.ReactNode> = {
    classic: <Layers className="size-5 text-primary" />,
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
              2 Styles &times; 3 Modes
            </span>
          </div>
          <p className="text-caption text-muted-foreground">
            Current configuration: <strong className="text-foreground">{style.toUpperCase()}</strong> visual style &times;{" "}
            <strong className="text-foreground">{theme?.toUpperCase() || "SYSTEM"}</strong> color mode
          </p>
        </div>

        {/* Action Controls: Fast Style Toggle & Color Mode */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleStyle}
            className="flex items-center gap-1.5 font-medium"
          >
            <RefreshCw className="size-3.5" />
            <span>Switch to {style === "classic" ? "Credential Vault" : "Classic Swiss"}</span>
          </Button>

          {/* Color Mode Switcher */}
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

      {/* 2 Visual Style Selection Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {styles.map((item) => {
          const isSelected = style === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStyle(item.id)}
              className={`group flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all ${
                isSelected
                  ? "border-primary bg-accent/40 ring-2 ring-primary/40 shadow-xs"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2.5">
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

              <p className="text-caption text-muted-foreground leading-relaxed">{item.description}</p>

              {/* Style Feature Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.id === "classic" && (
                  <>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Flat Swiss 1px borders
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Warm paper white
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      High data density
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Strict 6px radius
                    </span>
                  </>
                )}
                {item.id === "vault" && (
                  <>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
                      Precision 1px solid borders
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
                      Monospace metadata
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
                      Solid obsidian/paper
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary">
                      Live status dots
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Interactive Comparison Touchpoints */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Component Touchpoint 1: Buttons & Interactive Feedback */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h4 className="text-body font-semibold">Interactive Button Behavior</h4>
              <p className="text-caption text-muted-foreground">
                {style === "vault"
                  ? "Vault rule: solid precision border with crisp focus ring and high-contrast hover feedback."
                  : "Classic rule: clean flat Swiss tokens, standard 6px radius, and zero drop shadow."}
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
              Primary Action
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
              Ghost
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Current style active: <strong className="text-foreground">{style.toUpperCase()}</strong>. Notice the solid border transition and lack of blurry gradient overlays.
          </p>
        </div>

        {/* Component Touchpoint 2: Form Inputs & Monospace Credential Tags */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="border-b pb-3">
            <h4 className="text-body font-semibold">Form Inputs & Monospace Tags</h4>
            <p className="text-caption text-muted-foreground">
              {style === "vault"
                ? "Vault rule: precision 1px solid border with uppercase monospace credential tags."
                : "Classic rule: standard neutral border-input token with clean typographic labels."}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="poc-interactive-input">Credential Identifier</Label>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {style === "vault" ? "[REGISTRY: VAULT-SEC-8829]" : "Format: CERT-YYYY-ORG"}
                </span>
              </div>
              <Input
                id="poc-interactive-input"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter credential ID..."
                className="font-mono text-body"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="vault-mono-tag">SHA-256: 7F83B165...</span>
              <span className="vault-stamp-valid">SEC-VERIFIED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Component Touchpoint 3: Solid Sticky Table Cells (Zero Bleed-Through) */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-1 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-body font-semibold">Solid Sticky Table Cells & Headers</h4>
            <p className="text-caption text-muted-foreground">
              Both Classic and Credential Vault maintain <strong>100% solid, opaque table backgrounds</strong> so scrolled rows never bleed through headers or pinned columns.
            </p>
          </div>
          <span className="rounded bg-primary/10 px-2.5 py-1 text-caption font-mono font-medium text-primary">
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

      {/* Component Touchpoint 4: Authentic Credential Vault Showcase (Anti-Slop, Zero Gradients) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Cryptographically Verified Credential */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-body font-semibold">Verified Credential Card</h4>
            </div>
            <p className="text-caption text-muted-foreground">
              Authentic security aesthetic: crisp 1px solid emerald verification border, monospace metadata, and solid live pulsing status dot.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <VaultCard
              isVerified
              className="cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="vault-stamp-valid">
                      CRYPTOGRAPHICALLY VERIFIED
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      [VAULT-SEC-01]
                    </span>
                  </div>
                  <h5 className="mt-2 text-body font-bold text-foreground">
                    AWS Certified Solutions Architect - Professional
                  </h5>
                  <p className="font-mono text-caption text-muted-foreground mt-0.5">
                    Credential ID: AWS-PSA-90821-VN
                  </p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10">
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
            </VaultCard>

            <p className="text-[11px] text-muted-foreground">
              {style === "vault"
                ? "Vault mode active: 1px solid precision verification border with solid emerald indicator pulse."
                : "Switch to 'Credential Vault' style above to inspect authentic security styling."}
            </p>
          </div>
        </div>

        {/* Card 2: Security Credential with Live Pulsing Status Dots */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <div className="border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h4 className="text-body font-semibold">Security Credential & Live Dots</h4>
            </div>
            <p className="text-caption text-muted-foreground">
              Zero gradient colors: 100% solid surfaces with live pulsing indicators (emerald for valid, amber for expiring, red for expired).
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <VaultCard
              className="group cursor-pointer border-emerald-500/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-primary">
                    Official Security Credential · (ISC)&sup2;
                  </div>
                  <h5 className="mt-2 text-body font-bold text-foreground">
                    Certified Information Systems Security Professional (CISSP)
                  </h5>
                  <p className="font-mono text-caption text-muted-foreground mt-0.5">
                    REGISTRY: CISSP-90821-VN · SHA-256 VERIFIED
                  </p>
                </div>
                <div className="vault-seal flex size-9 items-center justify-center rounded-lg text-primary-foreground shadow-xs">
                  <ShieldCheck className="size-4" />
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
                    Expiring in 60d
                  </span>
                </div>
                <div className="flex items-center gap-1.5" data-status-tone="expired">
                  <span className="vault-live-dot" aria-hidden />
                  <span className="rounded border border-status-expired-border bg-status-expired-bg px-2 py-0.5 font-mono text-[11px] font-medium text-status-expired-fg">
                    Expired
                  </span>
                </div>
              </div>
            </VaultCard>

            <p className="text-[11px] text-muted-foreground">
              {style === "vault"
                ? "Vault mode active: Real-time solid status dot pulses indicate credential lifecycle states."
                : "Switch to 'Credential Vault' style above to activate live status dot indicators."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
