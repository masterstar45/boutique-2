import TelegramBot from "node-telegram-bot-api";
import { createReadStream } from "fs";
import { resolve } from "path";
import { storage } from "./storage";
import type { Product, Review } from "@shared/schema";

// Store bot instance for external access
let botInstance: TelegramBot | null = null;

// Function to send order confirmation to user
export async function sendOrderConfirmation(
  chatId: string,
  orderCode: string,
  orderMessage: string,
): Promise<void> {
  console.log(
    `sendOrderConfirmation called for order ${orderCode} to chatId ${chatId}`,
  );
  if (!botInstance) {
    console.log(
      "Bot not initialized (NODE_ENV=" +
        process.env.NODE_ENV +
        "), cannot send order confirmation",
    );
    return;
  }
  console.log("Bot instance available, sending message...");

  try {
    const confirmationMessage = `Commande ${orderCode} confirmee!\n\n${orderMessage}\n\nMerci pour votre commande! Un admin vous contactera bientot.`;

    await botInstance.sendMessage(parseInt(chatId), confirmationMessage, {
      parse_mode: "HTML",
    });

    // Also notify admins about new order
    const allAdminIds = new Set<string>();
    const envAdminId = process.env.ADMIN_TELEGRAM_ID;
    if (envAdminId) {
      envAdminId.split(",").forEach((id) => allAdminIds.add(id.trim()));
    }
    try {
      const dbAdmins = await storage.getAdmins();
      dbAdmins.forEach((admin: { telegramId: string }) =>
        allAdminIds.add(admin.telegramId),
      );
    } catch (err) {
      console.error("Failed to fetch db admins:", err);
    }

    const adminMessage = `🛒 <b>Nouvelle commande!</b>\n\nCode: <code>${orderCode}</code>\nClient: <code>${chatId}</code>\n\n${orderMessage}`;

    for (const adminId of Array.from(allAdminIds)) {
      try {
        await botInstance.sendMessage(parseInt(adminId), adminMessage, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📞 Contacter le client",
                  url: `tg://user?id=${chatId}`,
                },
              ],
              [
                {
                  text: "⭐ Ajouter points fidélité",
                  callback_data: `order_points_${orderCode}_${chatId}`,
                },
              ],
              [
                {
                  text: "✅ Marquer traitée",
                  callback_data: `order_done_${orderCode}`,
                },
              ],
            ],
          },
        });
      } catch (err) {
        console.error(
          `Failed to send order notification to admin ${adminId}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("Error sending order confirmation:", err);
  }
}

// Function to notify admins about new reviews
export async function notifyAdminsNewReview(review: Review): Promise<void> {
  if (!botInstance) return;

  try {
    const allAdminIds = new Set<string>();

    const envAdminId = process.env.ADMIN_TELEGRAM_ID;
    if (envAdminId) {
      envAdminId.split(",").forEach((id) => allAdminIds.add(id.trim()));
    }

    try {
      const dbAdmins = await storage.getAdmins();
      dbAdmins.forEach((admin: { telegramId: string }) =>
        allAdminIds.add(admin.telegramId),
      );
    } catch (err) {
      console.error("Failed to fetch db admins:", err);
    }

    const message = `Nouvel avis client!\n\nDe: ${review.firstName || "Client"}\n\nMessage:\n"${review.text}"\n\nAppuyer pour approuver ou supprimer:`;

    for (const adminId of Array.from(allAdminIds)) {
      try {
        await botInstance.sendMessage(parseInt(adminId), message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Approuver",
                  callback_data: `review_approve_${review.id}`,
                },
                {
                  text: "Supprimer",
                  callback_data: `review_delete_${review.id}`,
                },
              ],
            ],
          },
        });
      } catch (err) {
        console.error(
          `Failed to send review notification to admin ${adminId}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("Error notifying admins about review:", err);
  }
}

interface AdminSession {
  state:
    | "idle"
    | "awaiting_name"
    | "awaiting_brand"
    | "awaiting_description"
    | "awaiting_price"
    | "awaiting_category"
    | "awaiting_image"
    | "awaiting_edit_value"
    | "awaiting_admin_id"
    | "awaiting_promo_text"
    | "awaiting_review"
    | "awaiting_price_option"
    | "awaiting_stock"
    | "awaiting_promo_code"
    | "awaiting_loyalty_search"
    | "awaiting_loyalty_add"
    | "awaiting_loyalty_remove"
    | "awaiting_loyalty_setting"
    | "awaiting_password"
    | "awaiting_new_password"
    | "awaiting_password_label"
    | "awaiting_start_photo"
    | "awaiting_user_search"
    | "awaiting_user_msg_id"
    | "awaiting_user_msg_text"
    | "awaiting_broadcast_msg"
    | "awaiting_button_label"
    | "awaiting_button_url"
    | "awaiting_button_action";
  newProduct?: {
    name?: string;
    brand?: string;
    description?: string;
    price?: number;
    category?: string;
  };
  editingProductId?: number;
  editingField?: "name" | "brand" | "description" | "price" | "category";
  lastMenuMessageId?: number;
  promoText?: string;
  editingPriceOptionIndex?: number;
  loyaltyTargetChatId?: string;
  loyaltySettingField?: "earn" | "redeem" | "silver" | "gold";
  newPasswordValue?: string;
  targetUserId?: string;
  newButton?: {
    label?: string;
    url?: string;
    action?: string;
  };
  editingButtonId?: number;
}

const adminSessions: Map<number, AdminSession> = new Map();

function isEnvAdmin(chatId: number): boolean {
  const adminId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminId) return false;
  const adminIds = adminId.split(",").map((id) => id.trim());
  return adminIds.includes(chatId.toString());
}

async function isAdmin(chatId: number): Promise<boolean> {
  if (isEnvAdmin(chatId)) return true;
  const dbAdmin = await storage.getAdminByTelegramId(chatId.toString());
  return !!dbAdmin;
}

function getSession(chatId: number): AdminSession {
  if (!adminSessions.has(chatId)) {
    adminSessions.set(chatId, { state: "idle" });
  }
  return adminSessions.get(chatId)!;
}

function resetSession(chatId: number): void {
  adminSessions.set(chatId, { state: "idle" });
}

