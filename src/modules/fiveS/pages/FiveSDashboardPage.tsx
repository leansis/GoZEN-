import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { FiveSRadarChart } from '../components/FiveSRadarChart';
import { FiveSPhase } from '../types/fiveSTypes';
import toast from 'react-hot-toast';

export default function FiveSDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { 
    project, 
    zones, 
    subzones, 
    actions, 
    redTags, 
    standards, 
    audits, 
    loading 
  } = useFiveSProject(projectId);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando indicadores 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  // Radar scores
  const latestAudit = audits[0];
  const phaseScores: Record<FiveSPhase, number> = latestAudit?.phaseScores || {
    '1S': 75,
    '2S': 65,
    '3S': 70,
    '4S': 55,
    '5S': 40
  };

  // Evolution data from historical audits
  const evolutionData = audits.slice().reverse().map((a, idx) => ({
    name: a.executedDate || `Aud ${idx + 1}`,
    score: Math.round(a.score),
    target: project.targetScore || 85,
  }));

  // If no audits yet, provide a baseline entry
  if (evolutionData.length === 0) {
    evolutionData.push({
      name: 'Inicial',
      score: project.currentScore || 50,
      target: project.targetScore || 85
    });
  }

  // Action status summary
  const totalActions = actions.length;
  const verifiedActions = actions.filter(a => a.status === 'verified' || a.status === 'closed').length;
  const inProgressActions = actions.filter(a => a.status === 'in_progress' || a.status === 'open').length;
  const actionEfficacyRate = totalActions > 0 ? Math.round((verifiedActions / totalActions) * 100) : 0;

  // Red tag summary
  const totalTags = redTags.length;
  const resolvedTags = redTags.filter(t => t.status === 'resolved').length;
  const tagResolutionRate = totalTags > 0 ? Math.round((resolvedTags / totalTags) * 100) : 100;

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Resumen general
      const summaryData = [
        ['Proyecto 5S', project.name],
        ['Planta / Centro', project.plantOrCenter],
        ['Fase Actual', project.currentPhase],
        ['Puntuación Global', `${(project.currentScore || 0).toFixed(0)}%`],
        ['Puntuación Objetivo', `${project.targetScore || 85}%`],
        ['Responsable 5S', project.responsibleName],
        ['Líder del Grupo', project.leaderName],
        ['Fecha de Extracción', new Date().toLocaleDateString()]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

      // 2. Acciones PDCA
      if (actions.length > 0) {
        const actionsSheetData = actions.map(a => ({
          'Fase': a.phase,
          'Zona': a.zoneName || a.zoneId,
          'Título': a.title,
          'Descripción': a.description,
          'Prioridad': a.priority,
          'Estado': a.status,
          'Responsable': a.assignedName || 'Sin asignar',
          'Fecha Límite': a.dueDate,
          'Fecha Resuelta': a.completedDate || '',
          'Foto NOK': a.photoNokUrl ? 'Sí' : 'No',
          'Foto OK': a.photoOkUrl ? 'Sí' : 'No'
        }));
        const wsActions = XLSX.utils.json_to_sheet(actionsSheetData);
        XLSX.utils.book_append_sheet(wb, wsActions, 'Acciones PDCA');
      }

      // 3. Tarjetas Rojas
      if (redTags.length > 0) {
        const tagsSheetData = redTags.map(t => ({
          'Nº Tarjeta': t.tagNumber,
          'Fecha': t.date,
          'Zona': t.zoneName || t.zoneId,
          'Descripción': t.itemDescription,
          'Categoría': t.category,
          'Motivo': t.reason,
          'Acción Propuesta': t.actionProposed,
          'Estado': t.status,
          'Ubicación Cuarentena': t.quarantineLocation || ''
        }));
        const wsTags = XLSX.utils.json_to_sheet(tagsSheetData);
        XLSX.utils.book_append_sheet(wb, wsTags, 'Tarjetas Rojas 1S');
      }

      // 4. Auditorías
      if (audits.length > 0) {
        const auditsSheetData = audits.map(a => ({
          'Título': a.title,
          'Fecha': a.executedDate || a.scheduledDate,
          'Auditor': a.auditorName,
          'Zona': a.zoneName || a.zoneId,
          'Puntuación (%)': Math.round(a.score),
          '1S': a.phaseScores?.['1S'] || 0,
          '2S': a.phaseScores?.['2S'] || 0,
          '3S': a.phaseScores?.['3S'] || 0,
          '4S': a.phaseScores?.['4S'] || 0,
          '5S': a.phaseScores?.['5S'] || 0,
          'No Conformidades': a.findingsCount
        }));
        const wsAudits = XLSX.utils.json_to_sheet(auditsSheetData);
        XLSX.utils.book_append_sheet(wb, wsAudits, 'Auditorías 5S');
      }

      XLSX.writeFile(wb, `Informe_5S_${project.name.replace(/\s+/g, '_')}.xlsx`);
      toast.success('Archivo Excel exportado con éxito');
    } catch (e: any) {
      console.error('Error exporting excel:', e);
      toast.error('Error al exportar Excel: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* Top Banner and Summary */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Cuadro de Mando e Indicadores 5S</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Métricas de consolidación, semáforos por zona, curva de auditorías y exportación ejecutiva.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xs transition"
          >
            <Printer size={15} />
            <span>Imprimir Informe</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Excel (XLSX)</span>
          </button>
        </div>
      </div>

      {/* Key Indicator Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Índice de Madurez 5S</span>
          <span className="text-3xl font-black text-gray-900">
            {(project.currentScore || 0).toFixed(0)}%
          </span>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Objetivo: {project.targetScore || 85}%</span>
            <span className="text-emerald-600 font-bold">Fase {project.currentPhase}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Tasa Cierre Tarjetas Rojas</span>
          <span className="text-3xl font-black text-rose-600">
            {tagResolutionRate}%
          </span>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>{resolvedTags} de {totalTags} resueltas</span>
            <span className="text-gray-400">1S Seiri</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Eficacia Acciones PDCA</span>
          <span className="text-3xl font-black text-blue-600">
            {actionEfficacyRate}%
          </span>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>{verifiedActions} verificadas OK</span>
            <span className="text-gray-400">{inProgressActions} en curso</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Cobertura de Estándares</span>
          <span className="text-3xl font-black text-purple-600">
            {standards.length}
          </span>
          <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>{zones.length} zonas operativas</span>
            <span className="text-gray-400">4S Seiketsu</span>
          </div>
        </div>
      </div>

      {/* Main Visual Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Spider Chart */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900 text-sm">Radar 5S de Madurez Global</h3>
            <span className="text-xs text-gray-400 font-medium">Última auditoría</span>
          </div>
          <FiveSRadarChart phaseScores={phaseScores} targetScore={project.targetScore || 85} height={280} />
        </div>

        {/* Audit Evolution Line Chart */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Evolución Histórica de Auditorías</h3>
                <p className="text-xs text-gray-500">Curva de aprendizaje y sostenibilidad en el tiempo</p>
              </div>
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold border border-emerald-200">
                Tendencia positiva
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, '']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Objetivo"
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Puntuación"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-gray-500 pt-3 border-t border-gray-100">
            <span className="flex items-center gap-1.5 font-medium text-blue-600">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Resultado Real (%)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-gray-400">
              <span className="w-3 h-0.5 bg-gray-400 border-t border-dashed border-gray-400 inline-block" /> Meta ({project.targetScore || 85}%)
            </span>
          </div>
        </div>
      </div>

      {/* Traffic Light Scorecard per Zone */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Semáforo de Cumplimiento por Zonas</h3>
            <p className="text-xs text-gray-500">Monitor visual para identificar cuellos de botella en la planta</p>
          </div>
          <Link to={`/5s/projects/${project.id}/zones`} className="text-xs font-semibold text-blue-600 hover:underline">
            Ver detalle zonas →
          </Link>
        </div>

        {zones.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">No hay zonas definidas todavía.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {zones.map((zone) => {
              const zoneActions = actions.filter(a => a.zoneId === zone.id);
              const pending = zoneActions.filter(a => a.status === 'open' || a.status === 'in_progress').length;

              return (
                <div
                  key={zone.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {zone.code}
                      </span>
                      <FiveSStatusBadge status={zone.status || 'gray'} size="sm" />
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm truncate">{zone.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Resp: {zone.responsibleName || 'Sin asignar'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
                    <span>{pending} acciones pendientes</span>
                    <span className="font-semibold text-gray-800">{zone.score || 0}% score</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
