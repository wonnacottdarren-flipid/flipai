import Stripe from "stripe";
import { getUserByStripeCustomerId, updateUser } from "./db.js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export const stripe = new Stripe(STRIPE_SECRET_KEY || "sk_test_placeholder");

export const PLAN_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter_placeholder",
  growth: process.env.STRIPE_PRICE_GROWTH || "price_growth_placeholder",
  pro: process.env.STRIPE_PRICE_PRO || "price_pro_placeholder",
};

export async function createCheckoutSession(user, plan) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured yet.");
  }

  const priceId = PLAN_PRICES[plan];
  if (!priceId) throw new Error("Invalid plan.");

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: user.id }
    });
    customerId = customer.id;
    updateUser(user.id, (u) => ({ ...u, stripeCustomerId: customerId }));
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } }
  });

  return session.url;
}

export async function createPortalSession(user) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured yet.");
  }
  if (!user.stripeCustomerId) {
    throw new Error("No Stripe customer found for this account yet.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: APP_URL
  });

  return session.url;
}

export function stripeWebhookHandler(req, res) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription") {
          const userId = session.metadata?.userId;
          const plan = session.metadata?.plan;
          if (userId) {
            updateUser(userId, (u) => ({
              ...u,
              stripeCustomerId: session.customer || u.stripeCustomerId,
              stripeSubscriptionId: session.subscription || u.stripeSubscriptionId,
              subscriptionStatus: "active",
              plan: plan || u.plan,
            }));
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const user = getUserByStripeCustomerId(subscription.customer);
        if (user) {
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const plan = Object.entries(PLAN_PRICES).find(([, id]) => id === priceId)?.[0] || user.plan;
          updateUser(user.id, (u) => ({
            ...u,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            plan,
          }));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const user = getUserByStripeCustomerId(subscription.customer);
        if (user) {
          updateUser(user.id, (u) => ({
            ...u,
            stripeSubscriptionId: null,
            subscriptionStatus: "free",
            plan: "free",
          }));
        }
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Webhook handler failed.");
  }
}
