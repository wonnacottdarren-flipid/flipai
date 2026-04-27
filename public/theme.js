document.addEventListener("DOMContentLoaded", () => {
  console.log("FlipAI theme.js loaded");

  injectThemeStyles();
  applyFuturisticClasses();
});

// =========================
// INJECT GLOBAL STYLES
// =========================
function injectThemeStyles() {
  const style = document.createElement("style");

  style.innerHTML = `
    :root {
      --neon-blue: #4f8cff;
      --neon-green: #22c55e;
      --neon-purple: #a855f7;
      --glass-bg: rgba(15, 23, 42, 0.65);
      --glass-border: rgba(255,255,255,0.08);
      --blur: blur(14px);
    }

    body {
      background: radial-gradient(circle at 20% 20%, #0f172a, #020617 80%);
      color: #e2e8f0;
    }

    /* GLASS CARDS */
    .deal-card,
    .analysis-shell,
    .analysis-main-card,
    .analysis-side-card,
    .analysis-stat-card {
      background: var(--glass-bg);
      backdrop-filter: var(--blur);
      border: 1px solid var(--glass-border);
      border-radius: 18px;
      transition: all 0.25s ease;
    }

    .deal-card:hover,
    .analysis-main-card:hover,
    .analysis-side-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 40px rgba(79,140,255,0.15);
    }

    /* BUTTONS */
    button {
      background: linear-gradient(135deg, #4f8cff, #22c55e);
      border: none;
      border-radius: 10px;
      color: white;
      padding: 10px 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 12px rgba(79,140,255,0.6);
    }

    /* DEAL TYPE BADGES */
    .deal-type-banner.buy {
      background: rgba(34,197,94,0.15);
      color: var(--neon-green);
    }

    .deal-type-banner.offer {
      background: rgba(79,140,255,0.15);
      color: var(--neon-blue);
    }

    .deal-type-banner.tight {
      background: rgba(245,158,11,0.15);
      color: #f59e0b;
    }

    /* PROFIT */
    .profit-pill.strong {
      color: var(--neon-green);
    }

    /* RISK */
    .risk-pill.low {
      color: var(--neon-green);
    }

    .risk-pill.medium {
      color: #f59e0b;
    }

    .risk-pill.high {
      color: #f87171;
    }

    /* GLOW TEXT */
    .analysis-profit-value {
      text-shadow: 0 0 12px rgba(34,197,94,0.6);
    }

    .analysis-verdict-value {
      text-shadow: 0 0 10px rgba(79,140,255,0.6);
    }

    /* INPUTS */
    input, select, textarea {
      background: rgba(2,6,23,0.6);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      color: white;
      padding: 8px;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--neon-blue);
      box-shadow: 0 0 8px rgba(79,140,255,0.4);
    }

    /* SCROLLBAR */
    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(79,140,255,0.5);
      border-radius: 10px;
    }
  `;

  document.head.appendChild(style);
}

// =========================
// APPLY CLASSES SAFELY
// =========================
function applyFuturisticClasses() {
  document.querySelectorAll(".deal-card").forEach(card => {
    card.classList.add("futuristic-card");
  });

  document.querySelectorAll(".analysis-shell").forEach(card => {
    card.classList.add("futuristic-card");
  });
}
