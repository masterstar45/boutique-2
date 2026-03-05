import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Package, Settings, MessageSquare, TrendingUp, Search, Plus, Star, Clock, CheckCircle, XCircle, Trash2, Tag, Loader2, AlertCircle, ChevronDown, Eye, Edit2, ToggleLeft, ToggleRight, Bell, Upload, Image, Video, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Order, Product, Review, PromoCode } from "@shared/schema";

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "A l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2) + " EUR";
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "text-amber-500 bg-amber-500/10", icon: Clock },
  sent: { label: "Envoyee", color: "text-blue-500 bg-blue-500/10", icon: Loader2 },
  processing: { label: "En cours", color: "text-blue-500 bg-blue-500/10", icon: Loader2 },
  completed: { label: "Terminee", color: "text-green-500 bg-green-500/10", icon: CheckCircle },
  cancelled: { label: "Annulee", color: "text-red-500 bg-red-500/10", icon: XCircle },
};

const defaultProductForm = {
  name: "",
  brand: "",
  description: "",
  price: 0,
  imageUrl: "",
  videoUrl: "",
  category: "",
  sticker: "",
  stickerFlag: "",
  stock: "",
  priceOptions: "[]",
  tags: "[]",
};

type ProductFormData = typeof defaultProductForm;

function ProductFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isLoading,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ProductFormData;
  onSubmit: (data: ProductFormData) => void;
  isLoading: boolean;
  title: string;
}) {
  const [form, setForm] = useState<ProductFormData>(initialData);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initialData);
    }
  }, [open]);

  const handleChange = (field: keyof ProductFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (file: File, field: 'imageUrl' | 'videoUrl') => {
    const setter = field === 'imageUrl' ? setUploadingImage : setUploadingVideo;
    setter(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      handleChange(field, data.url);
    } catch {
      alert('Erreur lors de l\'upload du fichier');
    } finally {
      setter(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-card border-white/10">
        <DialogHeader>
          <DialogTitle className="text-primary">{title}</DialogTitle>
          <DialogDescription>Remplissez les champs du produit</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nom *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              required
              data-testid="input-product-name"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Marque *</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => handleChange("brand", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              required
              data-testid="input-product-brand"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 min-h-[60px]"
              required
              data-testid="input-product-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prix (centimes) *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => handleChange("price", parseInt(e.target.value) || 0)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                required
                data-testid="input-product-price"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categorie *</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                required
                data-testid="input-product-category"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Photo du produit *</label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'imageUrl');
              }}
            />
            {form.imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <img src={form.imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                  <span className="text-[10px] text-white/70 truncate flex-1 mr-2">{form.imageUrl}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                      data-testid="button-change-image"
                    >
                      <Upload className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange("imageUrl", "")}
                      className="w-7 h-7 rounded-lg bg-red-500/30 flex items-center justify-center hover:bg-red-500/50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full h-28 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-50"
                data-testid="button-upload-image"
              >
                {uploadingImage ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : (
                  <>
                    <Image className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Cliquer pour uploader une photo</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Video du produit</label>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'videoUrl');
              }}
            />
            {form.videoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <video src={form.videoUrl} className="w-full h-32 object-cover" muted />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                  <span className="text-[10px] text-white/70 truncate flex-1 mr-2">{form.videoUrl}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                      data-testid="button-change-video"
                    >
                      <Upload className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange("videoUrl", "")}
                      className="w-7 h-7 rounded-lg bg-red-500/30 flex items-center justify-center hover:bg-red-500/50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
                className="w-full h-28 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-50"
                data-testid="button-upload-video"
              >
                {uploadingVideo ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : (
                  <>
                    <Video className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Cliquer pour uploader une video</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sticker</label>
              <input
                type="text"
                value={form.sticker}
                onChange={(e) => handleChange("sticker", e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                data-testid="input-product-sticker"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pays (flag)</label>
              <input
                type="text"
                value={form.stickerFlag}
                onChange={(e) => handleChange("stickerFlag", e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                data-testid="input-product-stickerFlag"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Stock</label>
            <input
              type="text"
              value={form.stock}
              onChange={(e) => handleChange("stock", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              data-testid="input-product-stock"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tags (JSON array)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => handleChange("tags", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 font-mono"
              placeholder='["tag1", "tag2"]'
              data-testid="input-product-tags"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Options de prix (JSON)</label>
            <textarea
              value={form.priceOptions}
              onChange={(e) => handleChange("priceOptions", e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 font-mono min-h-[60px]"
              placeholder='[{"price": 50, "weight": "5g"}]'
              data-testid="input-product-priceOptions"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="button-submit-product"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {title}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [orderFilter, setOrderFilter] = useState<string | undefined>(undefined);
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showAddPromo, setShowAddPromo] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: "", discountPercent: 10 });

  const [newOrderCount, setNewOrderCount] = useState(0);
  const lastCountRef = useRef(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/orders/new-count');
        const data = await res.json();
        if (data.count > lastCountRef.current && lastCountRef.current > 0) {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGj6NuN3Xu2s2HECHtN3dwnM7IEKEsd3exHY+IkWDs97fxXhAJEiCst/gxnpBJkmCs9/gxnpBJkmCs9/gxnpBJQ==');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        }
        lastCountRef.current = data.count;
        setNewOrderCount(data.count);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/admin/orders", orderFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (orderFilter) params.set("status", orderFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/admin/orders?${params}`);
      return res.json();
    },
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      return res.json();
    },
  });

  const { data: pendingReviews } = useQuery<Review[]>({
    queryKey: ["/api/admin/reviews/pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reviews/pending");
      return res.json();
    },
  });

  const { data: promoCodes } = useQuery<PromoCode[]>({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/promo-codes");
      return res.json();
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderCode, status }: { orderCode: string; status: string }) => {
      await fetch(`/api/admin/orders/${orderCode}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const approveReview = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/reviews/${id}/approve`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData) => {
      let parsedTags: string[] = [];
      let parsedPriceOptions: { price: number; weight: string }[] = [];
      try { parsedTags = JSON.parse(data.tags); } catch {}
      try { parsedPriceOptions = JSON.parse(data.priceOptions); } catch {}

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          brand: data.brand,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          videoUrl: data.videoUrl || null,
          category: data.category,
          sticker: data.sticker || null,
          stickerFlag: data.stickerFlag || null,
          stock: data.stock || null,
          tags: parsedTags,
          priceOptions: parsedPriceOptions,
        }),
      });
      if (!res.ok) throw new Error("Failed to create product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowAddProduct(false);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      let parsedTags: string[] = [];
      let parsedPriceOptions: { price: number; weight: string }[] = [];
      try { parsedTags = JSON.parse(data.tags); } catch {}
      try { parsedPriceOptions = JSON.parse(data.priceOptions); } catch {}

      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          brand: data.brand,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          videoUrl: data.videoUrl || null,
          category: data.category,
          sticker: data.sticker || null,
          stickerFlag: data.stickerFlag || null,
          stock: data.stock || null,
          tags: parsedTags,
          priceOptions: parsedPriceOptions,
        }),
      });
      if (!res.ok) throw new Error("Failed to update product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingProduct(null);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const createPromoCode = useMutation({
    mutationFn: async (data: { code: string; discountPercent: number }) => {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create promo code");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setShowAddPromo(false);
      setPromoForm({ code: "", discountPercent: 10 });
    },
  });

  const togglePromoCode = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await fetch(`/api/admin/promo-codes/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
    },
  });

  const deletePromoCode = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
    },
  });

  const filteredOrders = (ordersData?.orders || []).filter((order: Order) => {
    if (!orderSearch) return true;
    const s = orderSearch.toLowerCase();
    return order.orderCode.toLowerCase().includes(s) ||
      order.chatId?.toLowerCase().includes(s) ||
      order.orderData.toLowerCase().includes(s);
  });

  const productToFormData = (p: Product): ProductFormData => ({
    name: p.name,
    brand: p.brand,
    description: p.description,
    price: p.price,
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl || "",
    category: p.category,
    sticker: p.sticker || "",
    stickerFlag: p.stickerFlag || "",
    stock: p.stock || "",
    priceOptions: JSON.stringify(p.priceOptions || []),
    tags: JSON.stringify(p.tags || []),
  });

  return (
    <div className="min-h-screen pb-24" data-testid="admin-dashboard">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-primary" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">PharmacyHash Bot</p>
        </div>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center" data-testid="button-admin-settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {statsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20" data-testid="card-stat-users">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
              <p className="text-xs text-muted-foreground">Utilisateurs</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/20" data-testid="card-stat-orders">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Package className="w-4 h-4 text-amber-500" />
                </div>
                {(stats?.pendingOrders || 0) > 0 && (
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {stats.pendingOrders}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-amber-500" data-testid="text-total-orders">{stats?.totalOrders || 0}</p>
              <p className="text-xs text-muted-foreground">Commandes totales</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/20" data-testid="card-stat-revenue">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-500" data-testid="text-revenue-today">{formatPrice(stats?.revenueToday || 0)}</p>
              <p className="text-xs text-muted-foreground">Revenus aujourd'hui</p>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/20" data-testid="card-stat-products">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Package className="w-4 h-4 text-purple-500" />
                </div>
                {(stats?.pendingReviews || 0) > 0 && (
                  <span className="text-xs font-bold text-purple-500 flex items-center gap-1">
                    <Star className="w-3 h-3" /> {stats.pendingReviews} avis
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-purple-500" data-testid="text-total-products">{stats?.totalProducts || 0}</p>
              <p className="text-xs text-muted-foreground">Produits</p>
            </Card>
          </div>
        )}

        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4 bg-black/40 p-1 rounded-xl">
            <TabsTrigger value="orders" className="rounded-lg text-xs relative" data-testid="tab-orders">
              Commandes
              {newOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">{newOrderCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products" className="rounded-lg text-xs" data-testid="tab-products">Produits</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-lg text-xs" data-testid="tab-reviews">Avis</TabsTrigger>
            <TabsTrigger value="promos" className="rounded-lg text-xs" data-testid="tab-promos">Promos</TabsTrigger>
          </TabsList>

          {/* ORDERS TAB */}
          <TabsContent value="orders" className="space-y-3">
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {[
                { value: undefined, label: "Tous" },
                { value: "pending", label: "En attente" },
                { value: "sent", label: "Envoyees" },
                { value: "completed", label: "Terminees" },
              ].map((f) => (
                <button
                  key={f.label}
                  onClick={() => setOrderFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    orderFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                  data-testid={`button-filter-${f.label.toLowerCase()}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Rechercher une commande..."
                className="w-full bg-card border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary/50"
                data-testid="input-order-search"
              />
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucune commande trouvee</p>
              </Card>
            ) : (
              filteredOrders.map((order: Order, i: number) => {
                const cfg = statusConfig[order.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                const isExpanded = expandedOrder === order.orderCode;

                return (
                  <motion.div
                    key={order.orderCode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-panel rounded-xl border border-white/5 overflow-hidden"
                    data-testid={`card-order-${order.orderCode}`}
                  >
                    <div className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded" data-testid={`text-order-code-${order.orderCode}`}>
                            {order.orderCode}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(order.createdAt)}</span>
                      </div>

                      {order.chatId && (
                        <p className="text-xs text-muted-foreground mb-2">Client: <span className="text-foreground font-mono">{order.chatId}</span></p>
                      )}

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{order.deliveryType}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : order.orderCode)}
                            className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-medium hover:bg-white/10 flex items-center gap-1"
                            data-testid={`button-details-${order.orderCode}`}
                          >
                            <Eye className="w-3 h-3" />
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                          {order.status === "pending" && (
                            <button
                              onClick={() => updateOrderStatus.mutate({ orderCode: order.orderCode, status: "sent" })}
                              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold"
                              data-testid={`button-process-${order.orderCode}`}
                            >
                              Envoyer
                            </button>
                          )}
                          {(order.status === "sent" || order.status === "processing") && (
                            <button
                              onClick={() => updateOrderStatus.mutate({ orderCode: order.orderCode, status: "completed" })}
                              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold"
                              data-testid={`button-complete-${order.orderCode}`}
                            >
                              Terminer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5"
                        >
                          <pre className="p-3 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {order.orderData}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-3">
            <button
              onClick={() => setShowAddProduct(true)}
              className="w-full py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
              data-testid="button-add-product"
            >
              <Plus className="w-4 h-4" />
              Ajouter un produit
            </button>

            {(products || []).length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun produit</p>
              </Card>
            ) : (
              (products || []).map((product: Product) => (
                <div key={product.id} className="glass-panel p-3 rounded-xl border border-white/5 flex items-center gap-3" data-testid={`card-product-${product.id}`}>
                  <div className="w-14 h-14 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{product.brand} - {product.category}</p>
                    <p className="text-xs font-bold text-primary mt-0.5">{formatPrice(product.price)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="p-2 text-blue-500/60 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                      data-testid={`button-edit-product-${product.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer "${product.name}" ?`)) {
                          deleteProduct.mutate(product.id);
                        }
                      }}
                      className="p-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      data-testid={`button-delete-product-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* REVIEWS TAB */}
          <TabsContent value="reviews" className="space-y-3">
            {(pendingReviews || []).length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Star className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun avis en attente</p>
              </Card>
            ) : (
              (pendingReviews || []).map((review: Review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-panel p-3 rounded-xl border border-white/5"
                  data-testid={`card-review-${review.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold">{review.firstName || "Client"}</p>
                      {review.username && (
                        <p className="text-xs text-muted-foreground">@{review.username}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">En attente</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">"{review.text}"</p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => deleteReview.mutate(review.id)}
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-medium hover:bg-red-500/20"
                      data-testid={`button-delete-review-${review.id}`}
                    >
                      Supprimer
                    </button>
                    <button
                      onClick={() => approveReview.mutate(review.id)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold"
                      data-testid={`button-approve-review-${review.id}`}
                    >
                      Approuver
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* PROMOS TAB */}
          <TabsContent value="promos" className="space-y-3">
            <button
              onClick={() => setShowAddPromo(true)}
              className="w-full py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
              data-testid="button-add-promo"
            >
              <Plus className="w-4 h-4" />
              Ajouter un code promo
            </button>

            {(promoCodes || []).length === 0 ? (
              <Card className="p-8 text-center glass-panel">
                <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">Aucun code promo</p>
              </Card>
            ) : (
              (promoCodes || []).map((promo: PromoCode) => (
                <div key={promo.id} className="glass-panel p-3 rounded-xl border border-white/5 flex items-center justify-between" data-testid={`card-promo-${promo.id}`}>
                  <div>
                    <p className="font-mono font-bold text-sm text-primary">{promo.code}</p>
                    <p className="text-xs text-muted-foreground">-{promo.discountPercent}% de reduction</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePromoCode.mutate({ id: promo.id, active: !promo.active })}
                      className={`p-1.5 rounded-lg transition-colors ${promo.active ? "text-green-500 hover:bg-green-500/10" : "text-red-500 hover:bg-red-500/10"}`}
                      data-testid={`button-toggle-promo-${promo.id}`}
                    >
                      {promo.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${promo.active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {promo.active ? "Actif" : "Inactif"}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer le code "${promo.code}" ?`)) {
                          deletePromoCode.mutate(promo.id);
                        }
                      }}
                      className="p-1.5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      data-testid={`button-delete-promo-${promo.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* ADD PRODUCT DIALOG */}
      <ProductFormDialog
        open={showAddProduct}
        onOpenChange={setShowAddProduct}
        initialData={defaultProductForm}
        onSubmit={(data) => createProduct.mutate(data)}
        isLoading={createProduct.isPending}
        title="Ajouter un produit"
      />

      {/* EDIT PRODUCT DIALOG */}
      {editingProduct && (
        <ProductFormDialog
          open={!!editingProduct}
          onOpenChange={(open) => { if (!open) setEditingProduct(null); }}
          initialData={productToFormData(editingProduct)}
          onSubmit={(data) => updateProduct.mutate({ id: editingProduct.id, data })}
          isLoading={updateProduct.isPending}
          title="Modifier le produit"
        />
      )}

      {/* ADD PROMO CODE DIALOG */}
      <Dialog open={showAddPromo} onOpenChange={setShowAddPromo}>
        <DialogContent className="max-w-sm bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="text-primary">Ajouter un code promo</DialogTitle>
            <DialogDescription>Creez un nouveau code de reduction</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createPromoCode.mutate(promoForm);
            }}
            className="space-y-3"
          >
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Code *</label>
              <input
                type="text"
                value={promoForm.code}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50"
                required
                placeholder="EX: PROMO20"
                data-testid="input-promo-code"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reduction (%) *</label>
              <input
                type="number"
                min={1}
                max={100}
                value={promoForm.discountPercent}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                required
                data-testid="input-promo-discount"
              />
            </div>
            <button
              type="submit"
              disabled={createPromoCode.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="button-submit-promo"
            >
              {createPromoCode.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Creer le code promo
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
