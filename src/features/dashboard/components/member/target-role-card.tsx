import { Award, Check, Circle } from "lucide-react";

export function TargetRoleCard() {
  const criteria = [
    { text: "Lead cloud migration project", done: true },
    { text: "2+ Advanced certifications", done: true },
    { text: "Internal technical mentorship", done: true },
    { text: "Multi-region security audit", done: false },
    { text: "Enterprise architecture review", done: false },
  ];

  return (
    <section
      aria-label="Target role (Coming soon)"
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-label uppercase tracking-wider font-semibold text-foreground">
            Target: Staff engineer
          </h3>
        </div>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          SOON
        </span>
      </div>

      <p className="text-caption text-muted-foreground">
        Technical criteria qualification status:
      </p>

      <ul className="flex flex-col gap-2 text-xs">
        {criteria.map((item) => (
          <li key={item.text} className="flex items-center gap-2">
            {item.done ? (
              <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-2.5" aria-hidden="true" />
              </div>
            ) : (
              <div className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                <Circle className="size-3" aria-hidden="true" />
              </div>
            )}
            <span
              className={item.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}
            >
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
