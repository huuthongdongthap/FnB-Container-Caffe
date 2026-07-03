import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/shared/SEOHead';
import { StoryTimeline } from '@/components/about/StoryTimeline';
import { TeamSection } from '@/components/about/TeamSection';
import { ContainerConcept } from '@/components/about/ContainerConcept';
import React from 'react';
import { Coffee, Leaf, Handshake, Sparkles, UserCheck, ChefHat, Palette, Wrench, Mic } from 'lucide-react';

const VALUE_ICONS: Record<string, React.ElementType> = {
  coffee: Coffee,
  leaf: Leaf,
  handshake: Handshake,
  sparkles: Sparkles,
};

const AVATAR_ICONS: Record<string, React.ElementType> = {
  'user-check': UserCheck,
  'chef-hat': ChefHat,
  palette: Palette,
  wrench: Wrench,
  mic: Mic,
};

const MILESTONES_DATA = [
 {
 year: '2024',
 title: 'Ý Tưởng Ban Đầu',
 description: 'Trong một lần đi công tác tại các thành phố lớn, chúng tôi nhận thấy mô hình quán cafe container đang rất phổ biến. Với tình yêu dành cho Sa Đéc và mong muốn mang đến không gian mới lạ cho quê hương, ý tưởng về AURA CAFE bắt đầu hình thành.',
 },
 {
 year: 'Q1/2025',
 title: 'Khởi Công Xây Dựng',
 description: 'Sau 6 tháng lên kế hoạch và thiết kế, chúng tôi chính thức khởi công xây dựng trên mảnh đất ~183m². Kiến trúc container 40ft + 2x20ft được thiết kế bởi đội ngũ kiến trúc sư giàu kinh nghiệm.',
 },
 {
 year: 'Q3/2025',
 title: 'Hoàn Thiện & Đào Tạo',
 description: 'Công trình hoàn thành sau 8 tháng thi công. Đội ngũ nhân viên được tuyển chọn và đào tạo bài bản về pha chế, phục vụ và chăm sóc khách hàng theo tiêu chuẩn 5 sao.',
 },
 {
 year: '01/2026',
 title: 'Chính Thức Khai Trương',
 description: 'AURA CAFE chính thức mở cửa đón khách vào ngày 1 tháng 1 năm 2026. Với không gian độc đáo, specialty coffee chất lượng và view rooftop tuyệt đẹp, chúng tôi nhanh chóng trở thành điểm đến hot nhất Sa Đéc.',
 },
 {
 year: 'Hiện Tại',
 title: 'Phát Triển & Vươn Xa',
 description: 'Không ngừng cải thiện chất lượng dịch vụ, mở rộng menu và xây dựng cộng đồng yêu cafe tại Sa Đéc. Chúng tôi tự hào là nơi kết nối những người trẻ yêu cà phê và không gian sáng tạo.',
 },
];

const VALUES_DATA = [
 { icon: 'coffee', title: 'Chất Lượng', description: '100% cà phê nguyên chất từ Buôn Ma Thuột, không pha trộn, không chất bảo quản.' },
 { icon: 'leaf', title: 'Bền Vững', description: 'Tái chế container, sử dụng nguyên liệu thân thiện môi trường, hỗ trợ nông dân địa phương.' },
 { icon: 'handshake', title: 'Kết Nối', description: 'Tạo không gian để mọi người gặp gỡ, chia sẻ và cùng nhau phát triển.' },
 { icon: 'sparkles', title: 'Sáng Tạo', description: 'Không ngừng đổi mới trong từng món đồ uống, từng trải nghiệm khách hàng.' },
];

const TEAM_DATA = [
 { name: 'Nguyễn Văn A', role: 'Founder & CEO', bio: '10 năm kinh nghiệm trong ngành cafe & nhà hàng. Đam mê mang đến không gian cà phê chất lượng cho quê hương Sa Đéc.', avatar: UserCheck },
 { name: 'Trần Thị B', role: 'Head Barista', bio: 'Chứng chỉ Q Grader quốc tế. Chuyên gia về rang xay và pha chế cà phê specialty.', avatar: ChefHat },
 { name: 'Lê Văn C', role: 'Creative Director', bio: 'Người đứng sau các concept trang trí và trải nghiệm khách hàng độc đáo của quán.', avatar: Palette },
 { name: 'Phạm Thị D', role: 'Operations Manager', bio: 'Đảm bảo mọi hoạt động của quán diễn ra trơn tru, từ nguyên liệu đến dịch vụ.', avatar: UserCheck },
 { name: 'Hoàng Văn E', role: 'Head Chef', bio: 'Sáng tạo các món ăn kèm và bánh ngọt tươi mới mỗi ngày, kết hợp hương vị Á-Âu.', avatar: Wrench },
 { name: 'Vũ Thị F', role: 'Marketing Lead', bio: 'Xây dựng cộng đồng và kết nối khách hàng thông qua các chiến dịch sáng tạo.', avatar: Mic },
];

