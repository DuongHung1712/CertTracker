"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Notifications"
                  className="relative size-9 sm:size-8 p-0"
                />
              }
            />
          }
        >
          <Bell aria-hidden="true" className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-foreground">Notifications</span>
          </div>
          <span className="text-caption text-muted-foreground">Recent updates</span>
        </div>
        <div className="p-3">
          <section
            aria-label="In-app alerts (Coming soon)"
            className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3"
          >
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Bell className="size-4" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-body font-semibold text-foreground">In-app alerts</span>
                <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-caption text-muted-foreground">
                  Coming soon
                </Badge>
              </div>
              <p className="text-caption text-muted-foreground leading-relaxed">
                Expiry reminders and approval updates inside CertTracker. Not available yet.
              </p>
            </div>
          </section>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
