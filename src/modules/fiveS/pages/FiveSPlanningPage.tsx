import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  TrendingUp,
  BarChart2,
  CalendarDays,
  Check,
  X,
  Info,
  Maximize2,
  Minimize2,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { useFiveSPermissions } from '../hooks/useFiveSPermissions';
import { FiveSHeader } from '../components/FiveSHeader';
import { FiveSStatusBadge } from '../components/FiveSStatusBadge';
import { FiveSService } from '../services/fiveSService';
import { 
  FiveSDedication, 
  FiveSDayOfWeek,
  FiveSPlanningItem, 
  FiveSPlanningStatus,
  FiveSPhase, 
  FiveSZone, 
  FiveSSubzone 
} from '../types/fiveSTypes';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

const DAYS_OF_WEEK: FiveSDayOfWeek[] = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
];

const FIVE_S_PHASES_LIST: { id: FiveSPhase; label: string; number: string; bg: string; text: string; border: string; barColor: string; order: number }[] = [
  { id: 'Seiri', label: '1S Seiri', number: '1S', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', barColor: 'bg-red-500', order: 1 },
  { id: 'Seiton', label: '2S Seiton', number: '2S', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', barColor: 'bg-amber-500', order: 2 },
  { id: 'Seiso', label: '3S Seiso', number: '3S', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', barColor: 'bg-blue-500', order: 3 },
  { id: 'Seiketsu', label: '4S Seiketsu', number: '4S', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', barColor: 'bg-purple-500', order: 4 },
  { id: 'Shitsuke', label: '5S Shitsuke', number: '5S', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', barColor: 'bg-emerald-500', order: 5 },
];

function getPhaseOrder(phaseStr: string | undefined): number {
  if (!phaseStr) return 99;
  const p = String(phaseStr).toUpperCase();
  if (p.includes('1S') || p.includes('SEIRI')) return 1;
  if (p.includes('2S') || p.includes('SEITON')) return 2;
  if (p.includes('3S') || p.includes('SEISO')) return 3;
  if (p.includes('4S') || p.includes('SEIKETSU')) return 4;
  if (p.includes('5S') || p.includes('SHITSUKE')) return 5;
  return 99;
}

function calculateDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const totalStartMinutes = sh * 60 + sm;
  const totalEndMinutes = eh * 60 + em;
  const diffMinutes = totalEndMinutes - totalStartMinutes;
  if (diffMinutes <= 0) return 0;
  return Number((diffMinutes / 60).toFixed(2));
}

function calculateDurationDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
  return diffDays > 0 ? diffDays : 1;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function FiveSPlanningPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId } = useAuth();
  const { 
    project, 
    members, 
    zones, 
    subzones, 
    dedications, 
    planningItems, 
    loading 
  } = useFiveSProject(projectId);
  const permissions = useFiveSPermissions(project, members);

  // Active members strictly belonging to activeCompanyId and project
  const activeMembers = useMemo(() => {
    return members.filter(m => m.active !== false && m.isActive !== false);
  }, [members]);

  // ===================== TARGET DURATION PARAMETER =====================
  const [targetDurationWeeks, setTargetDurationWeeks] = useState<number>(() => {
    return project?.targetDurationWeeksPerZone || 3;
  });
  const [isUpdatingTargetDuration, setIsUpdatingTargetDuration] = useState(false);

  // Keep in sync with project doc if loaded
  React.useEffect(() => {
    if (project?.targetDurationWeeksPerZone) {
      setTargetDurationWeeks(project.targetDurationWeeksPerZone);
    }
  }, [project?.targetDurationWeeksPerZone]);

  const handleSaveTargetDuration = async (weeks: number) => {
    if (!project || !activeCompanyId || weeks <= 0) return;
    try {
      setIsUpdatingTargetDuration(true);
      await FiveSService.updateProject(project.id, {
        targetDurationWeeksPerZone: weeks
      });
      setTargetDurationWeeks(weeks);
      toast.success('Referencia orientativa guardada en el proyecto.');
    } catch (err) {
      console.error('Error saving target duration:', err);
      toast.error('Error al guardar la duración orientativa.');
    } finally {
      setIsUpdatingTargetDuration(false);
    }
  };

  // ===================== DEDICATION STATE =====================
  const [isDedicationModalOpen, setIsDedicationModalOpen] = useState(false);
  const [editingDedication, setEditingDedication] = useState<FiveSDedication | null>(null);
  const [dedDayOfWeek, setDedDayOfWeek] = useState<FiveSDayOfWeek>('Martes');
  const [dedStartTime, setDedStartTime] = useState('10:00');
  const [dedEndTime, setDedEndTime] = useState('12:00');
  const [dedParticipants, setDedParticipants] = useState<string[]>([]);
  const [dedicationToDelete, setDedicationToDelete] = useState<FiveSDedication | null>(null);
  const [isSavingDedication, setIsSavingDedication] = useState(false);

  // Computed session duration in modal
  const modalSessionDuration = useMemo(() => {
    return calculateDurationHours(dedStartTime, dedEndTime);
  }, [dedStartTime, dedEndTime]);

  // ===================== CAPACITY CALCULATIONS =====================
  const capacityStats = useMemo(() => {
    let totalTeamHoursWeekly = 0;
    
    dedications.forEach(ded => {
      const dur = ded.sessionDurationHours || calculateDurationHours(ded.startTime, ded.endTime);
      const pCount = ded.participantIds?.length || 0;
      totalTeamHoursWeekly += dur * pCount;
    });

    const activeMembersCount = activeMembers.length || 1;
    const avgHoursPerPersonWeekly = Number((totalTeamHoursWeekly / activeMembersCount).toFixed(1));

    // Horizon in weeks based on project.startDate and project.targetDate
    let projectWeeks = 4;
    if (project?.startDate && project?.targetDate) {
      const s = new Date(project.startDate);
      const e = new Date(project.targetDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const diffMs = e.getTime() - s.getTime();
        const diffWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);
        if (diffWeeks > 0) {
          projectWeeks = Math.max(1, Math.round(diffWeeks));
        }
      }
    }

    // Horas acumuladas disponibles dentro del periodo del proyecto
    const totalAccumulatedHours = Number((totalTeamHoursWeekly * projectWeeks).toFixed(1));

    // Dedicación planificada vs realizada (realizada estrictamente 0 si no hay ejecución registrada)
    const totalPlannedHours = planningItems.reduce((acc, curr) => acc + (curr.plannedHours || 0), 0);
    const totalActualHours = planningItems.reduce((acc, curr) => acc + (curr.actualHours || 0), 0);
    const deviation = Number((totalActualHours - totalPlannedHours).toFixed(1));

    return {
      totalTeamHoursWeekly: Number(totalTeamHoursWeekly.toFixed(1)),
      avgHoursPerPersonWeekly,
      projectWeeks,
      totalAccumulatedHours,
      totalPlannedHours: Number(totalPlannedHours.toFixed(1)),
      totalActualHours: Number(totalActualHours.toFixed(1)),
      deviation
    };
  }, [dedications, activeMembers, project, planningItems]);

  // ===================== PLANNING ACTIVITY STATE =====================
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<FiveSPlanningItem | null>(null);
  const [actZoneId, setActZoneId] = useState('');
  const [actSubzoneId, setActSubzoneId] = useState('');
  const [actTitle, setActTitle] = useState('');
  const [actPhase, setActPhase] = useState<FiveSPhase>('Seiri');
  const [actResponsibleId, setActResponsibleId] = useState('');
  const [actStartDate, setActStartDate] = useState(project?.startDate || new Date().toISOString().split('T')[0]);
  const [actEndDate, setActEndDate] = useState(project?.targetDate || new Date().toISOString().split('T')[0]);
  const [actPlannedHours, setActPlannedHours] = useState('10');
  const [actProgress, setActProgress] = useState(0);
  const [actDescription, setActDescription] = useState('');
  const [activityToDelete, setActivityToDelete] = useState<FiveSPlanningItem | null>(null);
  const [isSavingActivity, setIsSavingActivity] = useState(false);

  // Modal duration calculation
  const modalActivityDurationDays = useMemo(() => {
    return calculateDurationDays(actStartDate, actEndDate);
  }, [actStartDate, actEndDate]);

  // Subzones filtered by currently selected zone in modal
  const modalAvailableSubzones = useMemo(() => {
    if (!actZoneId) return [];
    return subzones.filter(s => s.zoneId === actZoneId);
  }, [subzones, actZoneId]);

  // ===================== FULLSCREEN GANTT MODAL =====================
  const [isFullScreenGanttOpen, setIsFullScreenGanttOpen] = useState(false);

  // ===================== FILTERS STATE =====================
  const [filterZoneId, setFilterZoneId] = useState('ALL');
  const [filterPhase, setFilterPhase] = useState('ALL');
  const [filterResponsibleId, setFilterResponsibleId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Filtered planning items
  const filteredActivities = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return planningItems.filter(item => {
      // Zone filter
      if (filterZoneId !== 'ALL' && item.zoneId !== filterZoneId) return false;

      // Phase filter
      if (filterPhase !== 'ALL') {
        const itemPhaseNorm = String(item.phase || item.sPhase || '').toUpperCase();
        const targetPhaseNorm = filterPhase.toUpperCase();
        if (!itemPhaseNorm.includes(targetPhaseNorm)) return false;
      }

      // Responsible filter
      if (filterResponsibleId !== 'ALL' && (item.responsibleId || item.assignedTo) !== filterResponsibleId) return false;

      // Status filter
      if (filterStatus !== 'ALL') {
        const isDelayed = todayStr > item.endDate && (item.progress || 0) < 100;
        const isCompleted = (item.progress || 0) >= 100;
        if (filterStatus === 'DELAYED' && !isDelayed) return false;
        if (filterStatus === 'COMPLETED' && !isCompleted) return false;
        if (filterStatus === 'IN_PROGRESS' && (isCompleted || isDelayed || (item.progress || 0) === 0)) return false;
        if (filterStatus === 'NOT_STARTED' && (item.progress || 0) > 0) return false;
      }

      return true;
    });
  }, [planningItems, filterZoneId, filterPhase, filterResponsibleId, filterStatus]);

  // ===================== GANTT DATE SCALE =====================
  const ganttScale = useMemo(() => {
    let minDate = project?.startDate || new Date().toISOString().split('T')[0];
    let maxDate = project?.targetDate || addDaysToDate(minDate, 30);

    planningItems.forEach(item => {
      if (item.startDate && item.startDate < minDate) minDate = item.startDate;
      if (item.endDate && item.endDate > maxDate) maxDate = item.endDate;
    });

    const startObj = new Date(minDate);
    const endObj = new Date(maxDate);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || endObj < startObj) {
      endObj.setTime(startObj.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const days: { dateStr: string; label: string; dayNum: number; isWeekend: boolean }[] = [];
    const curr = new Date(startObj);
    while (curr <= endObj) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayNum = curr.getDate();
      const dayOfWeek = curr.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      days.push({
        dateStr,
        label: `${dayNum}`,
        dayNum,
        isWeekend
      });
      curr.setDate(curr.getDate() + 1);
    }

    return {
      minDate,
      maxDate,
      totalDays: days.length,
      days
    };
  }, [planningItems, project]);

  // Collapsed zones in Gantt
  const [collapsedGanttZones, setCollapsedGanttZones] = useState<Record<string, boolean>>({});

  const toggleGanttZone = (zoneId: string) => {
    setCollapsedGanttZones(prev => ({
      ...prev,
      [zoneId]: !prev[zoneId]
    }));
  };

  // Grouped activities by Zone for hierarchical Gantt with STRICT HIERARCHY: Zona -> Subzona -> Fase 5S -> Actividad (fecha inicio asc)
  const activitiesByZone = useMemo(() => {
    const sortActivitiesStrict = (items: FiveSPlanningItem[]) => {
      return [...items].sort((a, b) => {
        // 1. Subzona hierarchy (general/sin subzona primero, o por código/nombre de subzona)
        const subA = a.subzoneCode || a.subzoneName || '';
        const subB = b.subzoneCode || b.subzoneName || '';
        if (subA !== subB) {
          if (!subA) return -1;
          if (!subB) return 1;
          const subComp = subA.localeCompare(subB);
          if (subComp !== 0) return subComp;
        }

        // 2. Fase 5S obligatoria: 1S Seiri -> 2S Seiton -> 3S Seiso -> 4S Seiketsu -> 5S Shitsuke
        const orderA = getPhaseOrder(a.phase || (a.sPhase as string));
        const orderB = getPhaseOrder(b.phase || (b.sPhase as string));
        if (orderA !== orderB) return orderA - orderB;

        // 3. Fecha de inicio ascendente
        const dateComp = (a.startDate || '').localeCompare(b.startDate || '');
        if (dateComp !== 0) return dateComp;

        // 4. Nombre de actividad
        return (a.title || a.activity || '').localeCompare(b.title || b.activity || '');
      });
    };

    const groups: {
      zone: FiveSZone | null;
      zoneId: string;
      zoneName: string;
      zoneCode: string;
      items: FiveSPlanningItem[];
    }[] = [];

    // Ordenar zonas por código (Z-01, Z-02...)
    const sortedZones = [...zones].sort((za, zb) => (za.code || '').localeCompare(zb.code || ''));

    sortedZones.forEach(zone => {
      const rawItems = filteredActivities.filter(a => a.zoneId === zone.id);
      groups.push({
        zone,
        zoneId: zone.id,
        zoneName: zone.name,
        zoneCode: zone.code,
        items: sortActivitiesStrict(rawItems)
      });
    });

    // Actividades sin zona asignada (generales del proyecto)
    const unassigned = filteredActivities.filter(a => !a.zoneId || !zones.some(z => z.id === a.zoneId));
    if (unassigned.length > 0) {
      groups.push({
        zone: null,
        zoneId: 'unassigned',
        zoneName: 'Actividades Generales del Proyecto',
        zoneCode: 'GEN',
        items: sortActivitiesStrict(unassigned)
      });
    }

    return groups;
  }, [zones, filteredActivities]);

  // Actualización directa del porcentaje de avance (0 a 100%) sin incrementos cíclicos
  const handleUpdateActivityProgress = async (act: FiveSPlanningItem, newProgress: number) => {
    if (!permissions.canManagePlanning) return;
    const progressNum = Math.min(100, Math.max(0, newProgress));
    const todayStr = new Date().toISOString().split('T')[0];

    let computedStatus: FiveSPlanningStatus = 'IN_PROGRESS';
    if (progressNum >= 100) {
      computedStatus = 'COMPLETED';
    } else if (todayStr > act.endDate) {
      computedStatus = 'DELAYED';
    } else if (progressNum === 0) {
      computedStatus = 'NOT_STARTED';
    }

    try {
      await FiveSService.updatePlanningItem(act.id, {
        progress: progressNum,
        status: computedStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error al actualizar avance:', err);
      toast.error('Error al actualizar el avance de la actividad.');
    }
  };

  // ===================== DEDICATION HANDLERS =====================
  const handleOpenAddDedication = () => {
    setEditingDedication(null);
    setDedDayOfWeek('Martes');
    setDedStartTime('10:00');
    setDedEndTime('12:00');
    setDedParticipants(activeMembers.slice(0, 4).map(m => m.userId || m.id));
    setIsDedicationModalOpen(true);
  };

  const handleOpenEditDedication = (ded: FiveSDedication) => {
    setEditingDedication(ded);
    setDedDayOfWeek(ded.dayOfWeek);
    setDedStartTime(ded.startTime);
    setDedEndTime(ded.endTime);
    setDedParticipants(ded.participantIds || []);
    setIsDedicationModalOpen(true);
  };

  const handleToggleDedParticipant = (userId: string) => {
    setDedParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSaveDedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !activeCompanyId) return;

    const duration = calculateDurationHours(dedStartTime, dedEndTime);
    if (duration <= 0) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    if (dedParticipants.length === 0) {
      toast.error('Selecciona al menos un miembro participante del equipo.');
      return;
    }

    try {
      setIsSavingDedication(true);
      const participantNames = activeMembers
        .filter(m => dedParticipants.includes(m.userId || m.id))
        .map(m => m.name || m.userName || 'Miembro');

      const payload = {
        companyId: activeCompanyId,
        projectId: project.id,
        dayOfWeek: dedDayOfWeek,
        startTime: dedStartTime,
        endTime: dedEndTime,
        sessionDurationHours: duration,
        weeklySessionsCount: 1,
        participantIds: dedParticipants,
        participantNames,
        hoursPerParticipantWeekly: duration,
        totalTeamHoursWeekly: Number((duration * dedParticipants.length).toFixed(2))
      };

      if (editingDedication) {
        await FiveSService.updateDedication(editingDedication.id, payload);
        toast.success('Franja de dedicación actualizada.');
      } else {
        await FiveSService.addDedication(payload);
        toast.success('Franja de dedicación añadida.');
      }

      setIsDedicationModalOpen(false);
    } catch (err: any) {
      console.error('Error saving dedication:', err);
      toast.error('Error al guardar la franja de dedicación.');
    } finally {
      setIsSavingDedication(false);
    }
  };

  const handleConfirmDeleteDedication = async () => {
    if (!dedicationToDelete) return;
    try {
      await FiveSService.deleteDedication(dedicationToDelete.id);
      toast.success('Franja de dedicación eliminada.');
      setDedicationToDelete(null);
    } catch (err) {
      console.error('Error deleting dedication:', err);
      toast.error('Error al eliminar franja.');
    }
  };

  // ===================== ACTIVITY HANDLERS =====================
  const handleOpenAddActivity = (presetZoneId?: string, presetPhase?: FiveSPhase) => {
    setEditingActivity(null);
    setActZoneId(presetZoneId || (zones[0]?.id || ''));
    setActSubzoneId('');
    setActTitle('');
    setActPhase(presetPhase || 'Seiri');
    setActResponsibleId(activeMembers[0]?.userId || activeMembers[0]?.id || '');
    setActStartDate(project?.startDate || new Date().toISOString().split('T')[0]);
    setActEndDate(project?.targetDate ? addDaysToDate(project.startDate || new Date().toISOString().split('T')[0], 14) : addDaysToDate(new Date().toISOString().split('T')[0], 14));
    setActPlannedHours('8');
    setActProgress(0);
    setActDescription('');
    setIsActivityModalOpen(true);
  };

  const handleOpenEditActivity = (act: FiveSPlanningItem) => {
    setEditingActivity(act);
    setActZoneId(act.zoneId || '');
    setActSubzoneId(act.subzoneId || '');
    setActTitle(act.title || act.activity || '');
    setActPhase((act.phase as FiveSPhase) || act.sPhase || 'Seiri');
    setActResponsibleId(act.responsibleId || act.assignedTo || '');
    setActStartDate(act.startDate);
    setActEndDate(act.endDate);
    setActPlannedHours(String(act.plannedHours || 8));
    setActProgress(act.progress || 0);
    setActDescription(act.description || '');
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !activeCompanyId || !actTitle.trim()) {
      toast.error('Indica el nombre de la actividad.');
      return;
    }

    if (actStartDate > actEndDate) {
      toast.error('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }

    const progressNum = Math.min(100, Math.max(0, Number(actProgress) || 0));
    const durationDays = calculateDurationDays(actStartDate, actEndDate);
    const todayStr = new Date().toISOString().split('T')[0];

    // Status: 100% -> Completada. Si hoy > endDate y <100% -> Retrasada. 0% -> No iniciada. 0-100% -> En curso.
    let computedStatus: FiveSPlanningStatus = 'IN_PROGRESS';
    if (progressNum >= 100) {
      computedStatus = 'COMPLETED';
    } else if (todayStr > actEndDate) {
      computedStatus = 'DELAYED';
    } else if (progressNum === 0) {
      computedStatus = 'NOT_STARTED';
    }

    const selZone = zones.find(z => z.id === actZoneId);
    const selSubzone = subzones.find(s => s.id === actSubzoneId);
    const selResp = activeMembers.find(m => (m.userId || m.id) === actResponsibleId);

    try {
      setIsSavingActivity(true);
      const payload: Partial<FiveSPlanningItem> = {
        companyId: activeCompanyId,
        projectId: project.id,
        zoneId: actZoneId || undefined,
        zoneName: selZone?.name,
        zoneCode: selZone?.code,
        subzoneId: actSubzoneId || undefined,
        subzoneName: selSubzone?.name,
        subzoneCode: selSubzone?.code,
        title: actTitle.trim(),
        activity: actTitle.trim(),
        phase: actPhase,
        sPhase: actPhase,
        responsibleId: actResponsibleId,
        responsibleName: selResp?.name || selResp?.userName,
        assignedTo: actResponsibleId,
        assignedName: selResp?.name || selResp?.userName,
        startDate: actStartDate,
        endDate: actEndDate,
        durationDays,
        progress: progressNum,
        status: computedStatus,
        plannedHours: Number(actPlannedHours) || 0,
        // actualHours remains read-only at 0 or preserved from existing document
        actualHours: editingActivity?.actualHours || 0,
        description: actDescription.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingActivity) {
        await FiveSService.updatePlanningItem(editingActivity.id, payload);
        toast.success('Actividad actualizada.');
      } else {
        await FiveSService.addPlanningItem({
          ...payload as any,
          actualHours: 0,
          createdAt: new Date().toISOString()
        });
        toast.success('Actividad planificada.');
      }

      setIsActivityModalOpen(false);
    } catch (err: any) {
      console.error('Error saving activity:', err);
      toast.error('Error al guardar la actividad.');
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleConfirmDeleteActivity = async () => {
    if (!activityToDelete) return;
    try {
      await FiveSService.deletePlanningItem(activityToDelete.id);
      toast.success('Actividad eliminada.');
      setActivityToDelete(null);
    } catch (err) {
      console.error('Error deleting activity:', err);
      toast.error('Error al eliminar actividad.');
    }
  };

  // Reusable Gantt Chart Renderer
  const renderGanttContent = (isFullScreen: boolean = false) => {
    return (
      <div className="overflow-x-auto">
        <div className={isFullScreen ? "min-w-[1200px]" : "min-w-[950px]"}>
          {/* GANTT HEADER ROW */}
          <div className="flex border-b border-gray-200 bg-slate-50/90 text-xs font-bold text-gray-700 sticky top-0 z-10">
            <div className="w-[340px] p-3 border-r border-gray-200 shrink-0">
              Actividad / Zona / Responsable
            </div>
            <div className="w-[95px] p-3 text-center border-r border-gray-200 shrink-0">
              Fase 5S
            </div>
            <div className="w-[90px] p-3 text-center border-r border-gray-200 shrink-0">
              Fechas
            </div>
            <div className="w-[100px] p-3 text-center border-r border-gray-200 shrink-0">
              Avance
            </div>
            <div className="w-[85px] p-3 text-center border-r border-gray-200 shrink-0">
              Estado
            </div>
            <div className="flex-1 p-3 flex items-center justify-between text-[11px] text-gray-500">
              <span>Cronograma ({ganttScale.minDate} → {ganttScale.maxDate})</span>
              <span className="text-[10px] text-gray-400">Doble clic sobre barra o fila para editar</span>
            </div>
          </div>

          {/* GANTT ROWS GROUPED BY ZONE */}
          <div className="divide-y divide-gray-100">
            {activitiesByZone.map(group => {
              if (group.items.length === 0) return null;
              const isCollapsed = collapsedGanttZones[group.zoneId];

              return (
                <div key={group.zoneId} className="bg-white">
                  {/* Zone Header Row (Sin botones duplicados de creación) */}
                  <div 
                    onClick={() => toggleGanttZone(group.zoneId)}
                    className="flex items-center justify-between px-4 py-2 bg-slate-50/70 hover:bg-slate-100/80 cursor-pointer border-b border-slate-100 transition"
                  >
                    <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-mono text-[10px]">
                        {group.zoneCode}
                      </span>
                      <span>{group.zoneName}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        ({group.items.length} {group.items.length === 1 ? 'actividad' : 'actividades'})
                      </span>
                    </div>
                  </div>

                  {/* Activities list for this zone (Jerarquía: Zona -> Subzona -> Fase -> Actividad) */}
                  {!isCollapsed && group.items.map((act, actIdx) => {
                    const prevAct = actIdx > 0 ? group.items[actIdx - 1] : null;
                    const isNewSubzone = !prevAct || prevAct.subzoneId !== act.subzoneId;

                    const todayStr = new Date().toISOString().split('T')[0];
                    const isDelayed = todayStr > act.endDate && (act.progress || 0) < 100;
                    const isCompleted = (act.progress || 0) >= 100;
                    const isInProgress = (act.progress || 0) > 0 && !isCompleted && !isDelayed;

                    const phaseConfig = FIVE_S_PHASES_LIST.find(p => 
                      p.id === act.phase || 
                      p.number === act.phase || 
                      p.id === act.sPhase
                    ) || FIVE_S_PHASES_LIST[0];

                    const startIdx = ganttScale.days.findIndex(d => d.dateStr === act.startDate);
                    const endIdx = ganttScale.days.findIndex(d => d.dateStr === act.endDate);
                    const safeStartIdx = startIdx >= 0 ? startIdx : 0;
                    const safeEndIdx = endIdx >= 0 ? endIdx : ganttScale.days.length - 1;
                    const leftPct = ((safeStartIdx) / ganttScale.totalDays) * 100;
                    const widthPct = Math.max(3, (((safeEndIdx - safeStartIdx + 1)) / ganttScale.totalDays) * 100);

                    return (
                      <React.Fragment key={act.id}>
                        {/* Subzona separator for strict hierarchy: Zona -> Subzona -> Fase -> Actividad */}
                        {isNewSubzone && act.subzoneName && (
                          <div className="flex items-center gap-2 px-6 py-1.5 bg-slate-50/80 border-b border-gray-100 text-[11px] font-bold text-slate-700">
                            <Layers size={13} className="text-indigo-600" />
                            <span>Subzona / Puesto:</span>
                            <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {act.subzoneCode ? `${act.subzoneCode} - ` : ''}{act.subzoneName}
                            </span>
                          </div>
                        )}

                        <div 
                          onDoubleClick={() => handleOpenEditActivity(act)}
                          className="flex items-center border-b border-gray-100 hover:bg-slate-50/60 transition-colors py-2 text-xs select-none"
                        >
                          {/* Title / Responsible / Subzone */}
                          <div className="w-[340px] px-3 shrink-0">
                            <div className="flex items-center gap-1.5 font-bold text-gray-900 truncate">
                              <span className="truncate">{act.title || act.activity}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                              {act.subzoneName && (
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 text-[10px] font-medium">
                                  {act.subzoneCode ? `${act.subzoneCode} ` : ''}{act.subzoneName}
                                </span>
                              )}
                              <span className="truncate">
                                Resp: <strong className="text-gray-700">{act.responsibleName || act.assignedName || 'Sin asignar'}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Phase 5S badge */}
                          <div className="w-[95px] px-2 text-center shrink-0">
                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md border ${phaseConfig.bg} ${phaseConfig.text} ${phaseConfig.border}`}>
                              {phaseConfig.number} {phaseConfig.id}
                            </span>
                          </div>

                          {/* Dates & duration */}
                          <div className="w-[90px] px-2 text-center shrink-0 text-[11px] text-gray-600">
                            <div className="font-semibold">{act.durationDays || calculateDurationDays(act.startDate, act.endDate)} d</div>
                            <div className="text-[10px] text-gray-400 truncate" title={`${act.startDate} → ${act.endDate}`}>
                              {act.startDate.slice(5)}/{act.endDate.slice(5)}
                            </div>
                          </div>

                          {/* Avance (editable directamente 0-100% sin saltos cíclicos) */}
                          <div className="w-[100px] px-2 text-center shrink-0">
                            <div className="flex items-center justify-center">
                              {permissions.canManagePlanning ? (
                                <div className="inline-flex items-center bg-white border border-gray-200 hover:border-indigo-400 rounded-md px-1 py-0.5 shadow-2xs">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    defaultValue={act.progress || 0}
                                    key={`${act.id}-${act.progress}`}
                                    onBlur={(e) => {
                                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                      if (val !== (act.progress || 0)) {
                                        handleUpdateActivityProgress(act, val);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const input = e.currentTarget;
                                        const val = Math.min(100, Math.max(0, parseInt(input.value) || 0));
                                        input.blur();
                                      }
                                    }}
                                    className="w-10 text-center font-bold text-gray-800 text-[11px] p-0 border-0 focus:ring-0 focus:outline-hidden"
                                    title="Editar avance (0 a 100%). Pulsa Enter o sal del campo para guardar."
                                  />
                                  <span className="text-[10px] font-bold text-gray-400 select-none">%</span>
                                </div>
                              ) : (
                                <div className="font-bold text-gray-800 text-[11px]">{act.progress || 0}%</div>
                              )}
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isCompleted 
                                    ? 'bg-emerald-500' 
                                    : isDelayed 
                                      ? 'bg-red-500' 
                                      : 'bg-indigo-600'
                                }`}
                                style={{ width: `${act.progress || 0}%` }}
                              />
                            </div>
                          </div>

                        {/* Semantic Status Badge */}
                        <div className="w-[85px] px-2 text-center shrink-0">
                          {isCompleted ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completada
                            </span>
                          ) : isDelayed ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center justify-center gap-0.5">
                              <AlertCircle size={10} /> Retrasada
                            </span>
                          ) : isInProgress ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              En curso
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              No iniciada
                            </span>
                          )}
                        </div>

                        {/* Gantt Bar Visualization */}
                        <div className="flex-1 px-4 relative h-10 flex items-center">
                          <div className="absolute inset-0 flex pointer-events-none opacity-20">
                            {ganttScale.days.filter((_, i) => i % 5 === 0).map((d, i) => (
                              <div key={i} className="flex-1 border-r border-gray-300 h-full" />
                            ))}
                          </div>

                          {/* The Gantt Bar */}
                          <div
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditActivity(act);
                            }}
                            className={`absolute h-6 rounded-lg transition-all duration-200 flex items-center justify-between px-2 text-white shadow-xs cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-indigo-400 ${
                              isCompleted 
                                ? 'bg-emerald-500 hover:bg-emerald-600' 
                                : isDelayed 
                                  ? 'bg-red-500 hover:bg-red-600' 
                                  : phaseConfig.barColor
                            }`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`
                            }}
                            title={`${act.title} (${act.startDate} → ${act.endDate}) - ${act.progress}%. Doble clic para editar.`
                            }
                          >
                            <span className="text-[10px] font-bold truncate pr-1">
                              {act.title}
                            </span>
                          </div>

                          {/* Action edit/delete on right edge */}
                          {permissions.canManagePlanning && (
                            <div className="ml-auto flex items-center gap-1 z-10 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded-lg border border-gray-100 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleOpenEditActivity(act)}
                                className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                                title="Editar actividad"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setActivityToDelete(act)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded"
                                title="Eliminar actividad"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Cargando disponibilidad y planificación 5S...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 max-w-md mx-auto my-12">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Proyecto no encontrado</h3>
        <p className="text-sm text-gray-500">El proyecto no existe en la empresa activa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 5S MODULE HEADER (WITHOUT GLOBAL SAFARI 5S BUTTON) */}
      <FiveSHeader project={project} zones={zones} subzones={subzones} activeTab="planning" />

      {/* TOP OVERVIEW BANNER (CLEANED - NO DUPLICATE BUTTONS) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
              Fase 2 · Capacidad y Cronograma
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Horizonte del proyecto: {capacityStats.projectWeeks} semanas ({project.startDate} → {project.targetDate})
            </span>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Calendar className="text-indigo-600" size={24} />
            Planificación y Gantt de Implantación 5S
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Flujo estructurado: define la disponibilidad del equipo, calcula la capacidad real semanal y programa las actividades por zona y fase 5S.
          </p>
        </div>

        {/* PARÁMETRO ORIENTATIVO DE IMPLANTACIÓN (PUNTO 11) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3 shrink-0">
          <div>
            <span className="text-[11px] font-bold text-slate-700 block">
              Duración orientativa por zona/subzona:
            </span>
            <span className="text-[10px] text-slate-400">Referencia de planificación</span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="52"
              value={targetDurationWeeks}
              onChange={e => setTargetDurationWeeks(Math.max(1, parseInt(e.target.value) || 1))}
              onBlur={() => handleSaveTargetDuration(targetDurationWeeks)}
              disabled={isUpdatingTargetDuration || !permissions.canManagePlanning}
              className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-600">semanas</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BLOQUE A: DISPONIBILIDAD Y DEDICACIÓN DEL EQUIPO                          */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
              A
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Disponibilidad, Dedicación y Capacidad</h3>
              <p className="text-xs text-gray-500">Franjas semanales y cómputo de horas-persona del equipo</p>
            </div>
          </div>

          {/* ÚNICO PUNTO DE CREACIÓN BLOQUE A (PUNTO 1) */}
          {permissions.canManagePlanning && (
            <button
              onClick={handleOpenAddDedication}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-xs transition"
            >
              <Plus size={14} />
              + Añadir Franja Semanal
            </button>
          )}
        </div>

        {/* RESUMEN DE CAPACIDAD (KPIs INEQUÍVOCOS - PUNTO 2) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-snug">
              DEDICACIÓN MEDIA POR PERSONA
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-gray-900">
                {capacityStats.avgHoursPerPersonWeekly}
              </span>
              <span className="text-xs font-bold text-indigo-700 ml-1">
                h/persona/semana
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Promedio semanal</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider leading-snug">
              CAPACIDAD TOTAL DEL EQUIPO
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-indigo-600">
                {capacityStats.totalTeamHoursWeekly}
              </span>
              <span className="text-xs font-bold text-indigo-700 ml-1">
                h-persona/semana
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Suma franjas semanales</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-snug">
              CAPACIDAD ACUMULADA DEL PROYECTO
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-gray-900">
                {capacityStats.totalAccumulatedHours}
              </span>
              <span className="text-xs font-bold text-gray-600 ml-1">
                h-persona
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Horizonte ({capacityStats.projectWeeks} semanas)</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider leading-snug">
              HORAS PLANIFICADAS
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-blue-600">
                {capacityStats.totalPlannedHours}
              </span>
              <span className="text-xs font-bold text-blue-700 ml-1">
                h
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Suma de actividades</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider leading-snug">
              HORAS REALIZADAS
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-600">
                {capacityStats.totalActualHours}
              </span>
              <span className="text-xs font-bold text-emerald-700 ml-1">
                h
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Solo lectura (ejecución real)</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-snug">
              DESVIACIÓN
            </div>
            <div className="mt-2">
              <span className={`text-2xl font-black ${
                capacityStats.deviation > 0 
                  ? 'text-amber-600' 
                  : capacityStats.deviation < 0 
                    ? 'text-blue-600' 
                    : 'text-gray-900'
              }`}>
                {capacityStats.deviation > 0 ? `+${capacityStats.deviation}` : capacityStats.deviation}
              </span>
              <span className="text-xs font-bold text-gray-600 ml-1">
                h
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Realizadas - Planificadas</div>
          </div>
        </div>

        {/* FRANJAS SEMANALES CONFIGURADAS (PUNTO 3) */}
        {dedications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
            <Clock className="w-10 h-10 mx-auto text-indigo-400 mb-2" />
            <h4 className="text-sm font-bold text-gray-900">No hay franjas de dedicación configuradas</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Define las franjas semanales mediante el botón "+ Añadir Franja Semanal" para computar la capacidad disponible del equipo 5S.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dedications.map(ded => {
              const dur = ded.sessionDurationHours || calculateDurationHours(ded.startTime, ded.endTime);
              const pCount = ded.participantIds?.length || 0;
              const teamHours = Number((dur * pCount).toFixed(1));

              return (
                <div
                  key={ded.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200">
                          {ded.dayOfWeek}
                        </span>
                        <span className="text-xs font-bold text-gray-800">
                          {ded.startTime} – {ded.endTime}
                        </span>
                      </div>

                      {permissions.canManagePlanning && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditDedication(ded)}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded transition"
                            title="Editar franja"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => setDedicationToDelete(ded)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                            title="Eliminar franja"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CAPACIDAD DE ESTA FRANJA (PUNTO 3) */}
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 my-2 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Duración de la sesión:</span>
                        <strong className="text-slate-900 font-bold">{dur} horas</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Participantes:</span>
                        <strong className="text-slate-900 font-bold">{pCount}</strong>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-indigo-900">
                        <span className="font-semibold">Capacidad de esta franja:</span>
                        <strong className="text-indigo-700 font-black text-sm">{teamHours} horas-persona</strong>
                      </div>
                    </div>

                    <div className="mt-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Participantes ({pCount})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ded.participantNames && ded.participantNames.length > 0 ? (
                          ded.participantNames.map((name, idx) => (
                            <span 
                              key={idx}
                              className="text-[11px] font-medium bg-white text-gray-700 border border-gray-200 px-2 py-0.5 rounded-md"
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">
                            {pCount} integrantes seleccionados
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
                    <span>1 sesión semanal</span>
                    <span>{teamHours * 4} h-persona/mes aprox.</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* BLOQUE B: GANTT DE IMPLANTACIÓN 5S                                        */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
              B
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Gantt de Implantación 5S</h3>
              <p className="text-xs text-gray-500">Cronograma jerárquico (Zona → Subzona → 1S Seiri a 5S Shitsuke)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÓN VER GANTT COMPLETO (PUNTO 8) */}
            <button
              onClick={() => setIsFullScreenGanttOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-xl shadow-xs transition"
            >
              <Maximize2 size={14} className="text-indigo-600" />
              <span>Ver Gantt completo</span>
            </button>

            {/* ÚNICO BOTÓN CREACIÓN BLOQUE B (PUNTO 1) */}
            {permissions.canManagePlanning && (
              <button
                onClick={() => handleOpenAddActivity()}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-xs transition"
              >
                <Plus size={14} />
                + Nueva Actividad
              </button>
            )}
          </div>
        </div>

        {/* FILTROS (ZONA, FASE, RESPONSABLE, ESTADO) */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
            <Filter size={14} />
            <span>Filtros:</span>
          </div>

          <select
            value={filterZoneId}
            onChange={e => setFilterZoneId(e.target.value)}
            className="text-xs font-medium border border-gray-200 rounded-xl px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todas las Zonas</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.code} - {z.name}</option>
            ))}
          </select>

          <select
            value={filterPhase}
            onChange={e => setFilterPhase(e.target.value)}
            className="text-xs font-medium border border-gray-200 rounded-xl px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todas las Fases (1S–5S)</option>
            {FIVE_S_PHASES_LIST.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <select
            value={filterResponsibleId}
            onChange={e => setFilterResponsibleId(e.target.value)}
            className="text-xs font-medium border border-gray-200 rounded-xl px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todos los Responsables</option>
            {activeMembers.map(m => (
              <option key={m.id} value={m.userId || m.id}>{m.name || m.userName}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs font-medium border border-gray-200 rounded-xl px-2.5 py-1.5 bg-slate-50 hover:bg-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="NOT_STARTED">No iniciadas (0%)</option>
            <option value="IN_PROGRESS">En curso</option>
            <option value="COMPLETED">Completadas (100%)</option>
            <option value="DELAYED">Retrasadas (Vencidas)</option>
          </select>

          {(filterZoneId !== 'ALL' || filterPhase !== 'ALL' || filterResponsibleId !== 'ALL' || filterStatus !== 'ALL') && (
            <button
              onClick={() => {
                setFilterZoneId('ALL');
                setFilterPhase('ALL');
                setFilterResponsibleId('ALL');
                setFilterStatus('ALL');
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 ml-auto"
            >
              Restablecer filtros
            </button>
          )}
        </div>

        {/* GANTT VIEW CONTAINER (COMPACT) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          {filteredActivities.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarDays className="w-12 h-12 mx-auto text-indigo-300 mb-3" />
              <h4 className="text-base font-bold text-gray-900">No hay actividades de planificación que mostrar</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                Utiliza el botón "+ Nueva Actividad" para registrar actividades por zona y fase 5S.
              </p>
            </div>
          ) : (
            renderGanttContent(false)
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL: GANTT COMPLETO / FULLSCREEN (PUNTO 8 & 9 & 10)                      */}
      {/* ========================================================================= */}
      {isFullScreenGanttOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Fullscreen Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <Calendar className="text-indigo-600" size={24} />
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <span>Cronograma Gantt Completo 5S</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    {project.name}
                  </span>
                </h3>
                <p className="text-xs text-gray-500">
                  Escala temporal completa. Doble clic en cualquier actividad para editar fechas o detalles.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {permissions.canManagePlanning && (
                <button
                  onClick={() => handleOpenAddActivity()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shadow-xs transition"
                >
                  <Plus size={14} />
                  + Nueva Actividad
                </button>
              )}
              <button
                onClick={() => setIsFullScreenGanttOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                <Minimize2 size={14} />
                <span>Cerrar Vista Completa</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Gantt Content with full width and independent scroll */}
          <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {renderGanttContent(true)}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURAR FRANJA DE DEDICACIÓN                                    */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDedicationModalOpen}
        onClose={() => setIsDedicationModalOpen(false)}
        title={editingDedication ? 'Editar Franja de Dedicación' : 'Nueva Franja de Dedicación Semanal'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveDedication} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Día de la semana *
              </label>
              <select
                value={dedDayOfWeek}
                onChange={e => setDedDayOfWeek(e.target.value as FiveSDayOfWeek)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hora de Inicio *
              </label>
              <input
                type="time"
                required
                value={dedStartTime}
                onChange={e => setDedStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hora de Fin *
              </label>
              <input
                type="time"
                required
                value={dedEndTime}
                onChange={e => setDedEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
          </div>

          {/* CÁLCULO AUTOMÁTICO DE DURACIÓN Y CAPACIDAD (PUNTO 3) */}
          <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-500 font-medium">Duración calculada de la sesión:</span>
              <strong className="text-indigo-900 font-black text-sm ml-2">
                {modalSessionDuration} horas
              </strong>
            </div>
            <div className="text-right">
              <span className="text-gray-500 font-medium">Capacidad de esta franja:</span>
              <strong className="text-indigo-700 font-black text-sm ml-2">
                {Number((modalSessionDuration * dedParticipants.length).toFixed(1))} horas-persona
              </strong>
            </div>
          </div>

          {/* SELECCIÓN DE PARTICIPANTES (EXCLUSIVAMENTE MIEMBROS ACTIVOS) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Participantes Activos del Equipo 5S ({dedParticipants.length} seleccionados) *
              </label>
              <button
                type="button"
                onClick={() => {
                  if (dedParticipants.length === activeMembers.length) {
                    setDedParticipants([]);
                  } else {
                    setDedParticipants(activeMembers.map(m => m.userId || m.id));
                  }
                }}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
              >
                {dedParticipants.length === activeMembers.length ? 'Desmarcar todos' : 'Seleccionar todos'}
              </button>
            </div>

            {activeMembers.length === 0 ? (
              <div className="p-4 text-center text-xs text-amber-700 bg-amber-50 rounded-xl border border-amber-200">
                No hay miembros activos en el equipo 5S. Incorpora integrantes en la pestaña "Equipo".
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl p-2 bg-slate-50/50">
                {activeMembers.map(m => {
                  const uid = m.userId || m.id;
                  const isChecked = dedParticipants.includes(uid);

                  return (
                    <label
                      key={m.id}
                      className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer transition text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDedParticipant(uid)}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <div>
                          <strong className="text-gray-900 block">{m.name || m.userName}</strong>
                          <span className="text-[10px] text-gray-500">
                            {m.role} {m.department ? `• ${m.department}` : ''}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {m.shift || 'General'}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsDedicationModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingDedication}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {isSavingDedication ? 'Guardando...' : editingDedication ? 'Actualizar Franja' : 'Crear Franja'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: ACTIVIDAD DE PLANIFICACIÓN (PUNTOS 4, 6, 10)                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title={editingActivity ? 'Editar Actividad de Planificación' : 'Nueva Actividad de Planificación 5S'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveActivity} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nombre de la Actividad *
            </label>
            <input
              type="text"
              required
              value={actTitle}
              onChange={e => setActTitle(e.target.value)}
              placeholder="Ej. Clasificación de herramientas (1S), Marcaje de pasillos (2S)..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Zona */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Zona de Implantación
              </label>
              <select
                value={actZoneId}
                onChange={e => {
                  setActZoneId(e.target.value);
                  setActSubzoneId('');
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="">-- General / Sin zona específica --</option>
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.code} - {z.name}</option>
                ))}
              </select>
            </div>

            {/* Subzona dependiente */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Subzona / Puesto (Opcional)
              </label>
              <select
                value={actSubzoneId}
                disabled={!actZoneId || modalAvailableSubzones.length === 0}
                onChange={e => setActSubzoneId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">-- Toda la zona --</option>
                {modalAvailableSubzones.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fase 5S */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fase 5S Correspondiente *
              </label>
              <select
                value={actPhase}
                onChange={e => setActPhase(e.target.value as FiveSPhase)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 font-bold"
              >
                {FIVE_S_PHASES_LIST.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Responsable */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Responsable de la Actividad *
              </label>
              <select
                required
                value={actResponsibleId}
                onChange={e => setActResponsibleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Seleccionar miembro activo --</option>
                {activeMembers.map(m => (
                  <option key={m.id} value={m.userId || m.id}>
                    {m.name || m.userName} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fecha Inicio *
              </label>
              <input
                type="date"
                required
                value={actStartDate}
                onChange={e => setActStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fecha Fin *
              </label>
              <input
                type="date"
                required
                value={actEndDate}
                onChange={e => setActEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Duración calculada
              </label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-gray-800">
                {modalActivityDurationDays} días naturales
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Horas Planificadas
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={actPlannedHours}
                onChange={e => setActPlannedHours(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* HORAS REALIZADAS SOLO LECTURA (PUNTO 4) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Horas Realizadas (Solo lectura)
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-gray-700 cursor-not-allowed flex items-center justify-between">
                <span>Horas realizadas = {editingActivity?.actualHours || 0} h</span>
                <span className="text-[10px] text-gray-400 font-normal">Solo lectura</span>
              </div>
            </div>

            {/* AVANCE EDITABLE DIRECTAMENTE (PUNTO 6) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex justify-between items-center">
                <span>Avance:</span>
                <span className="font-bold text-indigo-700 text-sm">{actProgress}%</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={actProgress}
                  onChange={e => {
                    const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setActProgress(val);
                  }}
                  className="w-20 px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={actProgress}
                  onChange={e => setActProgress(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Descripción / Instrucciones
            </label>
            <textarea
              rows={2}
              value={actDescription}
              onChange={e => setActDescription(e.target.value)}
              placeholder="Detalles sobre la ejecución de la actividad 5S..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsActivityModalOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingActivity}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {isSavingActivity ? 'Guardando...' : editingActivity ? 'Guardar Cambios' : 'Crear Actividad'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DEDICATION */}
      <ConfirmModal
        isOpen={!!dedicationToDelete}
        onCancel={() => setDedicationToDelete(null)}
        onConfirm={handleConfirmDeleteDedication}
        title="Eliminar Franja de Dedicación"
        message={`¿Estás seguro de que deseas eliminar la franja del ${dedicationToDelete?.dayOfWeek} (${dedicationToDelete?.startTime} - ${dedicationToDelete?.endTime})? Esto recalculará la capacidad semanal del grupo.`}
        confirmText="Eliminar Franja"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
      />

      {/* CONFIRM DELETE ACTIVITY */}
      <ConfirmModal
        isOpen={!!activityToDelete}
        onCancel={() => setActivityToDelete(null)}
        onConfirm={handleConfirmDeleteActivity}
        title="Eliminar Actividad de Planificación"
        message={`¿Estás seguro de que deseas eliminar la actividad "${activityToDelete?.title}"?`}
        confirmText="Eliminar Actividad"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
      />
    </div>
  );
}
