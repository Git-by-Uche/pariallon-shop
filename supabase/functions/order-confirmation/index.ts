import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

function formatNaira(amount: number) {
  return `₦${new Intl.NumberFormat("en-NG").format(amount)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return jsonResponse({ error: "Sign in before requesting a receipt." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");
  const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN");
  const mailgunFrom = Deno.env.get("MAILGUN_FROM");
  const mailgunBaseUrl = Deno.env.get("MAILGUN_BASE_URL") ?? "https://api.mailgun.net";

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Supabase is not configured for receipts." }, 503);
  }
  if (!mailgunApiKey || !mailgunDomain || !mailgunFrom) {
    return jsonResponse({ error: "Mailgun is not configured yet." }, 503);
  }

  let orderId: string;
  try {
    const body = await request.json();
    orderId = body?.orderId;
    if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return jsonResponse({ error: "A valid order ID is required." }, 400);
    }
  } catch {
    return jsonResponse({ error: "The request body is invalid." }, 400);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Your sign-in session is no longer valid." }, 401);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, email, customer_name, address_line1, city, state, items, subtotal_naira, shipping_naira, total_naira",
    )
    .eq("id", orderId)
    .eq("user_id", userData.user.id)
    .single();

  if (orderError || !order) {
    return jsonResponse({ error: "That order could not be found." }, 404);
  }

  const lines = (order.items as Array<{
    name: string;
    quantity: number;
    unit_price_naira: number;
    subtotal_naira: number;
  }>).map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e9e5df">${escapeHtml(item.name)} × ${item.quantity}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e9e5df;text-align:right">${formatNaira(item.subtotal_naira)}</td>
    </tr>
  `).join("");

  const recipientName = escapeHtml(order.customer_name);
  const address = [
    order.address_line1,
    order.city,
    order.state,
  ].map((part) => escapeHtml(part)).join(", ");
  const html = `
    <div style="background:#f7f5f0;padding:36px 16px;font-family:Arial,sans-serif;color:#201f1d">
      <div style="max-width:600px;margin:auto;background:#fff;padding:36px">
        <p style="font-size:12px;letter-spacing:3px">PA / PARIALLON</p>
        <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400">Your order is in, ${recipientName}.</h1>
        <p>Thank you for shopping with Pariallon. We’ve received order ${escapeHtml(order.id.slice(0, 8).toUpperCase())}.</p>
        <table style="width:100%;border-collapse:collapse;margin:28px 0">${lines}</table>
        <p>Items: ${formatNaira(order.subtotal_naira)}</p>
        <p>Delivery: ${order.shipping_naira === 0 ? "Free" : formatNaira(order.shipping_naira)}</p>
        <p style="font-size:18px"><strong>Total: ${formatNaira(order.total_naira)}</strong></p>
        <p>Delivering to: ${address}</p>
        <p style="color:#777;font-size:13px">We’ll be in touch with delivery updates.</p>
      </div>
    </div>`;
  const text = [
    `Your order is in, ${order.customer_name}.`,
    `Order ${order.id.slice(0, 8).toUpperCase()}`,
    `Items: ${formatNaira(order.subtotal_naira)}`,
    `Delivery: ${order.shipping_naira === 0 ? "Free" : formatNaira(order.shipping_naira)}`,
    `Total: ${formatNaira(order.total_naira)}`,
    `Delivering to: ${address}`,
  ].join("\n");

  const form = new FormData();
  form.set("from", mailgunFrom);
  form.set("to", order.email);
  form.set("subject", `Pariallon order ${order.id.slice(0, 8).toUpperCase()} confirmed`);
  form.set("text", text);
  form.set("html", html);

  const mailgunResponse = await fetch(
    `${mailgunBaseUrl.replace(/\/$/, "")}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}`,
      },
      body: form,
    },
  );

  if (!mailgunResponse.ok) {
    const responseText = await mailgunResponse.text();
    console.error("Mailgun rejected an order confirmation.", {
      status: mailgunResponse.status,
      response: responseText.slice(0, 500),
    });
    return jsonResponse({ error: "The order was placed, but its email could not be sent." }, 502);
  }

  return jsonResponse({ sent: true });
});