// ─── Migration P5 : chiffre les PII déjà en clair (orderData + notes) ──────────
//
// À lancer UNE SEULE FOIS, APRÈS avoir :
//   1. défini ENCRYPTION_KEY (la même que celle du serveur),
//   2. défini DATABASE_URL vers la base de production,
//   3. déployé le code serveur qui sait déchiffrer (sinon l'app lirait du chiffré
//      sans pouvoir le déchiffrer — mais decryptField tolère déjà les 2 cas).
//
// Idempotent : une valeur déjà chiffrée (préfixe enc:v1:) est laissée intacte.
//
//   ENCRYPTION_KEY=xxx DATABASE_URL=yyy \
//     pnpm --filter @workspace/scripts exec tsx ./src/encrypt-existing-pii.ts
//
import { db, orders } from "@workspace/db";
import { createHash, createCipheriv, randomBytes } from "crypto";
import { eq } from "drizzle-orm";

const RAW = process.env.ENCRYPTION_KEY;
if (!RAW) {
  console.error("❌ ENCRYPTION_KEY manquante — abandon (rien n'a été modifié).");
  process.exit(1);
}
// Doit produire EXACTEMENT le même format que lib/privacy.ts (enc:v1:iv:tag:ct).
const KEY = createHash("sha256").update(RAW).digest();
const PREFIX = "enc:v1:";

function encrypt(pt: string | null | undefined): string | null {
  if (pt === null || pt === undefined) return null;
  if (pt.startsWith(PREFIX)) return pt; // déjà chiffré
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(pt, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return PREFIX + [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

async function main() {
  const rows = await db.select().from(orders);
  let changed = 0;
  for (const o of rows) {
    const newOrderData = encrypt(o.orderData);
    const newNotes = encrypt(o.notes ?? null);
    if (newOrderData !== o.orderData || newNotes !== o.notes) {
      await db.update(orders).set({ orderData: newOrderData as string, notes: newNotes }).where(eq(orders.id, o.id));
      changed++;
    }
  }
  console.log(`✅ Migration terminée : ${changed}/${rows.length} commande(s) chiffrée(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Migration échouée :", e);
  process.exit(1);
});
