import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function InvoiceEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3 flex justify-center">
        <FileText size={40} aria-hidden="true" className="text-muted" />
      </div>
      <p className="text-muted text-base">{t('invoices.empty.title')}</p>
      <p className="text-sm text-muted mt-1">{t('invoices.empty.description')}</p>
    </div>
  );
}
