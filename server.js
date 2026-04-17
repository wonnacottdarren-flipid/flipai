function renderBestOfferBox(bestOffer) {
  if (!bestOffer || bestOffer.hasBestOffer !== true) {
    return "";
  }

  return `
    <div class="offer-box">
      <h4>Best offer guidance</h4>
      <div class="offer-grid">
        <div class="offer-stat">
          <div class="label">Suggested offer</div>
          <div class="value">${currency(bestOffer.suggestedOffer)}</div>
        </div>
        <div class="offer-stat">
          <div class="label">Aggressive offer</div>
          <div class="value">${currency(bestOffer.aggressiveOffer)}</div>
        </div>
        <div class="offer-stat">
          <div class="label">Do not go above</div>
          <div class="value">${currency(bestOffer.maxSafeOffer)}</div>
        </div>
      </div>
      <div class="offer-grid">
        <div class="offer-stat">
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
      <div class="offer-subline">
        Current ask: <strong>${currency(bestOffer.askPrice)}</strong>
      </div>
    </div>
  `;
}
