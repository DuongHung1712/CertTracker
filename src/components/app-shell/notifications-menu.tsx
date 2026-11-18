"use client";

import { Bell, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Notifications"
            className="relative size-9 sm:size-8 p-0"
          />
        }
      >
        <Bell aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
          </div>
          <span className="text-xs text-muted-foreground">Recent updates</span>
        </div>
        <div className="p-3">
          <section
            aria-label="Certificate review (Coming soon)"
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
          >
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Certificate review</span>
                <Badge variant="outline" className="text-caption py-0 px-1 font-mono text-muted-foreground">
                  Coming soon
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Managers will check the evidence and confirm each certificate. Not available yet.
              </p>
            </div>
          </section>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
