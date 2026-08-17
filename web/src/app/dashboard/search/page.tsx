import type { Metadata } from "next";
import { SearchClient } from "./search-client";

export const metadata: Metadata = {
  title: "Search your knowledge base",
  description:
    "Search across everything you've saved to devbrain using keyword and AI semantic search.",
};

export default function SearchPage() {
  return <SearchClient />;
}
