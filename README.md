# POS System - Cloudflare D1 + Workers

Sistema de punto de venta (POS) optimizado para **Cloudflare Workers + D1 (gratuito)** con sincronización a Odoo.

## Análisis del Free Tier de Cloudflare

### Límites del plan gratuito

| Recurso | Límite | Estrategia de optimización |
|---------|--------|---------------------------|
| **Workers** | 100k reqs/día, 10ms CPU/req | Lógica de negocio en triggers SQL, respuestas pequeñas, batch writes |
| **D1** | 5 GB, 5M reads/día, 100k writes/día | Índices en todas las columnas de búsqueda, queries preparadas |
| **D1 por DB** | 10 GB máx, 50k DBs/cuenta | Una DB para el POS, multi-tenencia por esquema si escala |

### Optimizaciones clave aplicadas

1. **Lógica en la DB**: triggers SQLite para validación de stock, cálculo de totales, movimientos de inventario — sin CPU del Worker
2. **Batch de operaciones**: las ventas insertan sale_items + se actualiza stock + se registra movimiento en un solo request
3. **Índices**: todas las columnas de filtro (`status`, `created_at`, `sync_status`, `odoo_id`, `product_id`)
4. **Prepared statements**: Drizzle ORM las usa por defecto
5. **Respuestas mínimas**: solo `{ data: ... }` sin metadata innecesaria
6. **Read replicas**: D1 replica globalmente para lecturas de baja latencia

### Limitaciones de D1 conocidas

- **Sin stored procedures** → pero **soporta triggers SQLite** (CREATE TRIGGER)
- **Sin BEGIN/COMMIT transaccional** → usar `db.batch()` para operaciones atómicas
- **Sin funciones personalizadas** → toda la lógica va en triggers o en el Worker
- **`sqlite_version()` bloqueado** → no se puede consultar versión de SQLite

## Arquitectura

```
 Cliente POS (PWA - Preact)
       │
       ├── Online → Cloudflare Worker (API REST) → D1 → Odoo
       │
       └── Offline → IndexedDB (local) → encola ops → sync cuando vuelve la red
                         │
                    Service Worker (cache estáticos)
```

### Frontend (Cloudflare Pages - 0 CPU)

| Recurso | Tamaño (gzip) | Nota |
|---------|--------------|------|
| JS bundle | **14.66 kB** | Preact + app completa |
| CSS | **1.78 kB** | Minimalista POS UI |
| HTML | **0.56 kB** | Shell |
| Service Worker | 1.7 kB | Cache + offline |
| **Total inicial** | **~17 kB** | Carga instantánea |

### Backend (Cloudflare Workers + D1)

```
 Worker API ──→ D1 Database (SQLite + Triggers)
       │
       ├── Catálogo (productos, categorías)
       ├── Ventas (sales, sale_items)
       ├── Clientes (customers)
       ├── Inventario (inventory_movements)
       └── Sincronización (sync_log) ──→ Odoo (JSON-RPC)
```

## Modelo de Datos

### Tablas principales

| Tabla | Propósito | Trigger asociado |
|-------|-----------|-----------------|
| `products` | Catálogo de productos con stock actual | `trg_products_after_update` |
| `categories` | Categorías jerárquicas | — |
| `customers` | Clientes con saldo y crédito | `trg_customers_after_update` |
| `sales` | Cabecera de venta (totales, estado) | `trg_sales_after_update`, `trg_sales_after_cancel` |
| `sale_items` | Líneas de detalle de venta | `trg_sale_items_before_insert`, `trg_sale_items_after_insert`, `trg_sale_items_after_delete` |
| `inventory_movements` | Bitácora de movimientos de stock | (insertado por triggers) |
| `low_stock_alerts` | Alertas de stock bajo | (insertado por trigger) |
| `sync_log` | Registro de sincronización con Odoo | — |

## Triggers (Lógica de Negocio en la DB)

### 1. `trg_sale_items_before_insert` — Validación de stock

```
BEFORE INSERT ON sale_items
└── RAISE(ABORT) si current_stock < quantity
```

### 2. `trg_sale_items_after_insert` — Post-venta

```
AFTER INSERT ON sale_items
├── Actualiza subtotal, tax_total, discount_total, total en sales
├── Decrementa current_stock en products
├── Inserta registro en inventory_movements (type='exit')
└── Inserta alerta en low_stock_alerts si stock ≤ min_stock
```

### 3. `trg_sale_items_after_delete` — Reversión de ítem

```
AFTER DELETE ON sale_items
├── Recalcula totales en sales
└── Restaura current_stock en products
```

### 4. `trg_sales_after_cancel` — Cancelación de venta