export function AboutUs() {
 return (
 <>
 <SEOHead
 title="Về Chúng Tôi | AURA CAFE — Câu Chuyện & Đội Ngũ"
 description="Câu chuyện hình thành AURA CAFE từ tình yêu Sa Đéc. Đội ngũ barista chuyên nghiệp và không gian container độc đáo 1 trệt + rooftop."
 ogTitle="Về Chúng Tôi | AURA CAFE"
 ogDescription="Câu chuyện hình thành AURA CAFE từ tình yêu Sa Đéc"
 ogImage="images/night-4k.webp"
 ogType="website"
 />

 <main id="main-content">
 {/* Hero */}
 <section className="relative overflow-hidden bg-[#0A1A2E] py-24 text-[#e4e2e4]">
 <div className="mx-auto max-w-4xl px-4 text-center">
 <h1 className="font-[EB_Garamond,serif] text-5xl font-bold tracking-wide md:text-7xl">
 Về Chúng Tôi
 </h1>
 <p className="mt-4 text-lg text-[#e4e2e4]/70">
 Từ tình yêu Sa Đéc đến không gian container độc đáo
 </p>
 </div>
 </section>

 {/* History Timeline */}
 <StoryTimeline milestones={MILESTONES_DATA} />

 {/* Core Values */}
 <section className="bg-white/[0.03] backdrop-blur-md border border-white/[0.08] rounded-xl py-16">
 <div className="mx-auto max-w-6xl px-4">
 <div className="mb-12 text-center">
 <span className="font-utility text-xs font-semibold uppercase tracking-[4px] text-[#b8c7e2]">
 Giá Trị Cốt Lõi
 </span>
 <h2 className="mt-2 font-[EB_Garamond,serif] text-3xl font-bold text-[#e4e2e4] md:text-4xl">
 Điều Chúng Tôi Tin
 </h2>
 </div>
 <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
 {VALUES_DATA.map((value) => (
 <div
 key={value.title}
 className="rounded-2xl border border-white/[0.08] bg-[#0A1A2E] p-6 text-center transition-all duration-200 hover:border-white/[0.15]"
 >
 <div className="mb-3 text-3xl">{(() => { const Icon = VALUE_ICONS[value.icon]; return Icon ? <Icon size={28} /> : null; })()}</div>
 <h3 className="font-[EB_Garamond,serif] text-lg font-semibold text-[#e4e2e4]">
 {value.title}
 </h3>
 <p className="mt-2 text-sm text-[#b8c7e2]">{value.description}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Team */}
 <TeamSection members={TEAM_DATA} />

 {/* 5-Zone Concept */}
 <ContainerConcept />

 {/* CTA */}
 <section className="py-20 text-center">
 <div className="mx-auto max-w-2xl px-4">
 <h2 className="font-[EB_Garamond,serif] text-3xl font-bold text-[#e4e2e4] md:text-4xl">
 Đến Và Trải Nghiệm
 </h2>
 <p className="mt-3 text-[#b8c7e2]">
 Ghé thăm AURA CAFE để cảm nhận không gian độc đáo và thưởng thức những ly cà phê tuyệt hảo.
 </p>
 <div className="mt-8 flex flex-wrap justify-center gap-4">
 <Link
 to="/menu"
 className="rounded-xl bg-[#0A1A2E] px-6 py-3 font-semibold text-[#e4e2e4] transition-colors hover:bg-secondary"
 >
 Xem Menu
 </Link>
 <a
 href="https://maps.google.com/?q=39+Nguyen+Tat+Thanh+Sa+Dec+Dong+Thap"
 target="_blank"
 rel="noopener noreferrer"
 className="rounded-xl border border-white/[0.08] px-6 py-3 font-semibold text-[#e4e2e4] transition-colors hover:bg-[#b8c7e2]/10"
 >
 Chỉ Đường
 </a>
 <Link
 to="/table-reservation"
 className="rounded-xl border border-white/[0.08] px-6 py-3 font-semibold text-[#e4e2e4] transition-colors hover:bg-[#b8c7e2]/10"
 >
 Đặt Bàn
 </Link>
 </div>
 </div>
 </section>
 </main>
 </>
 );
}
