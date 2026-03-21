"use client";

import * as React from "react";
import { PenSquare } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export type NavItemId = "xposter";

const NAV_ITEMS: { id: NavItemId; label: string; icon: React.ElementType }[] = [
  { id: "xposter", label: "X Poster", icon: PenSquare },
];

export function AppSidebar({
  activeId,
  onSelect,
}: {
  activeId: NavItemId;
  onSelect: (id: NavItemId) => void;
}) {
  const { collapsed, setOpen, isMobile } = useSidebar();

  const handleSelect = (id: NavItemId) => {
    onSelect(id);
    if (isMobile) setOpen(false); // Close sidebar on mobile after selection
  };

  return (
    <>
      <Sidebar className="border-r border-[#38444d]">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <span className="font-bold text-[#e7e9ea] group-data-[collapsible=icon]:hidden">XCH</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">App</SidebarGroupLabel>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => handleSelect(item.id)}
                    isActive={activeId === item.id}
                    className="group-data-[collapsible=icon]:px-2"
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
