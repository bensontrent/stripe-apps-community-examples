import Link from 'next/link';
import SetupChecklist from '@/components/SetupChecklist';

// Home page. The setup checklist only renders while the run-once scaffolding
// folder (delete_me_after_setup/) exists on a dev server — once the project
// is configured, visitors just see the hero and feature overview.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12 sm:py-20">
      <SetupChecklist />

      <section className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        <span className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
          Next.js · Better Auth · Supabase · Stripe
        </span>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-black sm:text-4xl dark:text-zinc-50">
          A community backend template for Stripe Apps
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Email + password sessions with Better Auth, data in Supabase, verified
          signed requests from your app&apos;s Dashboard UI extension, and docs
          rendered straight from Markdown — ready to copy into your own app.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#635BFF] px-6 text-sm font-medium text-white transition-colors hover:bg-[#5348e8]"
          >
            Read the docs
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/[.08] px-6 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.06]"
          >
            Manage your account
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: 'Auth & sessions',
            body: 'Better Auth issues cookie sessions backed by Supabase Postgres; /account and the protected API routes rely on them.',
          },
          {
            title: 'Stripe App handshake',
            body: 'The proxy verifies stripe-signature headers, so requests from your app’s UI extension arrive pre-authenticated.',
          },
          {
            title: 'Docs from Markdown',
            body: 'Every file in src/content/docs becomes a page under /docs, rendered with Markdoc — sidebar and headings included.',
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-black/[.08] p-6 dark:border-white/[.145]"
          >
            <h2 className="text-base font-semibold text-black dark:text-zinc-50">
              {feature.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {feature.body}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