export function setupBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not set, bot will not start.");
    return;
  }

  // Only run bot in production to avoid conflicts
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    console.log(
      "Bot disabled in development mode to avoid conflicts. Bot runs only in production.",
    );
    return;
  }

  console.log("Starting Telegram bot...");

  const bot = new TelegramBot(token, {
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10,
      },
    },
  });
  botInstance = bot;

  bot.on("polling_error", (error: any) => {
    console.error("Telegram polling error:", error.code, error.message);
  });

  bot.on("error", (error: any) => {
    console.error("Telegram bot error:", error.message);
  });

  // Log when bot is ready
  bot
    .getMe()
    .then((botInfo) => {
      console.log(`Bot started successfully: @${botInfo.username}`);
    })
    .catch((err) => {
      console.error("Failed to get bot info:", err.message);
    });

  // Log all incoming messages for debugging
  bot.on("message", (msg) => {
    console.log(
      `Received message from ${msg.chat.id}: ${msg.text || "[non-text]"}`,
    );
  });

  // === MAIN MENU ===
  function sendMainMenu(chatId: number, messageId?: number) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "📦 Voir les produits", callback_data: "menu_products" }],
        [{ text: "➕ Ajouter un produit", callback_data: "menu_add" }],
        [{ text: "📋 Voir les commandes", callback_data: "menu_orders" }],
        [{ text: "⭐ Gerer les avis", callback_data: "menu_reviews" }],
        [{ text: "🏷️ Codes Promo", callback_data: "menu_promo_codes" }],
        [{ text: "🎯 Fidelite", callback_data: "menu_loyalty" }],
        [{ text: "🔐 Mots de passe", callback_data: "menu_passwords" }],
        [{ text: "🖼️ Photo de bienvenue", callback_data: "menu_start_photo" }],
        [{ text: "👤 Utilisateurs", callback_data: "menu_users" }],
        [{ text: "🔘 Boutons Client", callback_data: "menu_client_buttons" }],
        [{ text: "📢 Envoyer une Promo", callback_data: "menu_promo" }],
        [{ text: "📊 Statistiques", callback_data: "menu_stats" }],
        [{ text: "👥 Gerer les admins", callback_data: "menu_admins" }],
      ],
    };

    const text = "🏪 Panel Admin PharmacyHash\n\nQue souhaitez-vous faire?";

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === USERS MENU ===
  async function sendUsersMenu(chatId: number, messageId?: number) {
    const users = await storage.getAllBotUsers();

    const unlockedCount = users.filter((u) => u.isUnlocked).length;
    const lockedCount = users.length - unlockedCount;

    let text = "👤 Gestion des utilisateurs\n\n";
    text += `📊 Statistiques:\n`;
    text += `• Total: ${users.length} utilisateur(s)\n`;
    text += `• Actifs (deverrouilles): ${unlockedCount}\n`;
    text += `• Bloques (verrouilles): ${lockedCount}\n`;

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "📋 Liste des utilisateurs", callback_data: "users_list" }],
      [{ text: "🔍 Rechercher par ID", callback_data: "users_search" }],
      [
        {
          text: "📨 Envoyer message a un utilisateur",
          callback_data: "users_send_message",
        },
      ],
      [
        {
          text: "📢 Message a TOUS les utilisateurs",
          callback_data: "users_broadcast",
        },
      ],
    ];

    if (unlockedCount > 0) {
      buttons.push([
        { text: "🔒 Verrouiller TOUS", callback_data: "users_lock_all" },
      ]);
    }
    if (lockedCount > 0) {
      buttons.push([
        { text: "✅ Deverrouiller TOUS", callback_data: "users_unlock_all" },
      ]);
    }

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === USERS LIST ===
  async function sendUsersList(
    chatId: number,
    messageId?: number,
    page: number = 0,
  ) {
    const users = await storage.getAllBotUsers();
    const pageSize = 10;
    const totalPages = Math.ceil(users.length / pageSize);
    const start = page * pageSize;
    const pageUsers = users.slice(start, start + pageSize);

    let text = `👤 Liste des utilisateurs (${users.length} total)\n`;
    text += `Page ${page + 1}/${totalPages || 1}\n\n`;

    if (pageUsers.length === 0) {
      text += "Aucun utilisateur.";
    } else {
      pageUsers.forEach((user, i) => {
        const status = user.isUnlocked ? "✅" : "🔒";
        const date = user.unlockedAt
          ? new Date(user.unlockedAt).toLocaleDateString("fr-FR")
          : "-";
        const username = user.username
          ? `@${user.username}`
          : user.firstName || "Sans nom";
        text += `${start + i + 1}. ${status} ${username}\n`;
        text += `   ID: ${user.chatId}\n`;
        text += `   Accès: ${date}\n\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    // User action buttons
    pageUsers.forEach((user) => {
      buttons.push([
        {
          text: `👁️ Voir ${user.chatId}`,
          callback_data: `user_view_${user.chatId}`,
        },
      ]);
    });

    // Pagination
    const navRow: TelegramBot.InlineKeyboardButton[] = [];
    if (page > 0) {
      navRow.push({
        text: "⬅️ Precedent",
        callback_data: `users_page_${page - 1}`,
      });
    }
    if (page < totalPages - 1) {
      navRow.push({
        text: "Suivant ➡️",
        callback_data: `users_page_${page + 1}`,
      });
    }
    if (navRow.length > 0) {
      buttons.push(navRow);
    }

    buttons.push([{ text: "🔙 Retour", callback_data: "menu_users" }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === USER DETAILS ===
  async function sendUserDetails(
    chatId: number,
    userChatId: string,
    messageId?: number,
  ) {
    const user = await storage.getBotUserByChatId(userChatId);

    if (!user) {
      const keyboard = {
        inline_keyboard: [[{ text: "🔙 Retour", callback_data: "users_list" }]],
      };
      if (messageId) {
        bot
          .editMessageText("Utilisateur non trouve.", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          })
          .catch(() => {});
      }
      return;
    }

    const status = user.isUnlocked ? "✅ Déverrouillé" : "🔒 Verrouillé";
    const date = user.unlockedAt
      ? new Date(user.unlockedAt).toLocaleString("fr-FR")
      : "Jamais";
    const username = user.username ? `@${user.username}` : "Non défini";
    const firstName = user.firstName || "Non défini";

    let text = `👤 Détails utilisateur\n\n`;
    text += `📛 Nom: ${firstName}\n`;
    text += `👤 Username: ${username}\n`;
    text += `🆔 Chat ID: ${user.chatId}\n`;
    text += `📊 Statut: ${status}\n`;
    text += `📅 Dernier accès: ${date}\n`;

    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    if (user.isUnlocked) {
      buttons.push([
        { text: "🔒 Verrouiller", callback_data: `user_lock_${user.chatId}` },
      ]);
    } else {
      buttons.push([
        {
          text: "✅ Deverrouiller",
          callback_data: `user_unlock_${user.chatId}`,
        },
      ]);
    }

    buttons.push([
      {
        text: "📨 Envoyer un message",
        callback_data: `user_msg_${user.chatId}`,
      },
    ]);
    buttons.push([
      { text: "🗑️ Supprimer", callback_data: `user_delete_${user.chatId}` },
    ]);
    buttons.push([
      { text: "🔙 Retour a la liste", callback_data: "users_list" },
    ]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === ADMIN LIST ===
  async function sendAdminList(chatId: number, messageId?: number) {
    const dbAdmins = await storage.getAdmins();
    const envAdminId = process.env.ADMIN_TELEGRAM_ID;
    const envAdmins = envAdminId
      ? envAdminId.split(",").map((id) => id.trim())
      : [];

    let text = "👥 Gestion des administrateurs\n\n";
    text += "🔐 Admins principaux (env):\n";
    envAdmins.forEach((id, i) => {
      text += `${i + 1}. ID: ${id}\n`;
    });

    if (dbAdmins.length > 0) {
      text += "\nAdmins ajoutes:\n";
      dbAdmins.forEach((admin, i) => {
        text += `${i + 1}. ${admin.name || "Sans nom"} (ID: ${admin.telegramId})\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "➕ Ajouter un admin", callback_data: "admin_add" }],
    ];

    if (dbAdmins.length > 0) {
      buttons.push([
        { text: "🗑️ Supprimer un admin", callback_data: "admin_remove_list" },
      ]);
    }

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === ADMIN REMOVE LIST ===
  async function sendAdminRemoveList(chatId: number, messageId?: number) {
    const dbAdmins = await storage.getAdmins();

    if (dbAdmins.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Retour", callback_data: "menu_admins" }],
        ],
      };
      const text = "Aucun admin a supprimer.";

      if (messageId) {
        bot
          .editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          })
          .catch(() => {});
      } else {
        bot.sendMessage(chatId, text, { reply_markup: keyboard });
      }
      return;
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = dbAdmins.map(
      (admin) => [
        {
          text: `🗑️ Supprimer: ${admin.name || admin.telegramId}`,
          callback_data: `admin_remove_${admin.id}`,
        },
      ],
    );

    buttons.push([{ text: "🔙 Retour", callback_data: "menu_admins" }]);

    const text = "👥 Selectionnez l'admin a supprimer:";
    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === CLIENT BUTTONS MENU ===
  async function sendClientButtonsMenu(chatId: number, messageId?: number) {
    const buttons = await storage.getClientButtons();

    let text = "🔘 Gestion des boutons clients\n\n";
    text += "Ces boutons apparaitront dans le menu principal des clients.\n\n";

    if (buttons.length === 0) {
      text += "Aucun bouton configure.";
    } else {
      text += "Boutons actuels:\n";
      buttons.forEach((btn, i) => {
        const status = btn.active ? "✅" : "❌";
        const urlText = btn.url ? ` → ${btn.url.substring(0, 30)}...` : "";
        const actionText = btn.action ? ` [${btn.action}]` : "";
        text += `${i + 1}. ${status} ${btn.label}${urlText}${actionText}\n`;
      });
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "➕ Ajouter un bouton", callback_data: "btn_add" }],
    ];

    if (buttons.length > 0) {
      keyboard.push([
        { text: "📋 Gerer les boutons", callback_data: "btn_list" },
      ]);
    }

    keyboard.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: keyboard },
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }

  // === CLIENT BUTTONS LIST ===
  async function sendClientButtonsList(chatId: number, messageId?: number) {
    const buttons = await storage.getClientButtons();

    if (buttons.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Retour", callback_data: "menu_client_buttons" }],
        ],
      };
      const text = "Aucun bouton a gerer.";
      if (messageId) {
        bot
          .editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          })
          .catch(() => {});
      }
      return;
    }

    const keyboard: TelegramBot.InlineKeyboardButton[][] = buttons.map(
      (btn) => {
        const status = btn.active ? "✅" : "❌";
        return [
          {
            text: `${status} ${btn.label}`,
            callback_data: `btn_view_${btn.id}`,
          },
        ];
      },
    );

    keyboard.push([
      { text: "🔙 Retour", callback_data: "menu_client_buttons" },
    ]);

    const text = "🔘 Selectionnez un bouton a modifier:";

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: keyboard },
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }

  // === CLIENT BUTTON DETAILS ===
  async function sendClientButtonDetails(
    chatId: number,
    buttonId: number,
    messageId?: number,
  ) {
    const button = await storage.getClientButton(buttonId);

    if (!button) {
      const keyboard = {
        inline_keyboard: [[{ text: "🔙 Retour", callback_data: "btn_list" }]],
      };
      if (messageId) {
        bot
          .editMessageText("Bouton introuvable.", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          })
          .catch(() => {});
      }
      return;
    }

    const status = button.active ? "✅ Actif" : "❌ Inactif";
    let text = `🔘 Details du bouton\n\n`;
    text += `📝 Label: ${button.label}\n`;
    text += `🔗 URL: ${button.url || "Non defini"}\n`;
    text += `⚙️ Action: ${button.action || "Non defini"}\n`;
    text += `📊 Position: ${button.position}\n`;
    text += `📊 Statut: ${status}\n`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    if (button.active) {
      keyboard.push([
        { text: "❌ Desactiver", callback_data: `btn_toggle_${button.id}_0` },
      ]);
    } else {
      keyboard.push([
        { text: "✅ Activer", callback_data: `btn_toggle_${button.id}_1` },
      ]);
    }

    keyboard.push([
      { text: "🗑️ Supprimer", callback_data: `btn_delete_${button.id}` },
    ]);
    keyboard.push([
      { text: "🔙 Retour a la liste", callback_data: "btn_list" },
    ]);

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: keyboard },
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  }

  // === REVIEWS LIST ===
  async function sendReviewsList(chatId: number, messageId?: number) {
    const pendingReviews = await storage.getPendingReviews();
    const approvedReviews = await storage.getApprovedReviews();

    let text = "⭐ Gestion des avis clients\n\n";
    text += `⏳ Avis en attente: ${pendingReviews.length}\n`;
    text += `✅ Avis publies: ${approvedReviews.length}\n`;

    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    if (pendingReviews.length > 0) {
      text += "\n📝 --- Avis en attente ---\n\n";
      pendingReviews.slice(0, 5).forEach((review, i) => {
        const shortText =
          review.text.length > 50
            ? review.text.substring(0, 50) + "..."
            : review.text;
        text += `${i + 1}. ${review.firstName || "Client"}: "${shortText}"\n`;
        buttons.push([
          {
            text: `✅ Approuver #${i + 1}`,
            callback_data: `review_approve_${review.id}`,
          },
          {
            text: `🗑️ Supprimer #${i + 1}`,
            callback_data: `review_delete_${review.id}`,
          },
        ]);
      });

      if (pendingReviews.length > 5) {
        text += `\n... et ${pendingReviews.length - 5} autres avis en attente`;
      }
    } else {
      text += "\nAucun avis en attente.";
    }

    if (approvedReviews.length > 0) {
      text += "\n\n🌟 --- Avis publies sur le site ---\n\n";
      approvedReviews.slice(0, 5).forEach((review, i) => {
        const shortText =
          review.text.length > 50
            ? review.text.substring(0, 50) + "..."
            : review.text;
        text += `${i + 1}. ${review.firstName || "Client"}: "${shortText}"\n`;
        buttons.push([
          {
            text: `🗑️ Supprimer avis publie #${i + 1}`,
            callback_data: `review_delete_${review.id}`,
          },
        ]);
      });

      if (approvedReviews.length > 5) {
        text += `\n... et ${approvedReviews.length - 5} autres avis publies`;
      }
    }

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === ORDER LIST ===
  async function sendOrderList(
    chatId: number,
    messageId?: number,
    page: number = 0,
    statusFilter?: string,
  ) {
    const pageSize = 5;
    const offset = page * pageSize;
    const ordersList = await storage.getOrders(statusFilter, pageSize, offset);
    const totalCount = await storage.getOrdersCount(statusFilter);
    const totalPages = Math.ceil(totalCount / pageSize);

    const statusLabels: Record<string, string> = {
      pending: "⏳ En attente",
      sent: "📤 Envoyée",
      completed: "✅ Terminée",
      cancelled: "❌ Annulée",
    };

    if (ordersList.length === 0 && page === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔙 Retour au menu", callback_data: "menu_main" }],
        ],
      };
      const text = statusFilter
        ? `Aucune commande avec le statut "${statusLabels[statusFilter] || statusFilter}".`
        : "Aucune commande pour le moment.";

      if (messageId) {
        bot
          .editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          })
          .catch(() => {});
      } else {
        bot.sendMessage(chatId, text, { reply_markup: keyboard });
      }
      return;
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = ordersList.map(
      (order) => {
        const statusIcon =
          order.status === "completed"
            ? "[OK]"
            : order.status === "cancelled"
              ? "[X]"
              : order.status === "sent"
                ? "[>]"
                : "[?]";
        return [
          {
            text: `${statusIcon} ${order.orderCode}`,
            callback_data: `order_${order.orderCode}`,
          },
        ];
      },
    );

    // Filter buttons
    const filterRow: TelegramBot.InlineKeyboardButton[] = [
      {
        text: statusFilter === "pending" ? "⏳ [Attente]" : "⏳ Attente",
        callback_data: "orders_filter_pending",
      },
      {
        text: statusFilter === "sent" ? "📤 [Envoyée]" : "📤 Envoyée",
        callback_data: "orders_filter_sent",
      },
      {
        text: !statusFilter ? "📋 [Toutes]" : "📋 Toutes",
        callback_data: "orders_filter_all",
      },
    ];
    buttons.push(filterRow);

    // Navigation
    const navRow: TelegramBot.InlineKeyboardButton[] = [];
    if (page > 0) {
      navRow.push({
        text: "⬅️ Précédent",
        callback_data: `orders_page_${page - 1}_${statusFilter || "all"}`,
      });
    }
    if (page < totalPages - 1) {
      navRow.push({
        text: "➡️ Suivant",
        callback_data: `orders_page_${page + 1}_${statusFilter || "all"}`,
      });
    }
    if (navRow.length > 0) buttons.push(navRow);

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const filterText = statusFilter
      ? ` (${statusLabels[statusFilter] || statusFilter})`
      : "";
    const text = `Commandes${filterText} (${totalCount} total) - Page ${page + 1}/${Math.max(1, totalPages)}\n\nSélectionnez une commande:`;
    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === ORDER DETAIL ===
  async function sendOrderDetail(
    chatId: number,
    orderCode: string,
    messageId?: number,
  ) {
    const order = await storage.getOrderByCode(orderCode);
    if (!order) {
      bot.sendMessage(chatId, "Commande introuvable.");
      return;
    }

    const statusLabels: Record<string, string> = {
      pending: "⏳ En attente",
      sent: "📤 Envoyée",
      completed: "✅ Terminée",
      cancelled: "❌ Annulée",
    };

    let text = `📋 Commande: ${order.orderCode}\n`;
    text += `📊 Statut: ${statusLabels[order.status] || order.status}\n`;
    text += `🚚 Livraison: ${order.deliveryType}\n\n`;
    text += order.orderData;

    const buttons: TelegramBot.InlineKeyboardButton[][] = [];

    // Contact client button (if chatId available)
    if (order.chatId) {
      buttons.push([
        { text: "📞 Contacter le client", url: `tg://user?id=${order.chatId}` },
      ]);
      // Loyalty points button
      buttons.push([
        {
          text: "⭐ Ajouter points fidélité",
          callback_data: `order_points_${orderCode}_${order.chatId}`,
        },
      ]);
    }

    // Status change buttons based on current status
    if (order.status === "pending" || order.status === "sent") {
      buttons.push([
        {
          text: "✅ Marquer terminée",
          callback_data: `order_status_${orderCode}_completed`,
        },
      ]);
    }
    if (order.status !== "cancelled") {
      buttons.push([
        {
          text: "❌ Annuler",
          callback_data: `order_status_${orderCode}_cancelled`,
        },
      ]);
    }
    if (order.status === "cancelled" || order.status === "completed") {
      buttons.push([
        {
          text: "⏳ Remettre en attente",
          callback_data: `order_status_${orderCode}_pending`,
        },
      ]);
      buttons.push([
        { text: "🗑️ Supprimer", callback_data: `order_delete_${orderCode}` },
      ]);
    }

    buttons.push([
      { text: "🔙 Retour aux commandes", callback_data: "menu_orders" },
    ]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === PRODUCT LIST ===
  async function sendProductList(
    chatId: number,
    messageId?: number,
    page: number = 0,
  ) {
    const products = await storage.getProducts();
    const pageSize = 5;
    const totalPages = Math.ceil(products.length / pageSize);
    const start = page * pageSize;
    const pageProducts = products.slice(start, start + pageSize);

    if (products.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: "➕ Ajouter un produit", callback_data: "menu_add" }],
          [{ text: "🔙 Retour", callback_data: "menu_main" }],
        ],
      };
      const text = "Aucun produit dans la boutique.";

      if (messageId) {
        bot
          .editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          })
          .catch(() => {});
      } else {
        bot.sendMessage(chatId, text, { reply_markup: keyboard });
      }
      return;
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = pageProducts.map(
      (p) => [
        {
          text: `${p.name} - ${(p.price / 100).toFixed(2)}EUR`,
          callback_data: `product_${p.id}`,
        },
      ],
    );

    // Navigation
    const navRow: TelegramBot.InlineKeyboardButton[] = [];
    if (page > 0) {
      navRow.push({ text: "⬅️ Precedent", callback_data: `page_${page - 1}` });
    }
    if (page < totalPages - 1) {
      navRow.push({ text: "➡️ Suivant", callback_data: `page_${page + 1}` });
    }
    if (navRow.length > 0) buttons.push(navRow);

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const text = `📦 Produits (${products.length} total) - Page ${page + 1}/${totalPages}\n\nSelectionnez un produit:`;
    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === PRODUCT DETAIL ===
  async function sendProductDetail(
    chatId: number,
    productId: number,
    messageId?: number,
  ) {
    const product = await storage.getProduct(productId);
    if (!product) {
      bot.sendMessage(chatId, "Produit introuvable.");
      return;
    }

    const priceOptions = (product.priceOptions || []) as {
      price: number;
      weight: string;
    }[];
    let priceOptionsText =
      priceOptions.length > 0
        ? priceOptions
            .map((o, i) => `  ${i + 1}. ${o.price}€ ${o.weight}`)
            .join("\n")
        : "  Aucune option";

    const text =
      `📦 Produit #${product.id}\n\n` +
      `📝 Nom: ${product.name}\n` +
      `🏷️ Marque: ${product.brand}\n` +
      `💰 Prix de base: ${(product.price / 100).toFixed(2)} EUR\n` +
      `📁 Categorie: ${product.category}\n` +
      `📊 Stock: ${product.stock || "Non defini"}\n` +
      `📄 Description: ${product.description}\n\n` +
      `⚖️ Options de prix:\n${priceOptionsText}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✏️ Modifier nom", callback_data: `edit_name_${productId}` },
          {
            text: "💰 Modifier prix",
            callback_data: `edit_price_${productId}`,
          },
        ],
        [
          {
            text: "🏷️ Modifier marque",
            callback_data: `edit_brand_${productId}`,
          },
          {
            text: "📁 Modifier categorie",
            callback_data: `edit_category_${productId}`,
          },
        ],
        [
          {
            text: "📄 Modifier description",
            callback_data: `edit_description_${productId}`,
          },
        ],
        [
          {
            text: "⚖️ Gerer les options de prix",
            callback_data: `price_options_${productId}`,
          },
        ],
        [
          {
            text: "📊 Modifier stock",
            callback_data: `edit_stock_${productId}`,
          },
        ],
        [
          {
            text: "🖼️ Changer image/video",
            callback_data: `edit_image_${productId}`,
          },
        ],
        [
          {
            text: "🗑️ Supprimer",
            callback_data: `delete_confirm_${productId}`,
          },
        ],
        [{ text: "🔙 Retour aux produits", callback_data: "menu_products" }],
      ],
    };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === PRICE OPTIONS MANAGEMENT ===
  async function sendPriceOptions(
    chatId: number,
    productId: number,
    messageId?: number,
  ) {
    const product = await storage.getProduct(productId);
    if (!product) {
      bot.sendMessage(chatId, "Produit introuvable.");
      return;
    }

    const priceOptions = (product.priceOptions || []) as {
      price: number;
      weight: string;
    }[];

    let text = `⚖️ Gestion des options de prix\n📦 ${product.name}\n\n`;
    if (priceOptions.length === 0) {
      text += "Aucune option de prix configuree.";
    } else {
      text += "Options actuelles:\n";
      priceOptions.forEach((opt, i) => {
        text += `${i + 1}. ${opt.price}€ ${opt.weight}\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text: "➕ Ajouter une option",
          callback_data: `price_add_${productId}`,
        },
      ],
    ];

    if (priceOptions.length > 0) {
      priceOptions.forEach((opt, i) => {
        buttons.push([
          {
            text: `🗑️ Supprimer: ${opt.price}€ ${opt.weight}`,
            callback_data: `price_del_${productId}_${i}`,
          },
        ]);
      });
    }

    buttons.push([
      { text: "🔙 Retour au produit", callback_data: `product_${productId}` },
    ]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === STATS ===
  async function sendStats(chatId: number, messageId?: number) {
    const products = await storage.getProducts();
    const categories = Array.from(new Set(products.map((p) => p.category)));

    // Get order counts by status
    const pendingCount = await storage.getOrdersCount("pending");
    const sentCount = await storage.getOrdersCount("sent");
    const completedCount = await storage.getOrdersCount("completed");
    const totalOrders = await storage.getOrdersCount();

    // Get recent daily stats (last 7 days)
    const recentStats = await storage.getRecentDailyStats(7);

    let text =
      `📊 Statistiques PharmacyHash\n\n` +
      `📦 Produits: ${products.length}\n` +
      `📁 Categories: ${categories.length} (${categories.slice(0, 3).join(", ")}${categories.length > 3 ? "..." : ""})\n\n` +
      `📋 Commandes:\n` +
      `   ⏳ En attente: ${pendingCount}\n` +
      `   📤 Envoyees: ${sentCount}\n` +
      `   ✅ Terminees: ${completedCount}\n` +
      `   📊 Total: ${totalOrders}\n`;

    if (recentStats.length > 0) {
      text += `\n💰 Chiffre d'affaires (7 derniers jours):\n`;
      let totalRevenue = 0;
      let totalDailyOrders = 0;
      recentStats.forEach((stat) => {
        const revenue = (stat.revenue / 100).toFixed(2);
        const dateDisplay = stat.date.split("-").reverse().join("/");
        text += `   ${dateDisplay}: ${stat.orderCount} cmd - ${revenue}€\n`;
        totalRevenue += stat.revenue;
        totalDailyOrders += stat.orderCount;
      });
      text += `\n📈 Total période: ${totalDailyOrders} cmd - ${(totalRevenue / 100).toFixed(2)}€`;
    } else {
      text += `\n💰 Aucune donnée de vente enregistrée.`;
    }

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔄 Remettre CA à zéro",
            callback_data: "stats_reset_revenue",
          },
        ],
        [{ text: "🔙 Retour au menu", callback_data: "menu_main" }],
      ],
    };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === PROMO CODES ===
  async function sendPromoCodesList(chatId: number, messageId?: number) {
    const promoCodes = await storage.getPromoCodes();

    let text = "🏷️ Gestion des Codes Promo\n\n";

    if (promoCodes.length === 0) {
      text += "Aucun code promo pour le moment.";
    } else {
      text += "📋 Codes actifs:\n";
      promoCodes.forEach((promo, i) => {
        const status = promo.active ? "✅" : "❌";
        text += `${i + 1}. ${status} ${promo.code} - ${promo.discountPercent}%\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "➕ Créer un code promo", callback_data: "promo_create" }],
    ];

    if (promoCodes.length > 0) {
      promoCodes.forEach((promo) => {
        const toggleText = promo.active ? "⏸️ Désactiver" : "▶️ Activer";
        buttons.push([
          {
            text: `${toggleText}: ${promo.code}`,
            callback_data: `promo_toggle_${promo.id}`,
          },
          { text: `🗑️ Supprimer`, callback_data: `promo_delete_${promo.id}` },
        ]);
      });
    }

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === LOYALTY MENU ===
  async function sendLoyaltyMenu(chatId: number, messageId?: number) {
    const settings = await storage.getLoyaltySettings();
    const topUsers = await storage.getTopLoyaltyUsers(5);

    let text = "🎯 Programme de Fidélité\n\n";
    text += "⚙️ Paramètres actuels:\n";
    text += `  • Gain: ${settings.earnRate / 100} pt/€\n`;
    text += `  • Valeur: ${settings.redeemRate} pts = 1€\n`;
    text += `  • 🥉 Bronze: 0-${settings.silverThreshold - 1} pts (x1)\n`;
    text += `  • 🥈 Argent: ${settings.silverThreshold}-${settings.goldThreshold - 1} pts (x${(settings.silverMultiplier / 100).toFixed(2)})\n`;
    text += `  • 🥇 Or: ${settings.goldThreshold}+ pts (x${(settings.goldMultiplier / 100).toFixed(2)})\n`;

    if (topUsers.length > 0) {
      text += "\n🏆 Top clients:\n";
      topUsers.forEach((user, i) => {
        const tierEmoji =
          user.tier === "gold" ? "🥇" : user.tier === "silver" ? "🥈" : "🥉";
        text += `${i + 1}. ${tierEmoji} ID ${user.chatId}: ${user.points} pts (total: ${user.totalEarned})\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "🔍 Rechercher un client", callback_data: "loyalty_search" }],
      [
        {
          text: "⚙️ Modifier les parametres",
          callback_data: "loyalty_settings",
        },
      ],
      [{ text: "🔙 Retour au menu", callback_data: "menu_main" }],
    ];

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === PASSWORD MENU ===
  async function sendPasswordMenu(chatId: number, messageId?: number) {
    const passwords = await storage.getAccessPasswords();

    let text = "🔐 Gestion des mots de passe\n\n";
    text += "Les mots de passe sont cryptés pour la sécurité.\n";
    text += "Notez le mot de passe lors de sa création!\n\n";

    if (passwords.length === 0) {
      text += "Aucun mot de passe configuré.\n";
      text += "Créez un mot de passe pour protéger l'accès au bot.";
    } else {
      text += "Mots de passe:\n\n";
      passwords.forEach((pwd, i) => {
        const status = pwd.active ? "✅" : "❌";
        const usage = pwd.usageLimit
          ? `${pwd.usageCount}/${pwd.usageLimit}`
          : `${pwd.usageCount}`;
        const label = pwd.label || `#${pwd.id}`;
        text += `${i + 1}. ${status} ${label} - ${usage} utilisations\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "➕ Créer un mot de passe", callback_data: "password_add" }],
    ];

    passwords.forEach((pwd) => {
      const label = pwd.label || `#${pwd.id}`;
      buttons.push([
        {
          text: pwd.active ? `❌ Desact. ${label}` : `✅ Activer ${label}`,
          callback_data: `password_toggle_${pwd.id}`,
        },
        { text: `🗑️`, callback_data: `password_delete_${pwd.id}` },
      ]);
    });

    buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  async function sendLoyaltyUserDetail(
    chatId: number,
    targetChatId: string,
    messageId?: number,
  ) {
    const balance = await storage.getLoyaltyBalance(targetChatId);
    const transactions = await storage.getLoyaltyTransactions(targetChatId, 10);
    const botUser = await storage
      .getAllBotUsers()
      .then((users) => users.find((u) => u.chatId === targetChatId));

    let text = `🎯 Fidélité - Client ${targetChatId}\n`;
    if (botUser) {
      text += `👤 ${botUser.firstName || ""} ${botUser.username ? "@" + botUser.username : ""}\n`;
    }
    text += "\n";

    if (balance) {
      const tierEmoji =
        balance.tier === "gold"
          ? "🥇"
          : balance.tier === "silver"
            ? "🥈"
            : "🥉";
      text += `${tierEmoji} Niveau: ${balance.tier.toUpperCase()}\n`;
      text += `💰 Points actuels: ${balance.points}\n`;
      text += `📊 Total gagné: ${balance.totalEarned}\n`;
    } else {
      text += "Aucun historique de fidélité.\n";
    }

    if (transactions.length > 0) {
      text += "\n📜 Historique récent:\n";
      transactions.forEach((tx) => {
        const sign = tx.delta > 0 ? "+" : "";
        const date = tx.createdAt.split("T")[0];
        text += `  ${date}: ${sign}${tx.delta} pts (${tx.reason})\n`;
      });
    }

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [
        {
          text: "➕ Ajouter pts",
          callback_data: `loyalty_add_${targetChatId}`,
        },
        {
          text: "➖ Retirer pts",
          callback_data: `loyalty_remove_${targetChatId}`,
        },
      ],
      [{ text: "🔙 Retour", callback_data: "menu_loyalty" }],
    ];

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  async function sendLoyaltySettings(chatId: number, messageId?: number) {
    const settings = await storage.getLoyaltySettings();

    let text = "⚙️ Paramètres du Programme de Fidélité\n\n";
    text += `📈 Taux de gain: ${settings.earnRate / 100} point(s) par euro\n`;
    text += `💰 Taux de remboursement: ${settings.redeemRate} points = 1€\n\n`;
    text += `🥉 Seuil Bronze: ${settings.bronzeThreshold} pts\n`;
    text += `🥈 Seuil Argent: ${settings.silverThreshold} pts (bonus x${(settings.silverMultiplier / 100).toFixed(2)})\n`;
    text += `🥇 Seuil Or: ${settings.goldThreshold} pts (bonus x${(settings.goldMultiplier / 100).toFixed(2)})\n`;

    const buttons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "✏️ Modifier taux gain", callback_data: "loyalty_set_earn" }],
      [
        {
          text: "✏️ Modifier taux remboursement",
          callback_data: "loyalty_set_redeem",
        },
      ],
      [
        {
          text: "✏️ Modifier seuil Argent",
          callback_data: "loyalty_set_silver",
        },
      ],
      [{ text: "✏️ Modifier seuil Or", callback_data: "loyalty_set_gold" }],
      [{ text: "🔙 Retour", callback_data: "menu_loyalty" }],
    ];

    const keyboard = { inline_keyboard: buttons };

    if (messageId) {
      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
    } else {
      bot.sendMessage(chatId, text, { reply_markup: keyboard });
    }
  }

  // === /start COMMAND ===
  bot.onText(/\/start(?:\s+(.*))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startParam = match?.[1]?.trim() || "";

    console.log("Start command received, param:", startParam);

    // Check if this is an order start
    if (startParam && startParam.startsWith("order_")) {
      const orderCode = startParam.replace("order_", "");

      try {
        const order = await storage.getOrderByCode(orderCode);

        if (!order) {
          bot.sendMessage(chatId, "Commande introuvable.");
          return;
        }

        // Get customer info
        const customerName = msg.from?.first_name || "Client";
        const customerUsername = msg.from?.username
          ? `@${msg.from.username}`
          : "";

        // Build order message for admin
        let adminMessage = `Nouvelle commande de ${customerName} ${customerUsername}\n`;
        adminMessage += `ID Client: ${chatId}\n\n`;
        adminMessage += order.orderData;
        adminMessage += `\n\nCode: ${orderCode}`;

        // Get all admin IDs (from env + database)
        const allAdminIds = new Set<string>();

        // Add env admins
        const envAdminId = process.env.ADMIN_TELEGRAM_ID;
        if (envAdminId) {
          envAdminId.split(",").forEach((id) => allAdminIds.add(id.trim()));
        }

        // Add database admins
        try {
          const dbAdmins = await storage.getAdmins();
          dbAdmins.forEach((admin: { telegramId: string }) =>
            allAdminIds.add(admin.telegramId),
          );
        } catch (err) {
          console.error("Failed to fetch db admins:", err);
        }

        // Send to all admins in parallel (no await) for speed
        const adminPromises = Array.from(allAdminIds).map((aid) =>
          bot
            .sendMessage(parseInt(aid), adminMessage, {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Contacter le client",
                      url: `tg://user?id=${chatId}`,
                    },
                  ],
                  [
                    {
                      text: "⭐ Ajouter points fidélité",
                      callback_data: `order_points_${orderCode}_${chatId}`,
                    },
                  ],
                ],
              },
            })
            .then(() => console.log(`Order sent to admin ${aid}`))
            .catch((err) =>
              console.error(`Failed to send order to admin ${aid}:`, err),
            ),
        );

        // Update order status and confirm to customer in parallel with admin notifications
        const [,] = await Promise.all([
          Promise.all(adminPromises),
          storage.updateOrderStatus(orderCode, "sent"),
        ]);

        // Confirm to customer (fire and forget)
        bot
          .sendMessage(
            chatId,
            `Merci pour votre commande!\n\nVotre commande (${orderCode}) a été envoyée à notre équipe.\nNous vous contacterons très bientôt pour finaliser.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Retour à la boutique",
                      web_app: { url: process.env.PUBLISHED_URL || "" },
                    },
                  ],
                ],
              },
            },
          )
          .catch((err) =>
            console.error("Failed to confirm order to customer:", err),
          );
        return;
      } catch (err) {
        console.error("Order processing error:", err);
        bot.sendMessage(chatId, "Une erreur est survenue. Veuillez réessayer.");
        return;
      }
    }

    // Check if this is a review request
    if (startParam === "review") {
      const session = getSession(chatId);
      session.state = "awaiting_review";

      bot.sendMessage(
        chatId,
        "Merci de vouloir laisser un avis!\n\nÉcrivez votre avis ci-dessous et nous le transmettrons à notre équipe:",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Annuler", callback_data: "cancel_review" }],
            ],
          },
        },
      );
      return;
    }

    // Save user to database for promo messages
    try {
      await storage.upsertBotUser({
        chatId: chatId.toString(),
        username: msg.from?.username || null,
        firstName: msg.from?.first_name || null,
        isUnlocked: false,
        unlockedAt: null,
      });
    } catch (err) {
      console.error("Failed to save bot user:", err);
    }

    // Admins bypass password, clients must be unlocked
    const userIsAdmin = await isAdmin(chatId);
    const userIsUnlocked = await storage.isUserUnlocked(chatId.toString());

    if (!userIsAdmin && !userIsUnlocked) {
      const session = getSession(chatId);
      session.state = "awaiting_password";

      bot.sendMessage(
        chatId,
        "Bienvenue! Pour accéder à PharmacyHash, veuillez entrer le mot de passe:",
      );
      return;
    }

    // Normal start - show welcome
    const webAppUrl =
      process.env.PUBLISHED_URL ||
      (process.env.REPL_ID
        ? `https://${process.env.REPL_ID}.replit.app`
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`);

    // Check for custom start photo
    const customPhotoFileId = await storage.getBotSetting(
      "start_photo_file_id",
    );
    const welcomeCaption =
      "Bienvenue dans l'univers PharmacyHash!\nUn clic et hop - la Mini App s'ouvre pour toi.";

    // Build keyboard with custom buttons
    const keyboardButtons: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: "Ouvrir PharmacyHash", web_app: { url: webAppUrl } }],
    ];

    // Add custom client buttons
    try {
      const customButtons = await storage.getClientButtons(true); // Only active buttons
      for (const btn of customButtons) {
        if (btn.url) {
          // URL button
          keyboardButtons.push([{ text: btn.label, url: btn.url }]);
        } else if (btn.action === "open_app") {
          // Open mini app button
          keyboardButtons.push([
            { text: btn.label, web_app: { url: webAppUrl } },
          ]);
        } else if (btn.action === "contact_admin") {
          // Contact admin button - get first admin ID
          const envAdminId =
            process.env.ADMIN_TELEGRAM_ID?.split(",")[0]?.trim();
          if (envAdminId) {
            keyboardButtons.push([
              { text: btn.label, url: `tg://user?id=${envAdminId}` },
            ]);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching custom buttons:", err);
    }

    const welcomeKeyboard = { inline_keyboard: keyboardButtons };

    if (customPhotoFileId) {
      // Use custom photo from Telegram file_id
      try {
        await bot.sendPhoto(chatId, customPhotoFileId, {
          caption: welcomeCaption,
          reply_markup: welcomeKeyboard,
        });
      } catch (err) {
        console.error("Error sending custom photo:", err);
        bot.sendMessage(chatId, welcomeCaption, {
          reply_markup: welcomeKeyboard,
        });
      }
    } else {
      // Use default photo from file
      const imagePath = resolve(
        "./client/public/images/pharmacyhash-start.jpg",
      );
      try {
        const photoStream = createReadStream(imagePath);
        bot.sendPhoto(chatId, photoStream, {
          caption: welcomeCaption,
          reply_markup: welcomeKeyboard,
        });
      } catch (err) {
        bot.sendMessage(chatId, welcomeCaption, {
          reply_markup: welcomeKeyboard,
        });
      }
    }
  });

  // === /admin COMMAND ===
  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;

    if (!(await isAdmin(chatId))) {
      bot.sendMessage(chatId, "Acces refuse.");
      return;
    }

    resetSession(chatId);
    sendMainMenu(chatId);
  });

  // === /cancel COMMAND ===
  bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    if (!(await isAdmin(chatId))) return;

    resetSession(chatId);
    bot.sendMessage(chatId, "Operation annulee.");
    sendMainMenu(chatId);
  });

  // === CALLBACK QUERIES (Button clicks) ===
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data;

    if (!chatId || !data) return;
    if (!(await isAdmin(chatId))) {
      bot.answerCallbackQuery(query.id, { text: "Acces refuse" });
      return;
    }

    bot.answerCallbackQuery(query.id);
    const session = getSession(chatId);

    // No operation - for disabled buttons
    if (data === "noop") {
      return;
    }

    // Main menu
    if (data === "menu_main") {
      resetSession(chatId);
      sendMainMenu(chatId, messageId);
      return;
    }

    // Products list
    if (data === "menu_products") {
      sendProductList(chatId, messageId);
      return;
    }

    // Page navigation
    if (data.startsWith("page_")) {
      const page = parseInt(data.split("_")[1]);
      sendProductList(chatId, messageId, page);
      return;
    }

    // Product detail
    if (data.startsWith("product_")) {
      const productId = parseInt(data.split("_")[1]);
      sendProductDetail(chatId, productId, messageId);
      return;
    }

    // Stats
    if (data === "menu_stats") {
      sendStats(chatId, messageId);
      return;
    }

    // Reset revenue stats
    if (data === "stats_reset_revenue") {
      await storage.resetDailyStats();
      bot.answerCallbackQuery(query.id, {
        text: "Chiffre d'affaires remis a zero!",
      });
      sendStats(chatId, messageId);
      return;
    }

    // Orders list
    if (data === "menu_orders") {
      sendOrderList(chatId, messageId);
      return;
    }

    // Reviews management
    if (data === "menu_reviews") {
      sendReviewsList(chatId, messageId);
      return;
    }

    // Client buttons menu
    if (data === "menu_client_buttons") {
      sendClientButtonsMenu(chatId, messageId);
      return;
    }

    // Client buttons - add new
    if (data === "btn_add") {
      session.state = "awaiting_button_label";
      session.newButton = {};
      bot.editMessageText(
        "🔘 Nouveau bouton\n\nEntrez le texte du bouton (ce que le client verra):",
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Annuler", callback_data: "menu_client_buttons" }],
            ],
          },
        },
      );
      return;
    }

    // Client buttons - list
    if (data === "btn_list") {
      sendClientButtonsList(chatId, messageId);
      return;
    }

    // Client buttons - view
    if (data.startsWith("btn_view_")) {
      const buttonId = parseInt(data.replace("btn_view_", ""));
      sendClientButtonDetails(chatId, buttonId, messageId);
      return;
    }

    // Client buttons - toggle
    if (data.startsWith("btn_toggle_")) {
      const parts = data.split("_");
      const buttonId = parseInt(parts[2]);
      const active = parts[3] === "1";
      await storage.toggleClientButton(buttonId, active);
      sendClientButtonDetails(chatId, buttonId, messageId);
      return;
    }

    // Client buttons - delete
    if (data.startsWith("btn_delete_")) {
      const buttonId = parseInt(data.replace("btn_delete_", ""));
      await storage.deleteClientButton(buttonId);
      bot.answerCallbackQuery(query.id, { text: "Bouton supprime!" });
      sendClientButtonsMenu(chatId, messageId);
      return;
    }

    // Client buttons - skip URL (action only)
    if (data === "btn_skip_url") {
      session.state = "awaiting_button_action";
      bot.editMessageText(
        "⚙️ Entrez l'action du bouton:\n\n• open_app - Ouvrir la mini app\n• contact_admin - Contacter un admin\n• Ou tapez une action personnalisée",
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🛒 open_app (ouvrir boutique)",
                  callback_data: "btn_action_open_app",
                },
              ],
              [
                {
                  text: "💬 contact_admin",
                  callback_data: "btn_action_contact_admin",
                },
              ],
              [{ text: "❌ Annuler", callback_data: "menu_client_buttons" }],
            ],
          },
        },
      );
      return;
    }

    // Client buttons - predefined actions
    if (data.startsWith("btn_action_")) {
      const action = data.replace("btn_action_", "");
      if (session.newButton) {
        session.newButton.action = action;

        // Create the button
        const allButtons = await storage.getClientButtons();
        await storage.createClientButton({
          label: session.newButton.label!,
          url: session.newButton.url || null,
          action: session.newButton.action,
          position: allButtons.length,
          active: true,
        });

        resetSession(chatId);
        bot.answerCallbackQuery(query.id, { text: "Bouton cree!" });
        sendClientButtonsMenu(chatId, messageId);
      }
      return;
    }

    // Order filters
    if (data === "orders_filter_pending") {
      sendOrderList(chatId, messageId, 0, "pending");
      return;
    }
    if (data === "orders_filter_sent") {
      sendOrderList(chatId, messageId, 0, "sent");
      return;
    }
    if (data === "orders_filter_all") {
      sendOrderList(chatId, messageId, 0);
      return;
    }

    // Order page navigation
    if (data.startsWith("orders_page_")) {
      const parts = data.split("_");
      const page = parseInt(parts[2]);
      const statusFilter = parts[3] === "all" ? undefined : parts[3];
      sendOrderList(chatId, messageId, page, statusFilter);
      return;
    }

    // Order done (from notification)
    if (data.startsWith("order_done_")) {
      const orderCode = data.replace("order_done_", "");
      try {
        await storage.updateOrderStatus(orderCode, "sent");
        bot.editMessageText(`✅ Commande ${orderCode} marquée comme traitée!`, {
          chat_id: chatId,
          message_id: messageId,
        });
      } catch (err) {
        console.error("Error marking order as done:", err);
      }
      return;
    }

    // Order detail
    if (
      data.startsWith("order_") &&
      !data.startsWith("order_status_") &&
      !data.startsWith("order_delete_") &&
      !data.startsWith("order_done_") &&
      !data.startsWith("order_points_")
    ) {
      const orderCode = data.replace("order_", "");
      sendOrderDetail(chatId, orderCode, messageId);
      return;
    }

    // Order points menu - show loyalty management options for this customer
    if (data.startsWith("order_points_")) {
      const parts = data.replace("order_points_", "").split("_");
      const orderCode = parts[0];
      const customerChatId = parts[1];

      try {
        // Fetch order, balance, and settings in parallel
        const [order, balance, settings] = await Promise.all([
          storage.getOrderByCode(orderCode),
          storage.getLoyaltyBalance(customerChatId),
          storage.getLoyaltySettings(),
        ]);

        if (!order) {
          bot.answerCallbackQuery(query.id, { text: "Commande introuvable" });
          return;
        }

        // Calculate points for this order
        const totalMatch = order.orderData.match(
          /Total\s*:\s*(\d+(?:[.,]\d+)?)\s*€/i,
        );
        const orderTotal = totalMatch
          ? parseFloat(totalMatch[1].replace(",", "."))
          : 0;
        const earnRate = settings.earnRate / 100;
        const suggestedPoints = Math.floor(orderTotal * earnRate);

        const tierLabels: Record<string, string> = {
          bronze: "🥉 Bronze",
          silver: "🥈 Argent",
          gold: "🥇 Or",
        };

        let text = `⭐ Gestion Fidélité - Client ${customerChatId}\n\n`;
        text += `📋 Commande: ${orderCode}\n`;
        text += `💰 Total commande: ${orderTotal}€\n`;
        text += `📊 Points suggérés: ${suggestedPoints} pts\n\n`;
        text += `💎 Solde actuel: ${balance?.points || 0} points\n`;
        text += `🏆 Niveau: ${tierLabels[balance?.tier || "bronze"] || "Bronze"}\n`;
        text += `📈 Total gagné: ${balance?.totalEarned || 0} pts`;

        const buttons: TelegramBot.InlineKeyboardButton[][] = [
          [
            {
              text: `➕ Ajouter ${suggestedPoints} pts (auto)`,
              callback_data: `loy_add_auto_${orderCode}_${customerChatId}_${suggestedPoints}`,
            },
          ],
          [
            {
              text: "➕ Ajouter pts manuellement",
              callback_data: `loy_add_manual_${customerChatId}`,
            },
          ],
          [
            {
              text: "➖ Retirer des points",
              callback_data: `loy_remove_${customerChatId}`,
            },
          ],
          [
            {
              text: "📜 Voir historique",
              callback_data: `loy_history_${customerChatId}`,
            },
          ],
          [
            {
              text: "📞 Contacter le client",
              url: `tg://user?id=${customerChatId}`,
            },
          ],
          [{ text: "🔙 Retour", callback_data: `order_${orderCode}` }],
        ];

        if (messageId) {
          bot
            .editMessageText(text, {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: { inline_keyboard: buttons },
            })
            .catch(() => {});
        } else {
          bot.sendMessage(chatId, text, {
            reply_markup: { inline_keyboard: buttons },
          });
        }
      } catch (err) {
        console.error("Error showing order points menu:", err);
        bot.answerCallbackQuery(query.id, { text: "Erreur" });
      }
      return;
    }

    // Auto add points from order
    if (data.startsWith("loy_add_auto_")) {
      const parts = data.replace("loy_add_auto_", "").split("_");
      const orderCode = parts[0];
      const customerChatId = parts[1];
      const pointsToAdd = parseInt(parts[2]);

      if (pointsToAdd <= 0) {
        bot.answerCallbackQuery(query.id, { text: "Pas de points à ajouter" });
        return;
      }

      try {
        await storage.addLoyaltyPoints(
          customerChatId,
          pointsToAdd,
          "order",
          `Commande ${orderCode}`,
          orderCode,
        );

        const balance = await storage.getLoyaltyBalance(customerChatId);

        bot.answerCallbackQuery(query.id, {
          text: `✅ ${pointsToAdd} points ajoutés!`,
        });

        // Update menu to show success
        const tierLabels: Record<string, string> = {
          bronze: "🥉 Bronze",
          silver: "🥈 Argent",
          gold: "🥇 Or",
        };

        let text = `✅ Points ajoutés avec succès!\n\n`;
        text += `📋 Commande: ${orderCode}\n`;
        text += `➕ Points ajoutés: ${pointsToAdd}\n\n`;
        text += `💎 Nouveau solde: ${balance?.points || pointsToAdd} points\n`;
        text += `🏆 Niveau: ${tierLabels[balance?.tier || "bronze"] || "Bronze"}`;

        if (messageId) {
          bot
            .editMessageText(text, {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "📞 Contacter le client",
                      url: `tg://user?id=${customerChatId}`,
                    },
                  ],
                  [
                    {
                      text: "🔙 Retour à la commande",
                      callback_data: `order_${orderCode}`,
                    },
                  ],
                ],
              },
            })
            .catch(() => {});
        }

        // Notify customer
        bot
          .sendMessage(
            parseInt(customerChatId),
            `🎉 Félicitations! Vous avez gagné ${pointsToAdd} points fidélité pour votre commande!\n\n` +
              `💎 Votre solde actuel: ${balance?.points || pointsToAdd} points\n` +
              `🏆 Niveau: ${tierLabels[balance?.tier || "bronze"] || "Bronze"}`,
          )
          .catch((err) => console.error("Failed to notify customer:", err));
      } catch (err) {
        console.error("Error adding auto points:", err);
        bot.answerCallbackQuery(query.id, { text: "Erreur lors de l'ajout" });
      }
      return;
    }

    // Manual add points - set state
    if (data.startsWith("loy_add_manual_")) {
      const customerChatId = data.replace("loy_add_manual_", "");
      session.state = "awaiting_loyalty_add";
      session.loyaltyTargetChatId = customerChatId;

      bot
        .editMessageText(
          `Entrez le nombre de points à ajouter pour le client ${customerChatId}:\n\n(Envoyez un nombre positif)`,
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Annuler", callback_data: "menu_main" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    // Remove points - set state
    if (data.startsWith("loy_remove_")) {
      const customerChatId = data.replace("loy_remove_", "");
      session.state = "awaiting_loyalty_remove";
      session.loyaltyTargetChatId = customerChatId;

      bot
        .editMessageText(
          `Entrez le nombre de points à retirer pour le client ${customerChatId}:\n\n(Envoyez un nombre positif)`,
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Annuler", callback_data: "menu_main" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    // View loyalty history
    if (data.startsWith("loy_history_")) {
      const customerChatId = data.replace("loy_history_", "");

      try {
        const transactions = await storage.getLoyaltyTransactions(
          customerChatId,
          10,
        );
        const balance = await storage.getLoyaltyBalance(customerChatId);

        let text = `📜 Historique Fidélité - Client ${customerChatId}\n\n`;
        text += `💎 Solde: ${balance?.points || 0} pts | 🏆 ${balance?.tier || "Bronze"}\n\n`;

        if (transactions.length === 0) {
          text += "Aucune transaction.";
        } else {
          for (const tx of transactions) {
            const sign = tx.delta > 0 ? "+" : "";
            const date = tx.createdAt
              ? new Date(tx.createdAt).toLocaleDateString("fr-FR")
              : "";
            text += `${sign}${tx.delta} pts - ${tx.reason}${tx.description ? ` (${tx.description})` : ""} ${date}\n`;
          }
        }

        if (messageId) {
          bot
            .editMessageText(text, {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "➕ Ajouter pts",
                      callback_data: `loy_add_manual_${customerChatId}`,
                    },
                  ],
                  [
                    {
                      text: "➖ Retirer pts",
                      callback_data: `loy_remove_${customerChatId}`,
                    },
                  ],
                  [{ text: "🔙 Retour", callback_data: "menu_loyalty" }],
                ],
              },
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("Error fetching loyalty history:", err);
        bot.answerCallbackQuery(query.id, { text: "Erreur" });
      }
      return;
    }

    if (data.startsWith("order_status_")) {
      const parts = data.split("_");
      const orderCode = parts[2];
      const newStatus = parts[3];

      await storage.updateOrderStatus(orderCode, newStatus);

      const statusLabels: Record<string, string> = {
        pending: "En attente",
        sent: "Envoyée",
        completed: "Terminée",
        cancelled: "Annulée",
      };

      bot.answerCallbackQuery(query.id, {
        text: `Statut changé: ${statusLabels[newStatus] || newStatus}`,
      });
      sendOrderDetail(chatId, orderCode, messageId);
      return;
    }

    // Order delete
    if (data.startsWith("order_delete_")) {
      const orderCode = data.replace("order_delete_", "");
      try {
        await storage.deleteOrder(orderCode);
        bot.answerCallbackQuery(query.id, { text: "Commande supprimée" });
        sendOrderList(chatId, messageId);
      } catch (err) {
        console.error("Failed to delete order:", err);
        bot.sendMessage(chatId, "Erreur lors de la suppression.");
      }
      return;
    }

    // Promo menu
    if (data === "menu_promo") {
      const usersCount = await storage.getBotUsersCount();
      session.state = "awaiting_promo_text";
      bot
        .editMessageText(
          `Envoyer une Promo\n\nNombre d'utilisateurs: ${usersCount}\n\nÉcrivez votre message promotionnel:`,
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "Annuler", callback_data: "menu_main" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    // Promo confirm
    if (data === "promo_confirm") {
      const promoText = session.promoText;
      if (!promoText) {
        bot.sendMessage(chatId, "Aucun message promo.");
        sendMainMenu(chatId);
        return;
      }

      const users = await storage.getAllBotUsers();
      let sent = 0;
      let failed = 0;

      bot
        .editMessageText(`Envoi en cours à ${users.length} utilisateurs...`, {
          chat_id: chatId,
          message_id: messageId,
        })
        .catch(() => {});

      for (const user of users) {
        try {
          await bot.sendMessage(parseInt(user.chatId), promoText);
          sent++;
          // Small delay to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err) {
          failed++;
          console.error(`Failed to send promo to ${user.chatId}:`, err);
        }
      }

      resetSession(chatId);
      bot.sendMessage(
        chatId,
        `Promo envoyée!\n\nEnvoyés: ${sent}\nÉchecs: ${failed}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Retour au menu", callback_data: "menu_main" }],
            ],
          },
        },
      );
      return;
    }

    // Promo cancel
    if (data === "promo_cancel") {
      resetSession(chatId);
      sendMainMenu(chatId, messageId);
      return;
    }

    // Review cancel
    if (data === "cancel_review") {
      resetSession(chatId);
      bot
        .editMessageText("Avis annule.", {
          chat_id: chatId,
          message_id: messageId,
        })
        .catch(() => {});
      return;
    }

    // Review approve
    if (data.startsWith("review_approve_")) {
      const reviewId = parseInt(data.split("_")[2]);
      try {
        await storage.approveReview(reviewId);
        bot
          .editMessageText("Avis approuve et publie sur le site!", {
            chat_id: chatId,
            message_id: messageId,
          })
          .catch(() => {});
      } catch (err) {
        console.error("Failed to approve review:", err);
        bot.sendMessage(chatId, "Erreur lors de l'approbation.");
      }
      return;
    }

    // Review delete
    if (data.startsWith("review_delete_")) {
      const reviewId = parseInt(data.split("_")[2]);
      try {
        await storage.deleteReview(reviewId);
        bot
          .editMessageText("Avis supprimé.", {
            chat_id: chatId,
            message_id: messageId,
          })
          .catch(() => {});
      } catch (err) {
        console.error("Failed to delete review:", err);
        bot.sendMessage(chatId, "Erreur lors de la suppression.");
      }
      return;
    }

    // Promo codes menu
    if (data === "menu_promo_codes") {
      sendPromoCodesList(chatId, messageId);
      return;
    }

    // Create promo code
    if (data === "promo_create") {
      session.state = "awaiting_promo_code";
      bot
        .editMessageText(
          "Créer un code promo\n\nEntrez le code et le pourcentage de réduction:\nFormat: CODE POURCENTAGE\n\nExemple: NOEL25 25",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "Annuler", callback_data: "menu_promo_codes" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    // Toggle promo code
    if (data.startsWith("promo_toggle_")) {
      const promoId = parseInt(data.split("_")[2]);
      try {
        const promos = await storage.getPromoCodes();
        const promo = promos.find((p) => p.id === promoId);
        if (promo) {
          await storage.togglePromoCode(promoId, !promo.active);
        }
        sendPromoCodesList(chatId, messageId);
      } catch (err) {
        console.error("Failed to toggle promo:", err);
        bot.sendMessage(chatId, "Erreur lors de la modification.");
      }
      return;
    }

    // Delete promo code
    if (data.startsWith("promo_delete_")) {
      const promoId = parseInt(data.split("_")[2]);
      try {
        await storage.deletePromoCode(promoId);
        sendPromoCodesList(chatId, messageId);
      } catch (err) {
        console.error("Failed to delete promo:", err);
        bot.sendMessage(chatId, "Erreur lors de la suppression.");
      }
      return;
    }

    // Add product
    if (data === "menu_add") {
      session.state = "awaiting_name";
      session.newProduct = {};
      bot
        .editMessageText(
          "Ajout d'un nouveau produit\n\nEtape 1/5: Entrez le nom du produit:",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    // Edit fields
    if (data.startsWith("edit_")) {
      const parts = data.split("_");
      const field = parts[1] as
        | "name"
        | "brand"
        | "description"
        | "price"
        | "category"
        | "image";
      const productId = parseInt(parts[2]);

      if (field === "image") {
        session.state = "awaiting_image";
        session.editingProductId = productId;
        bot
          .editMessageText(
            "Envoyez maintenant une photo ou video pour ce produit.\n\nOu tapez /cancel pour annuler.",
            { chat_id: chatId, message_id: messageId },
          )
          .catch(() => {});
        return;
      }

      session.state = "awaiting_edit_value";
      session.editingProductId = productId;
      session.editingField = field;

      const fieldNames: Record<string, string> = {
        name: "nom",
        brand: "marque",
        description: "description",
        price: "prix (en centimes, ex: 5000 pour 50EUR)",
        category: "categorie",
      };

      bot
        .editMessageText(
          `Entrez la nouvelle valeur pour ${fieldNames[field]}:`,
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    // Delete confirmation
    if (data.startsWith("delete_confirm_")) {
      const productId = parseInt(data.split("_")[2]);
      const product = await storage.getProduct(productId);

      if (!product) {
        bot.sendMessage(chatId, "Produit introuvable.");
        return;
      }

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "Oui, supprimer",
              callback_data: `delete_yes_${productId}`,
            },
            { text: "Non, annuler", callback_data: `product_${productId}` },
          ],
        ],
      };

      bot
        .editMessageText(`Voulez-vous vraiment supprimer "${product.name}"?`, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        })
        .catch(() => {});
      return;
    }

    // Delete confirmed
    if (data.startsWith("delete_yes_")) {
      const productId = parseInt(data.split("_")[2]);
      await storage.deleteProduct(productId);

      bot
        .editMessageText("Produit supprimé avec succès!", {
          chat_id: chatId,
          message_id: messageId,
        })
        .catch(() => {});

      setTimeout(() => sendProductList(chatId), 1500);
      return;
    }

    // Price options management
    if (data.startsWith("price_options_")) {
      const productId = parseInt(data.split("_")[2]);
      sendPriceOptions(chatId, productId, messageId);
      return;
    }

    if (data.startsWith("price_add_")) {
      const productId = parseInt(data.split("_")[2]);
      session.state = "awaiting_price_option";
      session.editingProductId = productId;
      bot
        .editMessageText(
          "Ajouter une option de prix\n\nFormat: prix poids\nExemple: 160 5g\n\nEntrez l'option:",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data.startsWith("price_del_")) {
      const parts = data.split("_");
      const productId = parseInt(parts[2]);
      const optionIndex = parseInt(parts[3]);

      const product = await storage.getProduct(productId);
      if (product) {
        const priceOptions = (
          (product.priceOptions || []) as { price: number; weight: string }[]
        ).filter((_, i) => i !== optionIndex);
        await storage.updateProduct(productId, { priceOptions } as any);
      }

      sendPriceOptions(chatId, productId, messageId);
      return;
    }

    // Stock editing
    if (data.startsWith("edit_stock_")) {
      const productId = parseInt(data.split("_")[2]);
      session.state = "awaiting_stock";
      session.editingProductId = productId;
      bot
        .editMessageText(
          "Entrez la valeur du stock (ex: 100g, 500g, En stock):",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    // Admin management
    if (data === "menu_admins") {
      sendAdminList(chatId, messageId);
      return;
    }

    if (data === "admin_add") {
      session.state = "awaiting_admin_id";
      bot
        .editMessageText(
          "Entrez l'ID Telegram du nouvel admin:\n\n(L'utilisateur peut obtenir son ID en envoyant /start a @userinfobot)",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data === "admin_remove_list") {
      sendAdminRemoveList(chatId, messageId);
      return;
    }

    if (data.startsWith("admin_remove_")) {
      const adminId = parseInt(data.split("_")[2]);
      await storage.removeAdmin(adminId);

      bot
        .editMessageText("Admin supprimé avec succès!", {
          chat_id: chatId,
          message_id: messageId,
        })
        .catch(() => {});

      setTimeout(() => sendAdminList(chatId), 1500);
      return;
    }

    // Loyalty menu
    if (data === "menu_loyalty") {
      sendLoyaltyMenu(chatId, messageId);
      return;
    }

    // === PASSWORD MENU ===
    if (data === "menu_passwords") {
      await sendPasswordMenu(chatId, messageId);
      return;
    }

    if (data === "password_add") {
      session.state = "awaiting_new_password";
      bot
        .editMessageText(
          "🔐 Créer un nouveau mot de passe\n\nEntrez le mot de passe à créer:",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data.startsWith("password_toggle_")) {
      const pwdId = parseInt(data.replace("password_toggle_", ""));
      const passwords = await storage.getAccessPasswords();
      const pwd = passwords.find((p) => p.id === pwdId);
      if (pwd) {
        await storage.toggleAccessPassword(pwdId, !pwd.active);
        bot.answerCallbackQuery(query.id, {
          text: pwd.active ? "Desactive" : "Active",
        });
      }
      await sendPasswordMenu(chatId, messageId);
      return;
    }

    if (data.startsWith("password_delete_")) {
      const pwdId = parseInt(data.replace("password_delete_", ""));
      await storage.deleteAccessPassword(pwdId);
      bot.answerCallbackQuery(query.id, { text: "Supprime" });
      await sendPasswordMenu(chatId, messageId);
      return;
    }

    if (data === "cancel_password") {
      resetSession(chatId);
      bot
        .editMessageText("Operation annulee.", {
          chat_id: chatId,
          message_id: messageId,
        })
        .catch(() => {});
      return;
    }

    // === START PHOTO MENU ===
    if (data === "menu_start_photo") {
      const currentPhoto = await storage.getBotSetting("start_photo_file_id");
      let text = "🖼️ Photo de bienvenue\n\n";
      text += currentPhoto
        ? "Une photo personnalisee est configuree.\n"
        : "Aucune photo personnalisee. La photo par defaut sera utilisee.\n";
      text += "\nEnvoyez une nouvelle photo pour la changer.";

      session.state = "awaiting_start_photo";

      const buttons: TelegramBot.InlineKeyboardButton[][] = [];
      if (currentPhoto) {
        buttons.push([
          {
            text: "🗑️ Supprimer la photo personnalisee",
            callback_data: "start_photo_delete",
          },
        ]);
      }
      buttons.push([{ text: "🔙 Retour au menu", callback_data: "menu_main" }]);

      bot
        .editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: buttons },
        })
        .catch(() => {});
      return;
    }

    if (data === "start_photo_delete") {
      await storage.setBotSetting("start_photo_file_id", "");
      resetSession(chatId);
      bot.answerCallbackQuery(query.id, { text: "Photo supprimée" });
      sendMainMenu(chatId, messageId);
      return;
    }

    // === USERS MENU ===
    if (data === "menu_users") {
      await sendUsersMenu(chatId, messageId);
      return;
    }

    if (data === "users_list") {
      await sendUsersList(chatId, messageId, 0);
      return;
    }

    if (data.startsWith("users_page_")) {
      const page = parseInt(data.replace("users_page_", ""));
      await sendUsersList(chatId, messageId, page);
      return;
    }

    if (data === "users_search") {
      session.state = "awaiting_user_search";
      bot
        .editMessageText(
          "🔍 Rechercher un utilisateur\n\nEntrez l'ID Telegram:",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Annuler", callback_data: "menu_users" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    if (data === "users_send_message") {
      session.state = "awaiting_user_msg_id";
      bot
        .editMessageText(
          "📨 Envoyer un message\n\nEntrez l'ID Telegram du destinataire:",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Annuler", callback_data: "menu_users" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    if (data.startsWith("user_msg_")) {
      const userChatId = data.replace("user_msg_", "");
      session.state = "awaiting_user_msg_text";
      session.targetUserId = userChatId;
      bot
        .editMessageText(
          `📨 Message pour ${userChatId}\n\nÉcrivez votre message:`,
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Annuler", callback_data: "menu_users" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    if (data === "users_broadcast") {
      session.state = "awaiting_broadcast_msg";
      bot
        .editMessageText(
          "📢 Message à tous les utilisateurs\n\nÉcrivez le message à envoyer:",
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Annuler", callback_data: "menu_users" }],
              ],
            },
          },
        )
        .catch(() => {});
      return;
    }

    if (data.startsWith("user_view_")) {
      const userChatId = data.replace("user_view_", "");
      await sendUserDetails(chatId, userChatId, messageId);
      return;
    }

    if (data.startsWith("user_lock_")) {
      const userChatId = data.replace("user_lock_", "");
      await storage.lockUser(userChatId);
      bot.answerCallbackQuery(query.id, { text: "Utilisateur verrouille" });
      await sendUserDetails(chatId, userChatId, messageId);
      return;
    }

    if (data.startsWith("user_unlock_")) {
      const userChatId = data.replace("user_unlock_", "");
      await storage.unlockUser(userChatId);
      bot.answerCallbackQuery(query.id, { text: "Utilisateur deverrouille" });
      await sendUserDetails(chatId, userChatId, messageId);
      return;
    }

    if (data.startsWith("user_delete_")) {
      const userChatId = data.replace("user_delete_", "");
      await storage.deleteBotUser(userChatId);
      bot.answerCallbackQuery(query.id, { text: "Utilisateur supprime" });
      await sendUsersList(chatId, messageId, 0);
      return;
    }

    if (data === "users_lock_all") {
      await storage.lockAllUsers();
      bot.answerCallbackQuery(query.id, {
        text: "Tous les utilisateurs verrouilles",
      });
      await sendUsersMenu(chatId, messageId);
      return;
    }

    if (data === "users_unlock_all") {
      await storage.unlockAllUsers();
      bot.answerCallbackQuery(query.id, {
        text: "Tous les utilisateurs deverrouilles",
      });
      await sendUsersMenu(chatId, messageId);
      return;
    }

    if (data === "loyalty_search") {
      session.state = "awaiting_loyalty_search";
      bot
        .editMessageText(
          "🔍 Rechercher un client\n\nEntrez l'ID Telegram du client:",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data === "loyalty_settings") {
      sendLoyaltySettings(chatId, messageId);
      return;
    }

    if (data.startsWith("loyalty_add_")) {
      const targetChatId = data.replace("loyalty_add_", "");
      session.state = "awaiting_loyalty_add";
      session.loyaltyTargetChatId = targetChatId;
      bot
        .editMessageText(
          `➕ Ajouter des points au client ${targetChatId}\n\nEntrez le nombre de points a ajouter:`,
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data.startsWith("loyalty_remove_")) {
      const targetChatId = data.replace("loyalty_remove_", "");
      session.state = "awaiting_loyalty_remove";
      session.loyaltyTargetChatId = targetChatId;
      bot
        .editMessageText(
          `➖ Retirer des points au client ${targetChatId}\n\nEntrez le nombre de points a retirer:`,
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data.startsWith("loyalty_user_")) {
      const targetChatId = data.replace("loyalty_user_", "");
      sendLoyaltyUserDetail(chatId, targetChatId, messageId);
      return;
    }

    if (data === "loyalty_set_earn") {
      session.state = "awaiting_loyalty_setting";
      session.loyaltySettingField = "earn";
      bot
        .editMessageText(
          "✏️ Modifier le taux de gain\n\nEntrez le nouveau taux (points par euro, ex: 1 pour 1pt/€):",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data === "loyalty_set_redeem") {
      session.state = "awaiting_loyalty_setting";
      session.loyaltySettingField = "redeem";
      bot
        .editMessageText(
          "✏️ Modifier le taux de remboursement\n\nEntrez le nouveau taux (points pour 1€, ex: 10):",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data === "loyalty_set_silver") {
      session.state = "awaiting_loyalty_setting";
      session.loyaltySettingField = "silver";
      bot
        .editMessageText(
          "✏️ Modifier le seuil Argent\n\nEntrez le nouveau seuil (nombre de points):",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }

    if (data === "loyalty_set_gold") {
      session.state = "awaiting_loyalty_setting";
      session.loyaltySettingField = "gold";
      bot
        .editMessageText(
          "✏️ Modifier le seuil Or\n\nEntrez le nouveau seuil (nombre de points):",
          { chat_id: chatId, message_id: messageId },
        )
        .catch(() => {});
      return;
    }
  });

  // === TEXT MESSAGE HANDLER ===
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith("/")) return;

    const session = getSession(chatId);
    const userIsAdmin = await isAdmin(chatId);

    // Allow password input for non-admin users in awaiting_password state
    if (session.state === "awaiting_password") {
      const password = text.trim();
      const validPassword = await storage.validateAccessPassword(password);

      if (validPassword) {
        await storage.unlockUser(chatId.toString());
        resetSession(chatId);

        const webAppUrl =
          process.env.PUBLISHED_URL ||
          (process.env.REPL_ID
            ? `https://${process.env.REPL_ID}.replit.app`
            : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`);

        const customPhotoFileId = await storage.getBotSetting(
          "start_photo_file_id",
        );
        const welcomeCaption =
          "Mot de passe correct! Bienvenue dans l'univers PharmacyHash!\nUn clic et hop - la Mini App s'ouvre pour toi.";
        const welcomeKeyboard = {
          inline_keyboard: [
            [{ text: "Ouvrir PharmacyHash", web_app: { url: webAppUrl } }],
          ],
        };

        if (customPhotoFileId) {
          try {
            await bot.sendPhoto(chatId, customPhotoFileId, {
              caption: welcomeCaption,
              reply_markup: welcomeKeyboard,
            });
          } catch (err) {
            bot.sendMessage(chatId, welcomeCaption, {
              reply_markup: welcomeKeyboard,
            });
          }
        } else {
          const imagePath = resolve(
            "./client/public/images/pharmacyhash-start.jpg",
          );
          try {
            const photoStream = createReadStream(imagePath);
            bot.sendPhoto(chatId, photoStream, {
              caption: welcomeCaption,
              reply_markup: welcomeKeyboard,
            });
          } catch (err) {
            bot.sendMessage(chatId, welcomeCaption, {
              reply_markup: welcomeKeyboard,
            });
          }
        }
      } else {
        bot.sendMessage(chatId, "Mot de passe incorrect. Veuillez reessayer:");
      }
      return;
    }

    // Only allow admins for all other message handling
    if (!userIsAdmin) return;

    // Adding admin flow
    if (session.state === "awaiting_admin_id") {
      const adminTelegramId = text.trim();

      if (!/^\d+$/.test(adminTelegramId)) {
        bot.sendMessage(chatId, "ID invalide. Entrez un ID numerique valide:");
        return;
      }

      const existingAdmin = await storage.getAdminByTelegramId(adminTelegramId);
      if (existingAdmin) {
        bot.sendMessage(chatId, "Cet admin existe deja!", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Retour", callback_data: "menu_admins" }],
            ],
          },
        });
        resetSession(chatId);
        return;
      }

      if (isEnvAdmin(parseInt(adminTelegramId))) {
        bot.sendMessage(chatId, "Cet ID est deja un admin principal (env).", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Retour", callback_data: "menu_admins" }],
            ],
          },
        });
        resetSession(chatId);
        return;
      }

      try {
        await storage.addAdmin({
          telegramId: adminTelegramId,
          name: null,
          addedBy: chatId.toString(),
        });

        resetSession(chatId);
        bot.sendMessage(
          chatId,
          `Admin ajouté avec succès!\nID: ${adminTelegramId}`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Retour aux admins", callback_data: "menu_admins" }],
              ],
            },
          },
        );
      } catch (err) {
        console.error("Error adding admin:", err);
        bot.sendMessage(chatId, "Erreur lors de l'ajout.");
        resetSession(chatId);
      }
      return;
    }

    // Admin: New password creation
    if (session.state === "awaiting_new_password") {
      session.newPasswordValue = text.trim();
      session.state = "awaiting_password_label";
      bot.sendMessage(
        chatId,
        "Entrez un nom/label pour ce mot de passe (ou envoyez - pour ignorer):",
      );
      return;
    }

    // Admin: Password label
    if (session.state === "awaiting_password_label") {
      const label = text.trim() === "-" ? undefined : text.trim();
      const password = session.newPasswordValue!;

      try {
        await storage.createAccessPassword(password, label);
        bot.sendMessage(
          chatId,
          `✅ Mot de passe créé avec succès!\n\n` +
            `🔐 Mot de passe: ${password}\n` +
            (label ? `📝 Label: ${label}\n` : "") +
            `\n⚠️ IMPORTANT: Notez ce mot de passe maintenant!\n` +
            `Il est crypté et ne sera plus visible.`,
        );
      } catch (err) {
        bot.sendMessage(chatId, "Erreur lors de la création du mot de passe.");
      }

      resetSession(chatId);
      sendMainMenu(chatId);
      return;
    }

    // Admin: Button label
    if (session.state === "awaiting_button_label") {
      session.newButton = session.newButton || {};
      session.newButton.label = text.trim();
      session.state = "awaiting_button_url";
      bot.sendMessage(
        chatId,
        "🔗 Entrez l'URL du bouton (lien vers lequel le client sera redirige):\n\nOu cliquez sur 'Passer' pour utiliser une action predéfinie.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⏭️ Passer (utiliser action)",
                  callback_data: "btn_skip_url",
                },
              ],
              [{ text: "❌ Annuler", callback_data: "menu_client_buttons" }],
            ],
          },
        },
      );
      return;
    }

    // Admin: Button URL
    if (session.state === "awaiting_button_url") {
      const url = text.trim();
      session.newButton = session.newButton || {};
      session.newButton.url = url;

      // Create the button with URL
      try {
        const allButtons = await storage.getClientButtons();
        await storage.createClientButton({
          label: session.newButton.label!,
          url: url,
          action: null,
          position: allButtons.length,
          active: true,
        });

        resetSession(chatId);
        bot.sendMessage(chatId, "✅ Bouton créé avec succès!", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔙 Retour aux boutons",
                  callback_data: "menu_client_buttons",
                },
              ],
            ],
          },
        });
      } catch (err) {
        console.error("Error creating button:", err);
        bot.sendMessage(chatId, "Erreur lors de la création du bouton.");
        resetSession(chatId);
      }
      return;
    }

    // Review text input (for customers)
    if (session.state === "awaiting_review") {
      const customerName = msg.from?.first_name || null;
      const customerUsername = msg.from?.username || null;

      // Save review to database
      let savedReview;
      try {
        savedReview = await storage.createReview({
          chatId: chatId.toString(),
          username: customerUsername,
          firstName: customerName,
          text: text,
          approved: false,
        });
      } catch (err) {
        console.error("Failed to save review:", err);
        bot.sendMessage(
          chatId,
          "Erreur lors de l'enregistrement de votre avis.",
        );
        resetSession(chatId);
        return;
      }

      // Send review to all admins for approval
      const allAdminIds = new Set<string>();
      const envAdminId = process.env.ADMIN_TELEGRAM_ID;
      if (envAdminId) {
        envAdminId.split(",").forEach((id) => allAdminIds.add(id.trim()));
      }
      try {
        const dbAdmins = await storage.getAdmins();
        dbAdmins.forEach((admin: { telegramId: string }) =>
          allAdminIds.add(admin.telegramId),
        );
      } catch (err) {
        console.error("Failed to fetch db admins:", err);
      }

      const displayName =
        customerName || (customerUsername ? `@${customerUsername}` : "Client");
      const reviewMessage = `Nouvel avis de ${displayName}\n\n"${text}"\n\nApprouver pour afficher sur le site?`;

      for (const aid of Array.from(allAdminIds)) {
        try {
          await bot.sendMessage(parseInt(aid), reviewMessage, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Approuver",
                    callback_data: `review_approve_${savedReview.id}`,
                  },
                  {
                    text: "Supprimer",
                    callback_data: `review_delete_${savedReview.id}`,
                  },
                ],
                [{ text: "Repondre", url: `tg://user?id=${chatId}` }],
              ],
            },
          });
        } catch (err) {
          console.error(`Failed to send review to admin ${aid}:`, err);
        }
      }

      resetSession(chatId);
      bot.sendMessage(
        chatId,
        "Merci pour votre avis! Notre equipe va le valider.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Retour à la boutique",
                  web_app: { url: process.env.PUBLISHED_URL || "" },
                },
              ],
            ],
          },
        },
      );
      return;
    }

    // Promo text input
    if (session.state === "awaiting_promo_text") {
      session.promoText = text;
      const usersCount = await storage.getBotUsersCount();

      bot.sendMessage(
        chatId,
        `Aperçu du message:\n\n${text}\n\nCe message sera envoyé à ${usersCount} utilisateur(s).`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Confirmer et envoyer",
                  callback_data: "promo_confirm",
                },
              ],
              [{ text: "Annuler", callback_data: "promo_cancel" }],
            ],
          },
        },
      );
      return;
    }

    // Promo code creation
    if (session.state === "awaiting_promo_code") {
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        bot.sendMessage(
          chatId,
          "Format incorrect. Utilisez: CODE POURCENTAGE\nExemple: NOEL25 25",
        );
        return;
      }

      const code = parts[0].toUpperCase();
      const percent = parseInt(parts[1]);

      if (isNaN(percent) || percent <= 0 || percent > 100) {
        bot.sendMessage(
          chatId,
          "Pourcentage invalide. Entrez un nombre entre 1 et 100.",
        );
        return;
      }

      try {
        await storage.createPromoCode({
          code,
          discountPercent: percent,
          active: true,
        });
        resetSession(chatId);
        bot.sendMessage(
          chatId,
          `Code promo créé!\n\nCode: ${code}\nRéduction: ${percent}%`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Voir les codes promo",
                    callback_data: "menu_promo_codes",
                  },
                ],
                [{ text: "Retour au menu", callback_data: "menu_main" }],
              ],
            },
          },
        );
      } catch (err) {
        console.error("Error creating promo code:", err);
        bot.sendMessage(chatId, "Erreur: ce code existe peut-etre deja.");
      }
      return;
    }

    // Loyalty search
    if (session.state === "awaiting_loyalty_search") {
      const targetChatId = text.trim();
      if (!/^\d+$/.test(targetChatId)) {
        bot.sendMessage(chatId, "ID invalide. Entrez un ID numerique:");
        return;
      }
      resetSession(chatId);
      sendLoyaltyUserDetail(chatId, targetChatId);
      return;
    }

    // Loyalty add points
    if (
      session.state === "awaiting_loyalty_add" &&
      session.loyaltyTargetChatId
    ) {
      const points = parseInt(text.trim());
      if (isNaN(points) || points <= 0) {
        bot.sendMessage(chatId, "Nombre invalide. Entrez un nombre positif:");
        return;
      }

      try {
        await storage.addLoyaltyPoints(
          session.loyaltyTargetChatId,
          points,
          "manual_add",
          undefined,
          `Ajout manuel par admin`,
        );
        const targetId = session.loyaltyTargetChatId;
        resetSession(chatId);
        bot.sendMessage(
          chatId,
          `✅ ${points} points ajoutes au client ${targetId}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Voir le client",
                    callback_data: `loyalty_user_${targetId}`,
                  },
                ],
                [{ text: "Retour", callback_data: "menu_loyalty" }],
              ],
            },
          },
        );
      } catch (err) {
        console.error("Error adding loyalty points:", err);
        bot.sendMessage(chatId, "Erreur lors de l'ajout des points.");
        resetSession(chatId);
      }
      return;
    }

    // Loyalty remove points
    if (
      session.state === "awaiting_loyalty_remove" &&
      session.loyaltyTargetChatId
    ) {
      const points = parseInt(text.trim());
      if (isNaN(points) || points <= 0) {
        bot.sendMessage(chatId, "Nombre invalide. Entrez un nombre positif:");
        return;
      }

      try {
        await storage.addLoyaltyPoints(
          session.loyaltyTargetChatId,
          -points,
          "manual_remove",
          undefined,
          `Retrait manuel par admin`,
        );
        const targetId = session.loyaltyTargetChatId;
        resetSession(chatId);
        bot.sendMessage(
          chatId,
          `✅ ${points} points retires au client ${targetId}`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Voir le client",
                    callback_data: `loyalty_user_${targetId}`,
                  },
                ],
                [{ text: "Retour", callback_data: "menu_loyalty" }],
              ],
            },
          },
        );
      } catch (err) {
        console.error("Error removing loyalty points:", err);
        bot.sendMessage(chatId, "Erreur lors du retrait des points.");
        resetSession(chatId);
      }
      return;
    }

    // Loyalty settings
    if (
      session.state === "awaiting_loyalty_setting" &&
      session.loyaltySettingField
    ) {
      const value = parseInt(text.trim());
      if (isNaN(value) || value <= 0) {
        bot.sendMessage(chatId, "Valeur invalide. Entrez un nombre positif:");
        return;
      }

      try {
        const field = session.loyaltySettingField;
        let updateData: any = {};

        if (field === "earn") {
          updateData.earnRate = value * 100;
        } else if (field === "redeem") {
          updateData.redeemRate = value;
        } else if (field === "silver") {
          updateData.silverThreshold = value;
        } else if (field === "gold") {
          updateData.goldThreshold = value;
        }

        await storage.updateLoyaltySettings(updateData);
        resetSession(chatId);
        bot.sendMessage(chatId, "✅ Paramètre mis à jour!", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Voir les paramètres",
                  callback_data: "loyalty_settings",
                },
              ],
              [{ text: "Retour", callback_data: "menu_loyalty" }],
            ],
          },
        });
      } catch (err) {
        console.error("Error updating loyalty settings:", err);
        bot.sendMessage(chatId, "Erreur lors de la mise a jour.");
        resetSession(chatId);
      }
      return;
    }

    // Adding new product flow
    if (session.state === "awaiting_name") {
      session.newProduct!.name = text;
      session.state = "awaiting_brand";
      bot.sendMessage(chatId, `Nom: ${text}\n\nEtape 2/5: Entrez la marque:`);
      return;
    }

    if (session.state === "awaiting_brand") {
      session.newProduct!.brand = text;
      session.state = "awaiting_description";
      bot.sendMessage(
        chatId,
        `Marque: ${text}\n\nEtape 3/5: Entrez la description:`,
      );
      return;
    }

    if (session.state === "awaiting_description") {
      session.newProduct!.description = text;
      session.state = "awaiting_price";
      bot.sendMessage(
        chatId,
        `Description enregistree.\n\nEtape 4/5: Entrez le prix en centimes (ex: 5000 pour 50EUR):`,
      );
      return;
    }

    if (session.state === "awaiting_price") {
      const price = parseInt(text);
      if (isNaN(price) || price <= 0) {
        bot.sendMessage(chatId, "Prix invalide. Entrez un nombre positif:");
        return;
      }
      session.newProduct!.price = price;
      session.state = "awaiting_category";
      bot.sendMessage(
        chatId,
        `Prix: ${(price / 100).toFixed(2)} EUR\n\nEtape 5/5: Entrez la categorie:`,
      );
      return;
    }

    if (session.state === "awaiting_category") {
      session.newProduct!.category = text;

      try {
        const newProduct = await storage.createProduct({
          name: session.newProduct!.name!,
          brand: session.newProduct!.brand!,
          description: session.newProduct!.description!,
          price: session.newProduct!.price!,
          category: text,
          imageUrl: "/images/pharmacyhash-product.jpg",
          tags: [],
        });

        resetSession(chatId);

        bot.sendMessage(
          chatId,
          `Produit créé avec succès!\n\n` +
            `ID: ${newProduct.id}\n` +
            `Nom: ${newProduct.name}\n` +
            `Prix: ${(newProduct.price / 100).toFixed(2)} EUR`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Voir le produit",
                    callback_data: `product_${newProduct.id}`,
                  },
                ],
                [{ text: "Retour au menu", callback_data: "menu_main" }],
              ],
            },
          },
        );
      } catch (err) {
        console.error("Error creating product:", err);
        bot.sendMessage(chatId, "Erreur lors de la creation.");
        resetSession(chatId);
      }
      return;
    }

    // Editing field
    if (
      session.state === "awaiting_edit_value" &&
      session.editingProductId &&
      session.editingField
    ) {
      try {
        let value: string | number = text;
        if (session.editingField === "price") {
          value = parseInt(text);
          if (isNaN(value) || value <= 0) {
            bot.sendMessage(chatId, "Prix invalide. Entrez un nombre positif:");
            return;
          }
        }

        await storage.updateProduct(session.editingProductId, {
          [session.editingField]: value,
        });
        const productId = session.editingProductId;
        resetSession(chatId);

        bot.sendMessage(chatId, "Modification enregistree!", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Voir le produit",
                  callback_data: `product_${productId}`,
                },
              ],
              [{ text: "Retour au menu", callback_data: "menu_main" }],
            ],
          },
        });
      } catch (err) {
        console.error("Error updating product:", err);
        bot.sendMessage(chatId, "Erreur lors de la modification.");
        resetSession(chatId);
      }
      return;
    }

    // Adding price option
    if (session.state === "awaiting_price_option" && session.editingProductId) {
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        bot.sendMessage(
          chatId,
          "Format invalide. Utilisez: prix poids\nExemple: 160 5g",
        );
        return;
      }

      const price = parseInt(parts[0]);
      const weight = parts.slice(1).join(" ");

      if (isNaN(price) || price <= 0) {
        bot.sendMessage(chatId, "Prix invalide. Entrez un nombre positif.");
        return;
      }

      try {
        const product = await storage.getProduct(session.editingProductId);
        if (product) {
          const priceOptions = [
            ...((product.priceOptions || []) as {
              price: number;
              weight: string;
            }[]),
            { price, weight },
          ];
          await storage.updateProduct(session.editingProductId, {
            priceOptions,
          } as any);
        }

        const productId = session.editingProductId;
        resetSession(chatId);

        bot.sendMessage(chatId, `Option ajoutee: ${price}€ ${weight}`, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Gerer les options",
                  callback_data: `price_options_${productId}`,
                },
              ],
              [
                {
                  text: "Voir le produit",
                  callback_data: `product_${productId}`,
                },
              ],
            ],
          },
        });
      } catch (err) {
        console.error("Error adding price option:", err);
        bot.sendMessage(chatId, "Erreur lors de l'ajout.");
        resetSession(chatId);
      }
      return;
    }

    // Editing stock
    if (session.state === "awaiting_stock" && session.editingProductId) {
      try {
        await storage.updateProduct(session.editingProductId, {
          stock: text.trim(),
        } as any);
        const productId = session.editingProductId;
        resetSession(chatId);

        bot.sendMessage(chatId, `Stock mis à jour: ${text.trim()}`, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Voir le produit",
                  callback_data: `product_${productId}`,
                },
              ],
              [{ text: "Retour au menu", callback_data: "menu_main" }],
            ],
          },
        });
      } catch (err) {
        console.error("Error updating stock:", err);
        bot.sendMessage(chatId, "Erreur lors de la mise a jour.");
        resetSession(chatId);
      }
      return;
    }

    // Handle user search
    if (session.state === "awaiting_user_search") {
      const searchId = text.trim();
      if (!/^\d+$/.test(searchId)) {
        bot.sendMessage(chatId, "ID invalide. Entrez un ID numerique:");
        return;
      }

      const user = await storage.getBotUserByChatId(searchId);
      resetSession(chatId);

      if (user) {
        await sendUserDetails(chatId, searchId);
      } else {
        bot.sendMessage(chatId, `Utilisateur ${searchId} non trouve.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Retour", callback_data: "menu_users" }],
            ],
          },
        });
      }
      return;
    }

    // Handle user message ID input
    if (session.state === "awaiting_user_msg_id") {
      const targetId = text.trim();
      if (!/^\d+$/.test(targetId)) {
        bot.sendMessage(chatId, "ID invalide. Entrez un ID numerique:");
        return;
      }

      session.state = "awaiting_user_msg_text";
      session.targetUserId = targetId;
      bot.sendMessage(chatId, `Écrivez le message pour ${targetId}:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Annuler", callback_data: "menu_users" }],
          ],
        },
      });
      return;
    }

    // Handle user message text
    if (session.state === "awaiting_user_msg_text" && session.targetUserId) {
      const targetId = session.targetUserId;
      resetSession(chatId);

      try {
        await bot.sendMessage(
          parseInt(targetId),
          `📨 Message de l'admin:\n\n${text}`,
        );
        bot.sendMessage(chatId, `✅ Message envoyé à ${targetId}!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Retour", callback_data: "menu_users" }],
            ],
          },
        });
      } catch (err) {
        bot.sendMessage(
          chatId,
          `❌ Impossible d'envoyer le message à ${targetId}. L'utilisateur a peut-être bloqué le bot.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Retour", callback_data: "menu_users" }],
              ],
            },
          },
        );
      }
      return;
    }

    // Handle broadcast message
    if (session.state === "awaiting_broadcast_msg") {
      resetSession(chatId);

      const users = await storage.getAllBotUsers();
      let sent = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await bot.sendMessage(
            parseInt(user.chatId),
            `📢 Annonce:\n\n${text}`,
          );
          sent++;
        } catch (err) {
          failed++;
        }
      }

      bot.sendMessage(
        chatId,
        `📢 Diffusion terminee!\n\n✅ Envoye: ${sent}\n❌ Echec: ${failed}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Retour", callback_data: "menu_users" }],
            ],
          },
        },
      );
      return;
    }
  });

  // === PHOTO HANDLER ===
  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;
    if (!(await isAdmin(chatId))) return;

    const session = getSession(chatId);

    // Handle start photo update
    if (session.state === "awaiting_start_photo") {
      try {
        const photo = msg.photo![msg.photo!.length - 1];
        await storage.setBotSetting("start_photo_file_id", photo.file_id);
        resetSession(chatId);

        bot.sendMessage(chatId, "✅ Photo de bienvenue mise a jour!", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Retour au menu", callback_data: "menu_main" }],
            ],
          },
        });
      } catch (err) {
        console.error("Error updating start photo:", err);
        bot.sendMessage(chatId, "Erreur lors de la mise a jour de la photo.");
        resetSession(chatId);
      }
      return;
    }

    // Handle product image update
    if (session.state !== "awaiting_image" || !session.editingProductId) return;

    try {
      const photo = msg.photo![msg.photo!.length - 1];
      const file = await bot.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const productId = session.editingProductId;
      await storage.updateProduct(productId, { imageUrl: fileUrl, videoUrl: null });
      resetSession(chatId);

      bot.sendMessage(chatId, "Image mise a jour!", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Voir le produit",
                callback_data: `product_${productId}`,
              },
            ],
            [{ text: "Retour au menu", callback_data: "menu_main" }],
          ],
        },
      });
    } catch (err) {
      console.error("Error updating image:", err);
      bot.sendMessage(chatId, "Erreur lors de la mise a jour de l'image.");
      resetSession(chatId);
    }
  });

  // === VIDEO HANDLER ===
  bot.on("video", async (msg) => {
    const chatId = msg.chat.id;
    if (!(await isAdmin(chatId))) return;

    const session = getSession(chatId);
    if (session.state !== "awaiting_image" || !session.editingProductId) return;

    try {
      const video = msg.video!;
      const file = await bot.getFile(video.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const productId = session.editingProductId;
      // When a video is uploaded, we store it in videoUrl and keep a placeholder or current imageUrl
      await storage.updateProduct(productId, { videoUrl: fileUrl });
      resetSession(chatId);

      bot.sendMessage(chatId, "Video mise a jour!", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Voir le produit",
                callback_data: `product_${productId}`,
              },
            ],
            [{ text: "Retour au menu", callback_data: "menu_main" }],
          ],
        },
      });
    } catch (err) {
      console.error("Error updating video:", err);
      bot.sendMessage(chatId, "Erreur lors de la mise a jour de la video.");
      resetSession(chatId);
    }
  });

  console.log("Telegram bot started!");
}
