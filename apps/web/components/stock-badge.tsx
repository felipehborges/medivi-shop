import { LocalizedText } from "@/components/localized-text";
import { Badge } from "@medivi/ui/components/ui/badge";

const LOW_STOCK_THRESHOLD = 5;

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive"><LocalizedText text={"Out of stock"} /></Badge>;
  if (stock <= LOW_STOCK_THRESHOLD) return <Badge variant="secondary"><LocalizedText text={"Only "} />{stock} <LocalizedText text={"left"} /></Badge>;
  return <Badge variant="outline"><LocalizedText text={"In stock"} /></Badge>;
}
