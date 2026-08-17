"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Plus,
  Search,
  Tag,
  FolderOpen,
  LayoutGrid,
} from "lucide-react";

// Defined here (inside a Client Component) rather than passed down as a prop from the
// server layout — icon components are function references and can't be serialized across
// the Server → Client Component boundary.
const navItems = [
  { href: "/dashboard", label: "All entries", icon: LayoutGrid },
  { href: "/dashboard/search", label: "Search", icon: Search },
  { href: "/dashboard/tags", label: "Tags", icon: Tag },
  { href: "/dashboard/collections", label: "Collections", icon: FolderOpen },
];

export function SidebarNav({
  userEmail,
  signOutAction,
  onNavigate,
}: {
  userEmail: string;
  signOutAction: () => Promise<void>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mb-6 flex items-center gap-2 px-2"
      >
        <Brain className="size-5" />
        <span className="text-lg font-semibold">devbrain</span>
      </Link>

      <Button asChild className="mb-4">
        <Link href="/dashboard/new" onClick={onNavigate}>
          <Plus className="size-4" />
          New entry
        </Link>
      </Button>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t pt-4">
        <p className="truncate px-2 text-xs text-muted-foreground">{userEmail}</p>
        <form action={signOutAction}>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}
