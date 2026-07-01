import { useState } from 'react';
import { useUpcomingEvents } from '@/hooks/use-events';
import { EventCard } from '@/components/events/event-card';
import { EventCalendar } from '@/components/events/event-calendar';
import { TicketPurchase } from '@/components/events/ticket-purchase';
import { Card, Skeleton } from '@/components/ui';

export function EventsPage() {
  const { upcoming, past, isLoading, isError } = useUpcomingEvents();
  const [showPastCalendar, setShowPastCalendar] = useState(false);

  return (
    <main className="mx-auto max-w-5xl px-4 py-24">
      {/* Hero */}
      <section className="mb-16 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Workspace &amp; Events
        </p>
        <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
          AURA CAFE
          <br />
          <span className="text-accent">Su Kien &amp; Dat Cho</span>
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-muted/70">
          Khong gian container industrial-luxury hoan hao cho workshop, tasting event, private
          booking va nhung buoi gap go dac biet tai Sa Dec.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="#booking"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-background transition-all hover:scale-105 hover:shadow-lg"
          >
            Dat Cho Ngay &rarr;
          </a>
          <a
            href="#calendar"
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-8 py-3 text-sm font-semibold text-accent transition-all hover:bg-accent/10"
          >
            Lich Su Kien
          </a>
        </div>
      </section>

      {/* Section 1: Upcoming Events */}
      <section id="upcoming" className="mb-16">
        <div className="mb-12 text-center">
          <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-accent/70">01</p>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            SU KIEN SAP TOI
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold">Lich Su Kien &amp; Workshop</h2>
          <p className="mx-auto max-w-md text-sm text-muted/60">
            Tham gia cac buoi tasting, workshop ca phe va su kien dac biet duoc to chuc hang tuan
            tai AURA CAFE.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Card className="p-10 text-center">
            <span className="mb-3 block text-4xl">&#9888;&#65039;</span>
            <h3 className="font-display text-lg font-bold">Khong the tai su kien</h3>
            <p className="text-sm text-muted/60">Vui long thu lai sau.</p>
          </Card>
        )}

        {/* Event Cards */}
        {!isLoading && !isError && upcoming.length === 0 && (
          <Card className="p-10 text-center">
            <span className="mb-3 block text-4xl">&#128197;</span>
            <h3 className="font-display text-lg font-bold">Chua co su kien sap toi</h3>
            <p className="text-sm text-muted/60">Theo doi de cap nhat su kien moi nhat!</p>
          </Card>
        )}

        {!isLoading && !isError && upcoming.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Booking */}
      <section id="booking" className="mb-16 rounded-2xl bg-gradient-to-b from-muted/5 to-transparent px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-accent/70">02</p>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              DAT CHO
            </p>
            <h2 className="mb-3 font-display text-3xl font-bold">
              Dat Cho Su Kien &amp; Private Booking
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted/60">
              Chon ngay gio va loai su kien. He thong se gui xac nhan tu dong.
            </p>
          </div>

          {/* Cal.com Embed Placeholder */}
          <Card className="mx-auto mb-12 max-w-lg p-8 text-center">
            <span className="mb-3 block text-4xl">&#128197;</span>
            <h3 className="font-display text-lg font-bold">Dat Lich Truc Tuyen</h3>
            <p className="mb-4 text-sm text-muted/60">
              Nhan vien AURA se xac nhan dat cho trong vong 2 gio lam viec.
            </p>
            <a
              href="https://cal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2 text-sm font-semibold text-background transition-all hover:scale-105"
            >
              Mo Cal.com de Dat Cho &rarr;
            </a>
          </Card>

          {/* Booking Features */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5 text-center">
              <span className="mb-2 block text-3xl">&#127968;</span>
              <h4 className="font-display text-base font-bold">Private Booking</h4>
              <p className="mt-1 text-xs text-muted/60">
                Thue toan bo khong gian cho su kien rieng tu.
              </p>
            </Card>
            <Card className="p-5 text-center">
              <span className="mb-2 block text-3xl">&#127894;</span>
              <h4 className="font-display text-base font-bold">Workshop</h4>
              <p className="mt-1 text-xs text-muted/60">
                To chuc workshop ca phe, latte art, cupping session.
              </p>
            </Card>
            <Card className="p-5 text-center">
              <span className="mb-2 block text-3xl">&#127866;</span>
              <h4 className="font-display text-base font-bold">Tasting Event</h4>
              <p className="mt-1 text-xs text-muted/60">
                Su kien thuong thuc ca phe specialty, pairing banh.
              </p>
            </Card>
            <Card className="p-5 text-center">
              <span className="mb-2 block text-3xl">&#128188;</span>
              <h4 className="font-display text-base font-bold">Corporate</h4>
              <p className="mt-1 text-xs text-muted/60">
                Gap go doi tac, hop nhom trong khong gian industrial.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Section 3: Workshop Calendar */}
      <section id="calendar" className="mb-16">
        <div className="mb-12 text-center">
          <p className="mb-1 text-xs font-semibold tracking-[0.15em] text-accent/70">03</p>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            LICH WORKSHOP
          </p>
          <h2 className="mb-3 font-display text-3xl font-bold">Lich Hoat Dong Hang Tuan</h2>
          <p className="mx-auto max-w-md text-sm text-muted/60">
            Dang ky tham gia cac workshop va su kien duoc to chuc dinh ky tai AURA CAFE.
          </p>
        </div>

        {!isLoading && !isError && (
          <EventCalendar
            upcoming={upcoming}
            past={past}
            showPast={showPastCalendar}
            onTogglePast={() => setShowPastCalendar((v) => !v)}
          />
        )}

        {/* Pretix-style Ticket Purchase Example */}
        {!isLoading && !isError && upcoming.length > 0 && (
          <div className="mt-12">
            <TicketPurchase
              eventTitle={upcoming[0]?.title ?? ''}
              tiers={[
                { id: 'general', name: 'Ve Thuong', price: 50000, description: 'Vao cua + 1 do uong', available: 20 },
                { id: 'vip', name: 'Ve VIP', price: 120000, description: 'Vao cua + 2 do uong + qua tang', available: 10 },
              ]}
              onPurchase={(tierId, qty) => {
                // eslint-disable-next-line no-console
                console.log(`Purchase: tier=${tierId}, qty=${qty}`);
              }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
