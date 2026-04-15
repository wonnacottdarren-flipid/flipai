import Stripe from "stripe";
import {
  getUserByStripeCustomerId,
  updateUser,
} from "./db.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function getPriceIdForPlan(plan) {
  const cleanPlan = String(plan || "").toLowerCase();

  if (cleanPlan === "starter") return process.env.STRIPE_STARTER_PRICE_ID;
  if (cleanPlan === "pro") return process.env.STRIPE_PRO_PRICE_ID;

  throw new Error("Invalid plan selected.");
}

async function ensureStripeCustomer(user) {
  if (!user) {
    throw new Error("User is required.");
  }

  if (user.stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(user.stripeCustomerId);

      if (existingCustomer && !existingCustomer.deleted) {
        return existingCustomer;
      }
    } catch (error) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");

      const missingCustomer =
        code === "resource_missing" || message.includes("No such customer");

      if (!missingCustomer) {
        throw error;
      }
    }
  }

  const newCustomer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user.id,
    },
  });

  user.stripeCustomerId = newCustomer.id;
  updateUser(user);

  return newCustomer;
}

export async function createCheckoutSession(user, plan) {
  const priceId = getPriceIdForPlan(plan);
  const customer = await ensureStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
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
      plan: String(plan || "").toLowerCase(),
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        plan: String(plan || "").toLowerCase(),
      },
    },
  });

  return session.url;
}

export async function createPortalSession(user) {
  const customer = await ensureStripeCustomer(user);

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${APP_URL}/`,
  });

  return session.url;
}

async function handleCheckoutSessionCompleted(event) {
  const session = event.data.object;
  const userId = session?.metadata?.userId;
  const customerId = session?.customer;
  const subscriptionId = session?.subscription;
  const plan = String(session?.metadata?.plan || "").toLowerCase();

  if (!userId) return;

  const user = getUserByStripeCustomerId(customerId) || null;

  if (user) {
    user.stripeCustomerId = customerId || user.stripeCustomerId || null;
    user.stripeSubscriptionId = subscriptionId || user.stripeSubscriptionId || null;
    user.subscriptionStatus = "active";
    user.plan = plan || user.plan || "free";
    updateUser(user);
  }
}

async function handleCustomerSubscriptionEvent(event) {
  const subscription = event.data.object;
  const customerId = subscription?.customer;
  const subscriptionId = subscription?.id;
  const status = subscription?.status || "inactive";
  const plan =
    String(subscription?.metadata?.plan || "").toLowerCase() ||
    inferPlanFromSubscription(subscription);

  const user = getUserByStripeCustomerId(customerId);

  if (!user) return;

  user.stripeCustomerId = customerId || user.stripeCustomerId || null;
  user.stripeSubscriptionId = subscriptionId || null;
  user.subscriptionStatus = status;

  if (status === "active" || status === "trialing") {
    user.plan = plan || user.plan || "free";
  } else if (
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired"
  ) {
    user.plan = "free";
  }

  updateUser(user);
}

function inferPlanFromSubscription(subscription) {
  const priceId =
    subscription?.items?.data?.[0]?.price?.id || "";

  if (priceId && priceId === process.env.STRIPE_STARTER_PRICE_ID) {
    return "starter";
  }

  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) {
    return "pro";
  }

  return "free";
}

export async function stripeWebhookHandler(req, res) {
  try {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(500).send("Missing webhook secret.");
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleCustomerSubscriptionEvent(event);
        break;

      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("stripeWebhookHandler error:", error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
}