```
AFTER UPDATE OF status ON sales WHEN NEW.status = 'cancelled'
├── Restaura stock de todos los productos de la venta
└── Inserta inventory_movements (type='entry', reason='sale_cancelled')
```

### 5. `trg_products_stock_adjustment` — Ajuste manual

```
AFTER UPDATE OF current_stock ON products (cuando no es por venta)
└── Inserta inventory_movements (type='adjustment')
```

## API Endpoints

### Productos
- `GET /api/products` — Listar (filtros: search, categoryId, active)
- `GET /api/products/:id` — Detalle
- `POST /api/products` — Crear
- `PATCH /api/products/:id` — Actualizar
- `DELETE /api/products/:id` — Desactivar

### Ventas
- `POST /api/sales` — Crear venta con items (genera receipt_number automático)
- `GET /api/sales` — Listar (filtro: status)
- `GET /api/sales/:id` — Detalle con items
- `POST /api/sales/:id/cancel` — Cancelar (activa trigger de restauración)

### Clientes
- `GET /api/customers` — Listar (filtro: search)
- `GET /api/customers/:id` — Detalle
- `POST /api/customers` — Crear
- `PATCH /api/customers/:id` — Actualizar

### Inventario
- `GET /api/inventory/stock` — Niveles de stock (?lowStock=true)
- `POST /api/inventory/adjust` — Ajustar stock
- `GET /api/inventory/movements` — Bitácora de movimientos
- `GET /api/inventory/alerts` — Alertas de stock bajo
- `POST /api/inventory/alerts/:id/resolve` — Resolver alerta

### Sincronización Odoo
- `POST /api/sync/start` — Sincronizar datos pendientes (POS → Odoo)
- `POST /api/sync/pull/products` — Importar productos desde Odoo
- `POST /api/sync/pull/customers` — Importar clientes desde Odoo
- `GET /api/sync/log` — Ver historial de sincronización

## Instalación y despliegue

### Backend (Worker + D1)

```bash
cd pos-system

# Instalar dependencias
bun install

# Crear la base de datos D1
bunx wrangler d1 create pos-db
# Copiar el database_id a wrangler.toml

# Configurar secrets para Odoo
bunx wrangler secret put ODOO_PASSWORD

# Aplicar migración (schema + triggers)
bunx wrangler d1 migrations apply pos-db --remote

# Sembrar datos iniciales
bunx wrangler d1 execute pos-db --remote --file=./src/db/seed.sql

# Desplegar Worker
bun run deploy
```

### Frontend (Pages SPA + PWA)

```bash
cd pos-system/frontend

# Instalar dependencias
bun install

# Configurar URL de la API (variable de entorno en Pages)
# VITE_API_URL=https://pos-system.tu-worker.workers.dev

# Build (genera dist/ con service worker)
bun run build

# Desplegar a Pages
bunx wrangler pages deploy dist --project-name=pos-frontend
```

### Desarrollo local

```bash
# Terminal 1: Backend Worker
cd pos-system
bun run dev

# Terminal 2: Frontend (Vite dev server con HMR)
cd pos-system/frontend
bun run dev
```

La app corre en modo PWA desde el primer build. Al abrirla en el navegador, pregunta
"Instalar aplicación" automáticamente.

## Estrategia Offline

| Operación | Online | Offline |
|-----------|--------|---------|
| Ver productos | API → cachea en IndexedDB | IndexedDB local |
| Ver clientes | API → cachea en IndexedDB | IndexedDB local |
| Crear venta | API → D1 (triggers actualizan stock) | IndexedDB `pending_ops` |
| Sincronizar | Envía pendientes + descarga catálogo | N/A |

Cuando vuelve la red, el botón "Sincronizar ahora" en la pestaña Sync:
1. Replayea todas las `pending_ops` (ventas offline)
2. Descarga el catálogo actualizado
3. Marca la última sync

## Sincronización con Odoo

Usa **JSON-RPC** (compatible Odoo 14+). Para Odoo 19+ considerar migrar a JSON-2 API (`/json/2/{model}/{method}`).

### Mapeo de modelos

| POS | Odoo | Dirección |
|-----|------|-----------|
| `products` → `product.template` | `default_code`, `name`, `list_price`, `standard_price` | Bidireccional |
| `customers` → `res.partner` | `ref`, `name`, `email`, `phone` | Bidireccional |
| `sales` → `sale.order` | Receipt como name, líneas como sale.order.line | POS → Odoo |
| `inventory_movements` → `stock.move` | product, quantity, location | POS → Odoo |

El campo `sync_status` en cada tabla controla qué registros están pendientes de sincronizar.
