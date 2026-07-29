import { useMemo, useRef, useState, useCallback } from "preact/hooks";
import { lineItemTotal } from "../lib/currency";
import type { CartItem, ProductWithCategory } from "../lib/types";

export interface Order {
  id: number;
  name: string;
  items: CartItem[];
  createdAt: Date;
}

export function useOrders(currency: string) {
  const orderIdCounter = useRef(0);

  function createOrder(name?: string): Order {
    orderIdCounter.current += 1;
    return {
      id: orderIdCounter.current,
      name: name || `Orden ${orderIdCounter.current}`,
      items: [],
      createdAt: new Date(),
    };
  }

  const [orders, setOrders] = useState<Order[]>([createOrder("Orden 1")]);
  const [activeOrderId, setActiveOrderId] = useState<number>(1);

  const activeOrder = orders.find((o) => o.id === activeOrderId) || orders[0];
  const itemCount = activeOrder.items.reduce((sum, item) => sum + item.quantity, 0);

  const totalDisplay = useMemo(
    () => +activeOrder.items.reduce((sum, item) => sum + lineItemTotal(item, currency), 0),
    [activeOrder.items, currency],
  );

  const addToCart = useCallback((product: ProductWithCategory) => {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== activeOrderId) return order;
      const existing = order.items.find((item) => item.product.id === product.id);
      if (!existing) {
        if (product.currentStock < 1) return order;
        return { ...order, items: [...order.items, { product, quantity: 1 }] };
      }
      if (existing.quantity >= product.currentStock) return order;
      return {
        ...order,
        items: order.items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      };
    }));
  }, [activeOrderId]);

  const updateQuantity = useCallback((productId: number, qty: number) => {
    setOrders((prev) => prev.map((order) => {
      if (order.id !== activeOrderId) return order;
      const item = order.items.find((i) => i.product.id === productId);
      if (!item) return order;
      const clamped = Math.min(Math.max(qty, 0), item.product.currentStock);
      if (clamped <= 0) {
        return { ...order, items: order.items.filter((i) => i.product.id !== productId) };
      }
      return {
        ...order,
        items: order.items.map((i) => (i.product.id === productId ? { ...i, quantity: clamped } : i)),
      };
    }));
  }, [activeOrderId]);

  const addOrder = useCallback(() => {
    const newOrder = createOrder();
    setOrders((prev) => [...prev, newOrder]);
    setActiveOrderId(newOrder.id);
  }, []);

  const removeOrder = useCallback((id: number) => {
    if (orders.length <= 1) return;
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      if (activeOrderId === id) setActiveOrderId(next[0].id);
      return next;
    });
  }, [orders.length, activeOrderId]);

  const switchOrder = useCallback((id: number) => {
    setActiveOrderId(id);
  }, []);

  const resetActiveOrder = useCallback(() => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== activeOrderId);
      if (next.length === 0) {
        const fresh = createOrder("Orden 1");
        setActiveOrderId(fresh.id);
        return [fresh];
      }
      if (!next.find((o) => o.id === activeOrderId)) setActiveOrderId(next[0].id);
      return next;
    });
  }, [activeOrderId]);

  return {
    orders,
    activeOrderId,
    activeOrder,
    itemCount,
    totalDisplay,
    addToCart,
    updateQuantity,
    addOrder,
    removeOrder,
    switchOrder,
    resetActiveOrder,
  };
}
