import { Badge } from "@medivi/ui/components/ui/badge";

const LOW_STOCK_THRESHOLD = 5;

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive">Out of stock</Badge>;
  if (stock <= LOW_STOCK_THRESHOLD) return <Badge variant="secondary">Only {stock} left</Badge>;
  return <Badge variant="outline">In stock</Badge>;
}
