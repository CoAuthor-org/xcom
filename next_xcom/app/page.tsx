"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  AppSidebar,
  NAV_ITEMS,
  NAV_ITEM_IDS,
  type NavItemId,
} from "@/components/app-sidebar";
import { useLocalStorageStringState } from "@/lib/use-local-storage-state";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { XPoster } from "@/components/xposter/xposter";
import { BlogPoster } from "@/components/blog-poster/blog-poster";
import { XEngager } from "@/components/x-engager/x-engager";
import { ScouterDashboard } from "@/components/scouter/scouter-dashboard";
import { Newsletters } from "@/components/newsletters/newsletters";

export default function Home() {
  const [activeId, setActiveId] = useLocalStorageStringState<NavItemId>(
    "xcom:nav:activeId",
    "xposter",
    NAV_ITEM_IDS
  );
  const activeNav = NAV_ITEMS.find((item) => item.id === activeId) ?? NAV_ITEMS[0];
  const ActiveIcon = activeNav.icon;
  const refreshBusy = activeId === "newsletters" ? false : false;

  return (
    <SidebarProvider defaultCollapsed={false}>
      <AppSidebar activeId={activeId} onSelect={setActiveId} />
      <SidebarInset className="bg-[#e0e0e0]">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-[#bebebe] bg-[#e0e0e0] px-3 sm:h-14 sm:px-4 transition-[width,height] ease-linear">
          <SidebarTrigger />
          <div className="inline-flex items-center gap-2 text-[#2d2d2d]">
            <ActiveIcon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-sm font-semibold sm:text-base">{activeNav.label}</span>
          </div>
          <div className="ml-auto">
            {activeId === "newsletters" ? (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new Event("newsletters:refresh"));
                }}
                className="inline-flex h-9 w-9 items-center justify-center text-[#2d2d2d]"
                aria-label="Refresh newsletters"
                title="Refresh newsletters"
              >
                <RefreshCw className={`h-4 w-4 ${refreshBusy ? "animate-spin" : ""}`} />
              </button>
            ) : null}
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-[#e0e0e0]">
          {activeId === "xposter" && <XPoster />}
          {activeId === "blogposter" && <BlogPoster />}
          {activeId === "xengager" && <XEngager />}
          {activeId === "scouter" && <ScouterDashboard />}
          {activeId === "newsletters" && <Newsletters />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
