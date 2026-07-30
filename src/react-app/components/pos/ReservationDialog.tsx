import { useEffect, useState } from "preact/hooks";
import { Button, Dialog, Input } from "../ui";

interface ReservationDialogProps {
  open: boolean;
  product: { id: number; name: string; price: number } | null;
  onConfirm: (data: {
    checkIn: string;
    checkOut: string;
    total: number;
  }) => void;
  onClose: () => void;
}

export function ReservationDialog({
  open,
  product,
  onConfirm,
  onClose,
}: ReservationDialogProps) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  useEffect(() => {
    if (open) {
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(0, 10);
      setCheckIn(tomorrow);
      setCheckOut(tomorrow);
    }
  }, [open]);

  if (!product) return null;

  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const total = product.price * nights;

  function handleConfirm() {
    if (!checkIn || !checkOut) return;
    onConfirm({ checkIn, checkOut, total });
  }

  return (
    <Dialog open={open} onClose={onClose} size="sm">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-800">Reservación</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-zinc-600">{product.name}</p>

        <div className="flex gap-3">
          <Input
            label="Check-in"
            type="date"
            value={checkIn}
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            onChange={(e: any) => setCheckIn(e.currentTarget?.value ?? e ?? "")}
            className="flex-1"
          />
          <Input
            label="Check-out"
            type="date"
            value={checkOut}
            min={
              checkIn ||
              new Date(Date.now() + 86400000).toISOString().slice(0, 10)
            }
            onChange={(e: any) =>
              setCheckOut(e.currentTarget?.value ?? e ?? "")
            }
            className="flex-1"
          />
        </div>

        <div className="bg-zinc-50 rounded-xl p-3 space-y-1 text-sm">
          <div className="flex justify-between text-zinc-500">
            <span>Precio por noche</span>
            <span>${product.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Noches</span>
            <span>{nights}</span>
          </div>
          <div className="flex justify-between font-semibold text-zinc-800 pt-1 border-t border-zinc-200">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!checkIn || !checkOut}>
            Agregar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
