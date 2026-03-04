import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CategoryTabsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({ categories, selected, onSelect }: CategoryTabsProps) {
  return (
    <div className="py-2 px-4 overflow-x-auto flex gap-2 hide-scrollbar">
      <button
        onClick={() => onSelect("")}
        className={cn(
          "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
          selected === "" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        data-testid="category-all"
      >
        {selected === "" && (
          <motion.div
            layoutId="active-category"
            className="absolute inset-0 bg-primary rounded-full"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        <span className="relative z-10">Tout</span>
      </button>

      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={cn(
            "relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
            selected === category ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          data-testid={`category-${category.toLowerCase()}`}
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
