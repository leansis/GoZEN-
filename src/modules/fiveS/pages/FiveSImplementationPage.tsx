import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Sparkles, 
  LayoutGrid, 
  Brush, 
  ShieldCheck, 
  Award, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Camera, 
  ArrowRight,
  Filter,
  Check,
  PackageCheck
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { 
  FiveSPhase, 
  FiveSRedTag, 
  FiveSOrderItem, 
  FiveSCleaningTask,
  RedTagCategory,
  RedTagReason,
  RedTagAction,
  RedTagStatus
} from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import { uploadFiveSImage } from '../services/fiveSStorageService';
import { FIVE_S_PHASES_META } from '../components/FiveSPhaseSelector';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSImplementationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId, dbUser } = useAuth();
  const { 
    project, 
    zones, 
    subzones, 
    redTags, 
    orderItems, 
    cleaningTasks, 
    standards, 
    audits, 
    loading 
  } = useFiveSProject(projectId);

  const [activeTab, setActiveTab] = useState<FiveSPhase>('1S');

  // 1S Red Tag Modal
  const [isRedTagModalOpen, setIsRedTagModalOpen] = useState(false);
  const [tagZoneId, setTagZoneId] = useState('');
  const [tagSubzoneId, setTagSubzoneId] = useState('');
  const [tagDescription, setTagDescription] = useState('');
  const [tagCategory, setTagCategory] = useState<RedTagCategory>('equipment');
  const [tagQuantity, setTagQuantity] = useState(1);
  const [tagReason, setTagReason] = useState<RedTagReason>('unnecessary');
  const [tagAction, setTagAction] = useState<RedTagAction>('holding_area');
  const [tagQuarantineLocation, setTagQuarantineLocation] = useState('Zona de Cuarentena 5S');
  const [tagPhotoFile, setTagPhotoFile] = useState<File | null>(null);
  const [tagPhotoUrl, setTagPhotoUrl] = useState('');

  // 2S Seiton Modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderZoneId, setOrderZoneId] = useState('');
  const [orderItemName, setOrderItemName] = useState('');
  const [orderLocation, setOrderLocation] = useState('');
  const [orderIdType, setOrderIdType] = useState<'shadow_board' | 'floor_marking' | 'label' | 'color_code'>('shadow_board');
  const [orderPhotoFile, setOrderPhotoFile] = useState<File | null>(null);

  // 3S Seiso Modal
  const [isCleaningModalOpen, setIsCleaningModalOpen] = useState(false);
  const [cleanZoneId, setCleanZoneId] = useState('');
  const [cleanTitle, setCleanTitle] = useState('');
  const [cleanType, setCleanType] = useState<'dirt_source' | 'cleaning_standard'>('dirt_source');
  const [cleanSourceCause, setCleanSourceCause] = useState('');
  const [cleanMethod, setCleanMethod] = useState('');
  const [cleanFrequency, setCleanFrequency] = useState<'shift' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [cleanResponsible, setCleanResponsible] = useState(dbUser?.name || '');

  // Resolve Red Tag Modal
  const [tagToResolve, setTagToResolve] = useState<FiveSRedTag | null>(null);
  const [resolvePhotoFile, setResolvePhotoFile] = useState<File | null>(null);

  // Deletion modals
  const [tagToDelete, setTagToDelete] = useState<FiveSRedTag | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<FiveSOrderItem | null>(null);
  const [cleanToDelete, setCleanToDelete] = useState<FiveSCleaningTask | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando implantación 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  // 1S RED TAG SUBMISSION
  const handleSaveRedTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !tagDescription.trim()) return;

    try {
      setIsSubmitting(true);
      let photoUrl = tagPhotoUrl || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80';
      if (tagPhotoFile) {
        photoUrl = await uploadFiveSImage(tagPhotoFile, activeCompanyId, project.id, 'findings', 'red_tag');
      }

      const selectedZone = zones.find(z => z.id === tagZoneId);
      const selectedSubzone = subzones.find(sz => sz.id === tagSubzoneId);
      const tagNumber = `TR-${Date.now().toString().slice(-4)}`;

      await FiveSService.addRedTag({
        projectId: project.id,
        companyId: activeCompanyId,
        zoneId: tagZoneId || zones[0]?.id || '',
        zoneName: selectedZone?.name,
        subzoneId: tagSubzoneId || undefined,
        subzoneName: selectedSubzone?.name,
        tagNumber,
        date: new Date().toISOString().split('T')[0],
        itemDescription: tagDescription.trim(),
        category: tagCategory,
        quantity: Number(tagQuantity) || 1,
        reason: tagReason,
        actionProposed: tagAction,
        quarantineLocation: tagQuarantineLocation.trim(),
        status: 'active',
        photoNokUrl: photoUrl,
        createdBy: dbUser?.uid || '',
        createdByName: dbUser?.name || 'Operario',
        createdAt: new Date().toISOString()
      });

      toast.success('Tarjeta roja emitida exitosamente');
      setIsRedTagModalOpen(false);
      setTagDescription('');
      setTagPhotoFile(null);
    } catch (err: any) {
      toast.error('Error al emitir tarjeta roja: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveRedTag = async () => {
    if (!tagToResolve || !activeCompanyId || !project.id) return;
    try {
      setIsSubmitting(true);
      let okPhotoUrl = 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80';
      if (resolvePhotoFile) {
        okPhotoUrl = await uploadFiveSImage(resolvePhotoFile, activeCompanyId, project.id, 'findings', 'resolved_ok');
      }

      await FiveSService.updateRedTag(tagToResolve.id, {
        status: 'resolved',
        photoOkUrl: okPhotoUrl,
        resolvedAt: new Date().toISOString()
      });

      toast.success('Tarjeta roja resuelta con foto OK');
      setTagToResolve(null);
      setResolvePhotoFile(null);
    } catch (err: any) {
      toast.error('Error al resolver: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2S SEITON SUBMISSION
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !orderItemName.trim()) return;

    try {
      setIsSubmitting(true);
      let photoUrl = '';
      if (orderPhotoFile) {
        photoUrl = await uploadFiveSImage(orderPhotoFile, activeCompanyId, project.id, 'layouts', 'seiton');
      }

      await FiveSService.addOrderItem({
        projectId: project.id,
        companyId: activeCompanyId,
        zoneId: orderZoneId || zones[0]?.id || '',
        itemName: orderItemName.trim(),
        assignedLocation: orderLocation.trim(),
        identificationType: orderIdType,
        photoUrl: photoUrl || undefined,
        status: 'green',
        createdAt: new Date().toISOString()
      });

      toast.success('Elemento de orden (2S) registrado');
      setIsOrderModalOpen(false);
      setOrderItemName('');
      setOrderLocation('');
      setOrderPhotoFile(null);
    } catch (err: any) {
      toast.error('Error al registrar orden: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3S SEISO SUBMISSION
  const handleSaveCleaning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !cleanTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await FiveSService.addCleaningTask({
        projectId: project.id,
        companyId: activeCompanyId,
        zoneId: cleanZoneId || zones[0]?.id || '',
        title: cleanTitle.trim(),
        type: cleanType,
        sourceCause: cleanSourceCause.trim() || undefined,
        standardMethod: cleanMethod.trim() || 'Inspección visual y limpieza con paño microfibra',
        frequency: cleanFrequency,
        responsibleName: cleanResponsible.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      });

      toast.success('Punto de limpieza e inspección (3S) creado');
      setIsCleaningModalOpen(false);
      setCleanTitle('');
      setCleanSourceCause('');
    } catch (err: any) {
      toast.error('Error al guardar limpieza: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* 5S Stage Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {(['1S', '2S', '3S', '4S', '5S'] as FiveSPhase[]).map((phase) => {
          const meta = FIVE_S_PHASES_META[phase];
          const Icon = meta.icon;
          const isActive = activeTab === phase;

          return (
            <button
              key={phase}
              onClick={() => setActiveTab(phase)}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${meta.badgeBg}`}>
                  {phase}
                </span>
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              </div>
              <div>
                <strong className="block text-sm text-gray-900 font-bold">{meta.japanese}</strong>
                <span className="text-[11px] text-gray-500 line-clamp-1">{meta.spanish}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* TAB 1S: SEIRI (TARJETAS ROJAS & DESPEJE) */}
      {activeTab === '1S' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">1S Seiri</span>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Gestión de Tarjetas Rojas y Cuarentena</h3>
              </div>
              <p className="text-xs text-gray-500">
                Separar lo necesario de lo innecesario, identificar anomalías con tarjetas rojas y despejar el puesto.
              </p>
            </div>

            <button
              onClick={() => {
                setTagZoneId(zones[0]?.id || '');
                setIsRedTagModalOpen(true);
              }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition shrink-0"
            >
              <Plus size={16} />
              <span>Emitir Tarjeta Roja</span>
            </button>
          </div>

          {/* Red Tags Grid */}
          {redTags.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
              <AlertTriangle size={32} className="text-gray-300 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-800 text-sm">No hay tarjetas rojas activas</h4>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                El puesto de trabajo está actualmente despejado de elementos innecesarios.
              </p>
              <button
                onClick={() => setIsRedTagModalOpen(true)}
                className="bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Emitir Tarjeta Roja
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {redTags.map((tag) => (
                <div
                  key={tag.id}
                  className={`bg-white rounded-2xl border overflow-hidden shadow-2xs transition-all flex flex-col justify-between ${
                    tag.status === 'resolved' ? 'border-emerald-200 opacity-90' : 'border-red-200 hover:border-red-400'
                  }`}
                >
                  <div>
                    {/* Tag Header */}
                    <div className="bg-red-50/70 p-3.5 border-b border-red-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-red-700 bg-white px-2 py-0.5 rounded border border-red-200 shadow-2xs">
                          {tag.tagNumber}
                        </span>
                        <span className="text-xs text-gray-500">{tag.date}</span>
                      </div>
                      <FiveSStatusBadge
                        status={tag.status === 'resolved' ? 'green' : 'red'}
                        label={tag.status === 'resolved' ? 'Resuelta OK' : 'En Cuarentena'}
                        size="sm"
                      />
                    </div>

                    {/* Photo NOK */}
                    {tag.photoNokUrl && (
                      <div className="aspect-16/9 bg-gray-100 overflow-hidden relative">
                        <img src={tag.photoNokUrl} alt={tag.itemDescription} className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          NOK INICIAL
                        </span>
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm leading-snug">{tag.itemDescription}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Zona: <strong className="text-gray-800">{tag.zoneName || 'General'}</strong>
                          {tag.subzoneName && ` / ${tag.subzoneName}`}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <div>
                          <span className="text-gray-400 block">Motivo:</span>
                          <span className="font-medium text-gray-800 uppercase">{tag.reason}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Acción propuesta:</span>
                          <span className="font-medium text-gray-800 uppercase">{tag.actionProposed}</span>
                        </div>
                      </div>

                      {tag.quarantineLocation && (
                        <p className="text-xs text-gray-500">
                          Ubicación: <span className="font-semibold text-gray-700">{tag.quarantineLocation}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-gray-50 mt-2">
                    {tag.status !== 'resolved' ? (
                      <button
                        onClick={() => setTagToResolve(tag)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} /> Resolver con Foto OK
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={14} /> Despeje validado
                      </span>
                    )}

                    <button
                      onClick={() => setTagToDelete(tag)}
                      className="p-2 text-gray-300 hover:text-red-600 transition"
                      title="Eliminar tarjeta"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2S: SEITON (ORDEN Y DISPOSICIÓN) */}
      {activeTab === '2S' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded">2S Seiton</span>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Paneles de Sombra y Delimitación de Puestos</h3>
              </div>
              <p className="text-xs text-gray-500">
                Un lugar para cada cosa y cada cosa en su lugar. Marcajes en suelo, paneles sombra e identificación visual rápida en &lt; 30 segundos.
              </p>
            </div>

            <button
              onClick={() => {
                setOrderZoneId(zones[0]?.id || '');
                setIsOrderModalOpen(true);
              }}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition shrink-0"
            >
              <Plus size={16} />
              <span>Registrar Elemento / Panel</span>
            </button>
          </div>

          {orderItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
              <LayoutGrid size={32} className="text-gray-300 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-800 text-sm">Sin estándares de orden registrados</h4>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Registra paneles de sombra, carros de herramientas y marcajes de suelo para la etapa Seiton.
              </p>
              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Añadir Elemento Ordenado
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orderItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 uppercase">
                        {item.identificationType === 'shadow_board' ? 'Panel de Sombra' :
                         item.identificationType === 'floor_marking' ? 'Marcaje en Suelo' : 'Etiquetado'}
                      </span>
                      <button
                        onClick={() => setOrderToDelete(item)}
                        className="text-gray-300 hover:text-red-600 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <h4 className="font-bold text-gray-900 text-base mb-1">{item.itemName}</h4>
                    <p className="text-xs text-gray-600">
                      Ubicación Asignada: <strong className="text-gray-900">{item.assignedLocation}</strong>
                    </p>

                    {item.photoUrl && (
                      <div className="mt-3 aspect-16/9 rounded-xl overflow-hidden bg-gray-100">
                        <img src={item.photoUrl} alt={item.itemName} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Cumplimiento visual</span>
                    <FiveSStatusBadge status={item.status || 'green'} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3S: SEISO (LIMPIEZA E INSPECCIÓN) */}
      {activeTab === '3S' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded">3S Seiso</span>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">Limpieza, Inspección y Fuentes de Suciedad</h3>
              </div>
              <p className="text-xs text-gray-500">
                La limpieza es una forma de inspección. Eliminar causas de fugas, polvo y virutas en el origen.
              </p>
            </div>

            <button
              onClick={() => {
                setCleanZoneId(zones[0]?.id || '');
                setIsCleaningModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition shrink-0"
            >
              <Plus size={16} />
              <span>Registrar Fuente / Tarea</span>
            </button>
          </div>

          {cleaningTasks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
              <Brush size={32} className="text-gray-300 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-800 text-sm">Sin fuentes de suciedad controladas</h4>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Identifica las causas raíz de suciedad y define estándares de inspección de puesto.
              </p>
              <button
                onClick={() => setIsCleaningModalOpen(true)}
                className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                Añadir Punto de Inspección
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cleaningTasks.map((clean) => (
                <div
                  key={clean.id}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                        clean.type === 'dirt_source' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {clean.type === 'dirt_source' ? 'Fuente de Suciedad' : 'Estándar Limpieza'}
                      </span>
                      <button
                        onClick={() => setCleanToDelete(clean)}
                        className="text-gray-300 hover:text-red-600 transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <h4 className="font-bold text-gray-900 text-base mb-1">{clean.title}</h4>
                    {clean.sourceCause && (
                      <p className="text-xs text-rose-600 font-medium mb-2">
                        Causa: {clean.sourceCause}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                      Método: {clean.standardMethod}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Frecuencia: <strong className="text-gray-800 capitalize">{clean.frequency}</strong></span>
                    <span>Resp: <strong className="text-gray-800">{clean.responsibleName}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4S: SEIKETSU (ESTANDARIZACIÓN) */}
      {activeTab === '4S' && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-2xs text-center space-y-4">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldCheck size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">4S Seiketsu • Estándares Visuales de Puesto</h3>
          <p className="text-xs text-gray-500 max-w-lg mx-auto">
            Consolidar el orden y limpieza alcanzados mediante fichas plastificadas o digitales, versionado y evidencias fotográficas de lo que está bien y lo que no se tolera.
          </p>
          <div>
            <Link
              to={`/5s/projects/${project.id}/standards`}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition"
            >
              <span>Abrir Módulo de Estándares Visuales</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* TAB 5S: SHITSUKE (DISCIPLINA Y AUDITORÍA) */}
      {activeTab === '5S' && (
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-2xs text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <Award size={28} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">5S Shitsuke • Disciplina, Hábito y Auditorías</h3>
          <p className="text-xs text-gray-500 max-w-lg mx-auto">
            El ciclo nunca termina: auditorías periódicas, checklists con scoring 0-5 y acciones correctivas para evitar la degradación del estado alcanzado.
          </p>
          <div>
            <Link
              to={`/5s/projects/${project.id}/audits`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm transition"
            >
              <span>Abrir Plan y Ejecución de Auditorías</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* MODAL EMITIR TARJETA ROJA (1S) */}
      <Modal
        isOpen={isRedTagModalOpen}
        onClose={() => setIsRedTagModalOpen(false)}
        title="Emitir Tarjeta Roja 5S"
      >
        <form onSubmit={handleSaveRedTag} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Zona *</label>
            <select
              value={tagZoneId}
              onChange={(e) => setTagZoneId(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            >
              {zones.map(z => (
                <option key={z.id} value={z.id}>[{z.code}] {z.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción del Elemento Innecesario *</label>
            <textarea
              required
              rows={2}
              value={tagDescription}
              onChange={(e) => setTagDescription(e.target.value)}
              placeholder="Ej: Caja de piezas defectuosas del mes pasado sin identificar..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Categoría</label>
              <select
                value={tagCategory}
                onChange={(e: any) => setTagCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="equipment">Maquinaria / Equipo</option>
                <option value="tool">Herramienta / Útil</option>
                <option value="material">Material / Pieza</option>
                <option value="document">Documento / Papel</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Motivo</label>
              <select
                value={tagReason}
                onChange={(e: any) => setTagReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="unnecessary">Innecesario</option>
                <option value="defective">Defectuoso</option>
                <option value="excess">Exceso de stock</option>
                <option value="obsolete">Obsoleto</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Acción Propuesta</label>
              <select
                value={tagAction}
                onChange={(e: any) => setTagAction(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="holding_area">Trasladar a Cuarentena</option>
                <option value="discard">Desechar / Chatarrar</option>
                <option value="relocate">Reubicar en otra área</option>
                <option value="return">Devolver a proveedor/almacén</option>
                <option value="repair">Reparar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Área de Cuarentena</label>
              <input
                type="text"
                value={tagQuarantineLocation}
                onChange={(e) => setTagQuarantineLocation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Foto NOK (Evidencia del hallazgo)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setTagPhotoFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsRedTagModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Emitir Tarjeta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL RESOLVER TARJETA ROJA CON FOTO OK */}
      <Modal
        isOpen={Boolean(tagToResolve)}
        onClose={() => setTagToResolve(null)}
        title="Resolver Tarjeta Roja con Evidencia OK"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Adjunta la fotografía del área una vez despejada para verificar la acción y archivar la tarjeta roja.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Fotografía del Estado Final (OK)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setResolvePhotoFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setTagToResolve(null)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleResolveRedTag}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Confirmar Resolución OK'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2S SEITON */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Registrar Elemento / Panel de Orden (2S)"
      >
        <form onSubmit={handleSaveOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del Útil o Área *</label>
            <input
              type="text"
              required
              value={orderItemName}
              onChange={(e) => setOrderItemName(e.target.value)}
              placeholder="Ej: Panel de Llaves Dinamométricas"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Ubicación Asignada *</label>
              <input
                type="text"
                required
                value={orderLocation}
                onChange={(e) => setOrderLocation(e.target.value)}
                placeholder="Ej: Pared lateral banco 2"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Identificación</label>
              <select
                value={orderIdType}
                onChange={(e: any) => setOrderIdType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="shadow_board">Panel de Sombra (Silueta)</option>
                <option value="floor_marking">Marcaje en Suelo</option>
                <option value="label">Etiqueta con Código</option>
                <option value="color_code">Código de Color</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Foto del Estándar de Orden</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setOrderPhotoFile(e.target.files[0]);
                }
              }}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsOrderModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Elemento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3S SEISO */}
      <Modal
        isOpen={isCleaningModalOpen}
        onClose={() => setIsCleaningModalOpen(false)}
        title="Registrar Fuente de Suciedad o Estándar Limpieza (3S)"
      >
        <form onSubmit={handleSaveCleaning} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo</label>
              <select
                value={cleanType}
                onChange={(e: any) => setCleanType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="dirt_source">Fuente de Suciedad / Fuga</option>
                <option value="cleaning_standard">Estándar de Inspección / Limpieza</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                required
                value={cleanTitle}
                onChange={(e) => setCleanTitle(e.target.value)}
                placeholder="Ej: Fuga de aceite reductor prensa"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {cleanType === 'dirt_source' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Causa Raíz de la Suciedad</label>
              <input
                type="text"
                value={cleanSourceCause}
                onChange={(e) => setCleanSourceCause(e.target.value)}
                placeholder="Ej: Retén desgastado que gotea durante el ciclo térmico..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Método de Limpieza e Inspección</label>
            <textarea
              rows={2}
              value={cleanMethod}
              onChange={(e) => setCleanMethod(e.target.value)}
              placeholder="Ej: Retirar virutas con cepillo, pasar trapo seco y verificar presión..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Frecuencia</label>
              <select
                value={cleanFrequency}
                onChange={(e: any) => setCleanFrequency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="shift">Por Turno</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable</label>
              <input
                type="text"
                value={cleanResponsible}
                onChange={(e) => setCleanResponsible(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsCleaningModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Tarea 3S'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATIONS */}
      <ConfirmModal
        isOpen={Boolean(tagToDelete)}
        onCancel={() => setTagToDelete(null)}
        onConfirm={async () => {
          if (tagToDelete) {
            await FiveSService.deleteRedTag(tagToDelete.id);
            setTagToDelete(null);
            toast.success('Tarjeta roja eliminada');
          }
        }}
        title="Eliminar Tarjeta Roja"
        message="¿Estás seguro de que deseas eliminar permanentemente esta tarjeta roja?"
      />

      <ConfirmModal
        isOpen={Boolean(orderToDelete)}
        onCancel={() => setOrderToDelete(null)}
        onConfirm={async () => {
          if (orderToDelete) {
            await FiveSService.deleteOrderItem(orderToDelete.id);
            setOrderToDelete(null);
            toast.success('Elemento eliminado');
          }
        }}
        title="Eliminar Elemento de Orden"
        message="¿Estás seguro de que deseas eliminar este elemento de orden?"
      />

      <ConfirmModal
        isOpen={Boolean(cleanToDelete)}
        onCancel={() => setCleanToDelete(null)}
        onConfirm={async () => {
          if (cleanToDelete) {
            await FiveSService.deleteCleaningTask(cleanToDelete.id);
            setCleanToDelete(null);
            toast.success('Punto de limpieza eliminado');
          }
        }}
        title="Eliminar Punto de Limpieza"
        message="¿Estás seguro de que deseas eliminar este punto de limpieza?"
      />
    </div>
  );
}
