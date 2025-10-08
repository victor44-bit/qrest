// app/landing/page.tsx
"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-neutral-50 to-neutral-200 text-neutral-900">
      {/* Hero Section */}
      <header className="px-6 py-6 border-b border-neutral-200 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-900 text-white font-bold">
              Q
            </div>
            <span className="font-semibold text-lg">Qrest</span>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-100"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow hover:shadow-md"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
          Crowd-build ideas. One sentence at a time.
        </h1>
        <p className="mt-4 text-lg text-neutral-600 max-w-2xl">
          Qrest is where people spark conversations, expand ideas, and co-create
          solutions. Start a chain and watch it grow with contributions from
          others.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-neutral-900 px-6 py-3 text-white font-medium hover:shadow-lg"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-neutral-300 bg-white px-6 py-3 font-medium hover:bg-neutral-100"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 px-6">
        <div className="mx-auto max-w-6xl grid md:grid-cols-3 gap-10 text-center">
          {[
            {
              title: "Collaborate Instantly",
              desc: "Post a seed idea, and others continue it with one-liners that keep the chain moving.",
            },
            {
              title: "Engaging & Fun",
              desc: "Like contributions, follow the best threads, and discover where creativity leads.",
            },
            {
              title: "Build Together",
              desc: "Turn small sparks into big projects through collective brainstorming.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition"
            >
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-neutral-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="py-20 px-6 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold">Why Qrest?</h2>
          <p className="mt-4 text-lg text-neutral-600">
            In a world of endless scrolling, Qrest creates space for thoughtful,
            sentence-sized contributions. It’s brainstorming made social,
            accessible, and fun.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-neutral-100 py-16 px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-center">Frequently Asked Questions</h2>
          <div className="mt-8 space-y-6">
            {[
              {
                q: "Is Qrest free?",
                a: "Yes! You can sign up and start collaborating without cost.",
              },
              {
                q: "What makes Qrest different?",
                a: "It’s built for quick, one-line contributions that add up to meaningful chains of thought.",
              },
              {
                q: "Can I invite friends?",
                a: "Absolutely. The more people who join your chain, the richer the ideas become.",
              },
            ].map((faq) => (
              <div key={faq.q} className="p-4 rounded-xl border bg-white shadow-sm">
                <h3 className="font-semibold">{faq.q}</h3>
                <p className="text-neutral-600 mt-1">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <footer className="py-20 text-center">
        <h2 className="text-2xl font-bold">Ready to start your first chain?</h2>
        <div className="mt-5 flex gap-3 justify-center">
          <Link
            href="/signup"
            className="rounded-xl bg-neutral-900 px-6 py-3 text-white font-medium hover:shadow-lg"
          >
            Sign up free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-neutral-300 bg-white px-6 py-3 font-medium hover:bg-neutral-100"
          >
            Log in
          </Link>
        </div>
        <p className="mt-6 text-sm text-neutral-500">
          © {new Date().getFullYear()} Qrest. Built for collaborative thinkers.
        </p>
      </footer>
    </div>
  );
}
