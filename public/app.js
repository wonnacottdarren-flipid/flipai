document.addEventListener("DOMContentLoaded", () => {
  console.log("FlipAI app.js loaded");

  const analyzeBtn = document.getElementById("analyzeBtn");
  const autoCompsBtn = document.getElementById("autoCompsBtn");
  const statusEl = document.getElementById("status");
  const autoCompsStatusEl = document.getElementById("autoCompsStatus");
  const resultArea = document.getElementById("resultArea");
  const compsHelperArea = document.getElementById("compsHelperArea");

  const authArea = document.getElementById("authArea");
  const userArea = document.getElementById("userArea");
  const userEmailEl = document.getElementById("userEmail");
  const authStatusEl = document.getElementById("authStatus");

  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const starterBtn = document.getElementById("starterBtn");
  const proBtn = document.getElementById("proBtn");
  const billingBtn = document.getElementById("billingBtn");
  const planValueEl = document.getElementById("planValue");
  const usageValueEl = document.getElementById("usageValue");
  const remainingValueEl = document.getElementById("remainingValue");
  const accountSublineEl = document.getElementById("accountSubline");

  const findDealsBtn = document.getElementById("findDealsBtn");
  const findBestDealsBtn = document.getElementById("findBestDealsBtn");
  const clearDealResultsBtn = document.getElementById("clearDealResultsBtn");
  const dealStatusEl = document.getElementById("dealStatus");
  const finderStatusEl = document.getElementById("finderStatus");
  const dealResultsEl = document.getElementById("dealResults");
  const finderResultsEl = document.getElementById("finderResults");
  const showTightDealsCheckbox = document.getElementById("showTightDeals");

  window.__lastFinderResponse = null;
  window.__lastFinderQueryRan = false;
  window.__lastDeals = [];
  window.__lastFoundDeals = [];

  function currency(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return "£0.00";
    return "£" + amount.toFixed(2);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function roundCurrencyValue(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  async function safeReadResponse(res) {
    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    if (!rawText) {
      return { data: {}, rawText: "" };
    }

    if (contentType.includes("application/json")) {
      try {
        return {
          data: JSON.parse(rawText),
          rawText
        };
      } catch {
        return {
          data: { error: rawText },
          rawText
        };
      }
    }

    try {
      return {
        data: JSON.parse(rawText),
        rawText
      };
    } catch {
      return {
        data: { error: rawText },
        rawText
      };
    }
  }

  function getResponseErrorMessage(res, data, fallbackMessage) {
    const message = data?.error || data?.message || data?.raw || "";

    if (message) {
      const clean = String(message).trim();
      if (clean.toLowerCase().includes("service unavailable")) {
        return "FlipAI is temporarily unavailable. Please try again shortly.";
      }
      return clean;
    }

    if (res.status >= 500) {
      return "FlipAI is temporarily unavailable. Please try again shortly.";
    }

    return fallbackMessage;
  }

  function setAnalyzeStatus(message, type) {
    if (!statusEl) return;
    statusEl.innerHTML = message
      ? `<div class="status ${escapeHtml(type)}">${escapeHtml(message)}</div>`
      : "";
  }

  function setAutoCompsStatus(message, type) {
    if (!autoCompsStatusEl) return;
    autoCompsStatusEl.innerHTML = message
      ? `<div class="status ${escapeHtml(type)}">${escapeHtml(message)}</div>`
      : "";
  }

  function setDealStatus(message, type) {
    if (!dealStatusEl) return;
    dealStatusEl.innerHTML = message
      ? `<div class="status ${escapeHtml(type)}">${escapeHtml(message)}</div>`
      : "";
  }

  function setFinderStatus(message, type) {
    if (!finderStatusEl) return;
    finderStatusEl.innerHTML = message
      ? `<div class="status ${escapeHtml(type)}">${escapeHtml(message)}</div>`
      : "";
  }

  function setAuthStatus(message, type) {
    if (!authStatusEl) return;
    authStatusEl.innerHTML = message
      ? `<div class="status ${escapeHtml(type)}">${escapeHtml(message)}</div>`
      : "";
  }

  function clearCompsHelper() {
    if (compsHelperArea) {
      compsHelperArea.innerHTML = "";
    }
  }

  function verdictColor(text) {
    const value = String(text || "").toUpperCase();

    if (value.includes("BUY")) return "#4ade80";
    if (value.includes("GOOD")) return "#4ade80";
    if (value.includes("OK")) return "#4ade80";
    if (value.includes("MARGINAL")) return "#f59e0b";
    if (value.includes("TIGHT")) return "#f59e0b";
    if (value.includes("SKIP")) return "#f87171";
    if (value.includes("AVOID")) return "#f87171";
    if (value.includes("BAD")) return "#f87171";

    return "#e2e8f0";
  }

  function scannerVerdictColor(text) {
    return verdictColor(text);
  }

  function getRiskClass(risk) {
    const value = String(risk || "").toLowerCase();
    if (value.includes("low")) return "low";
    if (value.includes("medium")) return "medium";
    return "high";
  }

  function getProfitClass(profit) {
    const value = Number(profit || 0);
    if (value >= 40) return "strong";
    if (value >= 15) return "mid";
    return "weak";
  }

  function getDealTypeClass(finderLabel) {
    const label = String(finderLabel || "").toLowerCase();
    if (label.includes("offer")) return "offer";
    if (label.includes("tight")) return "tight";
    return "buy";
  }

  function getDealTypeLabel(finderLabel) {
    const label = String(finderLabel || "").toLowerCase();
    if (label.includes("offer")) return "Offer target";
    if (label.includes("tight")) return "Tight check";
    if (label.includes("buy")) return "Strong buy";
    return "Review";
  }

  function normalizeOfferType(value) {
    const text = String(value || "").trim();
    if (!text) return "";

    return text
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getDecisionText(deal) {
    const label = String(deal?.finderLabel || "").toLowerCase();

    if (label.includes("offer")) return "Offer";
    if (label.includes("tight")) return "Skip unless checked";
    if (label.includes("buy")) return "Buy";

    return "Review";
  }

  function getDecisionSubline(deal) {
    const label = String(deal?.finderLabel || "").toLowerCase();

    if (label.includes("offer")) {
      return "This looks stronger below asking price than as a straight buy.";
    }

    if (label.includes("tight")) {
      return "Margin is borderline, so check condition and comps carefully first.";
    }

    if (label.includes("buy")) {
      return "This price looks strong enough to review as a potential buy now.";
    }

    return "Use the analyzer to confirm the numbers before acting.";
  }

  function getPrimaryActionLabel(deal) {
    const label = String(deal?.finderLabel || "").toLowerCase();

    if (label.includes("buy")) return "Analyze this Buy";
    if (label.includes("offer")) return "Review Offer Route";
    if (label.includes("tight")) return "Check Before Buying";

    return "Send to Analyzer";
  }

  function getListingActionLabel(deal) {
    const label = String(deal?.finderLabel || "").toLowerCase();
    if (label.includes("offer")) return "Open Listing to Negotiate";
    return "Open Listing";
  }

  function buildConfidenceText(deal) {
    const label = deal?.confidenceLabel || "Confidence";
    const score = Number(deal?.confidence || 0);
    if (!score && !deal?.confidenceLabel) return "";
    return `${label}${score ? ` (${score})` : ""}`;
  }

  function getPayload() {
    return {
      product: document.getElementById("product").value.trim(),
      condition: document.getElementById("condition").value.trim(),
      buyPrice: Number(document.getElementById("buyPrice").value || 0),
      repairCost: Number(document.getElementById("repairCost").value || 0),
      manualSoldPrices: document.getElementById("manualSoldPrices").value.trim(),
      extras: document.getElementById("extras").value.trim(),
      goal: document.getElementById("goal").value
    };
  }

  function getAutoCompsPayload() {
    return {
      product: document.getElementById("product").value.trim(),
      condition: document.getElementById("condition").value.trim()
    };
  }

  function getDealFinderPayload() {
    return {
      query: document.getElementById("dealKeyword").value.trim(),
      condition: document.getElementById("dealCondition").value.trim(),
      filterPriceMax: Number(document.getElementById("dealMaxPrice").value || 0),
      limit: 8,
      freeShippingOnly: document.getElementById("freeShippingOnly").value === "true"
    };
  }

  function getFindDealsPayload() {
    return {
      query: document.getElementById("dealKeyword").value.trim(),
      condition: document.getElementById("dealCondition").value.trim(),
      filterPriceMax: Number(document.getElementById("dealMaxPrice").value || 0),
      limit: 30,
      topN: 8,
      freeShippingOnly: document.getElementById("freeShippingOnly").value === "true",
      includeTightDeals: Boolean(showTightDealsCheckbox?.checked)
    };
  }

  function getCredentials() {
    return {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    };
  }

  function renderCompsHelperCard(options = {}) {
    const title = options.title || "Auto comps summary";
    const compCount = Number(options.compCount || 0);
    const confidence = Number(options.confidence || 0);
    const confidenceLabel = options.confidenceLabel || "Low";
    const pricingMode = options.pricingMode || "Auto comps estimate";
    const searchQuery = options.searchQuery || "N/A";
    const avgSoldPrice = Number(options.avgSoldPrice || 0);
    const medianSoldPrice = Number(options.medianSoldPrice || 0);
    const minSoldPrice = Number(options.minSoldPrice || 0);
    const maxSoldPrice = Number(options.maxSoldPrice || 0);
    const isWarning = Boolean(options.isWarning);

    const helperNote = isWarning
      ? "No sold comps were connected on this run. Try a shorter product title or manually review likely sold prices before relying on the estimate."
      : "These sold comps were connected and copied into the comp prices box. You can still edit them manually before running the analyzer.";

    return `
      <div class="comps-helper-card ${isWarning ? "warning-state" : ""}">
        <div class="comps-helper-kicker">${escapeHtml(title)}</div>

        <div class="comps-helper-grid">
          <div class="comps-helper-stat">
            <div class="comps-helper-stat-label">Comps found</div>
            <div class="comps-helper-stat-value">${compCount}</div>
            <div class="comps-helper-stat-subvalue">${escapeHtml(pricingMode)}</div>
          </div>

          <div class="comps-helper-stat">
            <div class="comps-helper-stat-label">Confidence</div>
            <div class="comps-helper-stat-value">${escapeHtml(confidenceLabel)} (${confidence})</div>
            <div class="comps-helper-stat-subvalue">Query used: ${escapeHtml(searchQuery)}</div>
          </div>

          <div class="comps-helper-stat">
            <div class="comps-helper-stat-label">Median sold</div>
            <div class="comps-helper-stat-value">${currency(medianSoldPrice)}</div>
            <div class="comps-helper-stat-subvalue">Average sold: ${currency(avgSoldPrice)}</div>
          </div>

          <div class="comps-helper-stat">
            <div class="comps-helper-stat-label">Sold range</div>
            <div class="comps-helper-stat-value">${currency(minSoldPrice)} - ${currency(maxSoldPrice)}</div>
            <div class="comps-helper-stat-subvalue">${compCount > 0 ? "Connected sold comps" : "No connected comps yet"}</div>
          </div>
        </div>

        <div class="comps-helper-note">
          <strong>What this means:</strong> ${escapeHtml(helperNote)}
        </div>
      </div>
    `;
  }

  function renderLockedState(message, options = {}) {
    const showStarter = Boolean(options.showStarter);
    const showPro = Boolean(options.showPro);

    resultArea.innerHTML = `
      <div class="locked-box">
        <h3>Unlock more FlipAI capacity</h3>
        <p>${escapeHtml(message)}</p>
        ${showStarter ? `<button class="upgrade-btn" onclick="window.startCheckout('starter')">Upgrade to Starter - £5/month</button>` : ""}
        ${showPro ? `<button class="upgrade-btn" onclick="window.startCheckout('pro')">Upgrade to Pro - £20/month</button>` : ""}
      </div>
    `;
  }

  function renderResult(data) {
    const result = data.result || {};
    const metrics = result.flipMetrics || {};
    const sold = result.manualSoldComps || metrics.soldComps || {};
    const analysis = result.flip_analysis || {};
    const listing = result.ebay_listing || {};

    const verdictText = metrics.verdict || analysis.final_verdict || "Review";
    const profitValue = Number(metrics.profit ?? analysis.net_profit ?? 0);
    const totalCostValue = Number(metrics.totalCost ?? analysis.costs ?? analysis.buy_price ?? 0);
    const estimatedResaleValue = Number(metrics.estimatedResale ?? analysis.sale_price ?? listing.quick_sale_price ?? 0);
    const ebayFeesValue = Number(metrics.ebayFees ?? analysis.fees ?? 0);
    const buyPriceValue = Number(analysis.buy_price ?? 0);
    const repairCostText = analysis.estimated_repair_or_refurbishment_cost || "";
    const compCount = Number(sold.compCount || 0);
    const confidenceValue = Number(sold.confidence || 0);
    const confidenceLabel = sold.confidenceLabel || "Low";
    const pricingMode = metrics.pricingMode || sold.pricingMode || "AI analysis";
    const riskText = analysis.risk_level || "N/A";
    const sellSpeedText = analysis.time_to_sell_estimate || "N/A";

    const confidenceDisplay = `${confidenceLabel} (${confidenceValue})`;
    const compSummary =
      compCount > 0
        ? `${compCount} comp${compCount === 1 ? "" : "s"} used`
        : "AI estimate from provided comps";

    resultArea.innerHTML = `
      <div class="analysis-shell">
        <div class="analysis-hero">
          <div class="analysis-main-card">
            <div class="analysis-kicker">Projected profit</div>
            <div class="analysis-profit-value">${currency(profitValue)}</div>
            <div class="analysis-profit-subline">
              Based on estimated resale, fees, buy price, and repair cost.
            </div>
          </div>

          <div class="analysis-side-card">
            <div class="analysis-kicker">Current verdict</div>
            <div class="analysis-verdict-value" style="color:${verdictColor(verdictText)};">
              ${escapeHtml(verdictText)}
            </div>
            <div class="analysis-verdict-subline">
              FlipAI’s overall read using profit, pricing confidence, risk, and resale assumptions.
            </div>
          </div>
        </div>

        <div class="analysis-stat-grid">
          <div class="analysis-stat-card">
            <div class="analysis-stat-label">Total cost</div>
            <div class="analysis-stat-value">${currency(totalCostValue)}</div>
            <div class="analysis-stat-subvalue">Buy price ${currency(buyPriceValue)}${repairCostText ? ` • Repair ${escapeHtml(repairCostText)}` : ""}</div>
          </div>

          <div class="analysis-stat-card">
            <div class="analysis-stat-label">Estimated resale</div>
            <div class="analysis-stat-value">${currency(estimatedResaleValue)}</div>
            <div class="analysis-stat-subvalue">Modelled resale value</div>
          </div>

          <div class="analysis-stat-card">
            <div class="analysis-stat-label">eBay fees</div>
            <div class="analysis-stat-value">${currency(ebayFeesValue)}</div>
            <div class="analysis-stat-subvalue">Estimated platform fees</div>
          </div>

          <div class="analysis-stat-card">
            <div class="analysis-stat-label">Pricing mode</div>
            <div class="analysis-stat-value">${escapeHtml(pricingMode)}</div>
            <div class="analysis-stat-subvalue">${escapeHtml(compSummary)}</div>
          </div>
        </div>

        <div class="analysis-note-grid">
          <div class="analysis-note-card">
            <div class="analysis-note-title">Risk and speed</div>
            <div class="analysis-note-body">
              <strong>Risk:</strong> ${escapeHtml(riskText)}<br>
              <strong>Time to sell:</strong> ${escapeHtml(sellSpeedText)}
            </div>
          </div>

          <div class="analysis-note-card">
            <div class="analysis-note-title">Comp confidence</div>
            <div class="analysis-note-body">
              <strong>Confidence:</strong> ${escapeHtml(confidenceDisplay)}<br>
              <strong>Comps used:</strong> ${compCount}
            </div>
          </div>
        </div>

        ${
          compCount > 0
            ? `
              <div class="analysis-note-card">
                <div class="analysis-note-title">Sold comp range</div>
                <div class="analysis-note-body">
                  <strong>Median sold:</strong> ${currency(sold.medianSoldPrice)}<br>
                  <strong>Average sold:</strong> ${currency(sold.avgSoldPrice)}<br>
                  <strong>Range:</strong> ${currency(sold.minSoldPrice)} - ${currency(sold.maxSoldPrice)}
                </div>
              </div>
            `
            : `
              <div class="analysis-note-card">
                <div class="analysis-note-title">Analysis note</div>
                <div class="analysis-note-body">
                  FlipAI has returned a live analysis using the values supplied to the analyzer.
                  For the strongest read, use Auto-fill comps or add manual sold prices before analysing.
                </div>
              </div>
            `
        }

        <div class="reasoning">${escapeHtml(analysis.brief_reasoning || "Analysis complete.")}</div>

        ${
          listing.title
            ? `
              <div class="analysis-title-card">
                <div class="analysis-note-title">Suggested eBay title</div>
                <div class="analysis-title-body">${escapeHtml(listing.title)}</div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function mapDeal(rawDeal = {}) {
    const scanner = rawDeal.scanner || {};
    const bestOffer = rawDeal.bestOffer || null;

    const price = Number(
      rawDeal.price?.value ??
      rawDeal.currentPrice?.value ??
      rawDeal.sellingStatus?.currentPrice?.value ??
      rawDeal.buyPrice ??
      rawDeal.price ??
      0
    ) || 0;

    const shipping = Number(
      rawDeal.shippingOptions?.[0]?.shippingCost?.value ??
      rawDeal.shippingCost?.value ??
      rawDeal.shipping ??
      0
    ) || 0;

    const image =
      rawDeal.imageUrl ||
      rawDeal.image?.imageUrl ||
      rawDeal.thumbnailImages?.[0]?.imageUrl ||
      rawDeal.galleryURL ||
      "";

    return {
      title: rawDeal.title || rawDeal.name || rawDeal.product || "Untitled listing",
      price,
      shipping,
      totalBuyPrice: Number(scanner.totalBuyPrice || rawDeal.totalBuyPrice || price + shipping),
      estimatedResale: Number(scanner.estimatedResale || rawDeal.estimatedResale || 0),
      estimatedProfit: Number(scanner.estimatedProfit || rawDeal.estimatedProfit || 0),
      ebayFees: Number(scanner.ebayFees || rawDeal.ebayFees || 0),
      marginPercent: Number(scanner.marginPercent || rawDeal.marginPercent || 0),
      verdict: scanner.verdict || rawDeal.verdict || "Review",
      risk: scanner.risk || rawDeal.risk || "High",
      score: Number(rawDeal.dealScore || scanner.score || 0),
      compCount: Number(scanner.compCount || rawDeal.compCount || 0),
      confidence: Number(scanner.confidence || rawDeal.confidence || 0),
      confidenceLabel: scanner.confidenceLabel || rawDeal.confidenceLabel || "",
      finderLabel: rawDeal.finderLabel || "Review",
      reason: rawDeal.reason || "Review this listing carefully before buying.",
      condition: rawDeal.condition || rawDeal.conditionDisplayName || rawDeal.itemCondition || "",
      url:
        rawDeal.url ||
        rawDeal.affiliateUrl ||
        rawDeal.originalUrl ||
        rawDeal.itemWebUrl ||
        rawDeal.viewItemURL ||
        rawDeal.link ||
        "",
      originalUrl: rawDeal.originalUrl || rawDeal.itemWebUrl || rawDeal.viewItemURL || rawDeal.link || "",
      image,
      warningFlags: Array.isArray(rawDeal.warningFlags) ? rawDeal.warningFlags : [],
      bestOffer,
      offerPrice: Number(rawDeal.offerPrice || scanner.offerPrice || 0),
      offerProfit: Number(rawDeal.offerProfit || scanner.offerProfit || 0),
      offerOpportunityType: normalizeOfferType(rawDeal.offerOpportunityType || scanner.offerOpportunityType || ""),
      reasonBreakdown: rawDeal.reasonBreakdown || null
    };
  }

  function buildReasonBullets(deal) {
    const backendBullets = Array.isArray(deal.reasonBreakdown?.bullets)
      ? deal.reasonBreakdown.bullets.filter(Boolean)
      : [];

    if (backendBullets.length) {
      return backendBullets.slice(0, 5);
    }

    const bullets = [];

    if (Number(deal.estimatedProfit || 0) > 0) {
      bullets.push(`Projected profit is about ${currency(deal.estimatedProfit)} after estimated fees.`);
    }

    if (Number(deal.estimatedResale || 0) > 0) {
      bullets.push(`Estimated resale is around ${currency(deal.estimatedResale)}.`);
    }

    if (Number(deal.marginPercent || 0) > 0) {
      bullets.push(`Estimated margin is ${Number(deal.marginPercent || 0).toFixed(2)}%.`);
    }

    if (Number(deal.compCount || 0) > 0) {
      bullets.push(`${Number(deal.compCount || 0)} comps support this pricing estimate.`);
    }

    if (deal.confidenceLabel) {
      bullets.push(`Confidence is currently rated ${deal.confidenceLabel}.`);
    }

    return bullets.slice(0, 5);
  }

  function renderReasonBreakdown(deal) {
    const bullets = buildReasonBullets(deal);

    if (!bullets.length) {
      return "";
    }

    return `
      <div class="deal-reasons">
        <h4>Why this ranks here</h4>
        <ul>
          ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderWarningBox(warningFlags = []) {
    if (!Array.isArray(warningFlags) || !warningFlags.length) {
      return "";
    }

    return `
      <div class="warning-box">
        <h4>Checks to review</h4>
        <ul>
          ${warningFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderBestOfferBox(bestOffer, offerOpportunityType = "") {
    if (!bestOffer || bestOffer.hasBestOffer !== true) {
      return "";
    }

    const normalizedType = normalizeOfferType(offerOpportunityType);

    return `
      <div class="offer-box">
        <div class="offer-box-header">
          <h4>Offer guidance</h4>
          ${normalizedType ? `<div class="offer-type-pill">${escapeHtml(normalizedType)}</div>` : ""}
        </div>

        <div class="offer-grid">
          <div class="offer-stat">
            <div class="label">Ask price</div>
            <div class="value">${currency(bestOffer.askPrice)}</div>
          </div>
          <div class="offer-stat offer-highlight">
            <div class="label">Suggested offer</div>
            <div class="value">${currency(bestOffer.suggestedOffer)}</div>
          </div>
          <div class="offer-stat">
            <div class="label">Do not go above</div>
            <div class="value">${currency(bestOffer.maxSafeOffer)}</div>
          </div>
        </div>

        <div class="offer-grid">
          <div class="offer-stat offer-highlight">
            <div class="label">Profit @ suggested</div>
            <div class="value">${currency(bestOffer.profitAtSuggested)}</div>
          </div>
          <div class="offer-stat">
            <div class="label">Profit @ aggressive</div>
            <div class="value">${currency(bestOffer.profitAtAggressive)}</div>
          </div>
          <div class="offer-stat">
            <div class="label">Profit @ ceiling</div>
            <div class="value">${currency(bestOffer.profitAtMaxSafe)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDealCard(deal, index, sourceKey) {
    const dealTypeClass = getDealTypeClass(deal.finderLabel);
    const decisionText = getDecisionText(deal);
    const decisionSubline = getDecisionSubline(deal);

    return `
      <div class="deal-card" style="${
        index === 0
          ? "border:1px solid rgba(79,140,255,0.45); box-shadow: 0 0 0 1px rgba(79,140,255,0.18), 0 20px 60px rgba(0,0,0,0.28);"
          : ""
      }">
        <div class="deal-card-topline">
          ${index === 0 ? `<div class="deal-rank-banner top">Top ranked result</div>` : ""}
          <div class="deal-type-banner ${escapeHtml(dealTypeClass)}">${escapeHtml(getDealTypeLabel(deal.finderLabel))}</div>
          ${deal.offerOpportunityType ? `<div class="deal-priority-banner">Priority: ${escapeHtml(deal.offerOpportunityType)}</div>` : ""}
        </div>

        <div class="deal-shell">
          <div class="deal-image-wrap">
            <div class="deal-image-box">
              ${
                deal.image
                  ? `<img class="deal-image" src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.title)}" />`
                  : `<div class="deal-image-fallback">No image available</div>`
              }
            </div>
          </div>

          <div class="deal-main">
            <div class="deal-title-row">
              <div class="deal-title-wrap">
                <h3 class="deal-title">${escapeHtml(deal.title)}</h3>
                <p class="deal-subtitle">${escapeHtml(deal.reason)}</p>
              </div>

              <div class="deal-price-stack">
                <div class="deal-price-label">Current price</div>
                <div class="deal-price">${currency(deal.price)}</div>
                <div class="deal-price-sub">Shipping ${currency(deal.shipping)}</div>
              </div>
            </div>

            <div class="deal-decision-strip">
              <div class="decision-card">
                <div class="decision-label">Recommended decision</div>
                <div class="decision-main">
                  <div class="decision-pill ${escapeHtml(dealTypeClass)}">${escapeHtml(decisionText)}</div>
                  <div class="decision-text">${escapeHtml(decisionText)}</div>
                </div>
                <div class="decision-subline">${escapeHtml(decisionSubline)}</div>
              </div>

              <div class="verdict-card">
                <div class="verdict-label">Verdict</div>
                <div class="verdict-main" style="color:${scannerVerdictColor(deal.verdict)};">
                  ${escapeHtml(deal.verdict)}
                </div>
                <div class="verdict-subline">
                  Profit, risk, and confidence combined into FlipAI’s current read.
                </div>
              </div>
            </div>

            <div class="deal-highlight-grid">
              <div class="deal-highlight primary">
                <div class="label">Estimated profit</div>
                <div class="value" style="color:${scannerVerdictColor(deal.verdict)};">${currency(deal.estimatedProfit)}</div>
                <div class="subvalue">After estimated fees</div>
              </div>

              <div class="deal-highlight secondary">
                <div class="label">Estimated resale</div>
                <div class="value">${currency(deal.estimatedResale)}</div>
                <div class="subvalue">Modelled resale value</div>
              </div>

              <div class="deal-highlight tertiary">
                <div class="label">Total buy cost</div>
                <div class="value">${currency(deal.totalBuyPrice || deal.price + deal.shipping)}</div>
                <div class="subvalue">Price + shipping</div>
              </div>
            </div>

            <div class="deal-chip-row">
              ${deal.condition ? `<div class="deal-condition">${escapeHtml(deal.condition)}</div>` : ""}
              <div class="deal-score">Score ${Number(deal.score || 0).toFixed(0)}</div>
              <div class="profit-pill ${getProfitClass(deal.estimatedProfit)}">Profit ${currency(deal.estimatedProfit)}</div>
              <div class="risk-pill ${getRiskClass(deal.risk)}">Risk ${escapeHtml(deal.risk)}</div>
              ${buildConfidenceText(deal) ? `<div class="confidence-pill">${escapeHtml(buildConfidenceText(deal))}</div>` : ""}
              <div class="deal-source">Comps ${Number(deal.compCount || 0)}</div>
            </div>

            <div class="deal-metrics">
              <div class="deal-metric">
                <div class="label">eBay fees</div>
                <div class="value">${currency(deal.ebayFees)}</div>
              </div>
              <div class="deal-metric">
                <div class="label">Margin %</div>
                <div class="value">${Number(deal.marginPercent || 0).toFixed(2)}%</div>
              </div>
              <div class="deal-metric">
                <div class="label">Comp count</div>
                <div class="value">${Number(deal.compCount || 0)}</div>
              </div>
              <div class="deal-metric">
                <div class="label">Confidence</div>
                <div class="value">${Number(deal.confidence || 0)}</div>
              </div>
            </div>

            ${renderReasonBreakdown(deal)}
            ${renderWarningBox(deal.warningFlags)}
            ${renderBestOfferBox(deal.bestOffer, deal.offerOpportunityType)}

            <div class="deal-actions">
              <button type="button" onclick="window.useDealForAnalysis(${index}, '${sourceKey}')">${escapeHtml(getPrimaryActionLabel(deal))}</button>
              ${
                deal.url
                  ? `<a href="${escapeHtml(deal.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(getListingActionLabel(deal))}</a>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDealResults(data) {
    const deals = (data.items || data.results || data.deals || []).map(mapDeal);
    window.__lastDeals = deals;

    if (!deals.length) {
      dealResultsEl.innerHTML = `
        <div class="empty-state">
          <h3>No matching listings found</h3>
          <p>Try a broader search term, increase the max price, or remove a condition word.</p>
        </div>
      `;
      return;
    }

    dealResultsEl.innerHTML = deals
      .map((deal, index) => renderDealCard(deal, index, "__lastDeals"))
      .join("");
  }

  function renderFinderSummaryStrip(source = {}, deals = []) {
    if (!deals.length) return "";

    const buyCount = deals.filter((deal) => String(deal.finderLabel || "").toLowerCase().includes("buy")).length;
    const offerCount = deals.filter((deal) => String(deal.finderLabel || "").toLowerCase().includes("offer")).length;
    const tightCount = deals.filter((deal) => String(deal.finderLabel || "").toLowerCase().includes("tight")).length;
    const bestProfit = deals.reduce((max, deal) => Math.max(max, Number(deal.estimatedProfit || 0)), 0);

    return `
      <div class="finder-summary-strip">
        <div class="finder-summary-box">
          <div class="label">Ranked results</div>
          <div class="value">${deals.length}</div>
          <div class="subvalue">Shown after filtering and scoring</div>
        </div>

        <div class="finder-summary-box">
          <div class="label">Buy / Offer / Tight</div>
          <div class="value">${buyCount} / ${offerCount} / ${tightCount}</div>
          <div class="subvalue">Tight appears when enabled</div>
        </div>

        <div class="finder-summary-box">
          <div class="label">Best projected profit</div>
          <div class="value">${currency(bestProfit)}</div>
          <div class="subvalue">Highest profit in this view</div>
        </div>

        <div class="finder-summary-box">
          <div class="label">Listings checked</div>
          <div class="value">${Number(source.totalFetched || 0)}</div>
          <div class="subvalue">Exact matches reviewed by FlipAI</div>
        </div>
      </div>
    `;
  }

  function renderFinderResults(data) {
    if (data) {
      window.__lastFinderResponse = data;
    }

    const source = data || window.__lastFinderResponse || {};
    const deals = (source.deals || []).map(mapDeal);
    window.__lastFoundDeals = deals;

    if (!deals.length) {
      finderResultsEl.innerHTML = `
        <div class="empty-state">
          <h3>No ranked deals found</h3>
          <p>Try a broader search, increase max price, or reveal Tight deals.</p>
        </div>
      `;
      return;
    }

    finderResultsEl.innerHTML =
      renderFinderSummaryStrip(source, deals) +
      deals.map((deal, index) => renderDealCard(deal, index, "__lastFoundDeals")).join("");
  }

  window.useDealForAnalysis = function useDealForAnalysis(index, sourceKey = "__lastDeals") {
    const deals = window[sourceKey] || [];
    const deal = deals[index];

    if (!deal) return;

    document.getElementById("product").value = deal.title || "";
    document.getElementById("condition").value = deal.condition || "Used item from eBay search results.";
    document.getElementById("buyPrice").value = Number(deal.totalBuyPrice || deal.price || 0).toFixed(2);
    document.getElementById("repairCost").value = "0.00";
    document.getElementById("manualSoldPrices").value = "";
    document.getElementById("extras").value = deal.originalUrl || deal.url || "";
    document.getElementById("goal").value = "Fast sale";

    clearCompsHelper();

    setAutoCompsStatus("", "");
    setAnalyzeStatus(
      "Deal loaded into analyzer. Comp box left empty. Click Auto-fill comps before analysing, or enter comps manually.",
      "success"
    );

    document.getElementById("analyzer").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  async function runAnalysis() {
    setAnalyzeStatus("Running FlipAI analysis...", "loading");
    resultArea.innerHTML = "";
    analyzeBtn.disabled = true;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getPayload())
      });

      const { data } = await safeReadResponse(res);

      if (res.status === 401) {
        setAnalyzeStatus("Sign in to access your FlipAI analysis workspace.", "error");
        renderLockedState("Sign in to access your FlipAI analysis workspace.");
        return;
      }

      if (res.status === 403 || data.locked === true) {
        const user = data.user || null;
        const plan = String(user?.plan || "free").toLowerCase();
        const status = String(user?.subscriptionStatus || "free").toLowerCase();
        const isStarter = plan === "starter" && (status === "active" || status === "trialing");

        setAnalyzeStatus(getResponseErrorMessage(res, data, "Your current plan allowance has been used."), "error");

        if (isStarter) {
          renderLockedState(
            data.error || "Your Starter workspace has used its 25 monthly analyses. Move to Pro to keep sourcing with unlimited analysis.",
            { showPro: true }
          );
        } else {
          renderLockedState(
            data.error || "Your free workspace has used its included analyses. Upgrade when you’re ready to keep using FlipAI on live opportunities.",
            { showStarter: true, showPro: true }
          );
        }

        if (user) {
          updateAccountUi(user);
        }

        return;
      }

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Request failed"));
      }

      setAnalyzeStatus("Analysis complete.", "success");
      renderResult(data);

      if (data.user) {
        updateAccountUi(data.user);
      }
    } catch (err) {
      setAnalyzeStatus(`Error: ${err.message}`, "error");
      resultArea.innerHTML = `<div class="placeholder">No result available.</div>`;
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  async function autoFillComps() {
    const payload = getAutoCompsPayload();

    if (!payload.product) {
      clearCompsHelper();
      setAutoCompsStatus("Enter a product first, then let FlipAI look for comps.", "error");
      return;
    }

    setAutoCompsStatus("Finding similar sold comps...", "loading");
    autoCompsBtn.disabled = true;
    clearCompsHelper();

    try {
      const res = await fetch("/api/auto-comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      const { data } = await safeReadResponse(res);

      if (res.status === 401) {
        setAutoCompsStatus("Sign in to use FlipAI auto comps.", "error");
        return;
      }

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Could not auto-fill comps."));
      }

      const autoComps = data.autoComps || {};
      const manualSoldPricesText = autoComps.manualSoldPricesText || "";
      const compCount = Number(autoComps.compCount || 0);
      const confidence = Number(autoComps.confidence || 0);
      const confidenceLabel = autoComps.confidenceLabel || "Low";
      const pricingMode = autoComps.pricingMode || "Auto comps estimate";
      const searchQuery = data.searchQuery || "N/A";

      document.getElementById("manualSoldPrices").value = manualSoldPricesText;

      compsHelperArea.innerHTML = renderCompsHelperCard({
        title: compCount > 0 ? "Auto comps connected" : "Auto comps note",
        compCount,
        confidence,
        confidenceLabel,
        pricingMode,
        searchQuery,
        avgSoldPrice: autoComps.avgSoldPrice,
        medianSoldPrice: autoComps.medianSoldPrice,
        minSoldPrice: autoComps.minSoldPrice,
        maxSoldPrice: autoComps.maxSoldPrice,
        isWarning: compCount <= 0
      });

      if (compCount <= 0) {
        setAutoCompsStatus(
          `No sold comps connected on this run. Query used: ${searchQuery}. Try a cleaner product title for a stronger estimate.`,
          "warning"
        );
        return;
      }

      setAutoCompsStatus(
        `Auto comps connected. Query used: ${searchQuery}. Comps: ${compCount}. Confidence: ${confidenceLabel} (${confidence}).`,
        "success"
      );
    } catch (err) {
      clearCompsHelper();
      setAutoCompsStatus(`Error: ${err.message}`, "error");
    } finally {
      autoCompsBtn.disabled = false;
    }
  }

  async function findDeals() {
    setDealStatus("Searching eBay listings...", "loading");
    dealResultsEl.innerHTML = "";
    findDealsBtn.disabled = true;

    try {
      const res = await fetch("/api/search-ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getDealFinderPayload())
      });

      const { data } = await safeReadResponse(res);

      if (res.status === 401) {
        setDealStatus("Sign in to use FlipAI eBay search.", "error");
        dealResultsEl.innerHTML = `
          <div class="empty-state">
            <h3>Sign in to continue</h3>
            <p>Create or access your FlipAI workspace, then search eBay listings directly inside the app.</p>
          </div>
        `;
        return;
      }

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Could not search eBay."));
      }

      renderDealResults(data);
      setDealStatus("Search complete.", "success");
    } catch (err) {
      setDealStatus(`Error: ${err.message}`, "error");
      dealResultsEl.innerHTML = `
        <div class="empty-state">
          <h3>Search results unavailable</h3>
          <p>FlipAI could not load search results right now.</p>
        </div>
      `;
    } finally {
      findDealsBtn.disabled = false;
    }
  }

  async function findBestDeals() {
    setFinderStatus("Scanning for the best opportunities...", "loading");
    finderResultsEl.innerHTML = "";
    findBestDealsBtn.disabled = true;

    try {
      const res = await fetch("/api/find-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getFindDealsPayload())
      });

      const { data } = await safeReadResponse(res);

      if (res.status === 401) {
        setFinderStatus("Sign in to use Deal Finder.", "error");
        finderResultsEl.innerHTML = `
          <div class="empty-state">
            <h3>Sign in to continue</h3>
            <p>Create or access your FlipAI workspace, then use Deal Finder to rank live opportunities.</p>
          </div>
        `;
        return;
      }

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Could not find deals."));
      }

      window.__lastFinderQueryRan = true;

      renderFinderResults(data);

      const tightModeText = data.includeTightDeals ? "including Tight deals" : "Buy and Offer only";

      setFinderStatus(
        `Deal Finder complete. Checked ${Number(data.totalFetched || 0)} listings and ranked ${Number(data.totalMatched || 0)} exact matches (${tightModeText}).`,
        "success"
      );

      document.getElementById("dealHunter").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (err) {
      setFinderStatus(`Error: ${err.message}`, "error");
      finderResultsEl.innerHTML = `
        <div class="empty-state">
          <h3>Ranked deals unavailable</h3>
          <p>FlipAI could not rank deals right now. Try again with a broader search.</p>
        </div>
      `;
    } finally {
      findBestDealsBtn.disabled = false;
    }
  }

  function clearDealResults() {
    dealResultsEl.innerHTML = "Search eBay listings and matching results will appear here.";
    finderResultsEl.innerHTML = "Use the “Find Best Deals” button above and your ranked deal results will appear here.";

    setDealStatus("", "");
    setFinderStatus("", "");

    window.__lastDeals = [];
    window.__lastFoundDeals = [];
    window.__lastFinderResponse = null;
    window.__lastFinderQueryRan = false;

    if (showTightDealsCheckbox) {
      showTightDealsCheckbox.checked = false;
    }
  }

  function updateAccountUi(user) {
    const plan = String(user.plan || "free").toLowerCase();
    const status = String(user.subscriptionStatus || "free").toLowerCase();
    const usageCount = Number(user.usageCount || 0);

    const isPro = plan === "pro" && (status === "active" || status === "trialing");
    const isStarter = plan === "starter" && (status === "active" || status === "trialing");

    if (userEmailEl) {
      userEmailEl.textContent = `Logged in as: ${user.email}`;
    }

    if (starterBtn) starterBtn.style.display = "none";
    if (proBtn) proBtn.style.display = "none";
    if (billingBtn) billingBtn.style.display = "none";

    if (isPro) {
      if (planValueEl) planValueEl.textContent = "Pro";
      if (usageValueEl) usageValueEl.textContent = "Unlimited";
      if (remainingValueEl) remainingValueEl.textContent = "∞";
      if (accountSublineEl) accountSublineEl.textContent = "Your Pro workspace is active with unlimited FlipAI analysis.";
      if (billingBtn) billingBtn.style.display = "block";
      return;
    }

    if (isStarter) {
      const remaining = Math.max(0, 25 - usageCount);

      if (planValueEl) planValueEl.textContent = "Starter";
      if (usageValueEl) usageValueEl.textContent = `${usageCount} / 25`;
      if (remainingValueEl) remainingValueEl.textContent = `${remaining}`;
      if (accountSublineEl) accountSublineEl.textContent = "Your Starter workspace includes 25 monthly FlipAI analyses.";
      if (proBtn) proBtn.style.display = "block";
      if (billingBtn) billingBtn.style.display = "block";
      return;
    }

    const remaining = Math.max(0, 5 - usageCount);

    if (planValueEl) planValueEl.textContent = "Free";
    if (usageValueEl) usageValueEl.textContent = `${usageCount} / 5`;
    if (remainingValueEl) remainingValueEl.textContent = `${remaining}`;
    if (accountSublineEl) accountSublineEl.textContent = "Your free workspace includes 5 FlipAI analyses to test the full experience.";
    if (starterBtn) starterBtn.style.display = "block";
    if (proBtn) proBtn.style.display = "block";
  }

  async function loadUser() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });

      if (!res.ok) {
        if (authArea) authArea.style.display = "block";
        if (userArea) userArea.style.display = "none";
        if (userEmailEl) userEmailEl.textContent = "";
        return;
      }

      const { data } = await safeReadResponse(res);

      if (data.user) {
        if (authArea) authArea.style.display = "none";
        if (userArea) userArea.style.display = "block";
        updateAccountUi(data.user);
      } else {
        if (authArea) authArea.style.display = "block";
        if (userArea) userArea.style.display = "none";
        if (userEmailEl) userEmailEl.textContent = "";
      }
    } catch {
      if (authArea) authArea.style.display = "block";
      if (userArea) userArea.style.display = "none";
      if (userEmailEl) userEmailEl.textContent = "";
    }
  }

  async function login() {
    const { email, password } = getCredentials();

    if (!email || !password) {
      setAuthStatus("Enter your email and password to access your workspace.", "error");
      return;
    }

    loginBtn.disabled = true;
    signupBtn.disabled = true;
    setAuthStatus("Opening your FlipAI workspace...", "loading");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const { data } = await safeReadResponse(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Login failed"));
      }

      setAuthStatus("Workspace opened successfully.", "success");
      await loadUser();
    } catch (err) {
      setAuthStatus(`Error: ${err.message}`, "error");
    } finally {
      loginBtn.disabled = false;
      signupBtn.disabled = false;
    }
  }

  async function signup() {
    const { name, email, password } = getCredentials();

    if (!name || !email || !password) {
      setAuthStatus("Enter your name, email, and password to create your workspace.", "error");
      return;
    }

    if (password.length < 8) {
      setAuthStatus("Password must be at least 8 characters.", "error");
      return;
    }

    loginBtn.disabled = true;
    signupBtn.disabled = true;
    setAuthStatus("Creating your FlipAI workspace...", "loading");

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password })
      });

      const { data } = await safeReadResponse(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Signup failed"));
      }

      setAuthStatus("Workspace created successfully.", "success");
      await loadUser();
    } catch (err) {
      setAuthStatus(`Error: ${err.message}`, "error");
    } finally {
      loginBtn.disabled = false;
      signupBtn.disabled = false;
    }
  }

  async function logout() {
    logoutBtn.disabled = true;
    setAuthStatus("Closing workspace...", "loading");

    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
      });

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      setAuthStatus("Workspace closed.", "success");

      resultArea.innerHTML = `<div class="placeholder">Run an analysis and your profit estimate, verdict, risk, and resale guidance will appear here.</div>`;
      dealResultsEl.innerHTML = "Search eBay listings and matching results will appear here.";
      finderResultsEl.innerHTML = "Use the “Find Best Deals” button above and your ranked deal results will appear here.";

      document.getElementById("manualSoldPrices").value = "";

      clearCompsHelper();
      setAnalyzeStatus("", "");
      setAutoCompsStatus("", "");
      setDealStatus("", "");
      setFinderStatus("", "");

      window.__lastDeals = [];
      window.__lastFoundDeals = [];
      window.__lastFinderResponse = null;
      window.__lastFinderQueryRan = false;

      if (showTightDealsCheckbox) {
        showTightDealsCheckbox.checked = false;
      }

      await loadUser();
    } catch (err) {
      setAuthStatus(`Error: ${err.message}`, "error");
    } finally {
      logoutBtn.disabled = false;
    }
  }

  window.startCheckout = async function startCheckout(plan) {
    try {
      const selectedPlan = String(plan || "").toLowerCase();
      setAnalyzeStatus("Opening secure checkout...", "loading");

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: selectedPlan })
      });

      const { data } = await safeReadResponse(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Could not start checkout."));
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Checkout URL missing.");
    } catch (err) {
      setAnalyzeStatus(`Error: ${err.message}`, "error");
    }
  };

  async function openBillingPortal() {
    try {
      setAuthStatus("Opening secure billing portal...", "loading");

      const res = await fetch("/api/create-portal-session", {
        method: "POST",
        credentials: "include"
      });

      const { data } = await safeReadResponse(res);

      if (!res.ok) {
        throw new Error(getResponseErrorMessage(res, data, "Could not open billing portal."));
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error("Billing portal URL missing.");
    } catch (err) {
      setAuthStatus(`Error: ${err.message}`, "error");
    }
  }

  analyzeBtn?.addEventListener("click", runAnalysis);
  autoCompsBtn?.addEventListener("click", autoFillComps);
  findDealsBtn?.addEventListener("click", findDeals);
  findBestDealsBtn?.addEventListener("click", findBestDeals);
  clearDealResultsBtn?.addEventListener("click", clearDealResults);
  loginBtn?.addEventListener("click", login);
  signupBtn?.addEventListener("click", signup);
  logoutBtn?.addEventListener("click", logout);
  starterBtn?.addEventListener("click", () => window.startCheckout("starter"));
  proBtn?.addEventListener("click", () => window.startCheckout("pro"));
  billingBtn?.addEventListener("click", openBillingPortal);

  showTightDealsCheckbox?.addEventListener("change", async () => {
    if (window.__lastFinderQueryRan) {
      await findBestDeals();
      return;
    }

    renderFinderResults();
  });

  loadUser();
});
