"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseLearningTab, type LearningTab } from "@/features/learning/tab";

const TAB_SPECIFIC_PARAMS = ["view", "status", "approval"] as const;

/** Certificates (results) and Learning (the journey) side by side; the tab is kept in ?tab= so links can open either. */
export function LearningTabs({
  initialTab,
  certificatesCount,
  learningCount,
  certificates,
  learning,
}: {
  initialTab: LearningTab;
  /** Undefined when the list could not be loaded: the tab then shows no number rather than a false 0. */
  certificatesCount?: number;
  learningCount?: number;
  certificates: ReactNode;
  learning: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: LearningTab = tabParam !== null ? parseLearningTab(tabParam) : initialTab;

  function change(next: LearningTab) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of TAB_SPECIFIC_PARAMS) params.delete(key);
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={(value) => change(value as LearningTab)}>
      <TabsList>
        <TabsTrigger value="certificates">{certificatesCount === undefined ? "Certificates" : `Certificates (${certificatesCount})`}</TabsTrigger>
        <TabsTrigger value="learning">{learningCount === undefined ? "Learning" : `Learning (${learningCount})`}</TabsTrigger>
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
