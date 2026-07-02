import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/shared/SEOHead';

export function NotFound() {
 return (
 <>
 <SEOHead
 title="404 — Không tìm thấy | AURA CAFE"
 description="Trang không tồn tại — AURA CAFE Container Rooftop Sa Đéc"
 noindex
 />

 <main
 id="main-content"
 className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"
 >
 <div
 data-testid="not-found-decoration"
 className="mb-6 text-8xl font-display font-bold text-accent/20 md:text-9xl"
 aria-hidden="true"
 >
 404
 </div>

 <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl">
 Trang không tồn tại
 </h1>

 <p className="mt-4 max-w-md text-muted">
 Trang bạn đang tìm kiếm có thể đã bị xóa hoặc thay đổi. Hãy quay lại trang chủ để khám phá không gian AURA CAFE.
 </p>

 <div className="mt-8 flex flex-wrap justify-center gap-4">
 <Link
 to="/"
 className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary"
 >
 Về Trang Chủ
 </Link>
 <Link
 to="/menu"
 className="rounded-xl border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:bg-accent/10"
 >
 Xem Thực Đơn
 </Link>
 </div>
 </main>
 </>
 );
}
