import { MapPin, Clock, Phone, Mail, Globe, ShieldCheck } from "lucide-react";
import logoImage from "@assets/pharmacy-hash-logo.png";

export default function Info() {
  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Informations</h1>
        <img 
          src={logoImage} 
          alt="PharmacyHash" 
          className="h-8 object-contain"
        />
      </header>

      <div className="p-4 space-y-6">
        <div className="relative h-48 rounded-2xl overflow-hidden bg-card border border-white/5">
           {/* Static map placeholder */}
           <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
             <MapPin className="w-10 h-10 text-primary animate-bounce" />
           </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card p-5 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <MapPin className="w-6 h-6 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">PharmacyHash</p>
                <p className="text-lg font-bold mt-1">12 rue de Seine</p>
                <p className="text-sm text-gray-300">75006 Paris, France</p>
              </div>
            </div>
          </div>

          <section className="bg-card p-5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2 text-primary">
              <MapPin className="w-5 h-5" /> Itinéraire
            </h2>
            <a href="https://waze.com/ul?q=12+rue+de+seine+75006+paris" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition-colors p-3 hover:bg-white/5 rounded-lg -mx-2 bg-white/5">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-medium">Ouvrir dans Waze</span>
            </a>
          </section>

          <section className="bg-card p-5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2 text-primary">
              <Clock className="w-5 h-5" /> Horaires
            </h2>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Lundi - Vendredi</span>
                <span className="font-medium text-white">10:00 - 20:00</span>
              </div>
              <div className="flex justify-between">
                <span>Samedi</span>
                <span className="font-medium text-white">11:00 - 22:00</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Dimanche</span>
                <span>Fermé</span>
              </div>
            </div>
          </section>

          <section className="bg-card p-5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2 text-primary">
              <ShieldCheck className="w-5 h-5" /> Contact
            </h2>
            <div className="space-y-3">
              <a href="#" className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg -mx-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>+33 1 23 45 67 89</span>
              </a>
              <a href="#" className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg -mx-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>contact@pharmacyhash.paris</span>
              </a>
              <a href="#" className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg -mx-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span>www.pharmacyhash.paris</span>
              </a>
            </div>
          </section>
        </div>

        <div className="text-center text-xs text-muted-foreground pt-8">
          <p>Version 2.0.1</p>
          <p>Designed with ❤️ in Paris</p>
        </div>
      </div>
    </div>
  );
}
