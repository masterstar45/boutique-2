import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/ProductCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "@assets/pharmacy-hash-logo.png";

export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const { data: products, isLoading, error } = useProducts(selectedCategory, search);

  // Extract unique categories from products (mock logic since we don't have separate endpoint)
  // In a real app, you might fetch categories separately or distinct query
  const categories = ["Flowers", "Resins", "Edibles", "Vapes", "Accessories"];

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive p-4 text-center">
        Error loading products. Please try again.
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-2 flex items-center justify-between">
          <h1 className="text-xl font-bold">Menu</h1>
          <img 
            src={logoImage} 
            alt="PharmacyHash" 
            className="h-8 object-contain"
          />
        </div>
        
        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>

        {/* Categories */}
        <CategoryTabs 
          categories={categories} 
          selected={selectedCategory} 
          onSelect={setSelectedCategory} 
        />
      </header>

      {/* Grid */}
      <main className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-card rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {products?.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isLoading && products?.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-muted-foreground">No products found.</p>
          </div>
        )}
      </main>
    </div>
  );
}
