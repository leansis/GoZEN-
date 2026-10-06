import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ClipboardCheck, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Trash2, 
  Eye, 
  Clock, 
  Camera, 
  Award, 
  Play, 
  Check, 
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { FiveSRadarChart } from '../components/FiveSRadarChart';
import { 
  FiveSAudit, 
  FiveSAuditTemplate, 
  FiveSAuditResponse, 
  FiveSPhase 
} from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import { uploadFiveSImage } from '../services/fiveSStorageService';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSAuditsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId, dbUser } = useAuth();
  const { project, zones, subzones, audits, loading } = useFiveSProject(projectId);

  // New Audit / Execution Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTitle, setAuditTitle] = useState('');
  const [auditZoneId, setAuditZoneId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditorName, setAuditorName] = useState(dbUser?.name || 'Auditor 5S');

  // Interactive Checklist execution state
  const [responses, setResponses] = useState<FiveSAuditResponse[]>([]);
  const [observations, setObservations] = useState('');

  // Audit detail view
  const [auditToView, setAuditToView] = useState<FiveSAudit | null>(null);
  const [auditToDelete, setAuditToDelete] = useState<FiveSAudit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando auditorías 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  const defaultQuestions: Array<{ id: string; phase: FiveSPhase; question: string; criterion: string }> = [
    // 1S
    { id: '1s-1', phase: '1S', question: '¿Solo están presentes los materiales y útiles necesarios en el puesto?', criterion: 'Ausencia de objetos innecesarios' },
    { id: '1s-2', phase: '1S', question: '¿Se aplican tarjetas rojas a los elementos dudosos y se aíslan?', criterion: 'Control de tarjetas rojas' },
    { id: '1s-3', phase: '1S', question: '¿El stock en curso (WIP) está dentro de los límites autorizados?', criterion: 'Sin acumulación de WIP' },
    // 2S
    { id: '2s-1', phase: '2S', question: '¿Cada elemento tiene una ubicación claramente señalizada y rotulada?', criterion: 'Marcaje en suelo y paneles sombra' },
    { id: '2s-2', phase: '2S', question: '¿Las herramientas se encuentran en su posición asignada y son accesibles en < 30 seg?', criterion: 'Panel sombra ergonómico' },
    { id: '2s-3', phase: '2S', question: '¿Pasillos y salidas de emergencia están despejados?', criterion: 'Vías de evacuación 100% libres' },
    // 3S
    { id: '3s-1', phase: '3S', question: '¿El suelo, máquinas y bancos están limpios de virutas, aceite o restos?', criterion: 'Limpieza como inspección' },
    { id: '3s-2', phase: '3S', question: '¿Se han detectado y controlado las fuentes de suciedad en el origen?', criterion: 'Causa raíz abordada' },
    { id: '3s-3', phase: '3S', question: '¿Los útiles de limpieza están completos y en su soporte asignado?', criterion: 'Estación de limpieza 5S equipada' },
    // 4S
    { id: '4s-1', phase: '4S', question: '¿Existen estándares visuales visibles y actualizados (fotos OK/NOK)?', criterion: 'Ficha de estándar 5S visible' },
    { id: '4s-2', phase: '4S', question: '¿Las gamas de limpieza y responsabilidades están asignadas a los operarios?', criterion: 'Rutinas de orden asignadas' },
    { id: '4s-3', phase: '4S', question: '¿Se identifican con código visual niveles de fluidos y sentidos de giro?', criterion: 'Gestión visual en maquinaria' },
    // 5S
    { id: '5s-1', phase: '5S', question: '¿Se respeta la frecuencia de auditorías periódicas?', criterion: 'Cumplimiento calendario auditorías' },
    { id: '5s-2', phase: '5S', question: '¿El equipo participa activamente y se cerraron las acciones anteriores?', criterion: 'Cierre eficaz de acciones PDCA' },
    { id: '5s-3', phase: '5S', question: '¿Se mantiene el hábito 5S al finalizar el turno sin relajación?', criterion: 'Disciplina consolidada' }
  ];

  const openNewAudit = () => {
    setAuditTitle(`Auditoría 5S - ${zones[0]?.name || 'Planta'}`);
    setAuditZoneId(zones[0]?.id || '');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setAuditorName(dbUser?.name || 'Auditor 5S');
    setObservations('');

    // Prepopulate responses with 4 out of 5 default
    setResponses(defaultQuestions.map(q => ({
      questionId: q.id,
      phase: q.phase,
      question: q.question,
      criterion: q.criterion,
      score: 4,
      isCompliant: true,
      comment: ''
    })));

    setIsAuditModalOpen(true);
  };

  const handleUpdateScore = (index: number, score: number) => {
    setResponses(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        score,
        isCompliant: score >= 3
      };
      return copy;
    });
  };

  const handleUpdateComment = (index: number, comment: string) => {
    setResponses(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], comment };
      return copy;
    });
  };

  // Calculations for current execution
  const totalPoints = responses.reduce((acc, r) => acc + r.score, 0);
  const maxPoints = responses.length * 5;
  const globalPercentage = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;
  const nonCompliancesCount = responses.filter(r => !r.isCompliant).length;

  const calculatePhaseScores = (respList: FiveSAuditResponse[]): Record<FiveSPhase, number> => {
    const phases: FiveSPhase[] = ['1S', '2S', '3S', '4S', '5S'];
    const res: Record<FiveSPhase, number> = { 
      '1S': 0, '2S': 0, '3S': 0, '4S': 0, '5S': 0,
      Seiri: 0, Seiton: 0, Seiso: 0, Seiketsu: 0, Shitsuke: 0 
    };

    phases.forEach(p => {
      const pItems = respList.filter(r => r.phase === p);
      if (pItems.length > 0) {
        const sum = pItems.reduce((acc, curr) => acc + curr.score, 0);
        res[p] = Math.round((sum / (pItems.length * 5)) * 100);
      }
    });

    return res;
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !auditTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const selectedZone = zones.find(z => z.id === auditZoneId);
      const phaseScores = calculatePhaseScores(responses);

      await FiveSService.addAudit({
        projectId: project.id,
        companyId: activeCompanyId,
        zoneId: auditZoneId || zones[0]?.id || '',
        zoneName: selectedZone?.name,
        title: auditTitle.trim(),
        auditorId: dbUser?.uid || '',
        auditorName: auditorName.trim(),
        scheduledDate,
        executedDate: new Date().toISOString().split('T')[0],
        status: 'completed',
        score: globalPercentage,
        phaseScores,
        findingsCount: nonCompliancesCount,
        observations: observations.trim() || undefined,
        responses,
        createdAt: new Date().toISOString()
      });

      toast.success(`Auditoría registrada con ${globalPercentage.toFixed(0)}% de cumplimiento`);
      setIsAuditModalOpen(false);
    } catch (err: any) {
      toast.error('Error al guardar auditoría: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!auditToDelete) return;
    try {
      await FiveSService.deleteAudit(auditToDelete.id);
      toast.success('Auditoría eliminada');
      setAuditToDelete(null);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* Top Banner and Summary */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Plan y Ejecución de Auditorías 5S (Shitsuke)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Evaluación periódica en campo, checklists puntuados 0-5 por fase, semáforo y detección de desviaciones.
          </p>
        </div>

        <button
          onClick={openNewAudit}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Play size={16} />
          <span>Ejecutar Nueva Auditoría</span>
        </button>
      </div>

      {/* Audits History Grid */}
      {audits.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <ClipboardCheck size={32} className="text-gray-300 mx-auto mb-2" />
          <h4 className="font-semibold text-gray-800 text-sm">Sin auditorías registradas</h4>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Ejecuta la primera auditoría 5S para evaluar el nivel de madurez y generar la puntuación del radar.
          </p>
          <button
            onClick={openNewAudit}
            className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            Comenzar Primera Auditoría
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {audits.map((audit) => {
            const scoreTraffic = audit.score >= 80 ? 'green' : audit.score >= 60 ? 'yellow' : 'red';

            return (
              <div
                key={audit.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
                      <Calendar size={13} /> {audit.executedDate || audit.scheduledDate}
                    </span>
                    <FiveSStatusBadge status={scoreTraffic} label={`${audit.score.toFixed(0)}% Cumplimiento`} size="sm" />
                  </div>

                  <h3 className="font-bold text-gray-900 text-base mb-1">{audit.title}</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Auditor: <strong className="text-gray-800">{audit.auditorName}</strong> • Zona: <strong className="text-gray-800">{audit.zoneName || 'General'}</strong>
                  </p>

                  {/* 5S mini score bar */}
                  <div className="grid grid-cols-5 gap-1 text-center bg-gray-50 p-2.5 rounded-xl border border-gray-100 mb-4">
                    {(['1S', '2S', '3S', '4S', '5S'] as FiveSPhase[]).map((p) => (
                      <div key={p}>
                        <span className="text-[10px] font-bold text-gray-400 block">{p}</span>
                        <strong className="text-xs font-black text-gray-800">
                          {audit.phaseScores ? audit.phaseScores[p] : 0}%
                        </strong>
                      </div>
                    ))}
                  </div>

                  {audit.findingsCount > 0 && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between font-medium mb-2">
                      <span className="flex items-center gap-1">
                        <AlertCircle size={14} /> {audit.findingsCount} hallazgos / no conformidades
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => setAuditToView(audit)}
                    className="flex-1 bg-gray-900 hover:bg-black text-white text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <Eye size={14} /> Ver Informe Completo
                  </button>

                  <button
                    onClick={() => setAuditToDelete(audit)}
                    className="p-2 text-gray-300 hover:text-red-600 transition"
                    title="Eliminar auditoría"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL EJECUCIÓN INTERACTIVA AUDITORÍA */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title="Ejecutar Auditoría 5S en Campo"
      >
        <form onSubmit={handleSaveAudit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header data */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título de la Auditoría *</label>
              <input
                type="text"
                required
                value={auditTitle}
                onChange={(e) => setAuditTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zona Auditada *</label>
              <select
                value={auditZoneId}
                onChange={(e) => setAuditZoneId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {zones.map(z => (
                  <option key={z.id} value={z.id}>[{z.code}] {z.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Score Counter */}
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-emerald-800 font-semibold block">Puntuación Global en Tiempo Real:</span>
              <span className="text-2xl font-black text-emerald-900 tracking-tight">
                {globalPercentage.toFixed(0)}%
              </span>
            </div>
            <div className="text-right text-xs">
              <span className="text-emerald-700 font-bold block">{totalPoints} de {maxPoints} pts</span>
              <span className="text-rose-600 font-semibold">{nonCompliancesCount} desviaciones (&lt;3)</span>
            </div>
          </div>

          {/* Interactive Questionnaire */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Checklist de Evaluación (Puntúa del 0 al 5)
            </h4>

            <div className="space-y-3">
              {responses.map((item, idx) => (
                <div
                  key={item.questionId}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    item.score < 3 ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {item.phase}
                        </span>
                        <span className="text-[11px] text-gray-400 font-medium">Criterio: {item.criterion}</span>
                      </div>
                      <p className="font-semibold text-xs text-gray-900 leading-snug">{item.question}</p>
                    </div>

                    {/* 0 to 5 score selector */}
                    <div className="flex items-center gap-1 shrink-0">
                      {[0, 1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleUpdateScore(idx, val)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            item.score === val
                              ? val >= 4 ? 'bg-emerald-600 text-white shadow-xs' :
                                val >= 3 ? 'bg-amber-500 text-white shadow-xs' : 'bg-rose-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment / Finding */}
                  <input
                    type="text"
                    value={item.comment || ''}
                    onChange={(e) => handleUpdateComment(idx, e.target.value)}
                    placeholder={item.score < 3 ? "¡Desviación detectada! Detalla el hallazgo..." : "Observaciones o recomendaciones (opcional)..."}
                    className="w-full px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Conclusiones Generales del Auditor</label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Resumen del grado de consolidación 5S y recomendaciones prioritarias..."
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-6 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Finalizar y Guardar Auditoría'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL VER INFORME COMPLETO DE AUDITORÍA */}
      <Modal
        isOpen={Boolean(auditToView)}
        onClose={() => setAuditToView(null)}
        title={auditToView?.title || 'Informe de Auditoría'}
      >
        {auditToView && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block">Puntuación Final:</span>
                <span className="text-3xl font-black text-emerald-700">{auditToView.score.toFixed(0)}%</span>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p>Auditor: <strong>{auditToView.auditorName}</strong></p>
                <p>Fecha: <strong>{auditToView.executedDate}</strong></p>
                <p>Zona: <strong>{auditToView.zoneName || 'General'}</strong></p>
              </div>
            </div>

            {/* Radar for this audit */}
            {auditToView.phaseScores && (
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Desglose por Fases:</h4>
                <FiveSRadarChart phaseScores={auditToView.phaseScores} height={200} />
              </div>
            )}

            {/* Responses List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Respuestas del Checklist:</h4>
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-white">
                {auditToView.responses?.map((resp, i) => (
                  <div key={i} className="py-2 text-xs flex items-start justify-between gap-3">
                    <div>
                      <span className="font-bold text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mr-1.5">
                        {resp.phase}
                      </span>
                      <span className="font-medium text-gray-800">{resp.question}</span>
                      {resp.comment && (
                        <p className="text-rose-600 text-[11px] mt-0.5 font-medium">Nota: {resp.comment}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded font-bold text-xs shrink-0 ${
                      resp.score >= 4 ? 'bg-emerald-100 text-emerald-800' :
                      resp.score >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {resp.score} / 5
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setAuditToView(null)}
                className="bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Cerrar Informe
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmModal
        isOpen={Boolean(auditToDelete)}
        onCancel={() => setAuditToDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar Auditoría"
        message={`¿Estás seguro de que deseas eliminar permanentemente esta auditoría?`}
      />
    </div>
  );
}
