import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CategoryTabsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-white/5 py-2 px-4 hide-scrollbar overflow-x-auto flex gap-2">
      <button
        onClick={() => onSelect("")}
        className={cn(
          "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
          selected === "" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {selected === "" && (
          <motion.div
            layoutId="active-category"
            className="absolute inset-0 bg-primary rounded-full"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="relative z-10">All</span>
      </button>

      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={cn(
            "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
            selected === category ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {selected === category && (
            <motion.div
              layoutId="active-category"
              className="absolute inset-0 bg-primary rounded-full"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative z-10">{category}</span>
        </button>
      ))}
    </div>
  );
}
