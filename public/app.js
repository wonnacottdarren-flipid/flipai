document.addEventListener("DOMContentLoaded", () => {
  console.log("FlipAI app.js loaded");

  // =========================
  // ELEMENT REFERENCES
  // =========================

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
  const billingBtn = document.getElementById("billingBtn");
  const starterBtn = document.getElementById("starterBtn");
  const proBtn = document.getElementById("proBtn");

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

  // =========================
  // HELPERS
  // =========================

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
    statusEl.innerHTML = message
      ? `<div class="status ${type}">${message}</div>`
      : "";
  }

  function setAutoCompsStatus(message, type) {
    autoCompsStatusEl.innerHTML = message
      ? `<div class="status ${type}">${message}</div>`
      : "";
  }

  function setDealStatus(message, type) {
    dealStatusEl.innerHTML = message
      ? `<div class="status ${type}">${message}</div>`
      : "";
  }

  function setFinderStatus(message, type) {
    finderStatusEl.innerHTML = message
      ? `<div class="status ${type}">${message}</div>`
      : "";
  }

  function setAuthStatus(message, type) {
    authStatusEl.innerHTML = message
      ? `<div class="status ${type}">${message}</div>`
      : "";
  }

  function clearCompsHelper() {
    compsHelperArea.innerHTML = "";
  }

  // =========================
  // PAYLOAD BUILDERS
  // =========================

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
      includeTightDeals: showTightDealsCheckbox.checked
    };
  }

  function getCredentials() {
    return {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    };
  }

  // =========================
  // CORE ACTIONS (MINIMAL SAFE VERSION)
  // =========================

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
      resultArea.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
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

      dealResultsEl.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
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

      finderResultsEl.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
      setFinderStatus("Done.", "success");
    } catch (err) {
      setFinderStatus(`Error: ${err.message}`, "error");
    } finally {
      findBestDealsBtn.disabled = false;
    }
  }

  async function loadUser() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) return;

      const data = await res.json();
      if (data.user) {
        userEmailEl.textContent = data.user.email;
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

  // =========================
  // EVENT LISTENERS
  // =========================

  analyzeBtn?.addEventListener("click", runAnalysis);
  autoCompsBtn?.addEventListener("click", autoFillComps);
  findDealsBtn?.addEventListener("click", findDeals);
  findBestDealsBtn?.addEventListener("click", findBestDeals);
  loginBtn?.addEventListener("click", login);
  signupBtn?.addEventListener("click", signup);
  logoutBtn?.addEventListener("click", logout);

  loadUser();
});
