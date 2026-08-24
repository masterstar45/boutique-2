export * from "./generated/api";
export * from "./generated/types";

// Désambiguïsation : ces 4 noms existent à la fois comme schéma Zod (valeur, dans
// ./generated/api) et comme type TypeScript (dans ./generated/types). Les deux
// `export *` ci-dessus les rendent ambigus (TS2308). On réexporte explicitement
// la valeur depuis api et le type depuis types — rien n'est perdu.
export {
  AddFavoriteBody,
  UpdateCartItemBody,
  UpdateOrderStatusBody,
  ValidatePromoCodeBody,
} from "./generated/api";
export type {
  AddFavoriteBody as AddFavoriteBodyType,
  UpdateCartItemBody as UpdateCartItemBodyType,
  UpdateOrderStatusBody as UpdateOrderStatusBodyType,
  ValidatePromoCodeBody as ValidatePromoCodeBodyType,
} from "./generated/types";
