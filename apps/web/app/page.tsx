import { ThemeToggle } from "@medivi/ui/components/theme-toggle";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-6 py-32 text-center">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Medivi Shop</h1>
      <p className="max-w-md text-muted-foreground">
        Monorepo scaffold is live. The catalog, cart, and checkout land in
        later tasks — see{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
          docs/tasks.md
        </code>
        .
      </p>
    </div>
  );
}
