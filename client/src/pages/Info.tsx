import { Info as InfoIcon, Camera, IdCard, MessageCircle, MapPin, EyeOff, Clock, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Info() {
  const items = [
    { icon: Camera, text: "Selfie" },
    { icon: IdCard, text: "Piece d'identite" },
    { icon: MessageCircle, text: "Comment avez-vous eu notre contact ?" },
    { icon: MapPin, text: "Adresse, code, et infos necessaires" },
  ];

  return (
    <div className="min-h-screen pb-28 bg-background relative">
      <div className="animated-bg" />
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 pt-safe">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Informations</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Guide & Horaires</p>
          </div>
          <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center overflow-hidden border border-primary/20 shadow-[0_0_15px_-5px_rgba(34,197,94,0.3)]">
            <InfoIcon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-[1.5rem] p-5 space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Premiere commande</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Documents a fournir</p>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{item.text}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel rounded-[1.5rem] p-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-base">Horaires d'ouverture</h3>
              <p className="text-lg font-black text-primary mt-0.5">10h - 22h</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-panel rounded-[1.5rem] p-5"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <EyeOff className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-bold text-base">Discretion assuree</h3>
              <p className="text-xs text-muted-foreground mt-1">Emballage neutre et livraison discrete</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
