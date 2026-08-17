import type { Metadata } from "next";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "Your DevBrain Dashboard",
  description:
    "Browse everything you've saved to devbrain — snippets, notes, errors, links, and docs.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
