import { useTVMenu } from '@/hooks/use-tv-menu';
import { MenuSlideshow } from '@/components/tv-menu/MenuSlideshow';
import { TriangleAlert } from 'lucide-react';

export default function TVMenuPage() {
 const { menuGroups, totalItems, isLoading, isError, lastUpdated, isHappyHour } = useTVMenu();

 if (isLoading && menuGroups.length === 0) {
 return (
 <div className="min-h-screen bg-[#0A1A2E] flex items-center justify-center">
 <div className="text-center text-gray-400">
 <div className="w-10 h-10 border-3 border-gray-600 border-t-gold rounded-full animate-spin mx-auto mb-4" />
 <span className="text-2xl">Đang tải thực đơn...</span>
 </div>
 </div>
 );
 }

 if (isError && menuGroups.length === 0) {
 return (
 <div className="min-h-screen bg-[#0A1A2E] flex items-center justify-center">
 <div className="text-center text-red-400">
 <span className="text-5xl block mb-4"><TriangleAlert size={36} className="inline" /></span>
 <span className="text-2xl">Không thể tải thực đơn. Đang thử lại...</span>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-[#0A1A2E] text-[#e4e2e4] p-10 overflow-hidden" style={{ cursor: 'none' }}>
 <MenuSlideshow
 menuGroups={menuGroups}
 isHappyHour={isHappyHour}
 lastUpdated={lastUpdated}
 totalItems={totalItems}
 />
 </div>
 );
}
