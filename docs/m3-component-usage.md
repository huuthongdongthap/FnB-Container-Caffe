# M3 Component Primitives — Usage Reference

12 Material Design 3 primitives tại `src/components/md3/`. Import qua barrel:

```tsx
import { MD3Button, MD3Card, MD3TextField } from '@/components/md3';
```

## Conventions chung

- **Tokens only** — mọi màu/shape/elevation qua `md-sys-*` (qua TW: `bg-md-surface`, `rounded-md-lg`)
- **State layers** — hover 8%, focus-visible ring, pressed 12%, disabled opacity-0.38
- **Touch target ≥48px** — hit area extend qua padding
- **a11y** — icon-only elements bắt buộc `aria-label`; mọi component forwardRef
- **`cn()`** từ `src/lib/cn.ts` merge className

---

## MD3Button

```tsx
<MD3Button variant="filled" onClick={save}>Lưu</MD3Button>
<MD3Button variant="outlined" startIcon={<Plus />}>Thêm</MD3Button>
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `filled \| outlined \| text \| elevated \| tonal` | `filled` |
| `size` | `default \| compact` | `default` |
| `startIcon` / `endIcon` | `ReactNode` | — |
| `disabled` | `boolean` | `false` |

Height 40px, corner-full, label-large. Nút primary của app.

## MD3Card

```tsx
<MD3Card variant="elevated" onClick={open}>…</MD3Card>
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `elevated \| filled \| outlined` | `elevated` |
| `onClick` | `() => void` | — (có = interactive mode) |

Corner 12px (`rounded-md-md`). Elevated = elevation-1 shadow.

## MD3Fab

```tsx
<MD3Fab icon={<Plus />} aria-label="Thêm món" onClick={add} />
<MD3Fab icon={<Plus />} label="Thêm món" />  {/* extended */}
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `primary \| secondary \| tertiary \| surface` | `primary` |
| `size` | `small \| medium \| large` | `medium` |
| `icon` | `ReactNode` | bắt buộc |
| `label` | `string` | — (có = extended FAB) |

Size: small 40px, medium 56px, large 96px. Icon-only → `aria-label` bắt buộc.

## MD3Chip

```tsx
<MD3Chip variant="filter" selected={on}>Cà phê</MD3Chip>
<MD3Chip variant="input" onDismiss={remove}>Sữa tươi</MD3Chip>
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `assist \| filter \| input \| suggestion` | `assist` |
| `selected` | `boolean` | `false` |
| `elevated` | `boolean` | `false` |
| `onDismiss` | `() => void` | — (input variant) |

Filter selected → checkmark + `bg-md-secondary-container`.

## MD3NavigationBar + Item

```tsx
<MD3NavigationBar value={tab} onChange={setTab}>
  <MD3NavigationBarItem icon={<Home />} label="Trang chủ" value="home" />
  <MD3NavigationBarItem icon={<Menu2 />} label="Menu" value="menu" badge={3} />
</MD3NavigationBar>
```

| Prop (Bar) | Kiểu |
|------------|------|
| `value` / `onChange` | `string \| number` / `(v) => void` |
| children | ≤5 items (dev warning nếu quá) |

| Prop (Item) | Kiểu |
|-------------|------|
| `icon`, `label`, `value` | bắt buộc |
| `badge` | `number` (99+ cap) hoặc `true` (dot) |

Fixed bottom h-20, active item có pill indicator (`secondary-container`).

## MD3TopAppBar

```tsx
<MD3TopAppBar title="Menu" leadingIcon={<ArrowLeft />} actions={[<Share key=... />]} />
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `small \| center-aligned \| medium \| large` | `small` |
| `leadingIcon`, `actions` | `ReactNode` / `ReactNode[]` | — |

Sticky z-40. Scroll > 0 → bg transition surface → surface-container. Medium/large expand title bottom.

## MD3TextField

```tsx
<MD3TextField label="Email" type="email" error={msg} supportingText="Địa chỉ dùng đăng nhập" />
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `filled \| outlined` | `filled` |
| `error` | `string` | — |
| `supportingText` | `string` | — |
| `leadingIcon` / `trailingIcon` | `ReactNode` | — |
| `counter`, `maxLength` | `boolean` / `number` | — |

