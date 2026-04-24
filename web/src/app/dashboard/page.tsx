// Dashboard home. Cross-course overview. Every control here is tap-only.
// For blocked flows that absolutely require text, link out to the ✏ Other…
// escape hatch defined in the bubble tree component.

import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-900">Dashboard</h1>
        <Link
          href="/connect"
          className="text-sm text-brand-700 hover:underline"
        >
          Manage connections
        </Link>
      </header>

      <section className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <CoursesCard />
        <RiskRadarCard />
        <ActionsCard />
      </section>
    </main>
  );
}

function CoursesCard() {
  return (
    <article className="rounded-lg border border-slate-200 p-5">
      <h2 className="font-medium text-brand-900">My classes</h2>
      <p className="mt-2 text-sm text-slate-500">
        (placeholder) — will list Canvas courses with scan status & quality
        score.
      </p>
    </article>
  );
}

function RiskRadarCard() {
  return (
    <article className="rounded-lg border border-slate-200 p-5">
      <h2 className="font-medium text-brand-900">Class risk radar</h2>
      <p className="mt-2 text-sm text-slate-500">
        (placeholder) — summary of at-risk students across all classes.
      </p>
    </article>
  );
}

function ActionsCard() {
  return (
    <article className="rounded-lg border border-slate-200 p-5">
      <h2 className="font-medium text-brand-900">Recent actions</h2>
      <p className="mt-2 text-sm text-slate-500">
        (placeholder) — last 10 AI actions with preview & re-run option.
      </p>
    </article>
  );
}
