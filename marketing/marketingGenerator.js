// marketing/marketingGenerator.js

function normalizeInput(input = {}) {
  return {
    idea: String(input.idea || "").trim(),
    category: String(input.category || "general").toLowerCase(),
  };
}

function buildHook(idea = "") {
  if (!idea) return "You won’t believe this flip...";
  return `You won’t believe this… ${idea}`;
}

function generateTikTok(idea = "") {
  const hook = buildHook(idea);

  return [
    hook,
    "",
    "Here’s how it went down:",
    idea,
    "",
    "This is exactly what FlipAI helps you find.",
    "Follow for more flips.",
  ].join("\n");
}

function generateInstagram(idea = "") {
  const hook = buildHook(idea);

  return `${hook}

${idea}

Built using FlipAI 🔍

#ebayflips #reselling #sidehustle #flipforprofit #ukreseller #makemoneyonline`;
}

function generateFacebook(idea = "") {
  return `Quick flip:

${idea}

This is the kind of deal FlipAI helps find daily.

Anyone else flipping right now?`;
}

function generateTwitter(idea = "") {
  return `${idea}

FlipAI is built for finding deals like this.

#reselling #flipping #sidehustle`;
}

function generateLinkedIn(idea = "") {
  return `Small wins compound.

${idea}

Tools like FlipAI are designed to turn everyday opportunities into scalable results.

Consistency is everything.`;
}

export function generateMarketingContent(input = {}) {
  const { idea } = normalizeInput(input);

  if (!idea) {
    return {
      ok: false,
      error: "Missing idea",
    };
  }

  return {
    ok: true,
    content: {
      tiktok: generateTikTok(idea),
      instagram: generateInstagram(idea),
      facebook: generateFacebook(idea),
      twitter: generateTwitter(idea),
      linkedin: generateLinkedIn(idea),
    },
  };
}
