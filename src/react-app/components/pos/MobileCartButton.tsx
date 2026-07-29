import { ShoppingCart } from "lucide-react";
import { Button } from "../ui";

interface MobileCartButtonProps {
  orderName: string;
  symbol: string;
  total: number;
  cartOpen: boolean;
  onClick: () => void;
}

export function MobileCartButton({ orderName, symbol, total, cartOpen, onClick }: MobileCartButtonProps) {
  return (
    <div className={`sm:hidden fixed bottom-4 left-4 right-4 z-[60] transition-opacity duration-200 ${cartOpen ? "opacity-0 pointer-events-none" : ""}`}>
      <Button onClick={onClick} className="w-full py-3 rounded-xl shadow-lg">
        <ShoppingCart size={18} />
        {orderName} — {symbol}{total.toFixed(2)}
      </Button>
    </div>
  );
}
