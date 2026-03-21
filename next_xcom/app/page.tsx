"use client";

import * as React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, type NavItemId } from "@/components/app-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { XPoster } from "@/components/xposter/xposter";

export default function Home() {
  const [activeId, setActiveId] = React.useState<NavItemId>("xposter");

  return (
    <SidebarProvider defaultCollapsed={false}>
      <AppSidebar activeId={activeId} onSelect={setActiveId} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#38444d] bg-[#15202b] px-3 sm:h-14 sm:px-4 transition-[width,height] ease-linear">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-auto bg-[#15202b]">
          {activeId === "xposter" && <XPoster />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
