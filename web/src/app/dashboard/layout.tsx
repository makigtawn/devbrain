import Link from "next/link";
import { requireUser } from "@/server/auth";
import { signOut } from "@/app/login/actions";
import { Brain } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileSidebar } from "@/components/mobile-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <header className="flex items-center justify-between border-b p-3 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Brain className="size-5" />
          <span className="text-lg font-semibold">devbrain</span>
        </Link>
        <MobileSidebar userEmail={user.email} signOutAction={signOut} />
      </header>

      <aside className="hidden w-64 shrink-0 border-r md:flex">
        <SidebarNav userEmail={user.email} signOutAction={signOut} />
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
