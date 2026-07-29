import {
    Banknote,
    Bed,
    Calendar,
    CreditCard,
    LogOut,
    Menu,
    Minus,
    Moon,
    Package,
    Plus,
    Search,
    ShoppingCart,
    Users,
    X
} from 'lucide-react';
import { useState } from 'react';

// --- DATOS DE EJEMPLO ---
const SAMPLE_PRODUCTS = [
  // Alojamiento (Servicios)
  { id: 1, name: 'Habitación Sencilla', price: 45.00, type: 'accommodation', available: 5, image: '🛏️', description: '1 Cama individual, WiFi, TV' },
  { id: 2, name: 'Habitación Doble', price: 75.00, type: 'accommodation', available: 3, image: '🛌', description: '2 Camas matrimoniales, Vista al mar' },
  { id: 3, name: 'Suite Presidencial', price: 150.00, type: 'accommodation', available: 1, image: '👑', description: 'Jacuzzi, Sala de estar, Minibar incluido' },
  // Productos Retail (Venta Directa)
  { id: 4, name: 'Agua Mineral 500ml', price: 1.50, type: 'retail', stock: 50, image: '💧' },
  { id: 5, name: 'Refresco Cola 355ml', price: 2.00, type: 'retail', stock: 30, image: '🥤' },
  { id: 6, name: 'Snack Papas Fritas', price: 2.50, type: 'retail', stock: 20, image: '🍟' },
  { id: 7, name: 'Cepillo de Dientes', price: 3.00, type: 'retail', stock: 15, image: '🪥' },
  { id: 8, name: 'Servicio de Lavandería', price: 10.00, type: 'retail', stock: 99, image: '🧺', description: 'Precio por carga' },
];

