# CTO Refactor Task - AURA SPACE Codebase Cleanup

## Goal
Reduce deploy size, remove dead files, consolidate duplicate CSS/JS, fix legacy references.
IMPORTANT: After each phase, verify before proceeding to the next.

---

## Phase 1: Remove Dead Files

### 1.1 Delete bloat files
```bash
rm -f export.pdf
rm -f lighthouse-report.html
rm -f websocket-server.js
rm -f task2.txt task4.txt
rm -f test-reviews.html
```

### 1.2 Update .cfignore
Make sure `.cfignore` contains these entries (add if missing):
```
export.pdf
lighthouse-report.html
node_modules
.git
.wrangler
_archive
.claude
dist
plans
designs
docs
tests
tools
scripts
*.pen
*.md
```

---

## Phase 2: CSS Consolidation

### 2.1 Check and remove unused loyalty CSS files
Run this check for each file:
```bash
for f in css/loyalty-full.css css/loyalty-m3.css css/loyalty-styles.css; do
  echo "=== $f ==="
  grep -rl "$(basename $f)" --include="*.html" . | grep -v node_modules | grep -v _archive | grep -v .claude
done
```
If a file has NO results -> safe to delete it.

### 2.2 Check and remove unused KDS CSS files
```bash
for f in css/kds-m3.css css/kds-styles.css; do
  echo "=== $f ==="
  grep -rl "$(basename $f)" --include="*.html" . | grep -v node_modules | grep -v _archive | grep -v .claude
done
```
If a file has NO results -> safe to delete it.

---

## Phase 3: JS Dead Code Cleanup

### 3.1 Remove legacy WebSocket client
```bash
grep -rl "websocket-client" --include="*.html" . | grep -v node_modules | grep -v _archive | grep -v .claude
```
If empty -> `rm js/websocket-client.js`

### 3.2 Remove WS_CONFIG from js/config.js
In file `js/config.js`, delete the WebSocket config block:
```javascript
// WebSocket config
export const WS_CONFIG = {
  URL: 'ws://localhost:8080/ws',
  RECONNECT_DELAY: 3000,
  MAX_RECONNECT: 5
};
```

### 3.3 Check supabase references in js/kds-app.js
```bash
grep -n "supabase" js/kds-app.js
```
Comment out or remove any dead supabase imports/references.

---

## Phase 4: Admin Consolidation

### 4.1 Check if legacy dashboard/ folder is referenced
```bash
grep -rl "dashboard/admin\|dashboard/login" --include="*.html" --include="*.js" . | grep -v node_modules | grep -v _archive | grep -v .claude
```
If any files link to `dashboard/admin.html` -> update them to point to `admin/dashboard.html`.
Then delete the entire `dashboard/` folder:
```bash
rm -rf dashboard/
```

### 4.2 Fix back-link in admin/orders.html
The back-link goes to `../dashboard/admin.html`. Change it to `dashboard.html`.

---

## Phase 5: Deploy and Verify

```bash
cd ~/mekong-cli/FnB-Container-Caffe
rm -rf /tmp/fnb-deploy && mkdir -p /tmp/fnb-deploy
rsync -av \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.claude' \
  --exclude='export.pdf' \
  --exclude='.wrangler' \
  --exclude='_archive' \
  --exclude='dist' \
  --exclude='plans' \
  --exclude='designs' \
  --exclude='docs' \
  --exclude='tests' \
  --exclude='tools' \
  --exclude='scripts' \
  --exclude='*.pen' \
  --exclude='lighthouse-report.html' \
  --exclude='*.md' \
  --exclude='*.txt' \
  --exclude='.DS_Store' \
  . /tmp/fnb-deploy/

echo "Deploy size:"
du -sh /tmp/fnb-deploy/

npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main --commit-dirty=true
```

### Post-deploy verify (curl check):
```bash
for page in "" "admin/dashboard.html" "admin/orders.html" "admin/reservations.html" "checkout.html" "menu.html"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://fnb-caffe-container.pages.dev/$page")
  echo "$page -> HTTP $STATUS"
done
```

## Rules
- ONLY delete a file AFTER confirming via grep that NO HTML/JS imports it
- DO NOT modify content of main HTML pages (index, menu, checkout, etc.)
- DO NOT change backend Worker logic
- Deploy and verify after EACH phase before moving to the next

## Done When
- export.pdf deleted
- Duplicate loyalty CSS cleaned
- Legacy websocket files removed
- Old dashboard/ folder consolidated
- Deploy size under 5MB
- All pages return HTTP 200
