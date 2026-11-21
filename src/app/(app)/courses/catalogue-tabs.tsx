"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Certificates / Courses tabs whose selection is mirrored in `?tab=`, so refresh and shared links keep it. */
export function CatalogueTabs({ certificates, courses }: { certificates: ReactNode; courses: ReactNode }) {
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
        <TabsTrigger value="certificates">Certificates</TabsTrigger>
        <TabsTrigger value="courses">Courses</TabsTrigger>
      </TabsList>
      <TabsContent value="certificates">{certificates}</TabsContent>
      <TabsContent value="courses">{courses}</TabsContent>
    </Tabs>
  );
}