// --- COMPONENTES BASE (Design System) ---
const Card = ({ children, className = '', onClick }: { children?: any; className?: string; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all' : ''} ${className}`}
  >
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', size = 'md', icon: Icon = null, fullWidth = false, className = '', ...props }: any) => {
  const baseStyle = "inline-flex items-center justify-center font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-indigo-500",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-500 shadow-sm"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2"
  };
  return (
    <button className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${sizes[size as keyof typeof sizes]} ${fullWidth ? 'w-full' : ''} ${className}`} {...props}>
      {Icon && <Icon className={`w-4 h-4 ${children ? 'mr-2' : ''}`} />}
      {children}
    </button>
  );
};

const Badge = ({ children, variant = 'gray', className = '' }: { children?: any; variant?: string; className?: string }) => {
  const variants = {
    gray: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700'
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </span>
  );
};

// --- VISTAS ---
const POSView = () => {
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Estados para UI Responsiva
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Estado para Reserva de Alojamiento
  const [bookingProduct, setBookingProduct] = useState(null);

  // --- Lógica del Carrito ---
  const handleProductClick = (product: any) => {
    if (product.type === 'accommodation') {
      setBookingProduct(product); // Abre modal de reserva
    } else {
      // Agregar producto retail directo
      const existing = cart.find(item => item.id === product.id && !item.isBooking);
      if (existing) {
        setCart(cart.map(item => item.id === product.id && !item.isBooking ? { ...item, qty: item.qty + 1 } : item));
      } else {
        setCart([...cart, { ...product, qty: 1, isBooking: false, cartItemId: Date.now().toString() }]);
      }
    }
  };

  const addBookingToCart = (bookingData: any) => {
    setCart([...cart, bookingData]);
    setBookingProduct(null);
  };

  const updateQty = (cartItemId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.qty + delta;
        // Validación básica de disponibilidad para habitaciones
        if (item.isBooking && newQty > item.available) return item;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  const total = cart.reduce((sum, item) => {
    const itemPrice = item.isBooking ? item.price * item.nights : item.price;
    return sum + (itemPrice * item.qty);
  }, 0);

  // --- Lógica de Búsqueda y Filtros ---
  const filteredProducts = SAMPLE_PRODUCTS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || p.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-slate-50 relative overflow-hidden">

      {/* Botón flotante de carrito (Solo Móvil) */}
      <div className="md:hidden fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setIsCartOpen(true)}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-lg flex items-center justify-center relative focus:outline-none focus:ring-4 focus:ring-indigo-300"
        >
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
              {cart.reduce((sum, item) => sum + item.qty, 0)}
            </span>
          )}
        </button>
      </div>

      {/* --- ÁREA PRINCIPAL (Cuadrícula de Productos) --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / Buscador */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 z-10 shrink-0">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar habitaciones o productos..."
              value={searchQuery}
              onChange={(e: any) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex overflow-x-auto hide-scrollbar space-x-2 pb-1 sm:pb-0">
            <Button
              variant={activeCategory === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('all')}
              className="whitespace-nowrap"
            >
              Todos
            </Button>
            <Button
              variant={activeCategory === 'accommodation' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('accommodation')}
              className="whitespace-nowrap"
            >
              <Bed className="w-4 h-4 mr-1.5" /> Habitaciones
            </Button>
            <Button
              variant={activeCategory === 'retail' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('retail')}
              className="whitespace-nowrap"
            >
              <Package className="w-4 h-4 mr-1.5" /> Tienda
            </Button>
          </div>
        </div>

        {/* Cuadrícula */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="flex flex-col relative group h-full"
              >
                {product.type === 'accommodation' && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant={(product.available ?? 0) > 0 ? 'success' : 'danger'}>
                      {product.available} Disp.
                    </Badge>
                  </div>
                )}

                <div className="flex-1 p-4 flex flex-col items-center justify-center text-center">
                   <div className="text-4xl sm:text-5xl mb-3 transform group-hover:scale-110 transition-transform duration-200">
                     {product.image}
                   </div>
                   <h3 className="text-sm sm:text-base font-semibold text-slate-800 line-clamp-2 min-h-[40px] sm:min-h-[48px]">
                     {product.name}
                   </h3>
                   {product.description && (
                     <p className="text-xs text-slate-500 mt-1 line-clamp-1 hidden sm:block">{product.description}</p>
                   )}
                </div>

                <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                   <p className="text-indigo-700 font-bold text-sm sm:text-base">
                     ${product.price.toFixed(2)}
                     {product.type === 'accommodation' && <span className="text-xs text-slate-500 font-normal"> /noche</span>}
                   </p>
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white rounded-full">
                     <Plus className="w-4 h-4" />
                   </Button>
                </div>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>No se encontraron resultados</p>
            </div>
          )}
        </div>
      </div>

      {/* --- PANEL DEL CARRITO (Sidebar Derecho / Overlay Móvil) --- */}
      <>
        {/* Overlay para móvil */}
        {isCartOpen && (
          <div
            className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />
        )}

        <div className={`
          fixed md:relative top-0 right-0 h-full w-full sm:w-[400px] z-50 md:z-10 bg-white flex flex-col shadow-2xl md:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] border-l border-slate-200
          transform transition-transform duration-300 ease-in-out
          ${isCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          {/* Header Carrito */}
          <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
            <h2 className="font-bold flex items-center text-slate-800 text-lg">
              <ShoppingCart className="w-5 h-5 mr-2 text-indigo-600" />
              Orden Actual
              {cart.length > 0 && (
                 <Badge variant="indigo" className="ml-3">{cart.reduce((sum, item) => sum + item.qty, 0)}</Badge>
              )}
            </h2>
            <button onClick={() => setIsCartOpen(false)} className="md:hidden p-2 text-slate-500 hover:bg-slate-200 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Lista de Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                  <ShoppingCart className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-sm font-medium">El carrito está vacío</p>
                <p className="text-xs text-center px-8">Selecciona habitaciones o productos para agregarlos a la cuenta.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.cartItemId} className="flex flex-col p-3 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start flex-1 pr-2">
                       <span className="text-xl sm:text-2xl mr-3 mt-0.5">{item.image}</span>
                       <div>
                         <h4 className="text-sm font-bold text-slate-800 leading-tight">{item.name}</h4>

                         {/* Metadatos de Reserva (Alojamiento) */}
                         {item.isBooking ? (
                           <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                             <div className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {item.checkIn} a {item.checkOut}</div>
                             <div className="flex items-center"><Moon className="w-3 h-3 mr-1" /> {item.nights} Noche{item.nights > 1 ? 's' : ''} x ${item.price.toFixed(2)}</div>
                           </div>
                         ) : (
                           <p className="text-xs text-slate-500 mt-0.5">${item.price.toFixed(2)} c/u</p>
                         )}
                       </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="font-bold text-slate-900">
                        ${((item.isBooking ? item.price * item.nights : item.price) * item.qty).toFixed(2)}
                      </span>
                      <button onClick={() => removeFromCart(item.cartItemId)} className="mt-1 text-xs text-red-500 hover:text-red-700 font-medium">Quitar</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end mt-2 pt-2 border-t border-slate-50">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden shadow-sm">
                      <button onClick={() => updateQty(item.cartItemId, -1)} className="p-1.5 hover:bg-slate-200 text-slate-600 transition-colors"><Minus className="w-4 h-4" /></button>
                      <span className="w-10 text-center text-sm font-bold text-slate-800">{item.qty}</span>
                      <button onClick={() => updateQty(item.cartItemId, 1)} className="p-1.5 hover:bg-slate-200 text-slate-600 transition-colors" disabled={item.isBooking && item.qty >= item.available}><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Carrito (Total y Cobrar) */}
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <div className="space-y-2 mb-4">
               <div className="flex justify-between text-sm text-slate-500">
                 <span>Subtotal</span>
                 <span>${total.toFixed(2)}</span>
               </div>
               <div className="flex justify-between text-sm text-slate-500">
                 <span>Impuestos (0%)</span>
                 <span>$0.00</span>
               </div>
               <div className="flex justify-between items-end pt-2 border-t border-slate-100">
                 <span className="text-slate-800 font-medium">Total a pagar</span>
                 <span className="text-3xl font-black text-indigo-700">${total.toFixed(2)}</span>
               </div>
            </div>
            <Button
              fullWidth
              size="lg"
              disabled={cart.length === 0}
              onClick={() => { setShowPaymentModal(true); setIsCartOpen(false); }}
              className="h-14 text-lg shadow-md shadow-indigo-200"
            >
              Procesar Pago
            </Button>
          </div>
        </div>
      </>

      {/* --- MODAL DE RESERVA (Alojamiento) --- */}
      {bookingProduct && (
        <BookingModal
          product={bookingProduct}
          onClose={() => setBookingProduct(null)}
          onAdd={addBookingToCart}
        />
      )}

      {/* --- MODAL DE PAGO --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl sm:max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Finalizar Venta</h2>
                <p className="text-sm text-slate-500">Selecciona el método de pago</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
              {/* Resumen */}
              <div className="flex flex-col items-center p-6 bg-indigo-600 text-white rounded-2xl shadow-inner">
                <span className="text-indigo-100 text-sm font-medium mb-1">Monto Total</span>
                <span className="text-5xl font-black">${total.toFixed(2)}</span>
              </div>

              {/* Métodos de pago */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Método Principal</label>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Button variant="outline" className="h-16 flex flex-col items-center justify-center border-2 border-indigo-600 bg-indigo-50 text-indigo-700">
                    <Banknote className="w-5 h-5 mb-1" /> Efectivo
                  </Button>
                  <Button variant="outline" className="h-16 flex flex-col items-center justify-center bg-white">
                    <CreditCard className="w-5 h-5 mb-1 text-slate-400" /> Tarjeta
                  </Button>
                </div>

                <div className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                   <div className="w-full relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                     <input
                        type="number"
                        defaultValue={total.toFixed(2)}
                        className="w-full pl-8 pr-4 py-3 bg-transparent text-lg font-bold text-slate-800 focus:outline-none"
                      />
                   </div>
                   <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 shrink-0"><X className="w-5 h-5"/></Button>
                </div>
              </div>

              {/* Cuadre */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Recibido</span>
                  <span className="font-medium text-slate-800">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50 text-emerald-700 p-3 rounded-lg">
                  <span className="font-bold">Cambio a devolver</span>
                  <span className="text-xl font-black">$0.00</span>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white shrink-0">
               <Button variant="success" fullWidth className="h-14 text-lg font-bold shadow-lg shadow-emerald-200/50">
                 Confirmar Pago
               </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE MODAL DE RESERVA ---
const BookingModal = ({ product, onClose, onAdd }: { product: any; onClose: () => void; onAdd: (data: any) => void }) => {
  // Inicializar fechas (hoy y mañana)
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [rooms, setRooms] = useState(1);

  // Calcular noches
  const calculateNights = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const nights = calculateNights(checkIn, checkOut);
  const totalPrice = product.price * nights * rooms;

  const handleConfirm = () => {
    onAdd({
      ...product,
      isBooking: true,
      checkIn,
      checkOut,
      nights,
      qty: rooms,
      cartItemId: `${product.id}-${checkIn}-${checkOut}-${Date.now()}`
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-0 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-indigo-600 text-white p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1 bg-indigo-500 hover:bg-indigo-400 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <span className="text-4xl">{product.image}</span>
            <div>
              <h2 className="text-xl font-bold">{product.name}</h2>
              <p className="text-indigo-100 text-sm">{product.available} Habitaciones disponibles</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Check-In</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(e: any) => setCheckIn(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Check-Out</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={(e: any) => setCheckOut(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
             <div>
               <label className="block text-sm font-bold text-slate-800">Habitaciones</label>
               <p className="text-xs text-slate-500">Max. {product.available} disponibles</p>
             </div>
             <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-sm">
                <button onClick={() => setRooms(Math.max(1, rooms - 1))} className="p-2 hover:bg-slate-100 text-slate-600 transition-colors"><Minus className="w-4 h-4" /></button>
                <span className="w-12 text-center text-base font-bold text-slate-800">{rooms}</span>
                <button onClick={() => setRooms(Math.min(product.available, rooms + 1))} className="p-2 hover:bg-slate-100 text-slate-600 transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
          </div>

          {/* Resumen calculos */}
          <div className="bg-indigo-50 rounded-xl p-4 text-indigo-900 border border-indigo-100">
            <div className="flex justify-between text-sm mb-1">
              <span>{rooms}x Habitación (${product.price}/noche)</span>
              <span>${(product.price * rooms).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-3 pb-3 border-b border-indigo-200/50">
              <span>Noches de estadía</span>
              <span>x {nights}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="font-bold">Total Estadia</span>
              <span className="text-2xl font-black">${totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1 shadow-md shadow-indigo-200" onClick={handleConfirm}>
            Agregar a Cuenta
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- LAYOUT PRINCIPAL (App Shell Responsivo) ---
export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { id: 'pos', name: 'Punto de Venta', icon: ShoppingCart },
    { id: 'bookings', name: 'Reservas (Próximamente)', icon: Calendar },
    { id: 'clients', name: 'Clientes', icon: Users },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-hidden">

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center space-x-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-slate-800 focus:outline-none">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-2">
             <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold">H</div>
             <span className="font-bold text-lg tracking-tight">Hotel POS</span>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay (Móvil) */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Navegación) */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center px-6 bg-slate-950/50 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold text-white mr-3 shadow-lg shadow-indigo-500/20">
            H
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Hotel POS</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Principal
          </div>
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors group ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 mr-3 flex-shrink-0 ${activeTab === item.id ? 'text-indigo-200' : 'text-slate-400 group-hover:text-slate-300'}`} />
              {item.name}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-slate-500 truncate">Recepción</p>
            </div>
            <LogOut className="w-4 h-4 text-slate-500 hover:text-white cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0 h-[100dvh]">
        {activeTab === 'pos' && <POSView />}
        {activeTab !== 'pos' && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
             <Calendar className="w-16 h-16 mb-4 opacity-20" />
             <h2 className="text-xl font-bold text-slate-600 mb-2">Vista en Construcción</h2>
             <p className="max-w-md">La funcionalidad para la sección de "{navigation.find(n => n.id === activeTab)?.name}" se implementará en una fase futura.</p>
          </div>
        )}
      </main>

    </div>
  );
}
