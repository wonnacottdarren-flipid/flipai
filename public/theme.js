document.addEventListener("DOMContentLoaded", () => {
  console.log("FlipAI theme.js loaded");

  injectThemeStyles();
  injectLogo();
  applyFuturisticClasses();
});

// =========================
// INJECT GLOBAL STYLES
// =========================
function injectThemeStyles() {
  const existing = document.getElementById("flipai-theme-styles");
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.id = "flipai-theme-styles";

  style.innerHTML = `
    :root {
      --flipai-teal: #19e6b3;
      --flipai-teal-soft: rgba(25, 230, 179, 0.16);
      --flipai-teal-border: rgba(25, 230, 179, 0.34);
      --flipai-blue: #4f8cff;
      --flipai-purple: #a855f7;
      --flipai-dark: #020617;
      --flipai-glass: rgba(7, 14, 28, 0.72);
      --flipai-glass-strong: rgba(10, 18, 35, 0.88);
      --flipai-border: rgba(255, 255, 255, 0.1);
      --flipai-glow: 0 0 30px rgba(25, 230, 179, 0.18);
    }

    body {
      background:
        radial-gradient(circle at 18% 8%, rgba(25, 230, 179, 0.16), transparent 28%),
        radial-gradient(circle at 85% 12%, rgba(79, 140, 255, 0.13), transparent 24%),
        radial-gradient(circle at 50% 100%, rgba(168, 85, 247, 0.1), transparent 30%),
        linear-gradient(180deg, #020617 0%, #07111f 48%, #020617 100%) !important;
      color: #e5f7ff;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0.75), transparent 75%);
      z-index: -1;
    }

    .topbar {
      padding: 14px 0 34px;
    }

    .brand {
      gap: 14px;
    }

    .brand-mark {
      width: 64px !important;
      height: 64px !important;
      border-radius: 999px !important;
      background:
        radial-gradient(circle at 50% 45%, rgba(255,255,255,0.08), transparent 45%),
        #020617 !important;
      border: 2px solid var(--flipai-teal) !important;
      box-shadow:
        0 0 22px rgba(25, 230, 179, 0.42),
        0 0 60px rgba(25, 230, 179, 0.16) !important;
      overflow: hidden;
      color: transparent !important;
      font-size: 0 !important;
    }

    .flipai-logo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 999px;
    }

    .brand > div:last-child > div:first-child {
      font-size: 24px;
      letter-spacing: -0.4px;
      color: #ffffff;
      text-shadow: 0 0 16px rgba(25, 230, 179, 0.28);
    }

    .brand-sub {
      color: rgba(229, 247, 255, 0.68) !important;
      letter-spacing: 0.5px;
    }

    .chip-link {
      background: rgba(7, 14, 28, 0.72) !important;
      border-color: rgba(25, 230, 179, 0.16) !important;
      color: rgba(229, 247, 255, 0.74) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }

    .chip-link:hover {
      color: #ffffff !important;
      background: rgba(25, 230, 179, 0.1) !important;
      border-color: var(--flipai-teal-border) !important;
      box-shadow: 0 0 18px rgba(25, 230, 179, 0.14);
    }

    .hero-main,
    .hero-side,
    .card,
    .feature-card,
    .pricing-card,
    .mini-card,
    .deal-card,
    .analysis-main-card,
    .analysis-side-card,
    .analysis-stat-card,
    .analysis-note-card,
    .analysis-title-card,
    .comps-helper-card,
    .finder-summary-box {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025)),
        var(--flipai-glass) !important;
      border: 1px solid rgba(25, 230, 179, 0.14) !important;
      box-shadow:
        0 22px 70px rgba(0, 0, 0, 0.34),
        0 0 34px rgba(25, 230, 179, 0.055) !important;
      backdrop-filter: blur(16px) !important;
    }

    .hero-main {
      border-color: rgba(25, 230, 179, 0.26) !important;
    }

    .hero-main::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(120deg, transparent 0%, rgba(25,230,179,0.08) 45%, transparent 70%);
      transform: translateX(-70%);
      animation: flipaiSweep 7s ease-in-out infinite;
      pointer-events: none;
    }

    .hero-main::after {
      background: radial-gradient(circle, rgba(25,230,179,0.28), transparent 68%) !important;
    }

    .eyebrow,
    .pricing-badge,
    .confidence-pill,
    .deal-badge {
      background: var(--flipai-teal-soft) !important;
      border-color: var(--flipai-teal-border) !important;
      color: #bfffee !important;
    }

    .hero h1 {
      color: #ffffff;
      text-shadow:
        0 0 18px rgba(25, 230, 179, 0.18),
        0 0 42px rgba(79, 140, 255, 0.08);
    }

    .hero p,
    .hero-point,
    .account-subline,
    .section-subtitle,
    .feature-card p,
    .deal-subtitle,
    .deal-summary {
      color: rgba(229, 247, 255, 0.72) !important;
    }

    .hero-point,
    .hero-stat,
    .account-stat,
    .metric,
    .deal-highlight,
    .deal-metric,
    .offer-stat,
    .panel,
    .reasoning {
      background: rgba(2, 6, 23, 0.42) !important;
      border-color: rgba(25, 230, 179, 0.11) !important;
    }

    button,
    .hero-cta.primary,
    .find-deals-btn,
    .deal-actions button {
      background: linear-gradient(135deg, #16d9a7, #4f8cff) !important;
      color: #ffffff !important;
      box-shadow:
        0 14px 34px rgba(25, 230, 179, 0.18),
        0 0 24px rgba(79, 140, 255, 0.12) !important;
    }

    .secondary-btn,
    .hero-cta.secondary,
    .deal-actions a {
      background: rgba(7, 14, 28, 0.72) !important;
      border: 1px solid rgba(25, 230, 179, 0.16) !important;
      color: #e5f7ff !important;
    }

    button:hover,
    .hero-cta:hover,
    .deal-actions a:hover {
      transform: translateY(-2px);
      box-shadow:
        0 18px 44px rgba(25, 230, 179, 0.22),
        0 0 28px rgba(25, 230, 179, 0.22) !important;
    }

    input,
    select,
    textarea {
      background: rgba(2, 6, 23, 0.68) !important;
      border-color: rgba(25, 230, 179, 0.16) !important;
      color: #ffffff !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
    }

    input:focus,
    textarea:focus,
    select:focus {
      border-color: rgba(25, 230, 179, 0.58) !important;
      box-shadow:
        0 0 0 4px rgba(25, 230, 179, 0.11),
        0 0 18px rgba(25, 230, 179, 0.16) !important;
    }

    .analysis-profit-value,
    .deal-price,
    .plan-price,
    .finder-summary-box .value {
      text-shadow: 0 0 16px rgba(25, 230, 179, 0.28);
    }

    .deal-card:hover,
    .card:hover,
    .pricing-card:hover,
    .feature-card:hover,
    .mini-card:hover {
      border-color: rgba(25, 230, 179, 0.28) !important;
      transform: translateY(-2px);
    }

    .deal-card::before {
      background: linear-gradient(90deg, rgba(25,230,179,0.95), rgba(79,140,255,0.75)) !important;
    }

    .deal-type-banner.buy,
    .decision-pill.buy,
    .label-buy {
      background: rgba(25, 230, 179, 0.14) !important;
      border-color: rgba(25, 230, 179, 0.34) !important;
      color: #bfffee !important;
    }

    .deal-type-banner.offer,
    .decision-pill.offer,
    .label-offer {
      background: rgba(79, 140, 255, 0.14) !important;
      border-color: rgba(79, 140, 255, 0.34) !important;
      color: #cfe0ff !important;
    }

    .profit-pill.strong,
    .risk-pill.low {
      color: #bfffee !important;
      background: rgba(25, 230, 179, 0.12) !important;
      border-color: rgba(25, 230, 179, 0.3) !important;
    }

    .footer {
      color: rgba(229, 247, 255, 0.52) !important;
    }

    ::-webkit-scrollbar {
      width: 9px;
      height: 9px;
    }

    ::-webkit-scrollbar-track {
      background: #020617;
    }

    ::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, rgba(25,230,179,0.68), rgba(79,140,255,0.55));
      border-radius: 999px;
    }

    @keyframes flipaiSweep {
      0%, 100% {
        transform: translateX(-85%);
        opacity: 0;
      }
      45%, 55% {
        opacity: 1;
      }
      70% {
        transform: translateX(85%);
        opacity: 0;
      }
    }
  `;

  document.head.appendChild(style);
}

// =========================
// LOGO
// =========================
function injectLogo() {
  const brandMark = document.querySelector(".brand-mark");
  if (!brandMark) return;

  brandMark.innerHTML = "";

  const img = document.createElement("img");
  img.src = "/logo.png";
  img.alt = "FlipAI logo";
  img.className = "flipai-logo-img";

  img.onerror = () => {
    brandMark.textContent = "F";
    brandMark.style.color = "#ffffff";
    brandMark.style.fontSize = "28px";
    brandMark.style.fontWeight = "900";
  };

  brandMark.appendChild(img);
}

// =========================
// APPLY CLASSES SAFELY
// =========================
function applyFuturisticClasses() {
  document.body.classList.add("flipai-futuristic-theme");

  document.querySelectorAll(".deal-card").forEach((card) => {
    card.classList.add("futuristic-card");
  });

  document.querySelectorAll(".analysis-shell").forEach((card) => {
    card.classList.add("futuristic-card");
  });
}
