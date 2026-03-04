import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Users, Package, Settings, MessageSquare, TrendingUp, Search, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for admin dashboard
const mockStats = {
  totalUsers: 1245,
  activeOrders: 34,
  revenueToday: 1250,
  newUsersToday: 12
};

const mockRecentOrders = [
  { id: "ORD-001", user: "Alex M.", total: "45.00€", status: "pending", time: "Il y a 10 min" },
  { id: "ORD-002", user: "Sophie T.", total: "120.00€", status: "processing", time: "Il y a 25 min" },
  { id: "ORD-003", user: "Lucas D.", total: "30.00€", status: "completed", time: "Il y a 1h" },
  { id: "ORD-004", user: "Emma R.", total: "85.00€", status: "completed", time: "Il y a 2h" },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen pb-24 bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-primary">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">PharmacyHash Bot</p>
        </div>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold text-primary flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12
              </span>
            </div>
            <p className="text-2xl font-bold">{mockStats.totalUsers}</p>
            <p className="text-xs text-muted-foreground">Utilisateurs totaux</p>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/20">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Package className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-500">{mockStats.activeOrders}</p>
            <p className="text-xs text-muted-foreground">Commandes actives</p>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20 col-span-2">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm font-medium">Revenus (Aujourd'hui)</span>
              </div>
              <span className="text-2xl font-bold text-green-500">{mockStats.revenueToday}€</span>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Actions Rapides</h2>
          <div className="grid grid-cols-4 gap-2">
            <button className="flex flex-col items-center justify-center p-3 glass-panel rounded-xl gap-2 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">Nouveau<br/>Produit</span>
            </button>
            <button className="flex flex-col items-center justify-center p-3 glass-panel rounded-xl gap-2 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">Message<br/>Massif</span>
            </button>
            <button className="flex flex-col items-center justify-center p-3 glass-panel rounded-xl gap-2 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">Gérer<br/>Stocks</span>
            </button>
            <button className="flex flex-col items-center justify-center p-3 glass-panel rounded-xl gap-2 active:scale-95 transition-transform">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">Liste<br/>Clients</span>
            </button>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-black/40 p-1 rounded-xl">
            <TabsTrigger value="orders" className="rounded-lg">Dernières Commandes</TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg">Gestion Menu</TabsTrigger>
          </TabsList>
          
          <TabsContent value="orders" className="space-y-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Rechercher une commande..." 
                className="w-full bg-card border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            
            {mockRecentOrders.map((order, i) => (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel p-3 rounded-xl border border-white/5"
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{order.id}</span>
                    <span className="text-sm font-medium">{order.user}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{order.time}</span>
                </div>
                
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                  <span className="font-bold">{order.total}</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium hover:bg-white/10">Détails</button>
                    {order.status === 'pending' && (
                      <button className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold">Valider</button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </TabsContent>
          
          <TabsContent value="products">
            <Card className="p-8 text-center glass-panel">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">L'interface de gestion complète des produits est en cours de développement.</p>
              <button className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-sm font-medium">Ouvrir dans le bot Telegram</button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}