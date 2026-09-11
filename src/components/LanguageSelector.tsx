import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import clsx from 'clsx';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'compact' | 'dropdown';
}

export default function LanguageSelector({ className }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div 
      className={clsx(
        "inline-flex items-center bg-gray-100/90 hover:bg-gray-100 p-0.5 rounded-lg border border-gray-200/80 transition-colors shadow-2xs",
        className
      )}
      title={t('header.language', 'Idioma / Sprache')}
      role="group"
      aria-label="Language selector"
    >
      <div className="pl-1.5 pr-1 text-gray-400">
        <Globe size={13} />
      </div>
      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={clsx(
          "px-2 py-0.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 select-none",
          language === 'es'
            ? "bg-white text-blue-700 shadow-xs font-bold"
            : "text-gray-500 hover:text-gray-900"
        )}
        title="Español"
      >
        <span className="text-[11px] leading-none">🇪🇸</span>
        <span className="tracking-wide">ES</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('de')}
        className={clsx(
          "px-2 py-0.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1 select-none",
          language === 'de'
            ? "bg-white text-blue-700 shadow-xs font-bold"
            : "text-gray-500 hover:text-gray-900"
        )}
        title="Deutsch"
      >
        <span className="text-[11px] leading-none">🇩🇪</span>
        <span className="tracking-wide">DE</span>
      </button>
    </div>
  );
}
