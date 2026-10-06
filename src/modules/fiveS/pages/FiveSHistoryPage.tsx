import React from 'react';
import { useParams } from 'react-router-dom';
import { 
  History, 
  Calendar, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  ClipboardCheck, 
  User, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSHistoryItem } from '../types/fiveSTypes';

export default function FiveSHistoryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, zones, subzones, history, loading } = useFiveSProject(projectId);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando histórico 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  const getEventIcon = (type: FiveSHistoryItem['type']) => {
    switch (type) {
      case 'safari':
      case 'action_created':
        return <Camera className="text-blue-600" size={16} />;
      case 'red_tag':
        return <AlertTriangle className="text-red-600" size={16} />;
      case 'action_resolved':
        return <CheckCircle2 className="text-emerald-600" size={16} />;
      case 'standard_approved':
        return <ShieldCheck className="text-purple-600" size={16} />;
      case 'audit_completed':
        return <ClipboardCheck className="text-amber-600" size={16} />;
      default:
        return <Sparkles className="text-gray-600" size={16} />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Bitácora y Trazabilidad Histórica 5S</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Registro inmutable del ciclo continuo de implantación: Foto NOK → Acción → Foto OK → Estándar → Auditoría.
        </p>
      </div>

      {/* Timeline */}
      {history.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 max-w-md mx-auto">
          <History size={32} className="text-gray-300 mx-auto mb-2" />
          <h4 className="font-semibold text-gray-800 text-sm">Sin eventos registrados</h4>
          <p className="text-xs text-gray-500 mt-1">
            Los safaris, tarjetas rojas, resoluciones y auditorías aparecerán aquí automáticamente conforme se interactúe con el módulo.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
            {history.map((item) => (
              <div key={item.id} className="relative group">
                {/* Node icon */}
                <div className="absolute -left-6 mt-1 w-5 h-5 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center group-hover:border-blue-600 group-hover:scale-110 transition-all shadow-2xs">
                  {getEventIcon(item.type)}
                </div>

                {/* Content card */}
                <div className="bg-gray-50/70 hover:bg-gray-50 p-4 rounded-xl border border-gray-200/80 transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      {item.phase && (
                        <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {item.phase}
                        </span>
                      )}
                      <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-200/60">
                    <span className="flex items-center gap-1">
                      <User size={12} /> {item.actorName}
                    </span>

                    {item.photoUrl && (
                      <a
                        href={item.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-semibold flex items-center gap-1 text-[11px]"
                      >
                        <Camera size={12} /> Ver foto adjunta
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
