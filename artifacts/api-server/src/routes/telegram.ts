import { Router, type IRouter } from "express";
import { timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { orders, loyaltyBalances, clientButtons, botSettings, botUsers, admins, livreurs } from "@workspace/db/schema";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { verifyTelegramWebhookSignature } from "../lib/telegram-auth";

const ADMIN_CHAT_ID = process.env.TELEGRAM_SUPER_ADMIN_ID || process.env.TELEGRAM_ADMIN_CHAT_ID || "";

const router: IRouter = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.APP_URL ?? "";
// Note: en multi-instance, ce timestamp est par-pod. Acceptable car le pire cas
// est que plusieurs pods tentent une réparation au même moment (appel idempotent).
let lastWebhookRepairAttempt = 0;

// Envoie à tous les admins (super admin + admins ajoutés dans le panel)
async function notifyAllAdmins(text: string, extra: object = {}) {
  if (!BOT_TOKEN) return;
  let adminIds: string[] = ADMIN_CHAT_ID ? [ADMIN_CHAT_ID] : [];
  try {
    const rows = await db.select({ telegramId: admins.telegramId }).from(admins);
    const dbIds = rows.map(r => r.telegramId).filter(Boolean) as string[];
    adminIds = [...new Set([...adminIds, ...dbIds])];
  } catch {}
  await Promise.allSettled(
    adminIds.map(chatId =>
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
      })
    )
  );
}

async function sendMessage(chatId: string | number, text: string, extra: object = {}) {
  if (!BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error("Telegram sendMessage API error:", { status: res.status, data });
    throw new Error(`Telegram sendMessage failed ${res.status}`);
  }
  return data;
}

async function sendPhoto(chatId: string | number, photoUrl: string, caption: string, extra: object = {}) {
  if (!BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML", ...extra }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    console.error("Telegram sendPhoto API error:", { status: res.status, data });
    const description = data?.description ? `: ${data.description}` : "";
    throw new Error(`Telegram sendPhoto failed ${res.status}${description}`);
  }
  return data;
}

async function sendVideo(chatId: string | number, videoId: string, caption: string, extra: object = {}) {
  if (!BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, video: videoId, caption, parse_mode: "HTML", ...extra }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    console.error("Telegram sendVideo API error:", { status: res.status, data });
    const description = data?.description ? `: ${data.description}` : "";
    throw new Error(`Telegram sendVideo failed ${res.status}${description}`);
  }
  return data;
}

function detectMediaTypeFromFileId(fileId: string): "photo" | "video" {
  // Telegram file_id format hints are not reliable across all files.
  // Use this only when no explicit media type is stored in settings.
  if (!fileId) return "photo";
  if (fileId.includes("video") || fileId.includes("mov")) return "video";
  return "photo";
}

function buildKeyboard(buttons: typeof clientButtons.$inferSelect[]): any[][] {
  if (buttons.length === 0) {
    return [[{ text: "🛒 Accéder à la Boutique", web_app: { url: BASE_URL } }]];
  }
  const keyboard: any[][] = [];
  let currentRow: any[] = [];
  for (const btn of buttons) {
    const btnText = btn.emoji ? `${btn.emoji} ${btn.label}` : btn.label;
    const isWebApp = btn.url.startsWith(BASE_URL) || btn.url.includes("railway.app") || btn.url.includes("replit.dev");
    const tgBtn = isWebApp ? { text: btnText, web_app: { url: btn.url } } : { text: btnText, url: btn.url };
    if (btn.fullWidth) {
      if (currentRow.length > 0) { keyboard.push(currentRow); currentRow = []; }
      keyboard.push([tgBtn]);
    } else {
      currentRow.push(tgBtn);
      if (currentRow.length >= 2) { keyboard.push(currentRow); currentRow = []; }
    }
  }
  if (currentRow.length > 0) keyboard.push(currentRow);
  return keyboard;
}

export async function sendTelegramMessage(chatId: string | number, text: string) {
  return sendMessage(chatId, text);
}

export async function setupWebhook() {
  if (!BOT_TOKEN) return;
  const webhookUrl = `${BASE_URL}/api/telegram/webhook`;
  try {
    const payload: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    };
    if (WEBHOOK_SECRET) {
      payload.secret_token = WEBHOOK_SECRET;
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as any;
    console.log("Telegram webhook setup:", data.description ?? data);
  } catch (err) {
    console.error("Telegram webhook setup error:", err);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert }),
    });
  } catch {}
}

