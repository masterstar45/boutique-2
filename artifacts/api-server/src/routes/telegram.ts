import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { orders, loyaltyBalances } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.APP_URL ?? "https://boutique-2-production.up.railway.app";

async function sendMessage(chatId: string | number, text: string, extra: object = {}) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...extra,
      }),
    });
  } catch (err) {
    console.error("Telegram send error:", err);
  }
}

export async function sendTelegramMessage(chatId: string | number, text: string) {
  return sendMessage(chatId, text);
}

export async function setupWebhook() {
  if (!BOT_TOKEN) return;
  const webhookUrl = `${BASE_URL}/api/telegram/webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message"], drop_pending_updates: true }),
    });
    const data = await res.json() as any;
    console.log("Telegram webhook setup:", data.description ?? data);
  } catch (err) {
    console.error("Telegram webhook setup error:", err);
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

router.post("/telegram/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  const message = update?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = (message.text as string).trim();
  const from = message.from ?? {};
  const username = from.username ? `@${from.username}` : from.first_name ?? "Utilisateur";
  const userId = from.id ?? chatId;
  const messageDate = message.date ? formatDate(message.date) : "";

  if (text.startsWith("/start")) {
    const welcomeText =
      `╔══════════════════════════════╗\n` +
      `║      🔌   SOS LE PLUG   🔌      ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `🎯 Bienvenue ${username} !\n\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `📊 INFORMATIONS UTILISATEUR\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `👤 Username : ${username}\n` +
      `🆔 User ID : <code>${userId}</code>\n` +
      `📅 Date : ${messageDate}\n` +
      `🌍 Fuseau : Europe/Paris\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `💡 Cliquez sur le bouton ci-dessous pour accéder à votre espace`;

    const boutiquUrl = `${BASE_URL}?tg_user=${encodeURIComponent(from.username ?? from.first_name ?? "")}&tg_id=${encodeURIComponent(userId)}`;

    await sendMessage(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: "🛒 Accéder à la Boutique",
            url: boutiquUrl,
          },
        ]],
      },
    });
    return;
  }

  if (text.startsWith("/monid") || text.startsWith("/id")) {
    await sendMessage(
      chatId,
      `🪪 <b>Vos informations :</b>\n\n` +
      `👤 Username : ${username}\n` +
      `🆔 User ID : <code>${userId}</code>\n\n` +
      `Copiez votre User ID dans la page <b>Compte</b> de la boutique pour accéder à votre historique.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Ouvrir la Boutique", url: BASE_URL }]],
        },
      }
    );
    return;
  }

  if (text.startsWith("/commandes")) {
    try {
      const userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.telegramChatId, String(userId)))
        .orderBy(desc(orders.createdAt))
        .limit(5);

      if (userOrders.length === 0) {
        await sendMessage(chatId,
          "📦 Vous n'avez pas encore de commandes.\n\n🛒 Passez votre première commande !",
          { reply_markup: { inline_keyboard: [[{ text: "🛒 Visiter la Boutique", url: BASE_URL }]] } }
        );
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
        msg += `${emoji} Commande #${o.id} — <b>${total}€</b>\n`;
        msg += `   📅 ${date} | Statut : <b>${o.status}</b>\n\n`;
      }

      await sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: [[{ text: "🛒 Retourner à la Boutique", url: BASE_URL }]] },
      });
    } catch {
      await sendMessage(chatId, "❌ Erreur lors de la récupération de vos commandes.");
    }
    return;
  }

  if (text.startsWith("/solde")) {
    try {
      const [loyalty] = await db
        .select()
        .from(loyaltyBalances)
        .where(eq(loyaltyBalances.telegramChatId, String(userId)));

      if (!loyalty) {
        await sendMessage(chatId,
          "💎 Vous n'avez pas encore de points de fidélité.\n\nPassez votre première commande pour en gagner !",
          { reply_markup: { inline_keyboard: [[{ text: "🛒 Commander", url: BASE_URL }]] } }
        );
        return;
      }

      await sendMessage(
        chatId,
        `💎 <b>Vos points de fidélité :</b>\n\n⭐ Solde actuel : <b>${loyalty.points} points</b>\n🎁 Utilisez vos points lors du prochain achat !`,
        { reply_markup: { inline_keyboard: [[{ text: "🛒 Utiliser mes points", url: BASE_URL }]] } }
      );
    } catch {
      await sendMessage(chatId, "❌ Erreur lors de la récupération de vos points.");
    }
    return;
  }

  await sendMessage(
    chatId,
    `🔌 <b>SOS LE PLUG</b>\n\n` +
    `Commandes disponibles :\n` +
    `/start - Démarrer\n` +
    `/monid - Mon User ID\n` +
    `/commandes - Mes commandes\n` +
    `/solde - Mes points de fidélité`,
    { reply_markup: { inline_keyboard: [[{ text: "🛒 Ouvrir la Boutique", url: BASE_URL }]] } }
  );
});

export default router;
