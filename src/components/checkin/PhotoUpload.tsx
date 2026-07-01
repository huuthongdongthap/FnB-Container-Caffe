import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

interface PhotoUploadProps {
  onUpload: (file: File) => void;
  className?: string;
}

export function PhotoUpload({ onUpload, className }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    onUpload(file);
  };

  return (
    <div className={cn('text-center', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="photo-upload-input"
        aria-label="Chụp ảnh hoặc tải ảnh lên"
      />

      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Ảnh preview"
            className="w-full max-w-sm mx-auto rounded-xl object-cover aspect-[4/3]"
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => {
              setPreview(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Chụp lại
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full max-w-sm mx-auto p-8 rounded-xl border-2 border-dashed border-gray-300',
            'hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer',
            'flex flex-col items-center gap-2'
          )}
        >
          <span className="text-4xl">&#128247;</span>
          <span className="text-sm font-medium text-gray-600">
            Chụp ảnh tại quán
          </span>
          <span className="text-xs text-gray-400">
            Chụp ảnh quán cà phê hoặc đồ uống của bạn
          </span>
        </button>
      )}
    </div>
  );
}
