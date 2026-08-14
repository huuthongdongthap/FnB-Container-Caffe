import React from 'react';

interface Props {
  invoiceId: string;
  invoiceNumber: string;
}

export default function ReceiptDownloadButton({ invoiceId, invoiceNumber }: Props) {
  async function handleDownload() {
    try {
      const res = await fetch(`/api/subscriptions/invoices/${invoiceId}/receipt`);
      if (!res.ok) {
        alert('Không thể tải hóa đơn');
        return;
      }
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `receipt-${invoiceNumber || invoiceId}.txt`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Lỗi tải hóa đơn');
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="text-xs text-blue-600 underline hover:text-blue-800"
      type="button"
    >
      Tải hóa đơn
    </button>
  );
}
