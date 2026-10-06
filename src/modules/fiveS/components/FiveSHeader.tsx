import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  MapPin, 
  Calendar, 
  Layers, 
  CheckSquare, 
  FileText, 
  ClipboardCheck, 
  BarChart3, 
  History, 
  Camera, 
  ArrowLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { FiveSProject, FiveSZone, FiveSSubzone } from '../types/fiveSTypes';
import { FiveSStatusBadge } from './FiveSStatusBadge';
import { FiveSSafariModal } from './FiveSSafariModal';

interface Props {
  project: FiveSProject;
  zones?: FiveSZone[];
  subzones?: FiveSSubzone[];
  activeTab?: string;
}

export const FiveSHeader: React.FC<Props> = ({
  project,
  zones = [],
  subzones = []
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSafariOpen, setIsSafariOpen] = useState(false);

  const tabs = [
    { id: 'hub', label: 'Resumen', path: `/5s/projects/${project.id}`, icon: Building2 },
    { id: 'team', label: 'Equipo', path: `/5s/projects/${project.id}/team`, icon: Users },
    { id: 'zones', label: 'Zonas', path: `/5s/projects/${project.id}/zones`, icon: MapPin },
    { id: 'planning', label: 'Planificación', path: `/5s/projects/${project.id}/planning`, icon: Calendar },
    { id: 'implementation', label: 'Implantación 5S', path: `/5s/projects/${project.id}/implementation`, icon: Layers },
    { id: 'actions', label: 'Acciones PDCA', path: `/5s/projects/${project.id}/actions`, icon: CheckSquare },
    { id: 'standards', label: 'Estándares', path: `/5s/projects/${project.id}/standards`, icon: FileText },
    { id: 'audits', label: 'Auditorías', path: `/5s/projects/${project.id}/audits`, icon: ClipboardCheck },
    { id: 'dashboard', label: 'Indicadores', path: `/5s/projects/${project.id}/dashboard`, icon: BarChart3 },
    { id: 'history', label: 'Histórico', path: `/5s/projects/${project.id}/history`, icon: History },
  ];

  const currentScore = project.currentScore || 0;
  const hasEvaluatedScore = typeof project.currentScore === 'number' && project.currentScore > 0;
  const scoreTraffic = hasEvaluatedScore 
    ? (currentScore >= 80 ? 'green' : currentScore >= 60 ? 'yellow' : 'red')
    : 'gray';

  return (
    <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 px-6 pt-5 mb-6 sticky top-0 z-20 shadow-2xs">
      {/* Breadcrumb & Project Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 font-medium">
            <Link to="/5s/projects" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <ArrowLeft size={13} /> Proyectos 5S
            </Link>
            <ChevronRight size={12} className="text-gray-400" />
            <span className="font-mono text-blue-700 font-bold">{project.code || '5S-001'}</span>
            <ChevronRight size={12} className="text-gray-400" />
            <span className="text-gray-800 font-semibold truncate max-w-xs">{project.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-black bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg">
              {project.code || '5S-001'}
            </span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">{project.name}</h1>
            
            <div className="flex items-center gap-2 flex-wrap">
              <FiveSStatusBadge status={project.status || 'PLANNED'} size="md" />
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-2xs">
                Fase {project.currentPhase || 'Seiri'}
              </span>
              <FiveSStatusBadge
                status={scoreTraffic}
                label={hasEvaluatedScore ? `Puntuación: ${currentScore.toFixed(0)}%` : 'Sin evaluar'}
                size="md"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 flex flex-wrap items-center gap-2">
            <span>Planta: <strong>{project.plantOrCenter}</strong></span>
            {project.areaDepartment && (
              <>
                <span className="text-gray-300">•</span>
                <span>Área: <strong>{project.areaDepartment}</strong></span>
              </>
            )}
            <span className="text-gray-300">•</span>
            <span>Resp 5S: <strong>{project.responsible5S || project.responsibleName || 'Sin asignar'}</strong></span>
            {project.leaderName && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-amber-800 font-semibold">Líder: {project.leaderName}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-gray-100 pt-1 -mb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;

          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={clsx(
                "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all",
                isActive
                  ? "border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              )}
            >
              <Icon size={15} className={isActive ? "text-blue-600" : "text-gray-400"} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
