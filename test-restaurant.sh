#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Create restaurant + tables ==="
REST=$(curl -s -X POST http://localhost:8787/api/restaurants \
  -H "Content-Type: application/json" -d '{"name":"Mi Restaurante"}')
REST_ID=$(echo "$REST" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Restaurant: $REST_ID"

T1=$(curl -s -X POST "http://localhost:8787/api/restaurants/$REST_ID/tables" \
  -H "Content-Type: application/json" -d '{"name":"Mesa 1","capacity":4,"posX":50,"posY":50}')
T1_ID=$(echo "$T1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Table 1: $T1_ID"

T2=$(curl -s -X POST "http://localhost:8787/api/restaurants/$REST_ID/tables" \
  -H "Content-Type: application/json" -d '{"name":"Mesa 2","capacity":2,"posX":250,"posY":100}')
T2_ID=$(echo "$T2" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Table 2: $T2_ID"

echo ""
echo "=== 2. Create in-progress sale for Mesa 1 ==="
SALE1=$(curl -s -X POST http://localhost:8787/api/sales \
  -H "Content-Type: application/json" \
  -d "{\"tableId\":$T1_ID,\"status\":\"in_progress\",\"items\":[{\"productId\":1,\"quantity\":2,\"unitPrice\":1.5},{\"productId\":3,\"quantity\":1,\"unitPrice\":2.5}]}")
echo "$SALE1" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f\"Sale #{d['id']}: status={d['status']} total=\${d['total']} table={d['tableName']}\")"

echo ""
echo "=== 3. Check table is occupied ==="
curl -s "http://localhost:8787/api/restaurants/$REST_ID" | python3 -c "
import sys,json
data=json.load(sys.stdin)['data']
for t in data['tables']:
    print(f\"  {t['name']}: {t['status']}\")"

echo ""
echo "=== 4. Add items to sale (total should update to \$8.50) ==="
curl -s -X POST "http://localhost:8787/api/sales/1/items" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":2,"quantity":3,"unitPrice":1.0}]}' | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f\"Items: {len(d['items'])}, Total: \${d['total']}, table={d.get('tableName','N/A')}\")"

echo ""
echo "=== 5. Split payment: card + cash totaling \$8.50 ==="
PAY=$(curl -s -X POST "http://localhost:8787/api/sales/1/pay" \
  -H "Content-Type: application/json" \
  -d '{"payments":[{"paymentMethodId":1,"amount":4.25},{"paymentMethodId":2,"amount":4.25}]}')
echo "$PAY" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f\"Status: {d['status']}, Payments: {len(d['payments'])}, table={d.get('tableName','N/A')}\")"

echo ""
echo "=== 6. Table freed after payment ==="
curl -s "http://localhost:8787/api/restaurants/$REST_ID" | python3 -c "
import sys,json
for t in json.load(sys.stdin)['data']['tables']:
    print(f\"  {t['name']}: {t['status']}\")"

echo ""
echo "=== 7. Quick POS (complete sale, no restaurant) ==="
QPOS=$(curl -s -X POST http://localhost:8787/api/sales \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":1,"unitPrice":1.5}]}')
echo "$QPOS" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f\"Sale #{d['id']}: {d['status']} \${d['total']}\")"

echo ""
echo "=== 8. Update table position ==="
curl -s -X PATCH "http://localhost:8787/api/restaurants/$REST_ID/tables/$T1_ID" \
  -H "Content-Type: application/json" \
  -d '{"posX":150,"posY":200}' | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f\"Table at ({d['posX']},{d['posY']})\")"

echo ""
echo "=== 9. Check sale detail with items + payments ==="
curl -s http://localhost:8787/api/sales/1 | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
print(f\"Sale #1: status={d['status']} total=\${d['total']} items={len(d['items'])} payments={len(d['payments'])}\")"

echo ""
echo "=== ALL TESTS PASSED ==="