Floating label animate lên khi có value/focus. Error → `aria-invalid` + `aria-describedby`.

## MD3IconButton

```tsx
<MD3IconButton icon={<Heart />} aria-label="Yêu thích" onClick={like} />
<MD3IconButton icon={on ? <Star /> : <StarOff />} selected={on} onToggle={setOn} />
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `variant` | `standard \| filled \| tonal \| outlined` | `standard` |
| `size` | `small \| medium \| large` | `medium` |
| `selected` / `onToggle` | `boolean` / `() => void` | toggle mode khi có |

Toggle mode: selected → swap sang tonal + `aria-pressed`. Icon-only → `aria-label` bắt buộc.

## MD3Menu + Item

```tsx
const [anchor, setAnchor] = useState<HTMLElement | null>(null);
<button ref={el => setAnchor(el)}>Mở</button>
<MD3Menu anchor={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
  <MD3MenuItem icon={<Edit />} onClick={edit}>Sửa</MD3MenuItem>
</MD3Menu>
```

| Prop (Menu) | Kiểu |
|-------------|------|
| `anchor` | `HTMLElement \| null` |
| `open`, `onClose` | `boolean`, `() => void` |

Portal-rendered, flip phải khi sát viewport edge. Keyboard: ↑↓ navigate, Enter chọn, Esc đóng. Focus restore về anchor sau khi đóng.

## MD3Dialog

```tsx
<MD3Dialog open={show} onClose={close} title="Xoá đơn?" preventScrimClose>
  <p>Hành động này không thể hoàn tác.</p>
  <div slot="actions">
    <MD3Button variant="text" onClick={close}>Huỷ</MD3Button>
    <MD3Button variant="text" onClick={del}>Xoá</MD3Button>
  </div>
</MD3Dialog>
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `open`, `onClose` | `boolean`, `() => void` | — |
| `title` | `string` | — |
| `preventScrimClose` | `boolean` | `false` |

Focus trap (Tab wrap), scroll lock body, focus restore. Corner 24px, scrim 32%.

## MD3Snackbar

```tsx
<MD3Snackbar open={show} message="Đã lưu" action="HOÀN TÁC" onActionClick={undo} onClose={hide} />
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `duration` | `number` (ms) | `4000` (0 = không auto-dismiss) |
| `action` / `onActionClick` | `string` / `() => void` | — |

`role="status"` + `aria-live="polite"`. Bg inverse-surface, slide-up animation.

## MD3LinearProgress / MD3CircularProgress

```tsx
<MD3LinearProgress value={65} buffer={80} />   // determinate
<MD3LinearProgress />                          // indeterminate
<MD3CircularProgress value={75} />
```

| Prop | Kiểu | Mặc định |
|------|------|----------|
| `value` | `number` (0-100) | undefined → indeterminate |
| `buffer` | `number` (linear only) | — |

Indeterminate → `aria-valuenow` omitted. Value clamp 0-100.

---

## Quy tắc chọn variant nhanh

| Tình huống | Dùng |
|------------|------|
| Primary CTA (1/screen) | `MD3Button variant="filled"` |
| Hành động phụ | `MD3Button variant="text"` hoặc `variant="tonal"` |
| Icon action trong list/card | `MD3IconButton variant="standard"` |
| Floating add/cart | `MD3Fab variant="primary"` |
| Filter danh mục menu | `MD3Chip variant="filter"` |
| Bottom nav mobile | `MD3NavigationBar` (≤5) |
| Page header | `MD3TopAppBar variant="small"` |
| Form input | `MD3TextField variant="filled"` |
| Confirm destructive | `MD3Dialog` + text buttons |
| Feedback non-blocking | `MD3Snackbar` |
