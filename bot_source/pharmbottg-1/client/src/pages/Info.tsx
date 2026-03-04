import { Info as InfoIcon, Camera, IdCard, MessageCircle, MapPin, EyeOff, Clock } from "lucide-react";
import logoImage from "@assets/pharmacy-hash-logo.png";

export default function Info() {
  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Informations</h1>
        <img 
          src={logoImage} 
          alt="PharmacyHash" 
          className="h-10 object-contain drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
        />
      </header>

      <div className="p-4">
        <div className="bg-card p-6 rounded-xl border border-white/5">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-primary" />
            Infos Supplémentaires
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">Première commande : fournir au standard</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Selfie</span>
                </li>
                <li className="flex items-center gap-3">
                  <IdCard className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Pièce d'identité</span>
                </li>
                <li className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Comment avez-vous eu notre contact ?</span>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Adresse, code, et infos nécessaires</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <span className="font-medium">Horaires d'ouverture</span>
                  <p className="text-muted-foreground">10h - 22h</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <EyeOff className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="font-medium">Rester discret</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
