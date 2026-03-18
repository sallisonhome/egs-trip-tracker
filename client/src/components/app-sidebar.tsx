import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  CalendarDays, LayoutDashboard, Gamepad2, Map, ChevronRight
} from "lucide-react";

const navItems = [
  { title: "Events & Trips", url: "/events", icon: CalendarDays },
  { title: "Games & Topics", url: "/dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const [loc] = useHashLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <Map className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight">EGS BD/AM</p>
            <p className="text-xs text-muted-foreground leading-tight">Trip Tracker</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive = loc === item.url || (item.url === "/events" && loc === "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t">
        <p className="text-xs text-muted-foreground">Epic Games Store Internal</p>
      </SidebarFooter>
    </Sidebar>
  );
}
