export function LocationMap() {
  return (
    <section className="bg-gradient-to-b from-[#050D1A] to-[#0A1A2E] py-20" aria-label="Vị trí quán">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-chrome-mid/60">
            ĐỊA CHỈ
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold text-chrome-bright sm:text-4xl">
            Tìm Chúng Tôi
          </h2>
          <p className="mx-auto mt-3 text-chrome-light/60">
            39 Nguyễn Tất Thành, Phường 1, Sa Đéc, Đồng Tháp
          </p>
        </div>

        <div className="mx-auto overflow-hidden rounded-2xl border border-chrome-light/10 shadow-xl">
          <div className="aspect-[21/9] w-full">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3928.537466122171!2d105.757416!3d10.289341!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTDCsDE3JzIxLjYiTiAxMDXCsDQ1JzI2LjciRQ!5e0!3m2!1svi!2s!4v1"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Bản đồ AURA CAFE"
              aria-label="Google Maps hiển thị vị trí AURA CAFE tại 39 Nguyễn Tất Thành, Sa Đéc"
            />
          </div>
        </div>

        {/* Info cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-5 text-center backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-chrome-mid/60">Giờ mở cửa</p>
            <p className="text-chrome-light/80">Thứ 2 - CN: 06:00 - 22:00</p>
          </div>
          <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-5 text-center backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-chrome-mid/60">Hotline</p>
            <a
              href="tel:0946013633"
              className="text-chrome-light/80 hover:text-chrome-bright transition-colors"
            >
              0946 013 633
            </a>
          </div>
          <div className="rounded-xl border border-chrome-light/10 bg-[#0A1A2E]/50 p-5 text-center backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-chrome-mid/60">Giao hàng</p>
            <p className="text-chrome-light/80">15-30 phút &middot; 5km</p>
          </div>
        </div>
      </div>
    </section>
  );
}
