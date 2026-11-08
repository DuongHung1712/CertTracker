import { AlertTriangle, Bot, Calendar, CheckSquare, Compass, Layers, Target } from "lucide-react";

const NOT_AVAILABLE = "Not available yet.";

const FEATURES = [
  { title: "Approvals", icon: CheckSquare, text: "Review and approve the certificates that members submit." },
  { title: "Goals", icon: Target, text: "Set certificate goals for a quarter and follow the progress." },
  { title: "Skills", icon: Layers, text: "See which skills your members have, based on their certificates." },
  { title: "Focus area", icon: Compass, text: "Choose the area you want to grow in, such as cloud or security." },
  {
    title: "Ask about certificates",
    icon: Bot,
    text: "Ask questions in plain English, such as who has a certificate expiring next month.",
  },
  {
    title: "Monthly summary",
    icon: Calendar,
    text: "A short report each month: certificates completed, expired and expiring.",
  },
  {
    title: "Risk alerts",
    icon: AlertTriangle,
    text: "A warning when only one member in a team holds a needed certificate, or it is about to expire.",
  },
];

export function AdminComingSoonCard() {
  return (
    <section
      aria-label="Planned features (Coming soon)"
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-label tracking-wider text-muted-foreground">Planned features</span>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-caption font-medium text-muted-foreground">
          Coming soon
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {FEATURES.map(({ title, icon: Icon, text }) => (
          <li key={title} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-xs font-semibold text-foreground">{title}</h3>
              <p className="text-caption text-muted-foreground">{`${text} ${NOT_AVAILABLE}`}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
