import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n, type MessageKey } from "@/lib/nextzen/i18n";

const LINKS: {
  to: "/" | "/gorev" | "/yazilim" | "/otomasyon" | "/sistem" | "/gecmis" | "/ayarlar";
  key: MessageKey;
  exact?: boolean;
}[] = [
  { to: "/", key: "nav.overview", exact: true },
  { to: "/gorev", key: "nav.new" },
  { to: "/yazilim", key: "nav.software" },
  { to: "/otomasyon", key: "nav.automation" },
  { to: "/sistem", key: "nav.systems" },
  { to: "/gecmis", key: "nav.history" },
  { to: "/ayarlar", key: "nav.settings" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <ul className="grid gap-1">
      {LINKS.map((link) => (
        <li key={link.to}>
          <Link
            to={link.to}
            activeOptions={{ exact: link.exact ?? false }}
            onClick={onNavigate}
            className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-muted transition-colors duration-150"
            activeProps={{
              className:
                "flex min-h-11 items-center rounded-sm bg-foreground/10 px-3 text-sm font-medium text-foreground transition-colors duration-150",
              "aria-current": "page",
            }}
          >
            {t(link.key)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
      >
        {t("skip")}
      </a>
      <div className="md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-border px-4 py-6 md:flex">
          <Link to="/" className="px-3 text-sm font-medium tracking-[0.18em] uppercase">
            {t("brand.kicker")}
          </Link>
          <nav aria-label={t("brand.kicker")}>
            <NavLinks />
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm md:hidden">
            <Link to="/" className="text-sm font-medium tracking-[0.18em] uppercase">
              {t("brand.kicker")}
            </Link>
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border"
                  aria-label={t("menu.open")}
                >
                  <Menu className="size-5" aria-hidden="true" />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,20rem)] flex-col gap-6 bg-card px-4 py-5 shadow-[var(--shadow)] pt-[max(1.25rem,env(safe-area-inset-top))]">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-sm font-medium tracking-[0.18em] uppercase">
                      {t("menu.title")}
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="inline-flex min-h-11 min-w-11 items-center justify-center"
                        aria-label={t("menu.close")}
                      >
                        <X className="size-5" aria-hidden="true" />
                      </button>
                    </Dialog.Close>
                  </div>
                  <nav aria-label={t("menu.title")}>
                    <NavLinks onNavigate={() => setOpen(false)} />
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </header>
          <main
            id="icerik"
            className="mx-auto w-full max-w-5xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-8 md:py-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
