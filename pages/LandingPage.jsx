import React from 'react';

const brand = {
  glyphDark: '/assets/3339_101125_FLYP_BS-png-05.png',
  glyphLight: '/assets/3339_101125_FLYP_BS-png-04.png',
  icon: '/assets/3339_101125_FLYP_BS-png-06.png',
  hero: '/assets/3339_101125_FLYP_BS-jpg-01.jpg',
  heroSecondary: '/assets/3339_101125_FLYP_BS-jpg-04.jpg',
};

const stats = [
  { label: 'Networks on FLYP', value: '2,700+' },
  { label: 'Invoices synced / month', value: '1.3M' },
  { label: 'Replenishment latency drop', value: '42%' },
];

const heroPillars = [
  'Inventory autopilot',
  'Intelligent billing',
  'AI copilots for every role',
];

const featureGrid = [
  {
    title: 'Predictive load balancing',
    copy: 'Demand shifts are absorbed automatically with dynamic reorder points, per-lane routing and smart depot transfers.',
  },
  {
    title: 'CFO-grade billing guardrails',
    copy: 'Embedded GST, e-invoicing, POS, and AR reconciliation inside a single cockpit with full audit trails.',
  },
  {
    title: 'AI briefings every morning',
    copy: 'Every distributor, field exec, and retailer gets contextual nudges, risk alerts, and voice-ready tasking.',
  },
];

const capabilityPanels = [
  {
    title: 'Command Center OS',
    bullets: [
      'Live lane heatmaps & ATP inventory',
      'Scenario planning with one-click pushes',
      'Executive-grade insight streams',
    ],
    image: brand.heroSecondary,
  },
  {
    title: 'Commerce Stack',
    bullets: [
      'Unified billing, POS & GST workflows',
      'Integrated payouts & credit management',
      'Programmable policy controls per channel',
    ],
    image: brand.hero,
  },
  {
    title: 'Field Fusion Apps',
    bullets: [
      'Android & iOS native shells with offline mode',
      'Voice-ready copilots and WhatsApp automation',
      'Instant provisioning with biometric authentication',
    ],
    image: '/assets/3339_101125_FLYP_BS-png-03.png',
  },
];

const platformBadges = ['Android', 'iOS', 'Web', 'Voice', 'API'];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#010307] text-white">
      <div className="relative isolate overflow-hidden">
        <img
          src={brand.hero}
          alt="FLYP hero"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#02060F]/90 via-[#010307]/95 to-[#010307]" />

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 px-6 pt-8 pb-24">
          <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5/30 p-6 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={brand.icon}
                alt="FLYP logomark"
                className="h-14 w-14 rounded-2xl border border-white/10 bg-white/10 p-2"
              />
              <img src="/assets/flyp-logo.png" alt="FLYP wordmark" className="h-8 lg:h-10" />
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/login"
                className="rounded-full border border-white/30 px-6 py-2 text-xs uppercase tracking-[0.3em] text-white/80 hover:border-emerald-300"
              >
                Sign in
              </a>
              <a
                href="/register"
                className="rounded-full bg-emerald-400 px-6 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#010307]"
              >
                Launch FLYP
              </a>
            </div>
          </header>

          <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-8">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-[0.65rem] uppercase tracking-[0.4em] text-emerald-300">
                New FLYP Identity
              </p>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                The distribution OS that keeps every flow in a permanent state of <span className="text-emerald-300">FLYP</span>.
              </h1>
              <p className="text-lg text-white/85">
                A future-forward visual system anchored in signal-green gradients, high-contrast typography, and cinematic depth.
                The same intelligence trusted across India’s fastest moving consumer networks—now with a bold new surface.
              </p>
              <div className="flex flex-wrap gap-3">
                {heroPillars.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/15 px-4 py-1 text-xs uppercase tracking-[0.35em] text-white/70"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <article
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-[#030A13]/70 p-4 backdrop-blur"
                  >
                    <p className="text-2xl font-semibold text-emerald-300">{stat.value}</p>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">{stat.label}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative rounded-[32px] border border-emerald-300/30 bg-gradient-to-br from-[#022220]/60 via-[#03070F] to-[#010307] p-8 shadow-[0_35px_90px_rgba(0,0,0,0.55)]">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/60">
                <img src={brand.glyphDark} alt="FLYP glyph" className="h-12 w-12 rounded-2xl bg-white/5 p-3" />
                Signal Stack
              </div>
              <p className="mt-6 text-2xl font-semibold">
                Replens, billing, trade promotions, and compliance orchestrated by one identity-first cockpit.
              </p>
              <ul className="mt-6 space-y-4 text-sm text-white/75">
                <li>• Adaptive design language tuned for dark + light surfaces</li>
                <li>• Shared iconography powering Android, iOS, and web shells</li>
                <li>• Real-time alerts streaming through voice, chat, and dashboards</li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                {platformBadges.map((platform) => (
                  <span key={platform} className="rounded-full border border-white/15 px-4 py-1 text-[0.7rem] uppercase tracking-[0.35em] text-white/60">
                    {platform}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <section className="grid gap-6 md:grid-cols-3">
          {featureGrid.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-white/10 bg-[#050B16] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="mt-4 text-sm text-white/75">{feature.copy}</p>
            </article>
          ))}
        </section>

        <section className="mt-20 space-y-10">
          {capabilityPanels.map((panel) => (
            <article
              key={panel.title}
              className="grid gap-6 rounded-[32px] border border-white/10 bg-[#03070F] p-6 md:grid-cols-[0.9fr_1.1fr]"
            >
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-300">FLYP Stack</p>
                <h4 className="text-2xl font-semibold">{panel.title}</h4>
                <ul className="space-y-3 text-sm text-white/70">
                  {panel.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
              </div>
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <img src={panel.image} alt={panel.title} className="h-full w-full object-cover" />
              </div>
            </article>
          ))}
        </section>

        <section className="mt-20 rounded-[32px] border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 via-[#041019] to-[#010307] p-10 text-center">
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            <img src={brand.glyphLight} alt="FLYP inverse logo" className="mx-auto h-16 w-16" />
            <h2 className="text-3xl font-semibold">
              Powering the next decade of distribution with an identity built for velocity.
            </h2>
            <p className="text-white/80">
              Launch FLYP across Android, iOS, or the web and keep every stakeholder tethered to the same pulse—24x7, multilingual, voice-ready.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="/register" className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#02050B]">
                Start scaling
              </a>
              <a href="/demo" className="rounded-2xl border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white">
                See the overhaul
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs uppercase tracking-[0.4em] text-white/40">
        © {new Date().getFullYear()} FLYP • Brand system & product experience by StockPilot
      </footer>
    </div>
  );
};

export default LandingPage;