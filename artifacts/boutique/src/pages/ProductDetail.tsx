import { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Minus, Plus, ShoppingBag, Check, Star, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetProduct, useAddToCart, useListProducts, getGetCartQueryKey } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";

const GOLD = "rgba(201,160,76,";
const GOLD_GRAD = "linear-gradient(135deg, #c9a04c 0%, #f0d070 45%, #d4a843 100%)";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const [, navigate] = useLocation();
  const productId = Number(params?.id);
  const { sessionId, chatId } = useSession();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedOption, setSelectedOption] = useState<{ price: number; weight: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [addedOk, setAddedOk] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const { data: product, isLoading } = useGetProduct(productId, { query: { enabled: !!productId } });
  const { data: similarProducts } = useListProducts(
    { category: product?.category },
    { query: { enabled: !!product?.category } }
  );

  // Force video playback when showVideo changes
  useEffect(() => {
    if (showVideo && videoRef.current) {
      // Reset and play
      videoRef.current.currentTime = 0;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay failed, try again after a short delay
          setTimeout(() => {
            videoRef.current?.play().catch(e => console.warn("Video play failed:", e));
          }, 100);
        });
      }
    }
  }, [showVideo]);

  const addToCartMutation = useAddToCart({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey(sessionId) });
        setAddedOk(true);
        setTimeout(() => {
          setShowModal(false);
          setSelectedOption(null);
          setQuantity(1);
          setAddedOk(false);
        }, 1200);
      }
    }
  });

  const handleOptionClick = (option: { price: number; weight: string }) => {
    setSelectedOption(option);
    setQuantity(1);
    setShowModal(true);
  };

  const handleAddDirect = () => {
    if (!product || !sessionId) return;
    addToCartMutation.mutate({
      data: { productId: product.id, sessionId, quantity: 1, selectedPrice: product.price, chatId } as any
    });
    setAddedOk(true);
    setTimeout(() => setAddedOk(false), 2000);
  };

  const handleConfirm = () => {
    if (!product || !selectedOption || !sessionId) return;
    addToCartMutation.mutate({
      data: {
        productId: product.id,
        sessionId,
        quantity,
        selectedPrice: selectedOption.price,
        selectedWeight: selectedOption.weight,
        chatId,
      } as any
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: `${GOLD}0.3)`, borderTopColor: `${GOLD}0.9)` }} />
          <p className="text-[11px] tracking-[0.3em] uppercase" style={{ color: `${GOLD}0.5)` }}>Chargement</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <ShoppingBag className="w-12 h-12 mb-4 opacity-20" style={{ color: `${GOLD}1)` }} />
        <h2 className="font-display text-2xl font-medium mb-2">Produit introuvable</h2>
        <p className="text-sm text-center mb-8" style={{ color: `${GOLD}0.5)` }}>Ce produit n'est plus disponible.</p>
        <button onClick={() => navigate("/menu")}
          className="px-8 py-3.5 rounded-2xl text-sm font-semibold tracking-[0.06em] uppercase"
          style={{ background: GOLD_GRAD, color: "#080603" }}>
          Retour à la collection
        </button>
      </div>
    );
  }

  const priceOptions = product.priceOptions || [];
  const tags = product.tags || [];
  const similar = similarProducts?.filter(p => p.id !== product.id).slice(0, 6) || [];

  return (
    <div className="min-h-screen pb-nav relative">

      {/* ── Back button ─────────────────────────────────────────────────────── */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => navigate("/menu")}
        className="fixed left-4 z-50 w-11 h-11 flex items-center justify-center rounded-full active:scale-90 transition-all"
        style={{
          top: "calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-top, 0px)) + 16px)",
          background: "rgba(8,6,3,0.75)",
          backdropFilter: "blur(16px)",
          border: `1px solid ${GOLD}0.2)`,
        }}
      >
        <ArrowLeft className="w-[18px] h-[18px]" style={{ color: `${GOLD}0.9)` }} />
      </motion.button>

      {/* ── Hero image ──────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/5", maxHeight: "72vh" }}>
        {showVideo && product.videoUrl ? (
          <video
            ref={videoRef}
            src={product.videoUrl}
            autoPlay loop muted playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={product.imageUrl || "https://images.unsplash.com/photo-1603584860006-25f0a0584b42?w=800&h=1000&fit=crop"}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        )}

        {/* Gradient overlay bottom */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to top, #080603 0%, rgba(8,6,3,0.5) 35%, rgba(8,6,3,0.1) 65%, transparent 100%)" }} />

        {/* Gradient overlay top (back btn area) */}
        <div className="absolute inset-x-0 top-0 h-24"
          style={{ background: "linear-gradient(to bottom, rgba(8,6,3,0.7) 0%, transparent 100%)" }} />

        {/* Sticker */}
        {product.sticker && (
          <div className="absolute right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              top: "calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-top, 0px)) + 16px)",
              background: "rgba(8,6,3,0.8)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${GOLD}0.25)`,
            }}>
            {product.stickerFlag && <span className="text-[11px]">{product.stickerFlag}</span>}
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: `${GOLD}0.9)` }}>
              {product.sticker}
            </span>
          </div>
        )}

        {/* Video toggle */}
        {product.videoUrl && (
          <button
            onClick={() => setShowVideo(v => !v)}
            className="absolute bottom-28 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              background: showVideo ? `${GOLD}0.2)` : "rgba(8,6,3,0.7)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${GOLD}${showVideo ? "0.4)" : "0.2)"}`,
            }}>
            <Play className="w-4 h-4 fill-current ml-0.5" style={{ color: `${GOLD}0.9)` }} />
          </button>
        )}

        {/* Name overlay on image */}
        <div className="absolute bottom-0 inset-x-0 px-5 pb-6">
          {product.brand && (
            <p className="text-[10px] tracking-[0.25em] uppercase mb-1.5 font-medium"
              style={{ color: `${GOLD}0.65)` }}>
              {product.brand}
            </p>
          )}
          <h1 className="font-display font-medium leading-tight"
            style={{
              fontSize: "clamp(1.8rem, 6vw, 2.5rem)",
              color: "rgba(242,234,218,0.95)",
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}>
            {product.name}
          </h1>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 space-y-6">

        {/* Tags + stock row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center flex-wrap gap-2"
        >
          {tags.map(tag => (
            <span key={tag}
              className="text-[9px] font-medium tracking-[0.2em] uppercase px-2.5 py-1 rounded-full"
              style={{
                background: `${GOLD}0.07)`,
                border: `1px solid ${GOLD}0.2)`,
                color: `${GOLD}0.8)`,
              }}>
              {tag}
            </span>
          ))}
          {product.stock && (
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase px-2.5 py-1 rounded-full ml-auto"
              style={{
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.18)",
                color: "rgba(34,197,94,0.8)",
              }}>
              ● {product.stock}
            </span>
          )}
        </motion.div>

        {/* Gold separator */}
        <div className="gold-line" />

        {/* Description */}
        {product.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-sm leading-relaxed"
            style={{ color: "rgba(201,185,155,0.7)", lineHeight: "1.75" }}
          >
            {product.description}
          </motion.p>
        )}

        {/* ── Price options ──────────────────────────────────────────────────── */}
        {priceOptions.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium mb-3" style={{ color: `${GOLD}0.5)` }}>
              Formats disponibles
            </p>
            <div className="grid grid-cols-2 gap-3">
              {priceOptions.map((opt, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOptionClick(opt)}
                  className="relative flex flex-col items-center justify-center gap-1.5 py-5 px-4 rounded-[1.25rem] transition-all"
                  style={{
                    background: `${GOLD}0.05)`,
                    border: `1px solid ${GOLD}0.18)`,
                  }}
                >
                  {/* Subtle gold shimmer on hover */}
                  <div className="absolute inset-0 rounded-[1.25rem] opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: `${GOLD}0.04)` }} />
                  <span className="font-display text-2xl font-medium relative" style={{ color: "rgba(242,234,218,0.95)" }}>
                    {opt.weight}
                  </span>
                  <span className="font-display text-lg font-semibold gradient-gold relative">{opt.price}€</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* Single price — direct add to cart */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between py-4"
            style={{ borderTop: `1px solid ${GOLD}0.1)`, borderBottom: `1px solid ${GOLD}0.1)` }}
          >
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: `${GOLD}0.5)` }}>Prix</p>
              <span className="font-display text-3xl font-medium gradient-gold">{product.price}€</span>
            </div>
            <button
              onClick={handleAddDirect}
              disabled={addToCartMutation.isPending}
              className="px-6 py-3.5 rounded-2xl font-semibold text-sm tracking-[0.06em] uppercase flex items-center gap-2 active:scale-[0.97] transition-all disabled:opacity-60 shimmer-btn"
              style={{ background: GOLD_GRAD, color: "#080603" }}
            >
              {addedOk
                ? <><Check className="w-4 h-4" /> Ajouté</>
                : <><ShoppingBag className="w-4 h-4" /> Ajouter</>}
            </button>
          </motion.div>
        )}

        {/* ── Similar products ───────────────────────────────────────────────── */}
        {similar.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="pt-2"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="gold-line flex-1" />
              <p className="text-[10px] tracking-[0.25em] uppercase font-medium shrink-0" style={{ color: `${GOLD}0.5)` }}>
                Dans la même veine
              </p>
              <div className="gold-line flex-1" />
            </div>
            <div className="flex gap-3.5 overflow-x-auto hide-scrollbar pb-2 -mx-5 px-5">
              {similar.map(p => (
                <div key={p.id} className="w-[155px] flex-shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Add to cart bottom sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && selectedOption && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowModal(false); setAddedOk(false); }}
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="relative w-full max-w-lg rounded-t-[2rem] overflow-hidden"
              style={{
                background: "#0f0c08",
                border: `1px solid ${GOLD}0.12)`,
                borderBottom: "none",
                boxShadow: `0 -20px 60px rgba(0,0,0,0.6), 0 0 80px -20px ${GOLD}0.1)`,
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-4 pb-1">
                <div className="w-10 h-0.5 rounded-full" style={{ background: `${GOLD}0.25)` }} />
              </div>

              <div className="px-6 pt-4 pb-safe">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[9px] tracking-[0.25em] uppercase mb-1.5" style={{ color: `${GOLD}0.45)` }}>
                      Ajouter au panier
                    </p>
                    <h3 className="font-display text-xl font-medium leading-tight" style={{ color: "rgba(242,234,218,0.95)" }}>
                      {product.name}
                    </h3>
                  </div>
                  <div className="shrink-0 text-right px-4 py-3 rounded-2xl"
                    style={{
                      background: `${GOLD}0.06)`,
                      border: `1px solid ${GOLD}0.18)`,
                    }}>
                    <p className="font-display text-2xl font-semibold gradient-gold leading-none">{selectedOption.price}€</p>
                    <p className="text-[10px] tracking-[0.15em] uppercase mt-1" style={{ color: `${GOLD}0.55)` }}>
                      {selectedOption.weight}
                    </p>
                  </div>
                </div>

                {/* Gold line */}
                <div className="gold-line mb-6" />

                {/* Quantity selector */}
                <div className="flex flex-col items-center gap-4 mb-6">
                  <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: `${GOLD}0.45)` }}>Quantité</p>
                  <div className="flex items-center gap-8">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
                      style={{
                        background: `${GOLD}0.06)`,
                        border: `1px solid ${GOLD}0.18)`,
                        color: `${GOLD}0.9)`,
                      }}>
                      <Minus className="w-4 h-4" />
                    </button>

                    <span className="font-display text-5xl font-light w-14 text-center" style={{ color: "rgba(242,234,218,0.95)" }}>
                      {quantity}
                    </span>

                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
                      style={{
                        background: `${GOLD}0.06)`,
                        border: `1px solid ${GOLD}0.18)`,
                        color: `${GOLD}0.9)`,
                      }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between mb-5 py-3"
                  style={{ borderTop: `1px solid ${GOLD}0.08)`, borderBottom: `1px solid ${GOLD}0.08)` }}>
                  <span className="text-[11px] tracking-[0.15em] uppercase" style={{ color: `${GOLD}0.45)` }}>Total</span>
                  <span className="font-display text-2xl font-semibold gradient-gold">
                    {selectedOption.price * quantity}€
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={handleConfirm}
                  disabled={addToCartMutation.isPending || addedOk}
                  className="w-full h-14 rounded-2xl font-semibold text-sm tracking-[0.08em] uppercase flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 mb-4 shimmer-btn"
                  style={{
                    background: addedOk
                      ? "linear-gradient(135deg, #22c55e, #16a34a)"
                      : GOLD_GRAD,
                    color: "#080603",
                    boxShadow: `0 4px 24px ${addedOk ? "rgba(34,197,94,0.3)" : `${GOLD}0.25)`}`,
                  }}
                >
                  {addToCartMutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-black/30 border-t-black/80 rounded-full animate-spin" /> Ajout…</>
                  ) : addedOk ? (
                    <><Check className="w-4 h-4" /> Ajouté au panier !</>
                  ) : (
                    <><ShoppingBag className="w-4 h-4" /> Ajouter — {selectedOption.price * quantity}€</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
