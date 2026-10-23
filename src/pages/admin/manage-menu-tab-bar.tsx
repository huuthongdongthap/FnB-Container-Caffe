import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { Tab } from './types';

interface ManageMenuTabBarProps {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}

/**
 * Tab strip for the menu admin page. Extracted from ManageMenu so the page stays
 * under the file-size budget as more admin surfaces are added.
 */
export function ManageMenuTabBar({ activeTab, onChange }: ManageMenuTabBarProps) {
  const { t } = useTranslation();

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'products', label: t('adminMenu.tabProducts') },
    { key: 'categories', label: t('adminMenu.tabCategories') },
    { key: 'modifiers', label: t('adminMenu.tabModifiers') },
  ];

  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
