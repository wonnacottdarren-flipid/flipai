import Stripe from "stripe";
import {
  getUserByStripeCustomerId,
  updateUser,
} from "./db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
};

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function getPlanFromPriceId(priceId) {
  if (priceId === PRICE_IDS.starter) return "starter";
  if (priceId === PRICE_IDS.pro) return "pro";
  return "free";
}

export async function createCheckoutSession(user, plan) {
  const selectedPlan = String(plan || "").toLowerCase();
  const priceId = PRICE_IDS[selectedPlan];

  if (!priceId) {
    throw new Error("Invalid plan selected.");
  }

  let customerId = user.stripeCustomerId || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id,
      },
    });

    customerId = customer.id;

    await updateUser({
      ...user,
      stripeCustomerId: customerId,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${APP_URL}/?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: {
      userId: user.id,
      plan: selectedPlan,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        plan: selectedPlan,
      },
    },
  });

  return session.url;
}

export async function createPortalSession(user) {
  if (!user.stripeCustomerId) {
    throw new Error("No Stripe customer found for this account yet.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/`,
  });

  return session.url;
}

async function handleCheckoutCompleted(session) {
  const customerId = session.customer;
  const subscriptionId = session.subscription;

  if (!customerId || !subscriptionId) return;

  const user = getUserByStripeCustomerId(customerId);
  if (!user) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = getPlanFromPriceId(priceId);

  await updateUser({
    ...user,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status || "active",
    plan,
  });
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  if (!customerId) return;

  const user = getUserByStripeCustomerId(customerId);
  if (!user) return;

  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const plan = getPlanFromPriceId(priceId);

  await updateUser({
    ...user,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status || "inactive",
    plan,
  });
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  if (!customerId) return;

  const user = getUserByStripeCustomerId(customerId);
  if (!user) return;

  await updateUser({
    ...user,
    stripeCustomerId: customerId,
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    plan: "free",
  });
}

export async function stripeWebhookHandler(req, res) {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
    }

    const signature = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
}
