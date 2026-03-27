import { Clock, ShieldCheck, HelpCircle, FileText } from "lucide-react";
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

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6 rounded-[2rem]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h2 className="font-bold text-lg">F.A.Q</h2>
          </div>

          <div className="space-y-4">
            <div className="border-b border-white/10 pb-4">
              <h3 className="font-bold text-sm mb-2 text-foreground">Quels sont les délais de livraison ?</h3>
              <p className="text-sm text-muted-foreground">La livraison standard prend 24 à 48 heures ouvrées selon votre localisation.</p>
            </div>
            <div className="border-b border-white/10 pb-4">
              <h3 className="font-bold text-sm mb-2 text-foreground">Les colis sont-ils discrets ?</h3>
              <p className="text-sm text-muted-foreground">Absolument. Tous nos envois sont double-scellés sous vide dans des emballages neutres sans aucune mention de notre boutique.</p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
