import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#B8FF65" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Saira+Condensed:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --dispatch-bg: #050816;
            --dispatch-grid: rgba(97, 216, 255, 0.08);
            --dispatch-display: "Saira Condensed", Impact, sans-serif;
            --dispatch-body: "Fraunces", Georgia, serif;
          }

          html, body {
            background:
              radial-gradient(circle at top right, rgba(97, 216, 255, 0.16), transparent 32%),
              radial-gradient(circle at bottom left, rgba(255, 122, 69, 0.12), transparent 30%),
              linear-gradient(180deg, #08111f, var(--dispatch-bg));
            color: #e9f2ff;
            font-family: var(--dispatch-body);
            margin: 0;
            min-height: 100%;
          }

          body::before {
            background-image:
              linear-gradient(var(--dispatch-grid) 1px, transparent 1px),
              linear-gradient(90deg, var(--dispatch-grid) 1px, transparent 1px);
            background-size: 44px 44px;
            content: "";
            inset: 0;
            opacity: 0.24;
            pointer-events: none;
            position: fixed;
            z-index: 0;
          }

          #root, body > div {
            position: relative;
            z-index: 1;
          }

          h1, h2, h3, h4, h5, h6 {
            font-family: var(--dispatch-display);
            letter-spacing: 0.04em;
          }
        `}</style>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
