"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LearningTab } from "@/features/learning/tab";

/** Certificates (results) and Learning (the journey) side by side; the tab is kept in ?tab= so links can open either. */
export function LearningTabs({
  initialTab,
  certificatesCount,
  learningCount,
  certificates,
  learning,
}: {
  initialTab: LearningTab;
  certificatesCount: number;
  learningCount: number;
  certificates: ReactNode;
  learning: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<LearningTab>(initialTab);

  function change(next: LearningTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={(value) => change(value as LearningTab)}>
      <TabsList>
        <TabsTrigger value="certificates">{`Certificates (${certificatesCount})`}</TabsTrigger>
        <TabsTrigger value="learning">{`Learning (${learningCount})`}</TabsTrigger>
      </TabsList>
      <TabsContent value="certificates" className="pt-2">
        {certificates}
      </TabsContent>
      <TabsContent value="learning" className="pt-2">
        {learning}
      </TabsContent>
    </Tabs>
  );
}
