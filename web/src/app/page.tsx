import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-5xl font-semibold tracking-tight text-brand-900">
        Canvas AI for Teachers
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        Teacher-first AI workflows that live inside Canvas LMS. Install the
        Chrome extension, connect your class, and start drafting assignments,
        rebuilding units, and surfacing at-risk students with a tap.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/connect"
          className="rounded-md bg-brand-700 px-4 py-2 text-white hover:bg-brand-900"
        >
          Connect a Canvas class
        </Link>
        <a
          href="https://chromewebstore.google.com/"
          className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:border-slate-400"
        >
          Install Chrome extension
        </a>
      </div>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <Feature
          title="Whole-course rebuild"
          body="Regenerate a unit around new standards while keeping your rubric voice. ~100 Canvas API calls in ~45 seconds."
        />
        <Feature
          title="Class risk radar"
          body="AI reads analytics + submissions and surfaces at-risk students with pre-drafted outreach."
        />
        <Feature
          title="Rubric-locked feedback"
          body="Bulk SpeedGrader feedback, every comment tied to a specific rubric criterion with cited text."
        />
      </section>

      <footer className="mt-24 border-t border-slate-200 pt-8 text-sm text-slate-500">
        Hackathon build — LA Hacks 2026
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <h3 className="font-medium text-brand-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}
