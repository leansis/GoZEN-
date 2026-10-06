import React from 'react';
import { useParams, Link } from 'react-router-dom';
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
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Award
} from 'lucide-react';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { FiveSRadarChart } from '../components/FiveSRadarChart';
import { FiveSNokOkComparison } from '../components/FiveSNokOkComparison';
import { FIVE_S_PHASES_META } from '../components/FiveSPhaseSelector';
import { FiveSPhase } from '../types/fiveSTypes';

export default function FiveSProjectHub() {
  const { projectId } = useParams<{ projectId: string }>();
  const { 
    project, 
    zones, 
    subzones, 
    actions, 
    redTags, 
    standards, 
    audits, 
    history, 
    loading 
  } = useFiveSProject(projectId);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Cargando centro de control 5S...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 max-w-md mx-auto my-12">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Proyecto no encontrado</h3>
        <p className="text-sm text-gray-500 mb-6">El proyecto 5S solicitado no existe o no tienes acceso en esta empresa.</p>
        <Link to="/5s/projects" className="bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl">
          Volver al listado
        </Link>
      </div>
    );
  }

  // Calculations
  const activeRedTags = redTags.filter(t => t.status === 'active' || t.status === 'in_quarantine').length;
  const resolvedRedTags = redTags.filter(t => t.status === 'resolved').length;
  
  const pendingActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress').length;
  const closedActions = actions.filter(a => a.status === 'verified' || a.status === 'closed').length;

  const latestAudit = audits[0];

  // Radar scores
  const phaseScores: Record<FiveSPhase, number> = latestAudit?.phaseScores || {
    '1S': 75,
    '2S': 65,
    '3S': 70,
    '4S': 55,
    '5S': 40
  };

  // Actions with both NOK and OK photos for visual showcase
  const transformedActions = actions.filter(a => a.photoNokUrl && a.photoOkUrl).slice(0, 2);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Score 5S */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Puntuación Global 5S</span>
            <Award className="text-blue-600" size={18} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              {(project.currentScore && project.currentScore > 0) ? `${project.currentScore.toFixed(0)}%` : 'Sin evaluar'}
            </span>
            {Boolean(project.currentScore && project.currentScore > 0) && (
              <span className="text-xs text-gray-400 font-medium">/ 100% max</span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <FiveSStatusBadge
              status={(project.currentScore && project.currentScore > 0) ? (project.currentScore >= 80 ? 'green' : project.currentScore >= 60 ? 'yellow' : 'red') : 'gray'}
              label={(project.currentScore && project.currentScore > 0) ? `${project.currentScore.toFixed(0)}%` : 'Sin evaluar'}
              size="sm"
            />
            <Link to={`/5s/projects/${project.id}/dashboard`} className="text-blue-600 hover:underline font-medium">
              Ver radar →
            </Link>
          </div>
        </div>

        {/* KPI 2: Tarjetas Rojas (1S) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Tarjetas Rojas (1S)</span>
            <AlertTriangle className="text-rose-600" size={18} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 tracking-tight">
              {activeRedTags}
            </span>
            <span className="text-xs text-gray-500 font-medium">activas en cuarentena</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
            <span>{resolvedRedTags} resueltas</span>
            <Link to={`/5s/projects/${project.id}/implementation`} className="text-blue-600 hover:underline font-medium">
              Gestionar 1S →
            </Link>
          </div>
        </div>

        {/* KPI 3: Acciones PDCA */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Plan de Acciones PDCA</span>
            <CheckSquare className="text-amber-600" size={18} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 tracking-tight">
              {pendingActions}
            </span>
            <span className="text-xs text-gray-500 font-medium">en curso</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
            <span>{closedActions} verificadas OK</span>
            <Link to={`/5s/projects/${project.id}/actions`} className="text-blue-600 hover:underline font-medium">
              Ver plan →
            </Link>
          </div>
        </div>

        {/* KPI 4: Estándares Visuales */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
            <span>Estándares Visuales (4S)</span>
            <ShieldCheck className="text-purple-600" size={18} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600 tracking-tight">
              {standards.length}
            </span>
            <span className="text-xs text-gray-500 font-medium">fichas activas</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
            <span>{zones.length} zonas cubiertas</span>
            <Link to={`/5s/projects/${project.id}/standards`} className="text-blue-600 hover:underline font-medium">
              Ver fichas →
            </Link>
          </div>
        </div>
      </div>

      {/* Middle Grid: 5S Spider Radar + 5S Implementation Phases Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 5S Spider Radar */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Radar de Madurez 5S</h3>
                <p className="text-xs text-gray-500">Desempeño actual por cada una de las 5 fases</p>
              </div>
              <Link
                to={`/5s/projects/${project.id}/audits`}
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1.5 rounded-lg transition"
              >
                Nueva Auditoría
              </Link>
            </div>
            <FiveSRadarChart phaseScores={phaseScores} targetScore={project.targetScore || 80} height={260} />
          </div>

          <div className="grid grid-cols-5 gap-1.5 pt-4 border-t border-gray-100 text-center">
            {(['1S', '2S', '3S', '4S', '5S'] as FiveSPhase[]).map((phase) => (
              <div key={phase} className="p-2 rounded-xl bg-gray-50 border border-gray-100">
                <span className="block text-[11px] font-bold text-gray-500">{phase}</span>
                <span className="block text-sm font-black text-gray-900">{phaseScores[phase]}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: The 5S Journey Navigator */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Ruta de Implantación 5S</h3>
              <p className="text-xs text-gray-500">Progreso paso a paso en el puesto de trabajo</p>
            </div>
            <Link
              to={`/5s/projects/${project.id}/implementation`}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              Abrir implantación <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {(['1S', '2S', '3S', '4S', '5S'] as FiveSPhase[]).map((phase) => {
              const meta = FIVE_S_PHASES_META[phase];
              const Icon = meta.icon;
              const isCurrent = project.currentPhase === phase;

              return (
                <div
                  key={phase}
                  className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    isCurrent
                      ? 'border-blue-400 bg-blue-50/50 shadow-2xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'} shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-gray-900">{phase} • {meta.japanese}</span>
                        <span className="text-xs text-gray-500 font-medium hidden sm:inline">({meta.spanish})</span>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          En curso
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">{meta.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Visual Showcase: Recent NOK vs OK Transformations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Transformaciones Visuales (Antes NOK → Después OK)
            </h3>
            <p className="text-xs text-gray-500">Resultados palpables y mejora continua del puesto</p>
          </div>
          <Link
            to={`/5s/projects/${project.id}/actions`}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Ver todas las acciones ({actions.length}) →
          </Link>
        </div>

        {transformedActions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {transformedActions.map((action) => (
              <FiveSNokOkComparison
                key={action.id}
                title={action.title}
                photoNokUrl={action.photoNokUrl}
                photoOkUrl={action.photoOkUrl}
                nokDate={action.createdAt?.split('T')[0]}
                okDate={action.completedDate || action.dueDate}
                actionTitle={action.description}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-lg mx-auto">
            <Camera size={32} className="text-gray-300 mx-auto mb-2" />
            <h4 className="font-semibold text-gray-800 text-sm">Sin comparativas NOK/OK todavía</h4>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Registra una anomalía con el Safari 5S para capturar la foto NOK. Al resolver la acción y adjuntar la foto OK, aparecerá en este escaparate visual.
            </p>
          </div>
        )}
      </div>

      {/* Zonas Status Grid */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Zonas de Trabajo</h3>
            <p className="text-xs text-gray-500">Semáforo de cumplimiento por delimitación física</p>
          </div>
          <Link
            to={`/5s/projects/${project.id}/zones`}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Gestionar zonas ({zones.length}) →
          </Link>
        </div>

        {zones.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-xs">
            Aún no se han definido zonas para este proyecto. Ve a la pestaña "Zonas" para delimitar las áreas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {zones.map((zone) => (
              <Link
                key={zone.id}
                to={`/5s/projects/${project.id}/zones`}
                className="p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-xs transition-all bg-gray-50/50 group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                    {zone.code}
                  </span>
                  <FiveSStatusBadge status={zone.status || 'gray'} size="sm" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                  {zone.name}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Resp: {zone.responsibleName || 'Sin asignar'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
