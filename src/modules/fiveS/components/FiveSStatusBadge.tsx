import React from 'react';
import clsx from 'clsx';
import { 
  FiveSTrafficStatus, 
  FiveSProjectStatus, 
  FiveSZoneStatus,
  FIVE_S_PROJECT_STATUS_LABELS,
  FIVE_S_ZONE_STATUS_LABELS
} from '../types/fiveSTypes';

interface Props {
  status: 
    | FiveSTrafficStatus 
    | FiveSProjectStatus 
    | FiveSZoneStatus 
    | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'open' | 'implemented' | 'verified' | 'closed'
    | string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const FiveSStatusBadge: React.FC<Props> = ({ status, size = 'sm', label }) => {
  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';
  let dotColor = 'bg-slate-400';
  let defaultLabel = 'No evaluado';

  switch (status) {
    // Project statuses
    case 'DRAFT':
      colorClasses = 'bg-slate-50 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
      defaultLabel = FIVE_S_PROJECT_STATUS_LABELS.DRAFT;
      break;
    case 'PLANNED':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      defaultLabel = FIVE_S_PROJECT_STATUS_LABELS.PLANNED;
      break;
    case 'IMPLEMENTING':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      defaultLabel = FIVE_S_PROJECT_STATUS_LABELS.IMPLEMENTING;
      break;
    case 'STANDARDIZED':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      dotColor = 'bg-purple-500';
      defaultLabel = FIVE_S_PROJECT_STATUS_LABELS.STANDARDIZED;
      break;
    case 'MAINTENANCE':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      defaultLabel = FIVE_S_PROJECT_STATUS_LABELS.MAINTENANCE;
      break;
    case 'CLOSED':
      colorClasses = 'bg-gray-100 text-gray-600 border-gray-300';
      dotColor = 'bg-gray-400';
      defaultLabel = FIVE_S_PROJECT_STATUS_LABELS.CLOSED;
      break;

    // Zone statuses
    case 'NOT_STARTED':
      colorClasses = 'bg-slate-50 text-slate-600 border-slate-200';
      dotColor = 'bg-slate-400';
      defaultLabel = FIVE_S_ZONE_STATUS_LABELS.NOT_STARTED;
      break;
    case 'IN_PROGRESS':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      defaultLabel = FIVE_S_ZONE_STATUS_LABELS.IN_PROGRESS;
      break;
    case 'IMPLEMENTED':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      defaultLabel = FIVE_S_ZONE_STATUS_LABELS.IMPLEMENTED;
      break;

    // Traffic colors & legacy
    case 'green':
    case 'completed':
    case 'verified':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      defaultLabel = 'Conforme';
      break;
    case 'yellow':
    case 'in_progress':
    case 'implemented':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      defaultLabel = 'En proceso';
      break;
    case 'red':
    case 'delayed':
    case 'open':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      defaultLabel = 'Incumplimiento';
      break;
    case 'gray':
    case 'pending':
    default:
      colorClasses = 'bg-slate-50 text-slate-600 border-slate-200';
      dotColor = 'bg-slate-400';
      defaultLabel = 'Sin evaluar';
      break;
  }

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 rounded-full font-medium',
    md: 'text-xs px-3 py-1 rounded-full font-semibold',
    lg: 'text-sm px-3.5 py-1.5 rounded-full font-semibold',
  }[size];

  return (
    <span className={clsx('inline-flex items-center gap-1.5 border shadow-2xs transition-colors', colorClasses, sizeClasses)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      {label || defaultLabel}
    </span>
  );
};
