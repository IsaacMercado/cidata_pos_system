import { useEffect, useState } from "preact/hooks";
import { Button, Dialog, Input } from "../ui";
import { api } from "../../lib/api";

interface ReservationDialogProps {
  open: boolean;
  product: { id: number; name: string; price: number } | null;
  onConfirm: (data: {
    checkIn: string;
    checkOut: string;
    total: number;
    guests: number;
    guestPrice: number;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
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
  const [guests, setGuests] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [availability, setAvailability] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) {
      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .slice(0, 10);
      const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000)
        .toISOString()
        .slice(0, 10);
      setCheckIn(tomorrow);
      setCheckOut(dayAfterTomorrow);
      setGuests(1);
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setAvailability(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !product || !checkIn || !checkOut || checkOut <= checkIn) {
      setAvailability(null);
      return;
    }
    let active = true;
    api.reservations.availability({ productId: product.id, checkIn, checkOut })
      .then((result) => { if (active) setAvailability(result.available); })
      .catch(() => { if (active) setAvailability(null); });
    return () => { active = false; };
  }, [open, product?.id, checkIn, checkOut]);

  if (!product) return null;

  const nights = Math.max(
    0,
    Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const validDates = Boolean(checkIn && checkOut && checkOut > checkIn);
  const guestPrice = product.price;
  const total = guestPrice * nights * guests;

  function handleConfirm() {
    if (!validDates) return;
    if (!guestName.trim() || availability === false) return;
    onConfirm({ checkIn, checkOut, total, guests, guestPrice, guestName: guestName.trim(), guestEmail: guestEmail.trim(), guestPhone: guestPhone.trim() });
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
        {availability !== null && (
          <p className={availability ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
            {availability ? "Disponible para esas fechas" : "No disponible: existe una reservación solapada"}
          </p>
        )}

        <div className="grid gap-3">
          <Input label="Huésped principal" value={guestName} onChange={(e: any) => setGuestName(e.currentTarget?.value ?? e ?? "")} />
          <div className="flex gap-3">
            <Input label="Correo" type="email" value={guestEmail} onChange={(e: any) => setGuestEmail(e.currentTarget?.value ?? e ?? "")} className="flex-1" />
            <Input label="Teléfono" value={guestPhone} onChange={(e: any) => setGuestPhone(e.currentTarget?.value ?? e ?? "")} className="flex-1" />
          </div>
          <Input label="Huéspedes" type="number" min="1" max="100" value={guests} onChange={(e: any) => setGuests(Math.max(1, Number(e.currentTarget?.value ?? e) || 1))} />
        </div>

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
              checkIn
                ? new Date(`${checkIn}T00:00:00Z`).getTime() + 86400000 > 0
                  ? new Date(new Date(`${checkIn}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
                  : checkIn
                : new Date(Date.now() + 86400000).toISOString().slice(0, 10)
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
            <span>${guestPrice.toFixed(2)} x huésped</span>
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
          <Button onClick={handleConfirm} disabled={!validDates || !guestName.trim() || availability !== true}>
            Agregar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
