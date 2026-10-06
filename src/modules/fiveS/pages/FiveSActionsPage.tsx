import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  CheckSquare, 
  Plus, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Camera, 
  Trash2, 
  Edit3, 
  Sparkles,
  ArrowRight,
  Eye,
  Check
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { FiveSNokOkComparison } from '../components/FiveSNokOkComparison';
import { 
  FiveSVisualAction, 
  FiveSPhase, 
  ActionPriority, 
  ActionStatus 
} from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import { uploadFiveSImage } from '../services/fiveSStorageService';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSActionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId, dbUser } = useAuth();
  const { project, zones, subzones, actions, loading } = useFiveSProject(projectId);

  const [filterPhase, setFilterPhase] = useState<FiveSPhase | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'ALL'>('ALL');
  const [filterZone, setFilterZone] = useState<string>('ALL');

  // New Action Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phase, setPhase] = useState<FiveSPhase>('1S');
  const [zoneId, setZoneId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ActionPriority>('medium');
  const [assignedName, setAssignedName] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [photoNokFile, setPhotoNokFile] = useState<File | null>(null);

  // Resolve Action Modal (Upload Photo OK)
  const [actionToResolve, setActionToResolve] = useState<FiveSVisualAction | null>(null);
  const [photoOkFile, setPhotoOkFile] = useState<File | null>(null);

  // Action detail view
  const [actionToView, setActionToView] = useState<FiveSVisualAction | null>(null);

  // Deletion
  const [actionToDelete, setActionToDelete] = useState<FiveSVisualAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando acciones 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !title.trim()) return;

    try {
      setIsSubmitting(true);
      let nokUrl = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80';
      if (photoNokFile) {
        nokUrl = await uploadFiveSImage(photoNokFile, activeCompanyId, project.id, 'actions', 'action_nok');
      }

      const selectedZone = zones.find(z => z.id === zoneId);

      await FiveSService.addAction({
        projectId: project.id,
        companyId: activeCompanyId,
        phase,
        zoneId: zoneId || zones[0]?.id || '',
        zoneName: selectedZone?.name,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'open',
        dueDate,
        assignedName: assignedName.trim() || undefined,
        photoNokUrl: nokUrl,
        source: 'safari',
        createdAt: new Date().toISOString(),
        createdBy: dbUser?.uid || '',
        createdByName: dbUser?.name || 'Operario'
      });

      toast.success('Acción PDCA registrada con foto NOK');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setPhotoNokFile(null);
    } catch (err: any) {
      toast.error('Error al crear acción: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionToResolve || !activeCompanyId || !project.id) return;

    try {
      setIsSubmitting(true);
      let okUrl = 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80';
      if (photoOkFile) {
        okUrl = await uploadFiveSImage(photoOkFile, activeCompanyId, project.id, 'actions', 'action_ok');
      }

      await FiveSService.updateAction(actionToResolve.id, {
        status: 'verified',
        photoOkUrl: okUrl,
        completedDate: new Date().toISOString().split('T')[0]
      }, dbUser?.name || 'Responsable');

      toast.success('¡Acción resuelta y verificada con foto OK!');
      setActionToResolve(null);
      setPhotoOkFile(null);
    } catch (err: any) {
      toast.error('Error al resolver acción: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAction = async () => {
    if (!actionToDelete) return;
    try {
      await FiveSService.deleteAction(actionToDelete.id);
      toast.success('Acción eliminada');
      setActionToDelete(null);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  const filteredActions = actions.filter((a) => {
    const matchesPhase = filterPhase === 'ALL' || a.phase === filterPhase;
    const matchesStatus = filterStatus === 'ALL' || a.status === filterStatus;
    const matchesZone = filterZone === 'ALL' || a.zoneId === filterZone;
    return matchesPhase && matchesStatus && matchesZone;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* Top Banner and Summary */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Plan de Acciones Visuales PDCA</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Trazabilidad completa: Detección Foto NOK → Asignación → Resolución Foto OK → Estandarización.
          </p>
        </div>

        <button
          onClick={() => {
            setZoneId(zones[0]?.id || '');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus size={16} />
          <span>Nueva Acción 5S</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-500 flex items-center gap-1">
            <Filter size={13} /> Filtrar por:
          </span>

          <select
            value={filterPhase}
            onChange={(e: any) => setFilterPhase(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-medium outline-none"
          >
            <option value="ALL">Todas las Fases (1S - 5S)</option>
            <option value="1S">1S Seiri</option>
            <option value="2S">2S Seiton</option>
            <option value="3S">3S Seiso</option>
            <option value="4S">4S Seiketsu</option>
            <option value="5S">5S Shitsuke</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e: any) => setFilterStatus(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-medium outline-none"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="open">Abierta / Pendiente</option>
            <option value="in_progress">En Curso</option>
            <option value="verified">Verificada OK</option>
            <option value="closed">Cerrada</option>
          </select>

          {zones.length > 0 && (
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-medium outline-none"
            >
              <option value="ALL">Todas las Zonas</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>[{z.code}] {z.name}</option>
              ))}
            </select>
          )}
        </div>

        <span className="text-gray-400 font-medium">
          {filteredActions.length} acciones registradas
        </span>
      </div>

      {/* Actions List */}
      {filteredActions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <CheckSquare size={32} className="text-gray-300 mx-auto mb-2" />
          <h4 className="font-semibold text-gray-800 text-sm">No hay acciones registradas</h4>
          <p className="text-xs text-gray-500 mt-1 mb-4">Crea una acción PDCA o utiliza Safari 5S para registrar una anomalía.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            Nueva Acción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredActions.map((action) => {
            const isResolved = action.status === 'verified' || action.status === 'closed' || Boolean(action.photoOkUrl);

            return (
              <div
                key={action.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Visual before/after mini comparison or NOK photo */}
                  {action.photoNokUrl && action.photoOkUrl ? (
                    <FiveSNokOkComparison
                      photoNokUrl={action.photoNokUrl}
                      photoOkUrl={action.photoOkUrl}
                      title={action.title}
                      nokDate={action.createdAt?.split('T')[0]}
                      okDate={action.completedDate || action.dueDate}
                    />
                  ) : action.photoNokUrl ? (
                    <div className="aspect-16/9 bg-gray-100 overflow-hidden relative">
                      <img src={action.photoNokUrl} alt={action.title} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                        NOK PENDIENTE DE RESOLUCIÓN
                      </div>
                    </div>
                  ) : null}

                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                            {action.phase}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            action.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            action.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            Prioridad {action.priority}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-base">{action.title}</h4>
                      </div>

                      <FiveSStatusBadge status={action.status} size="sm" />
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                      {action.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-gray-400 block text-[11px]">Zona:</span>
                        <strong className="text-gray-800">{action.zoneName || 'General'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[11px]">Responsable:</span>
                        <strong className="text-gray-800">{action.assignedName || 'Sin asignar'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                      <span>Vencimiento: <strong className="text-gray-700">{action.dueDate}</strong></span>
                      {action.completedDate && (
                        <span className="text-emerald-600 font-semibold">Resuelta: {action.completedDate}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 pt-0 border-t border-gray-50 flex items-center justify-between gap-2 mt-2">
                  {!isResolved ? (
                    <button
                      onClick={() => setActionToResolve(action)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Camera size={14} /> Resolver con Foto OK
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <CheckCircle2 size={15} /> Verificación OK completada
                    </span>
                  )}

                  <button
                    onClick={() => setActionToDelete(action)}
                    className="p-2 text-gray-300 hover:text-red-600 rounded-lg transition"
                    title="Eliminar acción"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR ACCIÓN */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nueva Acción 5S PDCA"
      >
        <form onSubmit={handleCreateAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fase 5S</label>
              <select
                value={phase}
                onChange={(e: any) => setPhase(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="1S">1S Seiri (Despejar)</option>
                <option value="2S">2S Seiton (Ordenar)</option>
                <option value="3S">3S Seiso (Limpiar)</option>
                <option value="4S">4S Seiketsu (Estandarizar)</option>
                <option value="5S">5S Shitsuke (Auditar)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zona Afectada</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {zones.map(z => (
                  <option key={z.id} value={z.id}>[{z.code}] {z.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Título de la Acción *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Instalar soporte para manguera neumática"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción de la Mejora</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle de la causa raíz y solución prevista..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Prioridad</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
              <input
                type="text"
                value={assignedName}
                onChange={(e) => setAssignedName(e.target.value)}
                placeholder="Nombre"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Límite</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Foto NOK de Partida (Evidencia del problema)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setPhotoNokFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Acción PDCA'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL RESOLVER ACCIÓN CON FOTO OK */}
      <Modal
        isOpen={Boolean(actionToResolve)}
        onClose={() => setActionToResolve(null)}
        title="Verificar y Resolver Acción con Foto OK"
      >
        <form onSubmit={handleResolveAction} className="space-y-4">
          <p className="text-xs text-gray-600">
            Sube la fotografía del estado resuelto para cerrar el ciclo PDCA y contrastarla con la foto NOK original.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Fotografía del Estado OK *</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setPhotoOkFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setActionToResolve(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Validar Acción OK'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmModal
        isOpen={Boolean(actionToDelete)}
        onCancel={() => setActionToDelete(null)}
        onConfirm={handleDeleteAction}
        title="Eliminar Acción PDCA"
        message={`¿Estás seguro de que deseas eliminar permanentemente esta acción?`}
      />
    </div>
  );
}
