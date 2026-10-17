import { cn } from '@/lib/cn';
import { Smartphone } from 'lucide-react';

interface QRCodeOverlayProps {
  show: boolean;
  onClose?: () => void;
  className?: string;
}

export function QRCodeOverlay({ show, onClose, className }: QRCodeOverlayProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm',
        className
      )}
      onClick={onClose}
    >
      <div
        className="bg-surface text-foreground border border-border rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-48 h-48 mx-auto mb-4 bg-surface/60 text-muted border border-border rounded-xl flex items-center justify-center">
          {/* QR code would be rendered here via qrcode library */}
          <div className="text-center">
            <div className="text-4xl mb-2"><Smartphone size={36} className="block mx-auto" /></div>
            <div className="w-32 h-32 mx-auto border-2 border-border rounded-lg flex items-center justify-center">
              <div className="grid grid-cols-5 gap-0.5">
                {Array.from({ length: 25 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-2 h-2',
                      Math.random() > 0.5 ? 'bg-foreground' : 'bg-transparent'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Quét mã QR để đặt món
        </h3>
        <p className="text-sm text-muted mb-4">
          Dùng camera điện thoại quét mã QR trên bàn để xem menu và đặt món trực tiếp
        </p>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-surface text-foreground border border-border rounded-lg text-sm font-medium hover:bg-surface/80 transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
