"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The number of member proposals waiting for the admin; nothing is shown at zero. */
function PendingCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="secondary" className="ml-1.5 rounded-sm px-1.5">
      {count}
      <span className="sr-only"> waiting for approval</span>
    </Badge>
  );
}

/** Certificates / Courses tabs whose selection is mirrored in `?tab=`, so refresh and shared links keep it. */
export function CatalogueTabs({
  certificates,
  courses,
  pendingCertificates = 0,
  pendingCourses = 0,
}: {
  certificates: ReactNode;
  courses: ReactNode;
  /** Admin only: proposals to review, so nothing is missed behind the tab that is not open. */
  pendingCertificates?: number;
  pendingCourses?: number;
}) {
  // Derived on every render: a link to `?tab=courses` (e.g. from the certificate sheet) must switch tabs too.
  const tab = useSearchParams().get("tab") === "courses" ? "courses" : "certificates";

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        // History API, not router.replace: the tab flips at once and no server round trip remounts the open sheet.
        window.history.replaceState(null, "", value === "courses" ? "?tab=courses" : window.location.pathname);
      }}
    >
      <TabsList>
        <TabsTrigger value="certificates">
          Certificates
          <PendingCount count={pendingCertificates} />
        </TabsTrigger>
        <TabsTrigger value="courses">
          Courses
          <PendingCount count={pendingCourses} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="certificates">{certificates}</TabsContent>
      <TabsContent value="courses">{courses}</TabsContent>
    </Tabs>
  );
}
