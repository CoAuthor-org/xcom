"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import {
  AppSidebar,
  NAV_ITEM_IDS,
  type NavItemId,
} from "@/components/app-sidebar";
import { useLocalStorageStringState } from "@/lib/use-local-storage-state";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { XPoster } from "@/components/xposter/xposter";
import { BlogPoster } from "@/components/blog-poster/blog-poster";
import { XEngager } from "@/components/x-engager/x-engager";
import { ScouterDashboard } from "@/components/scouter/scouter-dashboard";

export default function Home() {
  const [activeId, setActiveId] = useLocalStorageStringState<NavItemId>(
    "xcom:nav:activeId",
    "xposter",
    NAV_ITEM_IDS
  );

  return (
    <SidebarProvider defaultCollapsed={false}>
      <AppSidebar activeId={activeId} onSelect={setActiveId} />
      <SidebarInset className="bg-[#e0e0e0]">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#bebebe] bg-[#e0e0e0] px-3 sm:h-14 sm:px-4 transition-[width,height] ease-linear">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-auto bg-[#e0e0e0]">
          {activeId === "xposter" && <XPoster />}
          {activeId === "blogposter" && <BlogPoster />}
          {activeId === "xengager" && <XEngager />}
          {activeId === "scouter" && <ScouterDashboard />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