async function editMessageText(chatId: string | number, messageId: number, text: string, extra: object = {}) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", ...extra }),
    });
  } catch {}
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
  // ── Vérifier l'authenticité du webhook Telegram (TOUJOURS, même en dev) ──
  const secretTokenHeader = req.header("x-telegram-bot-api-secret-token");
  const customSignature = req.header("x-telegram-webhook-signature");
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  if (WEBHOOK_SECRET) {
    const secretValid = secretTokenHeader
      ? timingSafeEqual(Buffer.from(secretTokenHeader), Buffer.from(WEBHOOK_SECRET))
      : false;
    if (!secretValid) {
      console.warn("❌ Invalid Telegram webhook secret token");

      // Self-heal: if Telegram webhook lost/changed secret, try to re-register it
      const now = Date.now();
      if (now - lastWebhookRepairAttempt > 5 * 60 * 1000) {
        lastWebhookRepairAttempt = now;
        setupWebhook().catch((err) => {
          console.error("Webhook self-repair failed:", err);
        });
      }

      res.sendStatus(401);
      return;
    }
  } else if (customSignature) {
    // Fallback: signature custom si présente
    const hasValidLegacySignature = verifyTelegramWebhookSignature(rawBody, customSignature);
    if (!hasValidLegacySignature) {
      console.warn("❌ Invalid legacy webhook signature");
      res.sendStatus(401);
      return;
    }
  } else {
    // Aucun secret configuré — rejeter systématiquement
    console.warn("❌ Webhook received with no authentication configured");
    res.sendStatus(401);
    return;
  }

  res.sendStatus(200);

  const update = req.body;
  console.log("Telegram webhook received:", {
    payloadType: update?.callback_query ? "callback_query" : update?.message ? "message" : "unknown",
    messageText: update?.message?.text,
    chatId: update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id ?? update?.callback_query?.from?.id,
    fromId: update?.message?.from?.id ?? update?.callback_query?.from?.id,
    username: update?.message?.from?.username ?? update?.callback_query?.from?.username,
  });

  // ── Callback query (bouton inline livreur "Terminer") ─────────────────────
  const callbackQuery = update?.callback_query;
  if (callbackQuery) {
    const callbackData = (callbackQuery.data ?? "") as string;
    const callbackId = callbackQuery.id as string;
    const from = callbackQuery.from ?? {};
    const msgChatId = String(callbackQuery.message?.chat?.id ?? from.id);
    const messageId = callbackQuery.message?.message_id as number | undefined;
    const originalText = callbackQuery.message?.text ?? "";

    // Valider le format de callbackData
    if (!callbackData || !/^(status|deliver):/.test(callbackData)) {
      res.status(400).end();
      return;
    }

    if (callbackData.startsWith("status:")) {
      const parts = callbackData.split(":");
      const orderCode = parts[1];
      const newStatus = parts[2];
      const VALID = ["confirmed","preparing","ready","delivering","delivered","cancelled"];

      // Transitions d'état valides
      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["preparing", "cancelled"],
        preparing: ["ready"],
        ready: ["delivering"],
        delivering: ["delivered"],
      };

      if (orderCode && VALID.includes(newStatus)) {
        try {
          // Vérifier l'ordre actuel et valider la transition
          const [currentOrder] = await db.select().from(orders).where(eq(orders.orderCode, orderCode));
          if (!currentOrder) {
            await answerCallbackQuery(callbackId, "❌ Commande introuvable");
            return;
          }
          const allowed = VALID_TRANSITIONS[currentOrder.status] ?? [];
          if (!allowed.includes(newStatus)) {
            await answerCallbackQuery(callbackId, "❌ Transition invalide");
            return;
          }
          // UPDATE atomique : vérifie que le statut n'a pas changé entre la lecture et l'écriture
          const updated = await db.update(orders)
            .set({ status: newStatus })
            .where(and(eq(orders.orderCode, orderCode), eq(orders.status, currentOrder.status)))
            .returning();
          if (updated.length === 0) {
            await answerCallbackQuery(callbackId, "❌ Commande modifiée entre-temps, actualise.");
            return;
          }
          const STATUS_LABELS: Record<string,string> = {
            confirmed: "✅ Confirmée", preparing: "👨‍🍳 En préparation", ready: "🏁 Prête",
            delivering: "🚚 En livraison", delivered: "📦 Livrée", cancelled: "❌ Annulée",
          };
          await answerCallbackQuery(callbackId, `Commande ${STATUS_LABELS[newStatus] || newStatus}`, true);
          // Notifier le client
          const [order] = await db.select({ chatId: orders.chatId }).from(orders).where(eq(orders.orderCode, orderCode));
          if (order?.chatId) {
            const CLIENT_MESSAGES: Record<string,string> = {
              confirmed:  `✅ Ta commande <b>#${orderCode}</b> est confirmée !`,
              preparing:  `👨‍🍳 Ta commande <b>#${orderCode}</b> est en préparation.`,
              ready:      `🏁 Ta commande <b>#${orderCode}</b> est prête !`,
              delivering: `🚚 Ta commande <b>#${orderCode}</b> est en route !`,
              delivered:  `📦 Ta commande <b>#${orderCode}</b> a été livrée. Merci ! 🙏`,
              cancelled:  `❌ Ta commande <b>#${orderCode}</b> a été annulée.`,
            };
            const msg = CLIENT_MESSAGES[newStatus];
            if (msg) await sendMessage(order.chatId, msg);
          }
          // Modifier le message pour enlever les boutons
          if (messageId) {
            await editMessageText(msgChatId, messageId,
              (originalText || "") + `\n\n→ Statut mis à jour : <b>${STATUS_LABELS[newStatus]}</b>`,
              { reply_markup: { inline_keyboard: [] } }
            );
          }
        } catch (err) {
          await answerCallbackQuery(callbackId, "Erreur lors de la mise à jour", false);
        }
      }
      return;
    }

    if (callbackData.startsWith("deliver:")) {
      const orderCode = callbackData.slice("deliver:".length);
      try {
        // Vérifier que le livreur qui confirme est bien celui assigné à la commande
        const orderRows = await db.execute(sql`SELECT status, livreur_id FROM orders WHERE order_code = ${orderCode} LIMIT 1`);
        const currentOrder = (orderRows as any).rows?.[0] ?? (orderRows as any)[0];
        if (!currentOrder) {
          await answerCallbackQuery(callbackId, "❌ Commande introuvable", true);
          return;
        }
        if (currentOrder.status === "delivered") {
          await answerCallbackQuery(callbackId, "✅ Déjà livrée.", true);
          return;
        }
        // Si un livreur est assigné, vérifier que c'est bien lui
        if (currentOrder.livreur_id) {
          const [livreur] = await db.select().from(livreurs).where(eq(livreurs.id, Number(currentOrder.livreur_id)));
          if (livreur && livreur.chatId && String(from.id) !== livreur.chatId) {
            console.warn(`⚠️ Livraison refusée : ${from.id} a tenté de livrer ${orderCode} assigné à ${livreur.chatId}`);
            await answerCallbackQuery(callbackId, "❌ Tu n'es pas le livreur assigné à cette commande.", true);
            return;
          }
        }
        // Marque la commande comme livrée (avec vérification atomique du statut)
        const updated = await db.update(orders)
          .set({ status: "delivered" })
          .where(and(eq(orders.orderCode, orderCode), eq(orders.status, String(currentOrder.status))))
          .returning();
        if (updated.length === 0) {
          await answerCallbackQuery(callbackId, "❌ Statut modifié entre-temps, actualise.", true);
          return;
        }

        // Toast de confirmation au livreur
        await answerCallbackQuery(callbackId, "✅ Livraison confirmée ! Merci.", true);

        // Édite le message pour retirer le bouton et indiquer la confirmation
        if (messageId) {
          await editMessageText(msgChatId, messageId,
            originalText + `\n\n✅ <b>Livraison confirmée à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}</b>`,
            { reply_markup: { inline_keyboard: [] } }
          );
        }

        // Notifie tous les admins
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const livreurName = from.first_name
          ? `${esc(String(from.first_name))}${from.username ? ` (@${esc(String(from.username))})` : ""}`
          : from.username ? `@${esc(String(from.username))}` : "Livreur";
        await notifyAllAdmins(
          `🎉 <b>Commande livrée !</b>\n\n` +
          `📦 <b>#${orderCode}</b> a été marquée comme livrée.\n` +
          `🛵 Livreur : ${livreurName}`
        );
      } catch (err) {
        console.error("deliver callback error:", err);
        await answerCallbackQuery(callbackId, "❌ Erreur, contacte l'admin.", true);
      }
    } else {
      await answerCallbackQuery(callbackId);
    }
    return;
  }

  const message = update?.message;
  if (!message || !message.text) {
    console.log("Telegram webhook ignored: no text message", {
      messageExists: !!message,
      text: message?.text,
      updateType: update?.callback_query ? "callback_query" : "message",
    });
    return;
  }

  const chatId = message.chat.id;
  const text = (message.text as string).trim();
  const from = message.from ?? {};
  console.log("Telegram message received", { chatId, text, fromId: from.id, username: from.username });
  const username = from.username ? `@${from.username}` : from.first_name ?? "Utilisateur";
  const userId = from.id ?? chatId;
  const messageDate = message.date ? formatDate(message.date) : "";

  function escapeTelegramHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  if (text.startsWith("/start")) {
    const firstName = from.first_name ?? username;

    // ── Sauvegarder/mettre à jour le client dans bot_users ──────────────────
    let isNewUser = false;
    try {
      const existing = await db.select({ id: botUsers.id })
        .from(botUsers)
        .where(eq(botUsers.chatId, String(userId)))
        .limit(1);

      isNewUser = existing.length === 0;

      await db.insert(botUsers).values({
        chatId: String(userId),
        username: from.username ?? null,
        firstName: from.first_name ?? null,
      }).onConflictDoUpdate({
        target: botUsers.chatId,
        set: {
          username: sql`excluded.username`,
          firstName: sql`excluded.first_name`,
        },
      });
    } catch (err) {
      console.error("Erreur upsert bot_users:", err);
    }

    // ── Notification admin si nouveau client ─────────────────────────────────
    if (isNewUser) {
      const escFn = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const adminMsg =
        `🆕 <b>Nouveau client !</b>\n\n` +
        `👤 Prénom : <b>${from.first_name ? escFn(String(from.first_name)) : "—"}</b>\n` +
        `🔖 Username : ${from.username ? `@${escFn(String(from.username))}` : "—"}\n` +
        `🆔 ID Telegram : <code>${userId}</code>\n` +
        `📅 Il vient de démarrer le bot.\n\n` +
        `<i>Retrouvez-le dans le panel → Clients</i>`;
      notifyAllAdmins(adminMsg).catch(() => {});
    }

    // Fetch bot settings (safe — table may not exist yet on fresh deploy)
    const settings: Record<string, string> = {};
    let photoUrl = "";
    let customMessage = "";
    try {
      const settingsRows = await db.select().from(botSettings);
      settingsRows.forEach(r => { settings[r.key] = r.value; });
      photoUrl = settings["start_photo_url"] || "";
      customMessage = settings["start_message"] || "";
    } catch { /* table not ready yet, use defaults */ }

    const defaultMsg =
      `🎉 Salut <b>${firstName}</b> !\n\n` +
      `Bienvenue sur <b>🔌 SOS LE PLUG</b>\n\n` +
      `🌐 Explorez notre menu et passez commande en quelques clics !\n\n` +
      `✨ <i>Simple, rapide et sécurisé</i>`;

    const safeFirstName = escapeTelegramHtml(String(firstName));
    const safeUserId = String(userId).replace(/[^0-9]/g, "");
    const welcomeText = customMessage
      ? customMessage.replace("{username}", safeFirstName).replace("{id}", safeUserId)
      : defaultMsg;

    // Fetch buttons (safe — full_width column may not exist on fresh deploy)
    let dbButtons: any[] = [];
    try {
      dbButtons = await db
        .select()
        .from(clientButtons)
        .where(eq(clientButtons.active, true))
        .orderBy(asc(clientButtons.position));
      console.log("✅ Fetched buttons from DB:", { count: dbButtons.length, buttons: dbButtons.map(b => ({ id: b.id, label: b.label, active: b.active, position: b.position })) });
    } catch (err) {
      console.error("❌ Error fetching buttons from DB:", err);
      /* fall through, buildKeyboard handles empty array */
    }

    const keyboard = buildKeyboard(dbButtons);

    // Determine media type: use stored type first, fallback to detected if not stored
    let mediaType = settings["start_media_type"] || "";
    if (photoUrl && !mediaType) {
      mediaType = detectMediaTypeFromFileId(photoUrl);
      console.log(`📋 No stored media type, auto-detected: ${mediaType}`);
    } else if (photoUrl && mediaType) {
      const detectedType = detectMediaTypeFromFileId(photoUrl);
      if (mediaType !== detectedType) {
        console.warn(`⚠️ Media type mismatch: stored="${mediaType}" vs detected="${detectedType}". Will use stored and fallback if needed.`);
      }
    }
    if (!mediaType) mediaType = "photo"; // Final safety default

    console.log("Handling /start", { chatId, userId, firstName, photoUrl, mediaType, hasCustomMessage: !!customMessage, buttonsFetched: dbButtons.length, keyboardRows: keyboard.length, keyboard });
    try {
      if (photoUrl) {
        try {
          if (mediaType === "video") {
            await sendVideo(chatId, photoUrl, welcomeText, { reply_markup: { inline_keyboard: keyboard } });
          } else {
            await sendPhoto(chatId, photoUrl, welcomeText, { reply_markup: { inline_keyboard: keyboard } });
          }
        } catch (mediaErr: any) {
          // Fallback: if media send fails with a type mismatch, try the other type
          const errMsg = mediaErr?.message || "";
          if (errMsg.includes("wrong file_id") || errMsg.includes("file identifier") || errMsg.includes("can't use file of type")) {
            console.warn(`⚠️ Media send failed (${mediaType}), trying fallback type...`);
            if (mediaType === "video") {
              await sendPhoto(chatId, photoUrl, welcomeText, { reply_markup: { inline_keyboard: keyboard } });
            } else {
              await sendVideo(chatId, photoUrl, welcomeText, { reply_markup: { inline_keyboard: keyboard } });
            }
          } else {
            throw mediaErr;
          }
        }
      } else {
        await sendMessage(chatId, welcomeText, { reply_markup: { inline_keyboard: keyboard } });
      }
    } catch (err) {
      console.error("Erreur envoi /start:", err);
      await sendMessage(chatId, defaultMsg, { reply_markup: { inline_keyboard: [[{ text: "🛒 Accéder à la Boutique", web_app: { url: BASE_URL } }]] } }).catch(() => {});
    }
    return;
  }

  if (text.startsWith("/monid") || text.startsWith("/id")) {
    await sendMessage(
      chatId,
      `🪪 <b>Vos informations :</b>\n\n` +
      `👤 Username : ${escapeTelegramHtml(String(username))}\n` +
      `🆔 User ID : <code>${String(userId).replace(/[^0-9]/g, "")}</code>\n\n` +
      `Copiez votre User ID dans la page <b>Compte</b> de la boutique pour accéder à votre historique.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Ouvrir la Boutique", web_app: { url: BASE_URL } }]],
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
          { reply_markup: { inline_keyboard: [[{ text: "🛒 Visiter la Boutique", web_app: { url: BASE_URL } }]] } }
        );
        return;
      }

      const statusEmoji: Record<string, string> = {
        pending: "⏳", confirmed: "✅", shipped: "🚚", delivered: "🎉", cancelled: "❌",
      };

      let msg = `📦 <b>Vos ${userOrders.length} dernières commandes :</b>\n\n`;
      for (const o of userOrders) {
        const emoji = statusEmoji[o.status] ?? "📋";
        const date = new Date(o.createdAt!).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
        const total = ((o.totalAmount ?? 0) / 100).toFixed(2);
        msg += `${emoji} Commande #${o.id} — <b>${total}€</b>\n`;
        msg += `   📅 ${date} | Statut : <b>${o.status}</b>\n\n`;
      }

      await sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: [[{ text: "🛒 Retourner à la Boutique", web_app: { url: BASE_URL } }]] },
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
          { reply_markup: { inline_keyboard: [[{ text: "🛒 Commander", web_app: { url: BASE_URL } }]] } }
        );
        return;
      }

      await sendMessage(
        chatId,
        `💎 <b>Vos points de fidélité :</b>\n\n⭐ Solde actuel : <b>${loyalty.points} points</b>\n🎁 Utilisez vos points lors du prochain achat !`,
        { reply_markup: { inline_keyboard: [[{ text: "🛒 Utiliser mes points", web_app: { url: BASE_URL } }]] } }
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
    { reply_markup: { inline_keyboard: [[{ text: "🛒 Ouvrir la Boutique", web_app: { url: BASE_URL } }]] } }
  );
});

export default router;
