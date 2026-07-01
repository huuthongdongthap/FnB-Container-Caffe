import { cn } from '@/lib/cn';

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
        className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-48 h-48 mx-auto mb-4 bg-gray-200 rounded-xl flex items-center justify-center">
          {/* QR code would be rendered here via qrcode library */}
          <div className="text-center">
            <div className="text-4xl mb-2">&#128241;</div>
            <div className="w-32 h-32 mx-auto border-2 border-gray-800 rounded-lg flex items-center justify-center">
              <div className="grid grid-cols-5 gap-0.5">
                {Array.from({ length: 25 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-2 h-2',
                      Math.random() > 0.5 ? 'bg-gray-900' : 'bg-transparent'
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Quét mã QR để đặt món
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Dùng camera điện thoại quét mã QR trên bàn để xem menu và đặt món trực tiếp
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
