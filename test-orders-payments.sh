#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"

json() { python3 -c "$1"; }

REST=$(curl -s -X POST "$BASE_URL/api/restaurants" -H "Content-Type: application/json" -d '{"name":"Salon"}')
REST_ID=$(printf '%s' "$REST" | json "import sys,json; print(json.load(sys.stdin)['data']['id'])")

TABLE=$(curl -s -X POST "$BASE_URL/api/restaurants/$REST_ID/tables" -H "Content-Type: application/json" -d '{"name":"Mesa 1","capacity":4,"posX":10,"posY":10}')
TABLE_ID=$(printf '%s' "$TABLE" | json "import sys,json; print(json.load(sys.stdin)['data']['id'])")

SALE=$(curl -s -X POST "$BASE_URL/api/sales" -H "Content-Type: application/json" -d "{\"tableId\":$TABLE_ID,\"status\":\"in_progress\",\"items\":[{\"productId\":1,\"quantity\":2,\"unitPrice\":1.5}]}")
printf '%s\n' "$SALE" | json "import sys,json; d=json.load(sys.stdin)['data']; assert len(d['items'])==1; assert abs(d['total']-3.0)<0.01; print(f'create sale ok total={d[\"total\"]}')"

UPDATED=$(curl -s -X POST "$BASE_URL/api/sales/1/items" -H "Content-Type: application/json" -d '{"items":[{"productId":2,"quantity":2,"unitPrice":1.0}]}' )
printf '%s\n' "$UPDATED" | json "import sys,json; d=json.load(sys.stdin)['data']; assert len(d['items'])==2; assert abs(d['total']-5.0)<0.01; print(f'add items ok total={d[\"total\"]}')"

TABLE_STATE=$(curl -s "$BASE_URL/api/restaurants/$REST_ID")
printf '%s\n' "$TABLE_STATE" | json "import sys,json; t=json.load(sys.stdin)['data']['tables'][0]; assert t['status']=='occupied'; print(f'table occupied ok: {t[\"status\"]}')"

BAD_PAY=$(curl -s -X POST "$BASE_URL/api/sales/1/pay" -H "Content-Type: application/json" -d '{"payments":[{"paymentMethodId":1,"amount":4.0}]}' )
printf '%s\n' "$BAD_PAY" | json "import sys,json; d=json.load(sys.stdin); assert 'error' in d; print('reject bad payment ok')"

GOOD_PAY=$(curl -s -X POST "$BASE_URL/api/sales/1/pay" -H "Content-Type: application/json" -d '{"payments":[{"paymentMethodId":1,"amount":2.0},{"paymentMethodId":2,"amount":3.0}]}' )
printf '%s\n' "$GOOD_PAY" | json "import sys,json; d=json.load(sys.stdin)['data']; assert d['status']=='completed'; assert len(d['payments'])==2; print('split payment ok')"

TABLE_FREE=$(curl -s "$BASE_URL/api/restaurants/$REST_ID")
printf '%s\n' "$TABLE_FREE" | json "import sys,json; t=json.load(sys.stdin)['data']['tables'][0]; assert t['status']=='available'; print(f'table free ok: {t[\"status\"]}')"

DETAIL=$(curl -s "$BASE_URL/api/sales/1")
printf '%s\n' "$DETAIL" | json "import sys,json; d=json.load(sys.stdin)['data']; assert len(d['items'])==2; assert len(d['payments'])==2; assert abs(d['total']-5.0)<0.01; print('detail ok')"

echo "integration ok"
