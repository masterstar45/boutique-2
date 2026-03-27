import { Clock, ShieldCheck, FileText, Send } from "lucide-react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";

export default function Info() {
  return (
    <div className="min-h-screen">
      <TopBar title="Informations" backHref="/" />

      <main className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 rounded-[2rem]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Horaires</h2>
              <p className="text-sm text-muted-foreground uppercase tracking-widest">Ouvert tous les jours</p>
            </div>
          </div>
          <p className="text-3xl font-black font-display text-primary glow-text">10h00 - 22h00</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6 rounded-[2rem] border-primary/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Première commande</h2>
              <p className="text-sm text-muted-foreground uppercase tracking-widest">Vérification</p>
            </div>
          </div>
          
          <ul className="space-y-3">
            {["Pièce d'identité valide requise", "Selfie avec la pièce d'identité", "Adresse de livraison confirmée"].map((rule, i) => (
              <li key={i} className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{rule}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <a
            href="https://t.me/SOSLePlug75"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-5 rounded-[2rem] font-bold text-lg text-white transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)",
              boxShadow: "0 0 30px -8px rgba(42,171,238,0.6)",
            }}
          >
            <Send className="w-6 h-6" />
            Contacter le support
          </a>
        </motion.div>
      </main>
    </div>
  );
}
