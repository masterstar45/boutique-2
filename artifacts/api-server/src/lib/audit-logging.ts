import type { Request } from "express";
import { logger } from "./logger";
import type { TelegramMiniAppData } from "./telegram-auth";

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  adminChatId: string;
  adminName?: string;
  ipAddress: string;
  endpoint: string;
  method: string;
  status?: number;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Log une action admin pour l'audit
 */
export function logAdminAction(
  req: Request,
  action: string,
  options?: {
    status?: number;
    details?: Record<string, unknown>;
    error?: string;
  }
): void {
  const telegramUser: TelegramMiniAppData | undefined = (req as any).telegramUser;

  if (!telegramUser) {
    logger.warn({ action }, "Admin action logged without Telegram user context");
    return;
  }

  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    action,
    adminChatId: telegramUser.chatId,
    adminName: telegramUser.firstName || telegramUser.username,
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    endpoint: req.path,
    method: req.method,
    status: options?.status,
    details: options?.details,
    error: options?.error,
  };

  // Log en INFO pour les opérations réussies 👮 SÉCURITÉ
  if (!options?.error) {
    logger.info(
      {
        action: entry.action,
        admin: `${entry.adminName} (#${entry.adminChatId})`,
        endpoint: entry.endpoint,
        method: entry.method,
        details: entry.details,
      },
      `🔐 ADMIN ACTION: ${entry.action}`
    );
  } else {
    // Log en WARN pour les erreurs/tentatives suspectes
    logger.warn(
      {
        action: entry.action,
        admin: `${entry.adminName} (#${entry.adminChatId})`,
        ipAddress: entry.ipAddress,
        endpoint: entry.endpoint,
        method: entry.method,
        error: entry.error,
      },
      `⚠️  ADMIN ACTION FAILED: ${entry.action}`
    );
  }
}

/**
 * Extraits les IDs des paramètres request pour l'audit
 */
export function extractDetailsFromRequest(req: Request): Record<string, unknown> {
  const details: Record<string, unknown> = {};

  // Récupérer les IDs des params
  if (req.params.id) details.productId = req.params.id;
  if (req.params.orderCode) details.orderCode = req.params.orderCode;
  if (req.params.chatId) details.chatId = req.params.chatId;
  if (req.params.promoId) details.promoId = req.params.promoId;

  // Récupérer des champs du body (sans mots de passe!)
  if (req.body && typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    if (body.name) details.name = body.name;
    if (body.status) details.status = body.status;
    if (body.text) details.textLength = String(body.text).length; // Juste la longueur, pas le contenu
    if (body.notes) details.notes = body.notes;
  }

  return details;
}

/**
 * Types d'actions admin sensibles
 */
export const ADMIN_ACTIONS = {
  PRODUCT_CREATE: "product_create",
  PRODUCT_UPDATE: "product_update",
  PRODUCT_DELETE: "product_delete",
  PRODUCT_UPLOAD_VIDEO: "product_upload_video",
  ORDER_UPDATE_STATUS: "order_update_status",
  ORDER_DELETE: "order_delete",
  ORDER_UPDATE_NOTES: "order_update_notes",
  PROMO_CODE_CREATE: "promo_code_create",
  PROMO_CODE_DELETE: "promo_code_delete",
  BROADCAST_SEND: "broadcast_send",
  ADMIN_ADD: "admin_add",
  ADMIN_DELETE: "admin_delete",
  BOT_SETTINGS_UPDATE: "bot_settings_update",
  BOT_SETTINGS_UPLOAD_MEDIA: "bot_settings_upload_media",
} as const;
