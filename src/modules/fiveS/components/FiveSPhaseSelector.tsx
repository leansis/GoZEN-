import React from 'react';
import clsx from 'clsx';
import { FiveSPhase } from '../types/fiveSTypes';
import { Sparkles, LayoutGrid, Brush, ShieldCheck, Award } from 'lucide-react';

interface Props {
  selectedPhase: FiveSPhase | 'ALL';
  onSelectPhase: (phase: FiveSPhase | 'ALL') => void;
  showAllOption?: boolean;
}

const BASE_META = {
  '1S': {
    name: '1S',
    japanese: 'Seiri',
    spanish: 'Clasificar / Despejar',
    color: 'text-red-600',
    accentBg: 'bg-red-50 hover:bg-red-100 border-red-200',
    badgeBg: 'bg-red-600 text-white',
    icon: Sparkles,
    summary: 'Separar lo innecesario mediante tarjetas rojas y despejar el área de trabajo.',
  },
  '2S': {
    name: '2S',
    japanese: 'Seiton',
    spanish: 'Ordenar / Disponer',
    color: 'text-amber-600',
    accentBg: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
    badgeBg: 'bg-amber-600 text-white',
    icon: LayoutGrid,
    summary: 'Un lugar para cada cosa y cada cosa en su lugar con paneles sombra y marcajes.',
  },
  '3S': {
    name: '3S',
    japanese: 'Seiso',
    spanish: 'Limpiar / Inspeccionar',
    color: 'text-blue-600',
    accentBg: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    badgeBg: 'bg-blue-600 text-white',
    icon: Brush,
    summary: 'Limpiar detectando fuentes de suciedad y prevenir desgastes anómalos.',
  },
  '4S': {
    name: '4S',
    japanese: 'Seiketsu',
    spanish: 'Estandarizar',
    color: 'text-purple-600',
    accentBg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    badgeBg: 'bg-purple-600 text-white',
    icon: ShieldCheck,
    summary: 'Consolidar las 3S iniciales mediante estándares visuales y rutinas claras.',
  },
  '5S': {
    name: '5S',
    japanese: 'Shitsuke',
    spanish: 'Disciplina y Hábito',
    color: 'text-emerald-600',
    accentBg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    badgeBg: 'bg-emerald-600 text-white',
    icon: Award,
    summary: 'Mantener la disciplina mediante auditorías continuas y ciclo PDCA.',
  },
};

export const FIVE_S_PHASES_META: Record<string, typeof BASE_META['1S']> = {
  ...BASE_META,
  'Seiri': BASE_META['1S'],
  'Seiton': BASE_META['2S'],
  'Seiso': BASE_META['3S'],
  'Seiketsu': BASE_META['4S'],
  'Shitsuke': BASE_META['5S'],
};

export const FiveSPhaseSelector: React.FC<Props> = ({
  selectedPhase,
  onSelectPhase,
  showAllOption = true,
}) => {
  const phases: { id: FiveSPhase; label: string; number: string }[] = [
    { id: 'Seiri', label: 'Seiri', number: '1S' },
    { id: 'Seiton', label: 'Seiton', number: '2S' },
    { id: 'Seiso', label: 'Seiso', number: '3S' },
    { id: 'Seiketsu', label: 'Seiketsu', number: '4S' },
    { id: 'Shitsuke', label: 'Shitsuke', number: '5S' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {showAllOption && (
        <button
          type="button"
          onClick={() => onSelectPhase('ALL')}
          className={clsx(
            'px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5',
            selectedPhase === 'ALL'
              ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          )}
        >
          <span>Todas las fases</span>
        </button>
      )}

      {phases.map((p) => {
        const meta = FIVE_S_PHASES_META[p.id] || BASE_META['1S'];
        const Icon = meta.icon;
        const isSelected = selectedPhase === p.id || selectedPhase === p.number;

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPhase(p.id)}
            className={clsx(
              'px-3 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2',
              isSelected
                ? `${meta.badgeBg} shadow-sm border-transparent`
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            )}
          >
            <Icon size={14} className={isSelected ? 'text-white' : meta.color} />
            <span className="font-bold">{p.number}</span>
            <span className={clsx('text-[11px] font-medium hidden sm:inline', isSelected ? 'text-white/90' : 'text-gray-500')}>
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
