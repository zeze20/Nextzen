import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/nextzen/app-shell";
import { HistoryProvider, SettingsProvider } from "@/lib/nextzen/history";
import appCss from "../styles.css?url";

const THEME_BOOT = `(function(){try{var raw=localStorage.getItem("nextzen.settings.v1");var s=raw?JSON.parse(raw):{};var theme=s.theme||"system";var dark=theme==="dark"||(theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.lang=s.language==="en"?"en":"tr";document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Nextzen" },
      {
        name: "description",
        content: "Yazılım, otomasyon ve sistem yönetimi için riski etiketli görev konsolu.",
      },
      { name: "theme-color", content: "#f3f2ef", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#10110f", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <SettingsProvider>
            <HistoryProvider>
              <AppShell>
                <Outlet />
              </AppShell>
            </HistoryProvider>
          </SettingsProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
