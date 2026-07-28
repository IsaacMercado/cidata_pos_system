import { Banknote, Building, CreditCard, Smartphone } from "lucide-react";

export const paymentMethods = [
  { id: 1, code: "cash", name: "Efectivo" },
  { id: 2, code: "card", name: "Tarjeta" },
  { id: 3, code: "transfer", name: "Transferencia" },
  { id: 4, code: "mobile", name: "Pago Móvil" },
];

export const PAYMENT_METHODS = paymentMethods;

export const METHOD_LABEL: Record<number, string> = {
  1: "Efectivo",
  2: "Tarjeta",
  3: "Transferencia",
  4: "Pago Móvil",
};

export const METHOD_ICON: Record<number, typeof Banknote> = {
  1: Banknote,
  2: CreditCard,
  3: Building,
  4: Smartphone,
};

export function getPaymentMethod(id: number) {
  return paymentMethods.find((m) => m.id === id);
}