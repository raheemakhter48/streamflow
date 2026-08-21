import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CategoryFilter = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) => {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex min-h-11 gap-2.5 pb-2">
        {categories.map((category) => {
          const active = selectedCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className={`h-9 shrink-0 max-w-[160px] truncate rounded-full px-4 text-xs font-semibold transition-all duration-200 ${
                active
                  ? "bg-white text-black font-extrabold shadow-lg shadow-white/10 scale-105"
                  : "bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/15"
              }`}
              title={category}
            >
              {category}
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default CategoryFilter;
