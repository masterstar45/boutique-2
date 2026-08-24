import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Sel de masquage : on réutilise un secret déjà présent en prod pour rendre le
// hash non brute-forçable (les IDs Telegram sont des entiers énumérables, un
// simple sha256 non salé serait réversible). Fallback en dev uniquement.
const SALT =
  process.env.LOG_SALT ||
  process.env.TELEGRAM_BOT_TOKEN ||
  "sos-le-plug-dev-salt";

/**
 * Masque un identifiant (chatId Telegram, IP, etc.) pour les logs.
 * Même entrée → même sortie (corrélation possible), mais l'ID réel n'est jamais
 * écrit. Non réversible sans le sel.
 */
export function maskId(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "∅";
  const digest = createHash("sha256").update(SALT + String(value)).digest("hex");
  return `#${digest.slice(0, 10)}`;
}

/**
 * Tronque une adresse IP pour les logs : garde le préfixe réseau, masque l'hôte.
 * IPv4 → /24 (a.b.c.x), IPv6 → /48. Réduit la capacité de ré-identification tout
 * en gardant une utilité pour repérer un abus par plage.
 */
export function truncateIp(ip: string | undefined | null): string {
  if (!ip) return "∅";
  const clean = ip.replace(/^::ffff:/, ""); // IPv4 mappée en IPv6
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  if (clean.includes(":")) {
    const parts = clean.split(":");
    return `${parts.slice(0, 3).join(":")}::/48`;
  }
  return "∅";
}

// ─── Chiffrement au repos (AES-256-GCM), opt-in via ENCRYPTION_KEY ──────────────
// Conception rétrocompatible dans les deux sens :
//  - ENCRYPTION_KEY absente  → encryptField renvoie le clair (fonctionnalité off).
//  - Valeur en clair (données antérieures au chiffrement) → decryptField la renvoie
//    telle quelle (pas de préfixe `enc:v1:`).
// Déployer ce code ne change donc RIEN tant que la clé n'est pas définie. On peut
// l'activer ensuite (définir ENCRYPTION_KEY) puis migrer l'existant via le script.
const ENC_PREFIX = "enc:v1:";
const ENC_KEY = process.env.ENCRYPTION_KEY
  ? createHash("sha256").update(process.env.ENCRYPTION_KEY).digest() // 32 octets, quel que soit le format fourni
  : null;

/** Chiffre une chaîne. Renvoie le clair si ENCRYPTION_KEY n'est pas définie. */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  if (!ENC_KEY) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // déjà chiffré
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** Déchiffre une chaîne. Tolère le clair hérité (renvoyé tel quel). */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!value.startsWith(ENC_PREFIX)) return value; // clair (pré-chiffrement)
  if (!ENC_KEY) return value; // pas de clé pour déchiffrer — on ne casse pas
  try {
    const [, , ivB64, tagB64, ctB64] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return value;
  }
}

/** Renvoie une commande avec ses champs sensibles déchiffrés (orderData, notes). */
export function hydrateOrder<T extends { orderData?: string | null; notes?: string | null }>(row: T): T {
  if (!row) return row;
  return {
    ...row,
    ...(row.orderData !== undefined ? { orderData: decryptField(row.orderData) } : {}),
    ...(row.notes !== undefined ? { notes: decryptField(row.notes) } : {}),
  };
}
