import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Trash2, 
  Edit3, 
  Eye, 
  Printer, 
  Check, 
  Camera, 
  Sparkles,
  Layers
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSVisualStandard, FiveSPhase } from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import { uploadFiveSImage } from '../services/fiveSStorageService';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSStandardsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId, dbUser } = useAuth();
  const { project, zones, subzones, standards, loading } = useFiveSProject(projectId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStandard, setEditingStandard] = useState<FiveSVisualStandard | null>(null);
  
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<FiveSPhase>('4S');
  const [zoneId, setZoneId] = useState('');
  const [description, setDescription] = useState('');
  const [keyPointsText, setKeyPointsText] = useState('');
  const [checkFrequency, setCheckFrequency] = useState<'daily' | 'per_shift' | 'weekly' | 'monthly'>('daily');
  const [photoOkFile, setPhotoOkFile] = useState<File | null>(null);
  const [photoNokFile, setPhotoNokFile] = useState<File | null>(null);
  const [existingOkUrl, setExistingOkUrl] = useState('');
  const [existingNokUrl, setExistingNokUrl] = useState('');

  const [standardToView, setStandardToView] = useState<FiveSVisualStandard | null>(null);
  const [standardToDelete, setStandardToDelete] = useState<FiveSVisualStandard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando estándares 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  const openNewStandard = () => {
    setEditingStandard(null);
    setCode(`EST-5S-00${standards.length + 1}`);
    setTitle('');
    setPhase('4S');
    setZoneId(zones[0]?.id || '');
    setDescription('');
    setKeyPointsText('1. Herramientas colgadas en silueta correspondiente\n2. Superficie limpia de grasa y virutas\n3. Bandeja de virutas vaciada al terminar turno');
    setCheckFrequency('daily');
    setPhotoOkFile(null);
    setPhotoNokFile(null);
    setExistingOkUrl('');
    setExistingNokUrl('');
    setIsModalOpen(true);
  };

  const openEditStandard = (std: FiveSVisualStandard) => {
    setEditingStandard(std);
    setCode(std.code);
    setTitle(std.title);
    setPhase((std.phase as FiveSPhase) || '4S');
    setZoneId(std.zoneId);
    setDescription(std.description);
    setKeyPointsText(std.keyPoints.join('\n'));
    setCheckFrequency(std.checkFrequency);
    setExistingOkUrl(std.photoCorrectUrl);
    setExistingNokUrl(std.photoIncorrectUrl || '');
    setPhotoOkFile(null);
    setPhotoNokFile(null);
    setIsModalOpen(true);
  };

  const handleSaveStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !title.trim()) return;

    try {
      setIsSubmitting(true);
      let okUrl = existingOkUrl || 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80';
      let nokUrl = existingNokUrl || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80';

      if (photoOkFile) {
        okUrl = await uploadFiveSImage(photoOkFile, activeCompanyId, project.id, 'standards', 'std_ok');
      }
      if (photoNokFile) {
        nokUrl = await uploadFiveSImage(photoNokFile, activeCompanyId, project.id, 'standards', 'std_nok');
      }

      const selectedZone = zones.find(z => z.id === zoneId);
      const keyPoints = keyPointsText.split('\n').map(s => s.trim()).filter(Boolean);

      if (editingStandard) {
        await FiveSService.updateStandard(editingStandard.id, {
          code: code.trim(),
          title: title.trim(),
          phase,
          zoneId,
          zoneName: selectedZone?.name,
          description: description.trim(),
          version: (editingStandard.version || 1) + 1,
          photoCorrectUrl: okUrl,
          photoIncorrectUrl: nokUrl,
          keyPoints,
          checkFrequency,
          updatedAt: new Date().toISOString()
        });
        toast.success(`Estándar actualizado a versión v${(editingStandard.version || 1) + 1}`);
      } else {
        await FiveSService.addStandard({
          projectId: project.id,
          companyId: activeCompanyId,
          code: code.trim(),
          title: title.trim(),
          phase,
          zoneId,
          zoneName: selectedZone?.name,
          description: description.trim(),
          version: 1,
          status: 'approved',
          approvedByName: dbUser?.name || 'Responsable 5S',
          approvedDate: new Date().toISOString().split('T')[0],
          photoCorrectUrl: okUrl,
          photoIncorrectUrl: nokUrl,
          keyPoints,
          checkFrequency,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success('Estándar visual 5S registrado');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      toast.error('Error al guardar estándar: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!standardToDelete) return;
    try {
      await FiveSService.deleteStandard(standardToDelete.id);
      toast.success('Estándar eliminado');
      setStandardToDelete(null);
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
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Estándares Visuales 5S (Seiketsu)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Fichas de puesto con fotos del estado conforme (OK) frente al no conforme (NOK), puntos clave y versionado.
          </p>
        </div>

        <button
          onClick={openNewStandard}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus size={16} />
          <span>Nuevo Estándar Visual</span>
        </button>
      </div>

      {/* Standards Grid */}
      {standards.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <ShieldCheck size={32} className="text-gray-300 mx-auto mb-2" />
          <h4 className="font-semibold text-gray-800 text-sm">Sin estándares registrados</h4>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Crea la primera ficha visual para fijar el estándar de orden y limpieza de las zonas de trabajo.
          </p>
          <button
            onClick={openNewStandard}
            className="bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
          >
            Crear Estándar Visual
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {standards.map((std) => (
            <div
              key={std.id}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Visual OK Banner */}
                <div className="aspect-16/9 bg-gray-100 overflow-hidden relative">
                  <img src={std.photoCorrectUrl} alt={std.title} className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                    <CheckCircle2 size={13} /> ESTÁNDAR CONFORME (OK)
                  </div>
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    v{std.version}
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {std.code}
                      </span>
                      <h4 className="font-bold text-gray-900 text-base mt-1">{std.title}</h4>
                    </div>

                    <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                      {std.status === 'approved' ? 'Aprobado' : 'Borrador'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                    {std.description}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                      Puntos Clave de Control:
                    </span>
                    <ul className="text-xs text-gray-700 space-y-1">
                      {std.keyPoints.slice(0, 3).map((kp, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-snug">
                          <Check size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{kp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                    <span>Zona: <strong className="text-gray-700">{std.zoneName || 'General'}</strong></span>
                    <span>Revisión: <strong className="text-gray-700 capitalize">{std.checkFrequency}</strong></span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 pt-0 border-t border-gray-50 flex items-center justify-between gap-2 mt-2">
                <button
                  onClick={() => setStandardToView(std)}
                  className="flex-1 bg-gray-900 hover:bg-black text-white text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Eye size={14} /> Ficha Técnica Completa
                </button>

                <button
                  onClick={() => openEditStandard(std)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition"
                  title="Editar estándar"
                >
                  <Edit3 size={15} />
                </button>

                <button
                  onClick={() => setStandardToDelete(std)}
                  className="p-2 text-gray-400 hover:text-red-600 transition"
                  title="Eliminar estándar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CREAR / EDITAR ESTÁNDAR */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStandard ? `Editar Estándar Visual (${editingStandard.code})` : 'Nuevo Estándar Visual 5S'}
      >
        <form onSubmit={handleSaveStandard} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Código *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="EST-5S-001"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título del Estándar *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Orden y Limpieza del Puesto de Soldadura"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zona Asignada</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              >
                {zones.map(z => (
                  <option key={z.id} value={z.id}>[{z.code}] {z.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Frecuencia de Comprobación</label>
              <select
                value={checkFrequency}
                onChange={(e: any) => setCheckFrequency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="per_shift">Por Turno</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción del Estándar</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Criterios que todo operario debe respetar sin excepción..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Puntos Clave (uno por línea)</label>
            <textarea
              rows={3}
              value={keyPointsText}
              onChange={(e) => setKeyPointsText(e.target.value)}
              placeholder="1. Elemento A en su silueta..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Foto OK (Estándar Conforme)</label>
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

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Foto NOK (Inaceptable)</label>
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
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Estándar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL FICHA TÉCNICA DETALLE / IMPRIMIBLE */}
      <Modal
        isOpen={Boolean(standardToView)}
        onClose={() => setStandardToView(null)}
        title={`Ficha Estándar 5S: ${standardToView?.code}`}
      >
        {standardToView && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h3 className="font-black text-gray-900 text-lg">{standardToView.title}</h3>
                <p className="text-xs text-gray-500">
                  Zona: {standardToView.zoneName || 'General'} • Versión: v{standardToView.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
                title="Imprimir Ficha"
              >
                <Printer size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={14} /> ESTADO CORRECTO (OK)
                </span>
                <div className="aspect-4/3 rounded-xl overflow-hidden bg-gray-100 border border-emerald-200">
                  <img src={standardToView.photoCorrectUrl} alt="OK" className="w-full h-full object-cover" />
                </div>
              </div>

              {standardToView.photoIncorrectUrl && (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                    <XCircle size={14} /> NO TOLERADO (NOK)
                  </span>
                  <div className="aspect-4/3 rounded-xl overflow-hidden bg-gray-100 border border-rose-200">
                    <img src={standardToView.photoIncorrectUrl} alt="NOK" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                Puntos de Cumplimiento Obligatorio:
              </span>
              <ul className="text-xs text-gray-700 space-y-1.5">
                {standardToView.keyPoints.map((kp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStandardToView(null)}
                className="bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM */}
      <ConfirmModal
        isOpen={Boolean(standardToDelete)}
        onCancel={() => setStandardToDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar Estándar Visual"
        message={`¿Estás seguro de que deseas eliminar permanentemente el estándar "${standardToDelete?.code}"?`}
      />
    </div>
  );
}
