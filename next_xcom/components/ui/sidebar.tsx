"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";

const SidebarContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  isMobile: boolean;
}>({
  open: true,
  setOpen: () => {},
  collapsed: false,
  setCollapsed: () => {},
  isMobile: false,
});

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const isMobile = useIsMobile();

  return (
    <SidebarContext.Provider
      value={{ open, setOpen, collapsed, setCollapsed, isMobile }}
    >
      <div
        className="group flex min-h-svh w-full"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return React.useContext(SidebarContext);
}

export function SidebarTrigger() {
  const { setOpen, isMobile, collapsed, setCollapsed } = useSidebar();

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#bebebe] bg-[#e0e0e0] text-[#2d2d2d] shadow-[4px_4px_8px_#bebebe,-4px_-4px_8px_#ffffff] hover:shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff] md:hidden touch-manipulation"
        aria-label="Open sidebar"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setCollapsed(!collapsed)}
      className="hidden h-9 w-9 items-center justify-center rounded-md border border-[#bebebe] bg-[#e0e0e0] text-[#2d2d2d] shadow-[4px_4px_8px_#bebebe,-4px_-4px_8px_#ffffff] hover:shadow-[inset_4px_4px_8px_#bebebe,inset_-4px_-4px_8px_#ffffff] md:inline-flex"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <PanelLeft className="h-5 w-5" />
      ) : (
        <PanelLeftClose className="h-5 w-5" />
      )}
    </button>
  );
}

export function Sidebar({
  children,
  className,
  ...props
}: React.ComponentProps<"aside">) {
  const { open, setOpen, collapsed, isMobile } = useSidebar();

  if (isMobile) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
          />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] border-r border-[#bebebe] bg-[#e0e0e0] transition-transform md:hidden data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full"
            onEscapeKeyDown={() => setOpen(false)}
          >
            <div className="flex h-full flex-col overflow-hidden">{children}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <aside
      data-collapsible={collapsed ? "icon" : "none"}
      className={cn(
        "group",
        "fixed inset-y-0 left-0 z-40 hidden h-svh flex-col border-r border-[#bebebe] bg-[#e0e0e0] transition-[width] duration-200 ease-linear md:flex",
        collapsed ? "w-[var(--sidebar-width-icon)]" : "w-[var(--sidebar-width)]",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 p-2", className)}
      data-sidebar="sidebar-header"
      {...props}
    />
  );
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-2 overflow-auto p-2", className)}
      data-sidebar="sidebar-content"
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1", className)}
      data-sidebar="sidebar-group"
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-[#6b6b6b] group-data-[collapsible=icon]:hidden",
        className
      )}
      data-sidebar="sidebar-group-label"
      {...props}
    />
  );
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-col gap-1", className)}
      data-sidebar="sidebar-menu"
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("list-none", className)}
      data-sidebar="sidebar-menu-item"
      {...props}
    />
  );
}

export function SidebarMenuButton({
  className,
  isActive,
  ...props
}: React.ComponentProps<"button"> & { isActive?: boolean }) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-[#d5d5d5] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        isActive ? "bg-[#d5d5d5] text-[#1d9bf0] shadow-[inset_2px_2px_4px_#bebebe]" : "text-[#2d2d2d]",
        className
      )}
      data-sidebar="sidebar-menu-button"
      data-active={isActive}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  const { collapsed, isMobile } = useSidebar();

  return (
    <main
      className={cn(
        "relative flex min-h-svh flex-1 flex-col transition-[margin] duration-200 ease-linear",
        !isMobile && collapsed ? "md:ml-[var(--sidebar-width-icon)]" : "md:ml-[var(--sidebar-width)]",
        isMobile && "md:ml-0",
        className
      )}
      {...props}
    />
  );
}
