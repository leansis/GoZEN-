import React, { useState, useRef } from 'react';
import { Camera, Upload, AlertCircle, Check, Loader2, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { FiveSProject, FiveSZone, FiveSSubzone, FiveSPhase } from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import { uploadFiveSImage } from '../services/fiveSStorageService';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: FiveSProject;
  zones: FiveSZone[];
  subzones: FiveSSubzone[];
  onSuccess?: () => void;
}

export const FiveSSafariModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  zones,
  subzones,
  onSuccess
}) => {
  const { dbUser, activeCompanyId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const [zoneId, setZoneId] = useState<string>(zones[0]?.id || '');
  const [subzoneId, setSubzoneId] = useState<string>('');
  const [phase, setPhase] = useState<FiveSPhase>('1S');
  const [description, setDescription] = useState<string>('');
  const [immediateAction, setImmediateAction] = useState<string>('');
  const [createRedTag, setCreateRedTag] = useState<boolean>(true);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentSubzones = subzones.filter(sz => sz.zoneId === zoneId);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStep(2);
    }
  };

  const handleSamplePhoto = () => {
    // Quick demo placeholder if user doesn't have camera available in browser test
    const demoUrl = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80';
    setPreviewUrl(demoUrl);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !previewUrl) {
      toast.error('Por favor, aporta una fotografía y selecciona la zona');
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedZone = zones.find(z => z.id === zoneId);
      const selectedSubzone = subzones.find(sz => sz.id === subzoneId);

      let finalPhotoUrl = previewUrl;
      if (photoFile) {
        finalPhotoUrl = await uploadFiveSImage(photoFile, activeCompanyId, project.id, 'findings', 'safari');
      }

      const today = new Date().toISOString().split('T')[0];
      const nowIso = new Date().toISOString();
      const userName = dbUser?.name || 'Operador';
      const userId = dbUser?.uid || dbUser?.id || '';

      // 1. Create Red Tag if 1S or flagged
      let redTagId = '';
      if (createRedTag || phase === '1S') {
        const tagNumber = `TR-${Date.now().toString().slice(-4)}`;
        redTagId = await FiveSService.addRedTag({
          projectId: project.id,
          companyId: activeCompanyId,
          zoneId,
          zoneName: selectedZone?.name,
          subzoneId: subzoneId || undefined,
          subzoneName: selectedSubzone?.name,
          tagNumber,
          date: today,
          itemDescription: description,
          category: 'other',
          quantity: 1,
          reason: 'unnecessary',
          actionProposed: 'relocate',
          status: 'active',
          photoNokUrl: finalPhotoUrl,
          createdBy: userId,
          createdByName: userName,
          createdAt: nowIso
        });
      }

      // 2. Create PDCA Visual Action
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await FiveSService.addAction({
        projectId: project.id,
        companyId: activeCompanyId,
        zoneId,
        zoneName: selectedZone?.name,
        subzoneId: subzoneId || undefined,
        subzoneName: selectedSubzone?.name,
        phase,
        title: immediateAction || `Corrección de anomalía: ${description.slice(0, 40)}`,
        description,
        priority,
        status: 'open',
        dueDate: dueDate.toISOString().split('T')[0],
        photoNokUrl: finalPhotoUrl,
        source: 'safari',
        sourceRefId: redTagId || undefined,
        createdAt: nowIso,
        createdBy: userId,
        createdByName: userName,
      });

      toast.success('¡Anomalía y Acción registradas en Safari 5S!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting safari item:', err);
      toast.error('Error al guardar anomalía: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-xs">
              <Camera size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-tight">Safari 5S - Captura Rápida</h3>
              <p className="text-white/80 text-xs">Registro instantáneo de anomalía en campo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 border-b border-gray-100 text-xs font-semibold text-center bg-gray-50/50">
          <div className={`py-2.5 border-b-2 transition-all ${step === 1 ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-gray-400'}`}>
            1. Foto NOK
          </div>
          <div className={`py-2.5 border-b-2 transition-all ${step === 2 ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-gray-400'}`}>
            2. Zona y Fase
          </div>
          <div className={`py-2.5 border-b-2 transition-all ${step === 3 ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-gray-400'}`}>
            3. Acción
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* STEP 1: FOTO NOK */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Toma una fotografía de la desviación u oportunidad</p>
                <p className="text-xs text-gray-400 mt-0.5">La imagen se convertirá en la evidencia visual NOK de partida</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-red-300 bg-red-50/40 hover:bg-red-50/80 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors group"
              >
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-red-200 flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform mb-3">
                  <Camera size={32} />
                </div>
                <span className="font-semibold text-gray-800 text-sm">Tomar Foto con Cámara</span>
                <span className="text-xs text-gray-500 mt-1">o seleccionar desde la galería del dispositivo</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSamplePhoto}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                >
                  <Sparkles size={13} /> Usar foto de prueba
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ZONA Y FASE */}
          {step === 2 && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="relative rounded-xl overflow-hidden aspect-16/9 bg-black max-h-48 w-full border border-gray-200">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="absolute top-2 right-2 bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-md backdrop-blur-xs font-medium"
                  >
                    Cambiar foto
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Zona Afectada *</label>
                  <select
                    value={zoneId}
                    onChange={(e) => {
                      setZoneId(e.target.value);
                      setSubzoneId('');
                    }}
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        [{z.code}] {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Subzona (opcional)</label>
                  <select
                    value={subzoneId}
                    onChange={(e) => setSubzoneId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="">(Toda la zona)</option>
                    {currentSubzones.map((sz) => (
                      <option key={sz.id} value={sz.id}>
                        [{sz.code}] {sz.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fase 5S</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['1S', '2S', '3S', '4S', '5S'] as FiveSPhase[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPhase(p)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all text-center ${
                        phase === p ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción de la Anomalía *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Material sobrante acumulado en pasillo impidiendo paso de carretilla..."
                  required
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  Volver a Foto
                </button>
                <button
                  type="button"
                  disabled={!zoneId || !description.trim()}
                  onClick={() => setStep(3)}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  Continuar a Acción
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ACCIÓN Y RESOLUCIÓN */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Acción Inmediata o Propuesta</label>
                <input
                  type="text"
                  value={immediateAction}
                  onChange={(e) => setImmediateAction(e.target.value)}
                  placeholder="Ej: Retirar palet a cuarentena y demarcar suelo"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createRedTag}
                      onChange={(e) => setCreateRedTag(e.target.checked)}
                      className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                    />
                    <span className="text-xs font-medium text-gray-700">Emitir Tarjeta Roja</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Al guardar, se creará la anomalía con foto NOK y una acción en el panel PDCA para que el responsable aporte la foto OK tras resolverla.
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  Atrás
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Guardar Anomalía y Acción
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
