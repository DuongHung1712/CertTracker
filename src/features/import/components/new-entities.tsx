import { TriangleAlert } from "lucide-react";
import { hasNewEntities, rowsLabel, similarMessage, type NewEntityGroup, type NewEntities } from "@/features/import/preview";

const GROUP_LABEL: Record<NewEntityGroup, string> = {
  members: "Members",
  providers: "Providers",
  certTypes: "Certificate types",
  certificates: "Certificates",
  courses: "Courses",
};
const GROUP_ORDER: NewEntityGroup[] = ["members", "providers", "certTypes", "certificates", "courses"];

export const COURSE_NOTE = "A course is created for a priced exam so its cost is tracked.";

/**
 * What an import creates, by name, with the file rows that need each entry. `created` words it as done
 * ("Created in this import") instead of planned. A near-duplicate of an existing name carries a visible warning.
 */
export function NewEntitiesList({ entities, created = false }: { entities: NewEntities; created?: boolean }) {
  if (!hasNewEntities(entities)) return null;
  return (
    <div className="flex flex-col gap-3" data-testid="new-entities">
      <h2 className="text-section-title">{created ? "Created in this import" : "Will be created"}</h2>
      {GROUP_ORDER.filter((group) => entities[group].length > 0).map((group) => (
        <section key={group} aria-label={GROUP_LABEL[group]} className="flex flex-col gap-1">
          <h3 className="text-label text-muted-foreground uppercase">{`${GROUP_LABEL[group]} (${entities[group].length})`}</h3>
          {group === "courses" && !created && <p className="text-caption text-muted-foreground">{COURSE_NOTE}</p>}
          <ul className="flex flex-col gap-1">
            {entities[group].map((entry) => (
              <li key={`${entry.name}|${entry.rows[0]}`} className="min-w-0 text-body">
                <span className="font-medium wrap-anywhere" title={entry.name}>
                  {entry.name}
                </span>
                {entry.detail && <span className="text-muted-foreground wrap-anywhere">{` · ${entry.detail}`}</span>}
                <span className="text-caption text-muted-foreground">{` · ${rowsLabel(entry.rows)}`}</span>
                {entry.similarTo && (
                  <p className="mt-0.5 flex items-start gap-1.5 text-caption text-destructive wrap-anywhere">
                    <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <span className="sr-only">Warning: </span>
                      {similarMessage(entry.similarTo)}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
