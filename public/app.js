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

  function setAnalyzeStatus(message, type) {
    statusEl.innerHTML = message ? `<div class="status ${type}">${escapeHtml(message)}</div>` : "";
  }

  function setAutoCompsStatus(message, type) {
    autoCompsStatusEl.innerHTML = message ? `<div class="status ${type}">${escapeHtml(message)}</div>` : "";
  }

  function setDealStatus(message, type) {
    dealStatusEl.innerHTML = message ? `<div class="status ${type}">${escapeHtml(message)}</div>` : "";
  }

  function setFinderStatus(message, type) {
    finderStatusEl.innerHTML = message ? `<div class="status ${type}">${escapeHtml(message)}</div>` : "";
  }

  function setAuthStatus(message, type) {
    authStatusEl.innerHTML = message ? `<div class="status ${type}">${escapeHtml(message)}</div>` : "";
  }

  function clearCompsHelper() {
    if (compsHelperArea) compsHelperArea.innerHTML = "";
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

  function mapDeal(rawDeal = {}) {
    const scanner = rawDeal.scanner || {};
    const bestOffer = rawDeal.bestOffer || null;

    return {
      title: rawDeal.title || rawDeal.name || "Untitled listing",
      price: Number(rawDeal.price || 0),
      shipping: Number(rawDeal.shipping || 0),
      totalBuyPrice: Number(scanner.totalBuyPrice || rawDeal.totalBuyPrice || 0),
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
      condition: rawDeal.condition || rawDeal.conditionDisplayName || "",
      url: rawDeal.url || rawDeal.affiliateUrl || rawDeal.originalUrl || rawDeal.itemWebUrl || rawDeal.viewItemURL || "",
      image: rawDeal.imageUrl || rawDeal.image?.imageUrl || rawDeal.thumbnailImages?.[0]?.imageUrl || "",
      warningFlags: Array.isArray(rawDeal.warningFlags) ? rawDeal.warningFlags : [],
      bestOffer,
      offerPrice: Number(rawDeal.offerPrice || scanner.offerPrice || 0),
      offerProfit: Number(rawDeal.offerProfit || scanner.offerProfit || 0),
      offerOpportunityType: rawDeal.offerOpportunityType || scanner.offerOpportunityType || ""
    };
  }

  function renderResult(data) {
    const result = data.result || {};
    const metrics = result.flipMetrics || {};
    const analysis = result.flip_analysis || {};
    const sold = result.manualSoldComps || metrics.soldComps || {};

    resultArea.innerHTML = `
      <div class="analysis-shell">
        <div class="analysis-hero">
          <div class="analysis-main-card">
            <div class="analysis-kicker">Projected profit</div>
            <div class="analysis-profit-value">${currency(metrics.profit)}</div>
            <div class="analysis-profit-subline">Based on resale, costs, repairs, and fees.</div>
          </div>

          <div class="analysis-side-card">
            <div class="analysis-kicker">Verdict</div>
            <div class="analysis-verdict-value">${escapeHtml(metrics.verdict || analysis.final_verdict || "Review")}</div>
            <div class="analysis-verdict-subline">${escapeHtml(analysis.risk_level || "Check risk before buying.")}</div>
          </div>
        </div>

        <div class="analysis-stat-grid">
          <div class="analysis-stat-card">
            <div class="analysis-stat-label">Total cost</div>
            <div class="analysis-stat-value">${currency(metrics.totalCost)}</div>
          </div>
          <div class="analysis-stat-card">
            <div class="analysis-stat-label">Estimated resale</div>
            <div class="analysis-stat-value">${currency(metrics.estimatedResale)}</div>
          </div>
          <div class="analysis-stat-card">
            <div class="analysis-stat-label">eBay fees</div>
            <div class="analysis-stat-value">${currency(metrics.ebayFees)}</div>
          </div>
          <div class="analysis-stat-card">
            <div class="analysis-stat-label">Comps used</div>
            <div class="analysis-stat-value">${Number(sold.compCount || 0)}</div>
          </div>
        </div>

        <div class="reasoning">${escapeHtml(analysis.brief_reasoning || "Analysis complete.")}</div>
      </div>
    `;
  }

  function renderDealCard(deal, index, sourceKey) {
    return `
      <div class="deal-card">
        <div class="deal-card-topline">
          ${index === 0 ? `<div class="deal-rank-banner top">Top result</div>` : ""}
          <div class="deal-type-banner ${String(deal.finderLabel).toLowerCase().includes("offer") ? "offer" : String(deal.finderLabel).toLowerCase().includes("tight") ? "tight" : "buy"}">
            ${escapeHtml(deal.finderLabel)}
          </div>
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

            <div class="deal-highlight-grid">
              <div class="deal-highlight primary">
                <div class="label">Estimated profit</div>
                <div class="value">${currency(deal.estimatedProfit)}</div>
                <div class="subvalue">${escapeHtml(deal.verdict)}</div>
              </div>

              <div class="deal-highlight secondary">
                <div class="label">Estimated resale</div>
                <div class="value">${currency(deal.estimatedResale)}</div>
                <div class="subvalue">Modelled resale</div>
              </div>

              <div class="deal-highlight tertiary">
                <div class="label">Total buy cost</div>
                <div class="value">${currency(deal.totalBuyPrice || deal.price + deal.shipping)}</div>
                <div class="subvalue">Price + shipping</div>
              </div>
            </div>

            <div class="deal-chip-row">
              <div class="deal-score">Score ${Number(deal.score || 0).toFixed(0)}</div>
              <div class="profit-pill strong">Profit ${currency(deal.estimatedProfit)}</div>
              <div class="risk-pill ${String(deal.risk).toLowerCase()}">Risk ${escapeHtml(deal.risk)}</div>
              <div class="confidence-pill">${escapeHtml(deal.confidenceLabel || "Confidence")} ${Number(deal.confidence || 0)}</div>
              <div class="deal-source">Comps ${Number(deal.compCount || 0)}</div>
            </div>

            ${
              deal.bestOffer?.hasBestOffer
                ? `
                  <div class="offer-box">
                    <h4>Offer guidance</h4>
                    <div class="offer-grid">
                      <div class="offer-stat">
                        <div class="label">Ask price</div>
                        <div class="value">${currency(deal.bestOffer.askPrice)}</div>
                      </div>
                      <div class="offer-stat offer-highlight">
                        <div class="label">Suggested offer</div>
                        <div class="value">${currency(deal.bestOffer.suggestedOffer)}</div>
                      </div>
                      <div class="offer-stat">
                        <div class="label">Profit at offer</div>
                        <div class="value">${currency(deal.bestOffer.profitAtSuggested)}</div>
                      </div>
                    </div>
                  </div>
                `
                : ""
            }

            ${
              deal.warningFlags.length
                ? `
                  <div class="warning-box">
                    <h4>Warnings</h4>
                    <ul>
                      ${deal.warningFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}
                    </ul>
                  </div>
                `
                : ""
            }

            <div class="deal-actions">
              <button type="button" onclick="window.useDealForAnalysis(${index}, '${sourceKey}')">Send to Analyzer</button>
              ${
                deal.url
                  ? `<a href="${escapeHtml(deal.url)}" target="_blank" rel="noopener noreferrer">Open Listing</a>`
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
      dealResultsEl.innerHTML = `<div class="empty-state"><h3>No matching listings found</h3><p>Try a broader search or increase the max price.</p></div>`;
      return;
    }

    dealResultsEl.innerHTML = deals.map((deal, index) => renderDealCard(deal, index, "__lastDeals")).join("");
  }

  function renderFinderResults(data) {
    if (data) window.__lastFinderResponse = data;

    const source = data || window.__lastFinderResponse || {};
    const deals = (source.deals || []).map(mapDeal);
    window.__lastFoundDeals = deals;

    if (!deals.length) {
      finderResultsEl.innerHTML = `<div class="empty-state"><h3>No ranked deals found</h3><p>Try a broader search, higher max price, or reveal Tight deals.</p></div>`;
      return;
    }

    finderResultsEl.innerHTML = `
      <div class="finder-summary-strip">
        <div class="finder-summary-box">
          <div class="label">Ranked results</div>
          <div class="value">${deals.length}</div>
        </div>
        <div class="finder-summary-box">
          <div class="label">Listings checked</div>
          <div class="value">${Number(source.totalFetched || 0)}</div>
        </div>
        <div class="finder-summary-box">
          <div class="label">Exact matches</div>
          <div class="value">${Number(source.totalMatched || 0)}</div>
        </div>
        <div class="finder-summary-box">
          <div class="label">Qualified</div>
          <div class="value">${Number(source.totalQualifiedDeals || deals.length)}</div>
        </div>
      </div>
      ${deals.map((deal, index) => renderDealCard(deal, index, "__lastFoundDeals")).join("")}
    `;
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
    document.getElementById("extras").value = deal.url || "";
    document.getElementById("goal").value = "Fast sale";

    clearCompsHelper();
    setAnalyzeStatus("Deal loaded into analyzer. Comp box left empty. Click Auto-fill comps before analysing.", "success");

    document.getElementById("analyzer").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  async function runAnalysis() {
    setAnalyzeStatus("Analyzing...", "loading");
    analyzeBtn.disabled = true;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getPayload())
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Request failed");

      setAnalyzeStatus("Analysis complete.", "success");
      renderResult(data);
    } catch (err) {
      setAnalyzeStatus(`Error: ${err.message}`, "error");
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  async function autoFillComps() {
    setAutoCompsStatus("Finding comps...", "loading");
    autoCompsBtn.disabled = true;

    try {
      const res = await fetch("/api/auto-comps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getAutoCompsPayload())
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed");

      document.getElementById("manualSoldPrices").value =
        data.autoComps?.manualSoldPricesText || "";

      setAutoCompsStatus("Comps loaded.", "success");
    } catch (err) {
      setAutoCompsStatus(`Error: ${err.message}`, "error");
    } finally {
      autoCompsBtn.disabled = false;
    }
  }

  async function findDeals() {
    setDealStatus("Searching...", "loading");
    findDealsBtn.disabled = true;

    try {
      const res = await fetch("/api/search-ebay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getDealFinderPayload())
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed");

      renderDealResults(data);
      setDealStatus("Search complete.", "success");
    } catch (err) {
      setDealStatus(`Error: ${err.message}`, "error");
    } finally {
      findDealsBtn.disabled = false;
    }
  }

  async function findBestDeals() {
    setFinderStatus("Finding deals...", "loading");
    findBestDealsBtn.disabled = true;

    try {
      const res = await fetch("/api/find-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(getFindDealsPayload())
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed");

      window.__lastFinderQueryRan = true;
      renderFinderResults(data);
      setFinderStatus("Deal finder complete.", "success");

      document.getElementById("dealHunter").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    } catch (err) {
      setFinderStatus(`Error: ${err.message}`, "error");
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
    if (showTightDealsCheckbox) showTightDealsCheckbox.checked = false;
  }

  async function loadUser() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });

      if (!res.ok) {
        if (authArea) authArea.style.display = "block";
        if (userArea) userArea.style.display = "none";
        return;
      }

      const data = await res.json();

      if (data.user) {
        if (authArea) authArea.style.display = "none";
        if (userArea) userArea.style.display = "block";
        if (userEmailEl) userEmailEl.textContent = `Logged in as: ${data.user.email}`;
      }
    } catch {}
  }

  async function login() {
    const creds = getCredentials();
    setAuthStatus("Logging in...", "loading");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(creds)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      setAuthStatus("Logged in.", "success");
      loadUser();
    } catch (err) {
      setAuthStatus(err.message, "error");
    }
  }

  async function signup() {
    const creds = getCredentials();
    setAuthStatus("Creating account...", "loading");

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(creds)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      setAuthStatus("Account created.", "success");
      loadUser();
    } catch (err) {
      setAuthStatus(err.message, "error");
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setAuthStatus("Logged out.", "success");
    loadUser();
  }

  analyzeBtn?.addEventListener("click", runAnalysis);
  autoCompsBtn?.addEventListener("click", autoFillComps);
  findDealsBtn?.addEventListener("click", findDeals);
  findBestDealsBtn?.addEventListener("click", findBestDeals);
  clearDealResultsBtn?.addEventListener("click", clearDealResults);
  loginBtn?.addEventListener("click", login);
  signupBtn?.addEventListener("click", signup);
  logoutBtn?.addEventListener("click", logout);

  showTightDealsCheckbox?.addEventListener("change", async () => {
    if (window.__lastFinderQueryRan) {
      await findBestDeals();
      return;
    }

    renderFinderResults();
  });

  loadUser();
});
