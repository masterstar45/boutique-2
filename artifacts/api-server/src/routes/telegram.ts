import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { orders, loyaltyBalances, products } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.APP_URL ?? "https://boutique-2-production.up.railway.app";

export async function sendTelegramMessage(chatId: string | number, text: string, parseMode = "HTML") {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

export async function setupWebhook() {
  if (!BOT_TOKEN) return;
  const webhookUrl = `${BASE_URL}/api/telegram/webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"] }),
    });
    const data = await res.json() as any;
    console.log("Telegram webhook setup:", data.description ?? data);
  } catch (err) {
    console.error("Telegram webhook setup error:", err);
  }
}

router.post("/telegram/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  const message = update?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = (message.text as string).trim();
  const firstName = message.from?.first_name ?? "Client";

  if (text.startsWith("/start")) {
    await sendTelegramMessage(
      chatId,
      `🌿 <b>Bienvenue sur PharmacyHash, ${firstName} !</b>\n\n` +
      `Votre <b>Chat ID</b> est :\n<code>${chatId}</code>\n\n` +
      `📋 <b>Copiez ce code</b> et collez-le dans la page <b>Compte</b> de la boutique pour accéder à votre historique de commandes et vos points de fidélité.\n\n` +
      `🔗 <a href="${BASE_URL}">Ouvrir la boutique</a>\n\n` +
      `Commandes disponibles :\n` +
      `/commandes - Voir mes dernières commandes\n` +
      `/solde - Voir mes points de fidélité\n` +
      `/monid - Revoir mon Chat ID`
    );
    return;
  }

  if (text.startsWith("/monid") || text.startsWith("/id")) {
    await sendTelegramMessage(
      chatId,
      `🪪 Votre <b>Chat ID</b> : <code>${chatId}</code>\n\nCopiez ce code dans la page Compte de la boutique.`
    );
    return;
  }

  if (text.startsWith("/commandes")) {
    try {
      const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.telegramChatId, String(chatId)))
        .orderBy(desc(orders.createdAt))
        .limit(5);

      if (userOrders.length === 0) {
        await sendTelegramMessage(chatId, "📦 Vous n'avez pas encore de commandes.\n\n🛒 Visitez notre boutique : " + BASE_URL);
        return;
      }

      const statusEmoji: Record<string, string> = {
        pending: "⏳", confirmed: "✅", shipped: "🚚", delivered: "🎉", cancelled: "❌",
      };

      let msg = `📦 <b>Vos ${userOrders.length} dernières commandes :</b>\n\n`;
      for (const o of userOrders) {
        const emoji = statusEmoji[o.status] ?? "📋";
        const date = new Date(o.createdAt!).toLocaleDateString("fr-FR");
        const total = ((o.totalAmount ?? 0) / 100).toFixed(2);
        msg += `${emoji} Commande #${o.id} — ${total}€\n`;
        msg += `   📅 ${date} | Statut : <b>${o.status}</b>\n\n`;
      }
      await sendTelegramMessage(chatId, msg);
    } catch {
      await sendTelegramMessage(chatId, "❌ Erreur lors de la récupération de vos commandes.");
    }
    return;
  }

  if (text.startsWith("/solde")) {
    try {
      const [loyalty] = await db
        .select()
        .from(loyaltyBalances)
        .where(eq(loyaltyBalances.telegramChatId, String(chatId)));

      if (!loyalty) {
        await sendTelegramMessage(chatId, "💎 Vous n'avez pas encore de points de fidélité.\n\nPassez votre première commande sur la boutique !");
        return;
      }

      await sendTelegramMessage(
        chatId,
        `💎 <b>Vos points de fidélité :</b>\n\n` +
        `⭐ Solde actuel : <b>${loyalty.points} points</b>\n` +
        `🎁 Utilisez vos points lors du prochain achat pour obtenir une réduction !`
      );
    } catch {
      await sendTelegramMessage(chatId, "❌ Erreur lors de la récupération de vos points.");
    }
    return;
  }

  await sendTelegramMessage(
    chatId,
    `🌿 <b>PharmacyHash</b>\n\nCommandes disponibles :\n/start - Démarrer\n/monid - Mon Chat ID\n/commandes - Mes commandes\n/solde - Mes points de fidélité\n\n🔗 <a href="${BASE_URL}">Ouvrir la boutique</a>`
  );
});

export default router;
