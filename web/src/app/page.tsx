import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brain, Search, Tag, Code2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Brain className="size-5" />
          <span className="font-semibold">devbrain</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Never solve the same problem twice.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Your personal, searchable, AI-powered memory of everything you&apos;ve
          ever coded, debugged, or learned.
        </p>
        <Button size="lg" asChild className="mt-8">
          <Link href="/signup">Start your brain - it&apos;s free</Link>
        </Button>

        <div className="mt-20 grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
          <Feature
            icon={Code2}
            title="Save anything"
            description="Snippets, error logs, notes, links, and docs - pasted or saved from anywhere."
          />
          <Feature
            icon={Tag}
            title="Auto-tagged"
            description="AI classifies and tags everything the moment you save it."
          />
          <Feature
            icon={Search}
            title="Ask, don't grep"
            description='"How did I connect Stripe webhooks?" - search in plain English.'
          />
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Code2;
  title: string;
  description: string;
}) {
  return (
    <div>
      <Icon className="mb-2 size-5 text-muted-foreground" />
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
