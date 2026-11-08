import { Compass } from "lucide-react";

export function SkillsMatrixCard() {
  const skills = [
    { name: "Cloud Architecture", rating: "4/5 · Certified", pct: 80, isCertified: true },
    { name: "Kubernetes", rating: "3/5 · In progress", pct: 60, isCertified: false },
    { name: "Infrastructure as Code", rating: "4/5 · Certified", pct: 80, isCertified: true },
    { name: "System Security", rating: "2/5 · Self-assessed", pct: 40, isCertified: false },
  ];

  return (
    <section
      aria-label="My skills matrix (Coming soon)"
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Compass className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-label uppercase tracking-wider font-semibold text-foreground">
            My skills matrix
          </h3>
        </div>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          SOON
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {skills.map((skill) => (
          <div key={skill.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{skill.name}</span>
              <span className="font-mono text-foreground font-medium">{skill.rating}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={skill.isCertified ? "h-full bg-primary" : "h-full bg-muted-foreground/60"}
                style={{ width: `${skill.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
