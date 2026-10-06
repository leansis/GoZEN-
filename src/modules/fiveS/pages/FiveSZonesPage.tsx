import React, { useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  MapPin, 
  Plus, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Upload, 
  Layers, 
  ChevronDown, 
  ChevronRight, 
  User, 
  Briefcase, 
  X, 
  Sparkles,
  Info,
  Clock,
  Layers2
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useAppData } from '../../../contexts/AppDataContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { useFiveSPermissions } from '../hooks/useFiveSPermissions';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSService } from '../services/fiveSService';
import { FiveSStorageService } from '../services/fiveSStorageService';
import { 
  FiveSZone, 
  FiveSSubzone, 
  FiveSZoneStatus, 
  FiveSSubzoneCriticality,
  FiveSZoneType,
  FIVE_S_ZONE_TYPES,
  FIVE_S_SHIFTS
} from '../types/fiveSTypes';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSZonesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId } = useAuth();
  const { users } = useAppData();
  const { project, members, zones, subzones, loading } = useFiveSProject(projectId);
  const permissions = useFiveSPermissions(project, members);

  // Filter users by activeCompanyId
  const companyUsers = useMemo(() => {
    if (!activeCompanyId) return [];
    return users.filter(u => {
      const uCompanyId = u.companyId || (u as any).company_id;
      const uCompanyIds = (u as any).companyIds;
      return uCompanyId === activeCompanyId || (Array.isArray(uCompanyIds) && uCompanyIds.includes(activeCompanyId));
    });
  }, [users, activeCompanyId]);

  // Collapsed / expanded zones map (default expanded)
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});

  // Zone Modal state
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<FiveSZone | null>(null);
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState<FiveSZoneType>('Producción');
  const [zoneResponsibleId, setZoneResponsibleId] = useState('');
  const [zoneResponsibleName, setZoneResponsibleName] = useState('');
  const [zoneBoundaries, setZoneBoundaries] = useState('');
  const [zoneDescription, setZoneDescription] = useState('');
  const [zoneStatus, setZoneStatus] = useState<FiveSZoneStatus>('PLANNED');
  const [zoneImageUrl, setZoneImageUrl] = useState('');
  const [isUploadingZoneImage, setIsUploadingZoneImage] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<FiveSZone | null>(null);

  // Subzone Modal state
  const [isSubzoneModalOpen, setIsSubzoneModalOpen] = useState(false);
  const [targetZoneForSubzone, setTargetZoneForSubzone] = useState<FiveSZone | null>(null);
  const [editingSubzone, setEditingSubzone] = useState<FiveSSubzone | null>(null);
  const [subzoneCode, setSubzoneCode] = useState('');
  const [subzoneName, setSubzoneName] = useState('');
  const [subzoneWorkstationType, setSubzoneWorkstationType] = useState('');
  const [subzoneResponsibleId, setSubzoneResponsibleId] = useState('');
  const [subzoneResponsibleName, setSubzoneResponsibleName] = useState('');
  const [subzoneCriticality, setSubzoneCriticality] = useState<FiveSSubzoneCriticality>('MEDIA');
  const [subzoneDescription, setSubzoneDescription] = useState('');
  const [subzoneStatus, setSubzoneStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [subzoneReferencePhotoUrl, setSubzoneReferencePhotoUrl] = useState('');
  const [isUploadingSubzonePhoto, setIsUploadingSubzonePhoto] = useState(false);
  const [subzoneToDelete, setSubzoneToDelete] = useState<FiveSSubzone | null>(null);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const zoneFileInputRef = useRef<HTMLInputElement>(null);
  const subzoneFileInputRef = useRef<HTMLInputElement>(null);

  const toggleZoneExpand = (zoneId: string) => {
    setExpandedZones(prev => ({
      ...prev,
      [zoneId]: prev[zoneId] === undefined ? false : !prev[zoneId]
    }));
  };

  const isZoneExpanded = (zoneId: string) => expandedZones[zoneId] !== false;

  // ================= OPEN CREATE ZONE =================
  const handleOpenCreateZone = async () => {
    if (!project || !activeCompanyId) return;
    try {
      const nextCode = await FiveSService.getNextZoneCode(project.id, activeCompanyId);
      setEditingZone(null);
      setZoneCode(nextCode);
      setZoneName('');
      setZoneType('Producción');
      
      // Default responsible to project leader or first member
      const leader = members.find(m => m.isLeader && m.active);
      const fallbackMember = members.find(m => m.active);
      setZoneResponsibleId(leader?.userId || fallbackMember?.userId || '');
      setZoneResponsibleName(leader?.name || fallbackMember?.name || project.responsible5S || '');
      
      setZoneBoundaries('');
      setZoneDescription('');
      setZoneStatus('PLANNED');
      setZoneImageUrl('');
      setIsZoneModalOpen(true);
    } catch (error) {
      console.error('Error generating zone code:', error);
      toast.error('Error al inicializar la zona.');
    }
  };

  // ================= OPEN EDIT ZONE =================
  const handleOpenEditZone = (zone: FiveSZone) => {
    setEditingZone(zone);
    setZoneCode(zone.code);
    setZoneName(zone.name);
    setZoneType((zone.zoneType as FiveSZoneType) || 'Producción');
    setZoneResponsibleId(zone.responsibleId || '');
    setZoneResponsibleName(zone.responsibleName || '');
    setZoneBoundaries(zone.boundaries || '');
    setZoneDescription(zone.description || '');
    setZoneStatus((zone.status as FiveSZoneStatus) || 'PLANNED');
    setZoneImageUrl(zone.imageUrl || zone.layoutUrl || '');
    setIsZoneModalOpen(true);
  };

  // ================= SAVE ZONE =================
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !activeCompanyId || !zoneName.trim() || !zoneCode.trim()) {
      toast.error('Por favor completa el código y el nombre de la zona.');
      return;
    }

    try {
      if (editingZone) {
        await FiveSService.updateZone(editingZone.id, {
          code: zoneCode.trim().toUpperCase(),
          name: zoneName.trim(),
          zoneType,
          responsibleId: zoneResponsibleId,
          responsibleName: zoneResponsibleName,
          boundaries: zoneBoundaries.trim(),
          description: zoneDescription.trim(),
          status: zoneStatus,
          imageUrl: zoneImageUrl,
          layoutUrl: zoneImageUrl
        });
        toast.success(`Zona ${zoneCode} actualizada.`);
      } else {
        const now = new Date().toISOString();
        await FiveSService.addZone({
          projectId: project.id,
          companyId: activeCompanyId,
          code: zoneCode.trim().toUpperCase(),
          name: zoneName.trim(),
          zoneType,
          responsibleId: zoneResponsibleId,
          responsibleName: zoneResponsibleName,
          boundaries: zoneBoundaries.trim(),
          description: zoneDescription.trim(),
          status: zoneStatus,
          imageUrl: zoneImageUrl,
          layoutUrl: zoneImageUrl,
          order: zones.length + 1,
          createdAt: now,
          updatedAt: now
        });
        toast.success(`Zona ${zoneCode} creada correctamente.`);
      }
      setIsZoneModalOpen(false);
    } catch (error) {
      console.error('Error saving zone:', error);
      toast.error('Error al guardar la zona.');
    }
  };

  // ================= DELETE ZONE =================
  const handleConfirmDeleteZone = async () => {
    if (!zoneToDelete) return;
    try {
      await FiveSService.deleteZone(zoneToDelete.id);
      toast.success(`Zona ${zoneToDelete.code} eliminada.`);
      setZoneToDelete(null);
    } catch (error) {
      console.error('Error deleting zone:', error);
      toast.error('Error al eliminar la zona.');
    }
  };

  // ================= OPEN CREATE SUBZONE =================
  const handleOpenCreateSubzone = async (zone: FiveSZone) => {
    if (!project || !activeCompanyId) return;
    try {
      const nextCode = await FiveSService.getNextSubzoneCode(zone.id, zone.code, project.id, activeCompanyId);
      setTargetZoneForSubzone(zone);
      setEditingSubzone(null);
      setSubzoneCode(nextCode);
      setSubzoneName('');
      setSubzoneWorkstationType('');
      setSubzoneResponsibleId(zone.responsibleId || '');
      setSubzoneResponsibleName(zone.responsibleName || '');
      setSubzoneCriticality('MEDIA');
      setSubzoneDescription('');
      setSubzoneStatus('ACTIVE');
      setSubzoneReferencePhotoUrl('');
      setIsSubzoneModalOpen(true);
    } catch (error) {
      console.error('Error preparing subzone:', error);
      toast.error('Error al generar código de subzona.');
    }
  };

  // ================= OPEN EDIT SUBZONE =================
  const handleOpenEditSubzone = (zone: FiveSZone, subzone: FiveSSubzone) => {
    setTargetZoneForSubzone(zone);
    setEditingSubzone(subzone);
    setSubzoneCode(subzone.code);
    setSubzoneName(subzone.name);
    setSubzoneWorkstationType(subzone.workstationType || '');
    setSubzoneResponsibleId(subzone.responsibleId || '');
    setSubzoneResponsibleName(subzone.responsibleName || '');
    setSubzoneCriticality(subzone.criticality || 'MEDIA');
    setSubzoneDescription(subzone.description || '');
    setSubzoneStatus((subzone.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE');
    setSubzoneReferencePhotoUrl(subzone.referencePhotoUrl || subzone.photoUrl || '');
    setIsSubzoneModalOpen(true);
  };

  // ================= SAVE SUBZONE =================
  const handleSaveSubzone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !activeCompanyId || !targetZoneForSubzone || !subzoneName.trim() || !subzoneCode.trim()) {
      toast.error('Por favor completa el código y nombre del puesto / subzona.');
      return;
    }

    try {
      const nowSub = new Date().toISOString();
      if (editingSubzone) {
        await FiveSService.updateSubzone(editingSubzone.id, {
          code: subzoneCode.trim().toUpperCase(),
          name: subzoneName.trim(),
          workstationType: subzoneWorkstationType.trim(),
          responsibleId: subzoneResponsibleId,
          responsibleName: subzoneResponsibleName,
          criticality: subzoneCriticality,
          description: subzoneDescription.trim(),
          status: subzoneStatus,
          referencePhotoUrl: subzoneReferencePhotoUrl,
          photoUrl: subzoneReferencePhotoUrl,
          updatedAt: nowSub
        });
        toast.success(`Subzona ${subzoneCode} actualizada.`);
      } else {
        await FiveSService.addSubzone({
          zoneId: targetZoneForSubzone.id,
          projectId: project.id,
          companyId: activeCompanyId,
          code: subzoneCode.trim().toUpperCase(),
          name: subzoneName.trim(),
          workstationType: subzoneWorkstationType.trim(),
          responsibleId: subzoneResponsibleId,
          responsibleName: subzoneResponsibleName,
          criticality: subzoneCriticality,
          description: subzoneDescription.trim(),
          status: subzoneStatus,
          referencePhotoUrl: subzoneReferencePhotoUrl,
          photoUrl: subzoneReferencePhotoUrl,
          createdAt: nowSub,
          updatedAt: nowSub
        });
        toast.success(`Subzona ${subzoneCode} creada con éxito.`);
      }
      setIsSubzoneModalOpen(false);
    } catch (error) {
      console.error('Error saving subzone:', error);
      toast.error('Error al guardar la subzona.');
    }
  };

  // ================= DELETE SUBZONE =================
  const handleConfirmDeleteSubzone = async () => {
    if (!subzoneToDelete) return;
    try {
      await FiveSService.deleteSubzone(subzoneToDelete.id);
      toast.success(`Subzona ${subzoneToDelete.code} eliminada.`);
      setSubzoneToDelete(null);
    } catch (error) {
      console.error('Error deleting subzone:', error);
      toast.error('Error al eliminar la subzona.');
    }
  };

  // ================= UPLOAD ZONE IMAGE =================
  const handleZoneImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !activeCompanyId) return;

    setIsUploadingZoneImage(true);
    try {
      const url = await FiveSStorageService.uploadZoneImage(
        activeCompanyId,
        project.id,
        editingZone ? editingZone.id : 'temp',
        file
      );
      setZoneImageUrl(url);
      toast.success('Plano/Foto de zona subido.');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen.');
    } finally {
      setIsUploadingZoneImage(false);
    }
  };

  // ================= UPLOAD SUBZONE IMAGE =================
  const handleSubzoneImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project || !activeCompanyId || !targetZoneForSubzone) return;

    setIsUploadingSubzonePhoto(true);
    try {
      const url = await FiveSStorageService.uploadSubzoneImage(
        activeCompanyId,
        project.id,
        targetZoneForSubzone.id,
        editingSubzone ? editingSubzone.id : 'temp',
        file
      );
      setSubzoneReferencePhotoUrl(url);
      toast.success('Foto de referencia subida.');
    } catch (error) {
      console.error('Error uploading subzone image:', error);
      toast.error('Error al subir la foto de referencia.');
    } finally {
      setIsUploadingSubzonePhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Cargando delimitación de zonas 5S...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 max-w-md mx-auto my-12">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Proyecto no encontrado</h3>
        <p className="text-sm text-gray-500 mb-6">El proyecto 5S solicitado no existe en la empresa activa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 5S MODULE HEADER */}
      <FiveSHeader project={project} zones={zones} subzones={subzones} activeTab="zones" />

      {/* TOP CONTROLS & INFO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Fase 1 · Delimitación
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {zones.length} {zones.length === 1 ? 'Zona definida' : 'Zonas definidas'} · {subzones.length} Subzonas
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <MapPin className="text-indigo-600" size={24} />
            Zonas y Subzonas de Implantación 5S
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Delimita físicamente los perímetros de trabajo en la planta o área. Cada zona se divide en puestos, bancos o máquinas (subzonas) para facilitar el despliegue de las 5S y sus auditorías.
          </p>
        </div>

        {permissions.canManageZones && (
          <button
            onClick={handleOpenCreateZone}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-xs shrink-0"
          >
            <Plus size={18} />
            Nueva Zona
          </button>
        )}
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Zonas</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{zones.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Áreas delimitadas</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Subzonas</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{subzones.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Puestos / Máquinas</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zonas en Proceso</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {zones.filter(z => z.status === 'IN_PROGRESS').length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Despliegue activo</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subzonas Críticas</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {subzones.filter(s => String(s.criticality).toUpperCase() === 'ALTA').length}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Prioridad alta</div>
        </div>
      </div>

      {/* ZONES LIST */}
      {zones.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
            <Layers size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No hay zonas definidas todavía</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Comienza delimitando la primera zona de implantación 5S (p. ej. Línea de Envasado, Taller Mecánico, Almacén de Materias Primas).
          </p>
          {permissions.canManageZones && (
            <button
              onClick={handleOpenCreateZone}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-xs"
            >
              <Plus size={18} />
              Crear Primera Zona
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {zones.map(zone => {
            const zoneSubzones = subzones.filter(s => s.zoneId === zone.id);
            const expanded = isZoneExpanded(zone.id);

            const zoneStatusNormalized = String(zone?.status || 'PLANNED').toUpperCase();
            const statusMap: Record<string, { label: string; bg: string }> = {
              PLANNED: { label: 'Planificada', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
              IN_PROGRESS: { label: 'En Proceso', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
              IMPLEMENTED: { label: 'Implantada', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              MAINTENANCE: { label: 'Mantenimiento', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
              NOT_STARTED: { label: 'No iniciada', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
              PENDING: { label: 'Pendiente', bg: 'bg-slate-100 text-slate-700 border-slate-200' }
            };
            const statusMeta = statusMap[zoneStatusNormalized] || {
              label: zone?.status ? String(zone.status) : 'Planificada',
              bg: 'bg-slate-100 text-slate-700 border-slate-200'
            };

            return (
              <div 
                key={zone.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* ZONE HEADER CARD */}
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* LEFT INFO */}
                    <div className="flex items-start gap-4">
                      {/* ZONE CODE BADGE */}
                      <div className="w-14 h-14 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center font-bold shadow-xs shrink-0">
                        <span className="text-[10px] uppercase tracking-wider text-indigo-200 font-semibold leading-tight">ZONA</span>
                        <span className="text-base font-extrabold leading-none mt-0.5">{zone.code}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{zone.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.bg}`}>
                            {statusMeta.label}
                          </span>
                          {zone.zoneType && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {zone.zoneType}
                            </span>
                          )}
                        </div>

                        {zone.description && (
                          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                            {zone.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                          {zone.responsibleName && (
                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                              <User size={13} className="text-indigo-600" />
                              <strong className="text-slate-500">Resp:</strong> {zone.responsibleName}
                            </span>
                          )}

                          {zone.boundaries && (
                            <span className="flex items-center gap-1.5 text-slate-600" title={zone.boundaries}>
                              <MapPin size={13} className="text-slate-400" />
                              <strong className="text-slate-500">Límites:</strong> {zone.boundaries}
                            </span>
                          )}

                          <span className="flex items-center gap-1 text-slate-500">
                            <Layers size={13} className="text-indigo-500" />
                            <strong>{zoneSubzones.length}</strong> {zoneSubzones.length === 1 ? 'subzona' : 'subzonas'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT ACTIONS & PREVIEW */}
                    <div className="flex items-center gap-2 shrink-0 self-end lg:self-start">
                      {/* IMAGE THUMBNAIL IF PRESENT */}
                      {(zone.imageUrl || zone.layoutUrl) && (
                        <button
                          onClick={() => setPreviewImage({ 
                            url: zone.imageUrl || zone.layoutUrl || '', 
                            title: `Plano / Foto de ${zone.code} - ${zone.name}` 
                          })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                          title="Ver plano / foto"
                        >
                          <ImageIcon size={14} className="text-indigo-600" />
                          Plano/Foto
                        </button>
                      )}

                      {permissions.canManageZones && (
                        <>
                          <button
                            onClick={() => handleOpenCreateSubzone(zone)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors border border-indigo-200"
                          >
                            <Plus size={14} />
                            Añadir Subzona
                          </button>

                          <button
                            onClick={() => handleOpenEditZone(zone)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar Zona"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            onClick={() => setZoneToDelete(zone)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar Zona"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => toggleZoneExpand(zone.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                        title={expanded ? 'Colapsar subzonas' : 'Expandir subzonas'}
                      >
                        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* SUBZONES SECTION (COLLAPSIBLE / EXPANDED) */}
                {expanded && (
                  <div className="bg-slate-50/70 border-t border-slate-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Subzonas / Puestos de Trabajo ({zoneSubzones.length})
                        </span>
                        <span className="text-xs text-slate-400">
                          en {zone.name}
                        </span>
                      </div>

                      {permissions.canManageZones && (
                        <button
                          onClick={() => handleOpenCreateSubzone(zone)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Nueva Subzona
                        </button>
                      )}
                    </div>

                    {zoneSubzones.length === 0 ? (
                      <div className="bg-white rounded-xl border border-dashed border-slate-200 p-6 text-center">
                        <p className="text-xs text-slate-500">
                          Esta zona no tiene puestos ni subzonas registradas. Añade máquinas, bancos o puestos de ensamble.
                        </p>
                        {permissions.canManageZones && (
                          <button
                            onClick={() => handleOpenCreateSubzone(zone)}
                            className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            <Plus size={14} />
                            Crear primera subzona para {zone.code}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {zoneSubzones.map(sub => {
                          const critNormalized = String(sub?.criticality || 'MEDIA').toUpperCase();
                          const critMap: Record<string, { label: string; bg: string }> = {
                            ALTA: { label: 'Crítica Alta', bg: 'bg-red-50 text-red-700 border-red-200' },
                            MEDIA: { label: 'Crítica Media', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
                            BAJA: { label: 'Crítica Baja', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                          };
                          const critMeta = critMap[critNormalized] || {
                            label: sub?.criticality ? `Prioridad ${sub.criticality}` : 'Crítica Media',
                            bg: 'bg-amber-50 text-amber-700 border-amber-200'
                          };

                          return (
                            <div
                              key={sub.id}
                              className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
                                      {sub.code}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${critMeta.bg}`}>
                                      {critMeta.label}
                                    </span>
                                  </div>

                                  {permissions.canManageZones && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleOpenEditSubzone(zone, sub)}
                                        className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                        title="Editar Subzona"
                                      >
                                        <Edit3 size={14} />
                                      </button>
                                      <button
                                        onClick={() => setSubzoneToDelete(sub)}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                        title="Eliminar Subzona"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-slate-800 leading-snug">
                                  {sub.name}
                                </h4>

                                {sub.workstationType && (
                                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                    <Briefcase size={12} className="text-slate-400" />
                                    <span>{sub.workstationType}</span>
                                  </div>
                                )}

                                {sub.description && (
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                    {sub.description}
                                  </p>
                                )}
                              </div>

                              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                {sub.responsibleName ? (
                                  <span className="text-slate-600 truncate flex items-center gap-1 max-w-[150px]">
                                    <User size={12} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{sub.responsibleName}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Sin responsable</span>
                                )}

                                {(sub.referencePhotoUrl || sub.photoUrl) && (
                                  <button
                                    onClick={() => setPreviewImage({ 
                                      url: sub.referencePhotoUrl || sub.photoUrl || '', 
                                      title: `Foto de ${sub.code} - ${sub.name}` 
                                    })}
                                    className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 text-[11px]"
                                  >
                                    <ImageIcon size={12} />
                                    Foto ref.
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ================= ZONE MODAL ================= */}
      <Modal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        title={editingZone ? `Editar Zona ${editingZone.code}` : 'Nueva Zona de Implantación 5S'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveZone} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código *
              </label>
              <input
                type="text"
                required
                value={zoneCode}
                onChange={e => setZoneCode(e.target.value.toUpperCase())}
                placeholder="Z-01"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la Zona *
              </label>
              <input
                type="text"
                required
                value={zoneName}
                onChange={e => setZoneName(e.target.value)}
                placeholder="Ej. Línea 1 de Envasado, Taller..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Zona
              </label>
              <select
                value={zoneType}
                onChange={e => setZoneType(e.target.value as FiveSZoneType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                {FIVE_S_ZONE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado de Implantación
              </label>
              <select
                value={zoneStatus}
                onChange={e => setZoneStatus(e.target.value as FiveSZoneStatus)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PLANNED">Planificada</option>
                <option value="IN_PROGRESS">En Proceso</option>
                <option value="IMPLEMENTED">Implantada</option>
                <option value="MAINTENANCE">Mantenimiento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsable de la Zona
            </label>
            {members.length > 0 ? (
              <select
                value={zoneResponsibleId}
                onChange={e => {
                  const selMember = members.find(m => m.userId === e.target.value);
                  const selUser = companyUsers.find(u => u.id === e.target.value);
                  setZoneResponsibleId(e.target.value);
                  setZoneResponsibleName(selMember?.name || selUser?.name || zoneResponsibleName);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Seleccionar integrante del equipo 5S o usuario --</option>
                <optgroup label="Integrantes del equipo 5S">
                  {members.filter(m => m.active).map(m => (
                    <option key={m.id} value={m.userId}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Otros usuarios de la empresa">
                  {companyUsers
                    .filter(u => !members.some(m => m.active && m.userId === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email || u.department || 'Usuario'})
                      </option>
                    ))}
                </optgroup>
              </select>
            ) : (
              <input
                type="text"
                value={zoneResponsibleName}
                onChange={e => setZoneResponsibleName(e.target.value)}
                placeholder="Nombre del responsable de zona"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Límites físicos de la Zona
            </label>
            <input
              type="text"
              value={zoneBoundaries}
              onChange={e => setZoneBoundaries(e.target.value)}
              placeholder="Ej. Desde columna B4 hasta pasillo principal 2"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción / Alcance
            </label>
            <textarea
              rows={2}
              value={zoneDescription}
              onChange={e => setZoneDescription(e.target.value)}
              placeholder="Detalles del proceso, operaciones que se realizan, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* IMAGE / LAYOUT URL OR UPLOAD */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foto General o Plano de la Zona
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={zoneImageUrl}
                onChange={e => setZoneImageUrl(e.target.value)}
                placeholder="URL de imagen o sube archivo"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="file"
                ref={zoneFileInputRef}
                onChange={handleZoneImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => zoneFileInputRef.current?.click()}
                disabled={isUploadingZoneImage}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50"
              >
                <Upload size={14} />
                {isUploadingZoneImage ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
            {zoneImageUrl && (
              <div className="mt-2 relative w-20 h-16 rounded-lg overflow-hidden border border-slate-200">
                <img 
                  src={zoneImageUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover" 
                />
                <button
                  type="button"
                  onClick={() => setZoneImageUrl('')}
                  className="absolute top-0.5 right-0.5 bg-red-600 text-white p-0.5 rounded-full"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsZoneModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
            >
              {editingZone ? 'Guardar Cambios' : 'Crear Zona'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= SUBZONE MODAL ================= */}
      <Modal
        isOpen={isSubzoneModalOpen && !!targetZoneForSubzone}
        onClose={() => setIsSubzoneModalOpen(false)}
        title={editingSubzone 
          ? `Editar Subzona ${editingSubzone.code}` 
          : `Nueva Subzona para ${targetZoneForSubzone?.code}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveSubzone} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código *
              </label>
              <input
                type="text"
                required
                value={subzoneCode}
                onChange={e => setSubzoneCode(e.target.value.toUpperCase())}
                placeholder="SZ-01.1"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre del Puesto / Subzona *
              </label>
              <input
                type="text"
                required
                value={subzoneName}
                onChange={e => setSubzoneName(e.target.value)}
                placeholder="Ej. Armario de herramientas, Mesa de montaje..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Puesto / Máquina
              </label>
              <input
                type="text"
                value={subzoneWorkstationType}
                onChange={e => setSubzoneWorkstationType(e.target.value)}
                placeholder="Ej. Torno CNC, Banco de trabajo..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Criticidad / Prioridad 5S
              </label>
              <select
                value={subzoneCriticality}
                onChange={e => setSubzoneCriticality(e.target.value as FiveSSubzoneCriticality)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="ALTA">Alta (Prioritaria)</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsable del Puesto
            </label>
            {members.length > 0 ? (
              <select
                value={subzoneResponsibleId}
                onChange={e => {
                  const sel = members.find(m => m.userId === e.target.value);
                  const selUser = companyUsers.find(u => u.id === e.target.value);
                  setSubzoneResponsibleId(e.target.value);
                  setSubzoneResponsibleName(sel?.name || selUser?.name || subzoneResponsibleName);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Usar responsable de zona ({targetZoneForSubzone?.responsibleName || 'ninguno'}) --</option>
                <optgroup label="Integrantes del equipo 5S">
                  {members.filter(m => m.active).map(m => (
                    <option key={m.id} value={m.userId}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Otros usuarios">
                  {companyUsers
                    .filter(u => !members.some(m => m.active && m.userId === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email || u.department || 'Usuario'})
                      </option>
                    ))}
                </optgroup>
              </select>
            ) : (
              <input
                type="text"
                value={subzoneResponsibleName}
                onChange={e => setSubzoneResponsibleName(e.target.value)}
                placeholder="Nombre del operario o responsable"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descripción del Puesto
            </label>
            <textarea
              rows={2}
              value={subzoneDescription}
              onChange={e => setSubzoneDescription(e.target.value)}
              placeholder="Operaciones que se ejecutan, herramientas asignadas..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* PHOTO URL OR UPLOAD */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Foto de Referencia Inicial
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={subzoneReferencePhotoUrl}
                onChange={e => setSubzoneReferencePhotoUrl(e.target.value)}
                placeholder="URL de foto o sube archivo"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="file"
                ref={subzoneFileInputRef}
                onChange={handleSubzoneImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => subzoneFileInputRef.current?.click()}
                disabled={isUploadingSubzonePhoto}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50"
              >
                <Upload size={14} />
                {isUploadingSubzonePhoto ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
            {subzoneReferencePhotoUrl && (
              <div className="mt-2 relative w-20 h-16 rounded-lg overflow-hidden border border-slate-200">
                <img 
                  src={subzoneReferencePhotoUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover" 
                />
                <button
                  type="button"
                  onClick={() => setSubzoneReferencePhotoUrl('')}
                  className="absolute top-0.5 right-0.5 bg-red-600 text-white p-0.5 rounded-full"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSubzoneModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
            >
              {editingSubzone ? 'Guardar Cambios' : 'Crear Subzona'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE ZONE MODAL */}
      <ConfirmModal
        isOpen={!!zoneToDelete}
        onCancel={() => setZoneToDelete(null)}
        onConfirm={handleConfirmDeleteZone}
        title={`Eliminar Zona ${zoneToDelete?.code || ''}`}
        message={`¿Estás seguro de que deseas eliminar la zona "${zoneToDelete?.name}"? Esta acción también eliminará todas las subzonas asociadas.`}
        confirmText="Eliminar Zona"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
      />

      {/* CONFIRM DELETE SUBZONE MODAL */}
      <ConfirmModal
        isOpen={!!subzoneToDelete}
        onCancel={() => setSubzoneToDelete(null)}
        onConfirm={handleConfirmDeleteSubzone}
        title={`Eliminar Subzona ${subzoneToDelete?.code || ''}`}
        message={`¿Estás seguro de que deseas eliminar la subzona "${subzoneToDelete?.name}"?`}
        confirmText="Eliminar Subzona"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
      />

      {/* ================= PREVIEW IMAGE MODAL ================= */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon size={16} className="text-indigo-600" />
                {previewImage.title}
              </h4>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] flex items-center justify-center overflow-auto rounded-xl bg-slate-100">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
