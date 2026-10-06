import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Building2, 
  Calendar, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Trash2, 
  Edit3,
  Layers,
  Award,
  Hash,
  MapPin,
  Clock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useAppData } from '../../../contexts/AppDataContext';
import { 
  FiveSProject, 
  FiveSProjectStatus, 
  FiveSPhase, 
  FIVE_S_PROJECT_STATUS_LABELS 
} from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { FiveSPhaseSelector, FIVE_S_PHASES_META } from '../components/FiveSPhaseSelector';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSProjectsList() {
  const { activeCompanyId, dbUser, isGlobalAdmin, isAdmin } = useAuth();
  const { users } = useAppData();
  const navigate = useNavigate();

  // Strict company isolation for users
  const companyUsers = React.useMemo(() => {
    if (!activeCompanyId) return [];
    return users.filter(u => {
      const uCompanyId = u.companyId || (u as any).company_id;
      const uCompanyIds = (u as any).companyIds;
      return uCompanyId === activeCompanyId || (Array.isArray(uCompanyIds) && uCompanyIds.includes(activeCompanyId));
    });
  }, [users, activeCompanyId]);

  const [projects, setProjects] = useState<FiveSProject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<FiveSProjectStatus | 'ALL'>('ALL');
  const [selectedPhase, setSelectedPhase] = useState<FiveSPhase | 'ALL'>('ALL');
  const [selectedPlant, setSelectedPlant] = useState<string>('ALL');

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [plantOrCenter, setPlantOrCenter] = useState('Planta Principal');
  const [areaDepartment, setAreaDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [responsible5S, setResponsible5S] = useState(dbUser?.name || '');
  const [responsibleId, setResponsibleId] = useState(dbUser?.uid || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [initialStatus, setInitialStatus] = useState<FiveSProjectStatus>('PLANNED');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Edit
  const [editingProject, setEditingProject] = useState<FiveSProject | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlant, setEditPlant] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editObjectives, setEditObjectives] = useState('');
  const [editResponsible, setEditResponsible] = useState('');
  const [editResponsibleId, setEditResponsibleId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editStatus, setEditStatus] = useState<FiveSProjectStatus>('PLANNED');
  const [editPhase, setEditPhase] = useState<FiveSPhase>('Seiri');

  // Delete modal
  const [projectToDelete, setProjectToDelete] = useState<FiveSProject | null>(null);

  useEffect(() => {
    if (!activeCompanyId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Seed audit template if needed
    FiveSService.seedDefaultAuditTemplateIfNone(activeCompanyId);

    const unsub = FiveSService.subscribeProjects(activeCompanyId, (list) => {
      setProjects(list);
      setLoading(false);
    });

    return () => unsub();
  }, [activeCompanyId]);

  const plants = Array.from(new Set(projects.map(p => p.plantOrCenter).filter(Boolean)));

  const handleOpenCreateModal = async () => {
    if (!activeCompanyId) return;
    try {
      const nextCode = await FiveSService.getNextProjectCode(activeCompanyId);
      setCode(nextCode);
      setName('');
      setPlantOrCenter('Planta Principal');
      setAreaDepartment('');
      setDescription('');
      setObjectives('');
      setResponsible5S(dbUser?.name || '');
      setResponsibleId(dbUser?.uid || '');
      setStartDate(new Date().toISOString().split('T')[0]);
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      setTargetDate(d.toISOString().split('T')[0]);
      setInitialStatus('PLANNED');
      setIsCreateOpen(true);
    } catch (err) {
      console.error('Error prefetching project code:', err);
      setCode(`5S-001`);
      setIsCreateOpen(true);
    }
  };

  const handleOpenEditModal = (p: FiveSProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(p);
    setEditName(p.name);
    setEditPlant(p.plantOrCenter);
    setEditArea(p.areaDepartment || '');
    setEditDescription(p.description || '');
    setEditObjectives(p.objectives || '');
    setEditResponsible(p.responsible5S || p.responsibleName || '');
    setEditResponsibleId(p.responsibleId || '');
    setEditStartDate(p.startDate || '');
    setEditTargetDate(p.targetDate || '');
    setEditStatus(p.status || 'PLANNED');
    setEditPhase(p.currentPhase || 'Seiri');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !name.trim()) return;

    try {
      setIsSubmitting(true);
      const generatedCode = code.trim() || await FiveSService.getNextProjectCode(activeCompanyId);

      const newProjectId = await FiveSService.createProject({
        companyId: activeCompanyId,
        code: generatedCode,
        name: name.trim(),
        plantOrCenter: plantOrCenter.trim(),
        areaDepartment: areaDepartment.trim() || undefined,
        description: description.trim(),
        objectives: objectives.trim(),
        responsible5S: responsible5S.trim() || dbUser?.name || 'Responsable 5S',
        responsibleName: responsible5S.trim() || dbUser?.name || 'Responsable 5S',
        responsibleId: responsibleId || dbUser?.uid || '',
        startDate,
        targetDate,
        status: initialStatus,
        currentPhase: 'Seiri',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: dbUser?.uid || 'user',
        currentScore: 0,
      });

      toast.success('Proyecto 5S creado exitosamente');
      setIsCreateOpen(false);
      navigate(`/5s/projects/${newProjectId}`);
    } catch (err: any) {
      console.error('Error creating 5S project:', err);
      toast.error('Error al crear el proyecto: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      setIsSubmitting(true);
      await FiveSService.updateProject(editingProject.id, {
        name: editName.trim(),
        plantOrCenter: editPlant.trim(),
        areaDepartment: editArea.trim() || undefined,
        description: editDescription.trim(),
        objectives: editObjectives.trim(),
        responsible5S: editResponsible.trim(),
        responsibleName: editResponsible.trim(),
        responsibleId: editResponsibleId,
        startDate: editStartDate,
        targetDate: editTargetDate,
        status: editStatus,
        currentPhase: editPhase,
        updatedAt: new Date().toISOString()
      });

      toast.success('Proyecto 5S actualizado');
      setEditingProject(null);
    } catch (err: any) {
      toast.error('Error al actualizar el proyecto: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await FiveSService.deleteProject(projectToDelete.id);
      toast.success('Proyecto eliminado');
      setProjectToDelete(null);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  const filteredProjects = projects.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.plantOrCenter && p.plantOrCenter.toLowerCase().includes(term)) ||
      (p.areaDepartment && p.areaDepartment.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term));
    
    const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
    const matchesPhase = selectedPhase === 'ALL' || p.currentPhase === selectedPhase;
    const matchesPlant = selectedPlant === 'ALL' || p.plantOrCenter === selectedPlant;

    return matchesSearch && matchesStatus && matchesPhase && matchesPlant;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-300 via-indigo-300 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-200 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
              <Award size={14} /> Módulo 5S GoZEN
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Proyectos 5S</h1>
            <p className="text-blue-100/80 text-sm max-w-2xl mt-1.5 leading-relaxed">
              Gestión digital del ciclo completo de implantación, seguimiento, estandarización y auditoría 5S. Aislamiento estricto por empresa.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg transition-all hover:scale-102 active:scale-98 text-sm shrink-0"
          >
            <Plus size={18} />
            <span>Nuevo Proyecto 5S</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search bar */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, código (5S-001) o centro/planta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Estado filter */}
          <div className="md:col-span-4 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 shrink-0">Estado:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="PLANNED">Planificado</option>
              <option value="IMPLEMENTING">En implantación</option>
              <option value="STANDARDIZED">Estandarizado</option>
              <option value="MAINTENANCE">En mantenimiento</option>
              <option value="CLOSED">Cerrado</option>
            </select>
          </div>

          {/* Plant filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 shrink-0">Centro/Planta:</span>
            <select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              className="w-full text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Todas las Plantas</option>
              {plants.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Phase selector bar */}
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 hidden sm:inline">Fase 5S:</span>
            <FiveSPhaseSelector
              selectedPhase={selectedPhase}
              onSelectPhase={setSelectedPhase}
            />
          </div>
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'proyecto' : 'proyectos'}
          </span>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">Cargando proyectos 5S...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-xs max-w-lg mx-auto">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No hay proyectos 5S</h3>
          <p className="text-sm text-gray-500 mb-6">
            Comienza creando el primer proyecto 5S para tu centro o planta para arrancar con el ciclo de clasificación, orden y limpieza.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Crear Primer Proyecto 5S
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((p) => {
            const phaseMeta = FIVE_S_PHASES_META[p.currentPhase || 'Seiri'] || FIVE_S_PHASES_META['1S'];
            const hasEvaluatedScore = typeof p.currentScore === 'number' && p.currentScore > 0;

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/5s/projects/${p.id}`)}
                className="bg-white rounded-2xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 cursor-pointer p-6 flex flex-col justify-between group relative"
              >
                <div>
                  {/* Top Bar: Code, Phase, and Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                        {p.code || '5S-001'}
                      </span>
                      <span className={`${phaseMeta.badgeBg} text-[11px] font-bold px-2 py-0.5 rounded-md`}>
                        {p.currentPhase || 'Seiri'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <FiveSStatusBadge status={p.status || 'PLANNED'} size="sm" />

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditModal(p, e)}
                        className="text-gray-300 hover:text-blue-600 p-1 rounded-lg transition-colors"
                        title="Editar proyecto"
                      >
                        <Edit3 size={15} />
                      </button>

                      {/* Delete button for admin */}
                      {(isGlobalAdmin || isAdmin) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(p);
                          }}
                          className="text-gray-300 hover:text-red-600 p-1 rounded-lg transition-colors"
                          title="Eliminar proyecto"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Project Title */}
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight mb-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
                    {p.description || p.objectives || 'Sin descripción detallada del proyecto.'}
                  </p>

                  {/* Functional Metadata Grid */}
                  <div className="space-y-2 text-xs text-gray-600 bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <Building2 size={13} /> Centro / Planta:
                      </span>
                      <span className="font-semibold text-gray-800">{p.plantOrCenter}</span>
                    </div>

                    {p.areaDepartment && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          <MapPin size={13} /> Área:
                        </span>
                        <span className="font-semibold text-gray-800">{p.areaDepartment}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <UserCheck size={13} /> Responsable 5S:
                      </span>
                      <span className="font-semibold text-gray-800">{p.responsible5S || p.responsibleName || 'Sin asignar'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <Calendar size={13} /> Fechas:
                      </span>
                      <span className="font-medium text-gray-700">
                        {p.startDate || '—'} → {p.targetDate || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Evaluation state */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="text-gray-400">Evaluación de auditorías:</span>
                    {hasEvaluatedScore ? (
                      <span className="font-bold text-gray-900">{p.currentScore}%</span>
                    ) : (
                      <span className="italic text-gray-400">Sin evaluar</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Acceder al panel del proyecto</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal New 5S Project */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Crear Nuevo Proyecto 5S"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Código</label>
              <input
                type="text"
                readOnly
                value={code}
                placeholder="5S-001"
                className="w-full px-3 py-2 text-sm bg-gray-100 font-mono font-bold text-blue-700 border border-gray-200 rounded-xl outline-none cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del Proyecto 5S *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Implantación 5S - Línea de Montaje 1"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Centro / Planta *</label>
              <input
                type="text"
                required
                value={plantOrCenter}
                onChange={(e) => setPlantOrCenter(e.target.value)}
                placeholder="Ej: Factoría Norte / Almacén Central"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Área o Departamento *</label>
              <input
                type="text"
                required
                value={areaDepartment}
                onChange={(e) => setAreaDepartment(e.target.value)}
                placeholder="Ej: Mecanizado, Logística, Taller"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del alcance y situación actual del área de trabajo..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Objetivos</label>
            <textarea
              rows={2}
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="Objetivos específicos (orden, seguridad, ergonomía, reducción de tiempos de búsqueda...)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable 5S *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {companyUsers.length > 0 && (
                <select
                  onChange={(e) => {
                    const u = companyUsers.find(usr => usr.id === e.target.value || usr.uid === e.target.value);
                    if (u) {
                      setResponsible5S(u.name || '');
                      setResponsibleId(u.uid || u.id || '');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                >
                  <option value="">Seleccionar de usuarios de GoZEN...</option>
                  {companyUsers.map(u => (
                    <option key={u.id || u.uid} value={u.id || u.uid}>
                      {u.name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                required
                value={responsible5S}
                onChange={(e) => {
                  setResponsible5S(e.target.value);
                  setResponsibleId('');
                }}
                placeholder="Nombre del responsable 5S"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha de Inicio *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Objetivo de Finalización *</label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Estado Inicial</label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as FiveSProjectStatus)}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="DRAFT">Borrador</option>
                <option value="PLANNED">Planificado</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center justify-between">
            <span className="font-medium">Fase 5S Inicial:</span>
            <span className="font-bold bg-red-600 text-white px-2 py-0.5 rounded text-[11px]">
              Seiri (1S - Clasificar)
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Proyecto 5S'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit 5S Project */}
      {editingProject && (
        <Modal
          isOpen={Boolean(editingProject)}
          onClose={() => setEditingProject(null)}
          title={`Editar Proyecto 5S: ${editingProject.code || editingProject.name}`}
        >
          <form onSubmit={handleSaveEditProject} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del Proyecto *</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Centro / Planta *</label>
                <input
                  type="text"
                  required
                  value={editPlant}
                  onChange={(e) => setEditPlant(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Área o Departamento</label>
                <input
                  type="text"
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Objetivos</label>
              <textarea
                rows={2}
                value={editObjectives}
                onChange={(e) => setEditObjectives(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Responsable 5S</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {companyUsers.length > 0 && (
                  <select
                    onChange={(e) => {
                      const u = companyUsers.find(usr => usr.id === e.target.value || usr.uid === e.target.value);
                      if (u) {
                        setEditResponsible(u.name || '');
                        setEditResponsibleId(u.uid || u.id || '');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                  >
                    <option value="">Seleccionar de usuarios de GoZEN...</option>
                    {companyUsers.map(u => (
                      <option key={u.id || u.uid} value={u.id || u.uid}>
                        {u.name} {u.email ? `(${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  required
                  value={editResponsible}
                  onChange={(e) => {
                    setEditResponsible(e.target.value);
                    setEditResponsibleId('');
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Inicio</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Objetivo</label>
                <input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estado del Proyecto</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as FiveSProjectStatus)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="PLANNED">Planificado</option>
                  <option value="IMPLEMENTING">En implantación</option>
                  <option value="STANDARDIZED">Estandarizado</option>
                  <option value="MAINTENANCE">En mantenimiento</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fase Actual 5S</label>
                <select
                  value={editPhase}
                  onChange={(e) => setEditPhase(e.target.value as FiveSPhase)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Seiri">Seiri (1S - Clasificar)</option>
                  <option value="Seiton">Seiton (2S - Ordenar)</option>
                  <option value="Seiso">Seiso (3S - Limpiar)</option>
                  <option value="Seiketsu">Seiketsu (4S - Estandarizar)</option>
                  <option value="Shitsuke">Shitsuke (5S - Disciplina)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(projectToDelete)}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={handleDeleteProject}
        title="Eliminar Proyecto 5S"
        message={`¿Estás seguro de que deseas eliminar permanentemente el proyecto "${projectToDelete?.name}"? Esta acción borrará todas sus zonas, subzonas y configuraciones asociadas.`}
      />
    </div>
  );
}
