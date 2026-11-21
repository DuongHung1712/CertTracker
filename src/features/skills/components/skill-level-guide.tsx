import { LEVEL_SCALE_GUIDE, SKILL_LEVELS } from "../schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SkillLevelGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The full 0–5 scale with what each level looks like at work. The popover next to each rating is the short version. */
export function SkillLevelGuide({ open, onOpenChange }: SkillLevelGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-section-title">Skill levels 0–5</DialogTitle>
          <DialogDescription>
            Rate levels 0–4 yourself; a certificate makes them certified. Level 5 needs your manager&apos;s approval.
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col divide-y divide-border rounded-md border border-border">
          {SKILL_LEVELS.map((lvl) => {
            const item = LEVEL_SCALE_GUIDE[lvl];
            return (
              <div key={lvl} className="grid gap-1 p-3 text-caption sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="font-medium text-foreground">
                  {lvl} · {item.title}
                </dt>
                <dd className="text-muted-foreground">
                  <span className="block text-foreground">{item.officialLegend}</span>
                  {item.criteria}
                </dd>
              </div>
            );
          })}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
