import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import { 
  ClipboardList, CheckCircle2, AlertCircle, Calendar, Plus, 
  Trash2, Edit, Copy, Play, Eye, Filter, Search, RotateCw, 
  X, Check, AlertTriangle, MessageSquare, Image, ChevronRight,
  ArrowUpRight, Clock, ToggleLeft, ToggleRight, Settings
} from 'lucide-react';
import { format, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import Table, { Column } from '../components/Table';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Markdown from 'react-markdown';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType, cleanPayload } from '../lib/firestore-utils';
import clsx from 'clsx';
import { 
  Routine, RoutineControl, RoutineSchedule, RoutineExecution, 
  RoutineControlResponse, CaptureValueConfig, RoutineStatus, RoutineExecutionStatus
} from '../types';
import toast from 'react-hot-toast';

export default function Routines() {
  const { dbUser, isAdmin, activeCompanyId, company } = useAuth();
  const { t, dateLocale } = useLanguage();
  const showSectionHeaders = company?.settings?.showSectionHeaders !== false;
  const { users, forums, teams } = useAppData();
  
  // Tab control: 'hoy' | 'historico' | 'definicion'
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = (tabParam === 'historico' || tabParam === 'definicion') ? tabParam : 'hoy';
  const setActiveTab = (tab: 'hoy' | 'historico' | 'definicion') => {
    setSearchParams({ tab });
  };
  
  // Realtime Data states
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [executions, setExecutions] = useState<RoutineExecution[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states (History)
  const [histRoutineFilter, setHistRoutineFilter] = useState('');
  const [histResponsibleFilter, setHistResponsibleFilter] = useState('');
  const [histStatusFilter, setHistStatusFilter] = useState('');
  const [histResultFilter, setHistResultFilter] = useState('');
  const [histDateFilter, setHistDateFilter] = useState('');
  const [histContextSearch, setHistContextSearch] = useState('');

  // Modals visibility
  const [isDefModalOpen, setIsDefModalOpen] = useState(false);
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Selected entities
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<RoutineExecution | null>(null);
  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);

  // Active execution state (for the active execution wizard)
  const [currentExecResponses, setCurrentExecResponses] = useState<RoutineControlResponse[]>([]);
  const [currentExecContext, setCurrentExecContext] = useState({
    workOrder: '',
    machine: '',
    product: '',
    shift: '',
    eventDateTime: ''
  });

  // Routine definition form states
  const [defTitle, setDefTitle] = useState('');
  const [defDescription, setDefDescription] = useState('');
  const [defResponsibleId, setDefResponsibleId] = useState('');
  const [defActivationMode, setDefActivationMode] = useState<'scheduled' | 'event'>('scheduled');
  
  // Scheduled Config
  const [defStartDate, setDefStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [defRepeatEvery, setDefRepeatEvery] = useState(1);
  const [defRepeatUnit, setDefRepeatUnit] = useState<'day' | 'week' | 'month'>('day');
  const [defDaysOfWeek, setDefDaysOfWeek] = useState<number[]>([]); // 1-7
  const [defEndDate, setDefEndDate] = useState('');
  const [defEndTime, setDefEndTime] = useState('');

  // Controls array in definition form
  const [defControls, setDefControls] = useState<RoutineControl[]>([]);
  
  // State for adding/editing a control inside routine form
  const [isControlFormOpen, setIsControlFormOpen] = useState(false);
  const [editingControlIndex, setEditingControlIndex] = useState<number | null>(null);
  const [ctrlTitle, setCtrlTitle] = useState('');
  const [ctrlDescription, setCtrlDescription] = useState('');
  const [ctrlType, setCtrlType] = useState<'ok_nok' | 'capture_value'>('ok_nok');
  const [ctrlRequired, setCtrlRequired] = useState(true);
  const [ctrlCommentMode, setCtrlCommentMode] = useState<'allowed' | 'required' | 'none'>('allowed');
  const [ctrlReactionType, setCtrlReactionType] = useState<'none' | 'instruction' | 'rule' | 'incident' | 'action' | 'both'>('none');
  const [ctrlReactionConfig, setCtrlReactionConfig] = useState({
    instructionText: '',
    ruleId: '',
    forumId: '',
    responsibleId: '',
    automatic: false
  });
  const [ctrlValues, setCtrlValues] = useState<CaptureValueConfig[]>([]);

  // State for creating ad-hoc execution from "Hoy"
  const [adHocRoutineId, setAdHocRoutineId] = useState('');
  const [adHocContext, setAdHocContext] = useState({
    workOrder: '',
    machine: '',
    product: '',
    shift: '',
    eventDateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });

  // Load routines & executions real-time
  useEffect(() => {
    const companyId = dbUser?.companyId || activeCompanyId;
    if (!companyId) return;

    setLoading(true);

    const qRoutines = query(collection(db, 'routines'), where('companyId', '==', companyId));
    const unsubRoutines = onSnapshot(qRoutines, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'routines');
    });

    const qExecs = query(collection(db, 'routineExecutions'), where('companyId', '==', companyId));
    const unsubExecs = onSnapshot(qExecs, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoutineExecution));
      // Sort by planned date descending
      list.sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
      setExecutions(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'routineExecutions');
      setLoading(false);
    });

    return () => {
      unsubRoutines();
      unsubExecs();
    };
  }, [dbUser]);

  // Generate missing scheduled executions for today upon loading/checking
  useEffect(() => {
    if (routines.length === 0 || loading) return;

    const generateTodayScheduledExecutions = async () => {
      const companyId = dbUser?.companyId || activeCompanyId;
      if (!companyId) return;

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay(); // 1=Mon...7=Sun

      // Filter active scheduled routines
      const activeSchedRoutines = routines.filter(r => r.status === 'active' && r.activationMode === 'scheduled');

      for (const routine of activeSchedRoutines) {
        if (!routine.schedule) continue;
        const sched = routine.schedule;

        // Check if startDate has arrived and endDate (if exists) is not passed
        if (isAfter(startOfDay(parseISO(sched.startDate)), startOfDay(new Date()))) continue;
        if (sched.endDate && isBefore(startOfDay(parseISO(sched.endDate)), startOfDay(new Date()))) continue;

        // Check frequency & day of week matching
        let matchesDay = true;
        if (sched.repeatUnit === 'week' && sched.daysOfWeek && sched.daysOfWeek.length > 0) {
          if (!sched.daysOfWeek.includes(todayDayOfWeek)) {
            matchesDay = false;
          }
        }

        if (!matchesDay) continue;

        // Check if an execution already exists for today
        const alreadyExists = executions.some(e => e.routineId === routine.id && e.plannedDate === todayStr);

        if (!alreadyExists) {
          try {
            console.log(`Generating scheduled execution for routine "${routine.title}" for today (${todayStr})`);
            const initialControls: RoutineControlResponse[] = routine.controls.map(c => ({
              controlId: c.id,
              title: c.title,
              type: c.type,
              required: c.required,
              capturedValues: c.values ? c.values.reduce((acc, val) => ({ ...acc, [val.id]: '' }), {}) : {}
            }));

            const payload: Omit<RoutineExecution, 'id'> = {
              routineId: routine.id,
              routineTitle: routine.title,
              responsibleId: routine.responsibleId,
              responsibleName: routine.responsibleName || 'Responsable',
              plannedDate: todayStr,
              plannedTime: sched.endTime || undefined,
              status: 'planned',
              controls: initialControls,
              companyId,
              createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'routineExecutions'), payload);
          } catch (err) {
            console.error(`Error generating execution for routine ${routine.id}:`, err);
          }
        }
      }
    };

    generateTodayScheduledExecutions();
  }, [routines, executions, loading, dbUser]);

  // Roles & Creation Permission Helpers
  const isLeanPromotor = dbUser?.role === 'lean_promotor' || isAdmin;
  const isSupervisor = dbUser?.role === 'supervisor';

  // Get users that current user can assign a routine to:
  const assignableUsers = useMemo(() => {
    if (isLeanPromotor) {
      return users; // Can assign to anyone
    }
    if (isSupervisor) {
      // Supervisor can assign to self OR members of teams they supervise
      const supervisedTeamMembers = teams
        .filter(t => t.supervisorId === dbUser?.uid)
        .flatMap(t => t.members.map(m => m.uid));
      
      const supervisedSet = new Set(supervisedTeamMembers);
      supervisedSet.add(dbUser?.uid || '');

      return users.filter(u => supervisedSet.has(u.uid));
    }
    // Regular user can only assign to themselves
    return users.filter(u => u.uid === dbUser?.uid);
  }, [users, teams, dbUser, isLeanPromotor, isSupervisor]);

  // Today executions (Hoy)
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const todayExecutions = useMemo(() => {
    return executions.filter(e => {
      // Only show executions assigned to me (or all if supervisor/promotor)
      const isAssignedToMe = e.responsibleId === dbUser?.uid;
      const canViewAll = isLeanPromotor || isSupervisor; // supervisor/admin can see others' executions

      if (!isAssignedToMe && !canViewAll) return false;

      const isToday = e.plannedDate === todayDateStr;
      const isDelayed = e.plannedDate < todayDateStr && e.status !== 'completed' && e.status !== 'cancelled';

      return isToday || isDelayed || e.status === 'in_progress' || e.status === 'pending';
    });
  }, [executions, dbUser, todayDateStr, isLeanPromotor, isSupervisor]);

  // Histórico filtered executions
  const filteredHistoryExecutions = useMemo(() => {
    return executions.filter(e => {
      // If user is not supervisor/admin, they only see their own history
      const isAssignedToMe = e.responsibleId === dbUser?.uid;
      const canViewAll = isLeanPromotor || isSupervisor;
      if (!isAssignedToMe && !canViewAll) return false;

      // Routine filter
      if (histRoutineFilter && e.routineId !== histRoutineFilter) return false;
      // Responsible filter
      if (histResponsibleFilter && e.responsibleId !== histResponsibleFilter) return false;
      // Status filter
      if (histStatusFilter && e.status !== histStatusFilter) return false;
      // Result filter
      if (histResultFilter && e.globalResult !== histResultFilter) return false;
      // Date filter
      if (histDateFilter && e.plannedDate !== histDateFilter) return false;
      // Context search text (workOrder, machine, product, shift)
      if (histContextSearch) {
        const term = histContextSearch.toLowerCase();
        const ctx = e.context || {};
        const matchTitle = e.routineTitle.toLowerCase().includes(term);
        const matchWO = (ctx.workOrder || '').toLowerCase().includes(term);
        const matchMachine = (ctx.machine || '').toLowerCase().includes(term);
        const matchProd = (ctx.product || '').toLowerCase().includes(term);
        const matchShift = (ctx.shift || '').toLowerCase().includes(term);
        if (!matchTitle && !matchWO && !matchMachine && !matchProd && !matchShift) {
          return false;
        }
      }
      return true;
    });
  }, [executions, dbUser, isLeanPromotor, isSupervisor, histRoutineFilter, histResponsibleFilter, histStatusFilter, histResultFilter, histDateFilter, histContextSearch]);

  // Form Initializations
  const handleOpenCreateRoutine = () => {
    setSelectedRoutine(null);
    setDefTitle('');
    setDefDescription('');
    setDefResponsibleId(dbUser?.uid || '');
    setDefActivationMode('scheduled');
    setDefStartDate(format(new Date(), 'yyyy-MM-dd'));
    setDefRepeatEvery(1);
    setDefRepeatUnit('day');
    setDefDaysOfWeek([]);
    setDefEndDate('');
    setDefEndTime('');
    setDefControls([]);
    setIsDefModalOpen(true);
  };

  const handleOpenEditRoutine = (routine: Routine) => {
    setSelectedRoutine(routine);
    setDefTitle(routine.title);
    setDefDescription(routine.description);
    setDefResponsibleId(routine.responsibleId);
    setDefActivationMode(routine.activationMode);
    
    if (routine.schedule) {
      setDefStartDate(routine.schedule.startDate);
      setDefRepeatEvery(routine.schedule.repeatEvery);
      setDefRepeatUnit(routine.schedule.repeatUnit);
      setDefDaysOfWeek(routine.schedule.daysOfWeek || []);
      setDefEndDate(routine.schedule.endDate || '');
      setDefEndTime(routine.schedule.endTime || '');
    } else {
      setDefStartDate(format(new Date(), 'yyyy-MM-dd'));
      setDefRepeatEvery(1);
      setDefRepeatUnit('day');
      setDefDaysOfWeek([]);
      setDefEndDate('');
      setDefEndTime('');
    }

    setDefControls(routine.controls);
    setIsDefModalOpen(true);
  };

  const handleDuplicateRoutine = async (routine: Routine) => {
    try {
      const companyId = dbUser?.companyId || activeCompanyId;
      if (!companyId) return;

      const newTitle = `${routine.title} (copia)`;
      const payload: Omit<Routine, 'id'> = {
        title: newTitle,
        description: routine.description,
        responsibleId: dbUser?.uid || '',
        activationMode: routine.activationMode,
        schedule: routine.schedule ? { ...routine.schedule } : undefined,
        controls: routine.controls.map(c => ({ ...c, id: Math.random().toString(36).substr(2, 9) })),
        status: 'draft',
        companyId,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'routines'), cleanPayload(payload));
      toast.success('Rutina duplicada con éxito en modo borrador');
    } catch (err) {
      console.error(err);
      toast.error('Error al duplicar la rutina');
    }
  };

  const toggleRoutineStatus = async (routine: Routine) => {
    try {
      const newStatus: RoutineStatus = routine.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'routines', routine.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Rutina ${newStatus === 'active' ? 'activada' : 'desactivada'} con éxito`);
    } catch (err) {
      console.error(err);
      toast.error('Error al cambiar el estado de la rutina');
    }
  };

  const handleDeleteRoutine = async () => {
    if (!routineToDelete) return;
    try {
      await deleteDoc(doc(db, 'routines', routineToDelete.id));
      toast.success('Rutina eliminada con éxito');
      setIsConfirmDeleteOpen(false);
      setRoutineToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar la rutina');
    }
  };

  // Save Routine Definition
  const handleSaveRoutineDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defTitle.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    if (defControls.length === 0) {
      toast.error('Debes añadir al menos un control a la rutina');
      return;
    }

    const companyId = dbUser?.companyId || activeCompanyId;
    if (!companyId) return;

    const selectedResp = assignableUsers.find(u => u.uid === defResponsibleId);

    const routinePayload: Omit<Routine, 'id'> = {
      title: defTitle.trim(),
      description: defDescription.trim(),
      responsibleId: defResponsibleId,
      responsibleName: selectedResp?.name || 'Responsable',
      activationMode: defActivationMode,
      status: selectedRoutine ? selectedRoutine.status : 'draft',
      controls: defControls,
      companyId,
      createdAt: selectedRoutine ? selectedRoutine.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (defActivationMode === 'scheduled') {
      routinePayload.schedule = {
        startDate: defStartDate,
        repeatEvery: defRepeatEvery,
        repeatUnit: defRepeatUnit,
        daysOfWeek: defRepeatUnit === 'week' ? defDaysOfWeek : undefined,
        endDate: defEndDate || undefined,
        endTime: defEndTime || undefined
      };
    }

    try {
      if (selectedRoutine) {
        await updateDoc(doc(db, 'routines', selectedRoutine.id), cleanPayload(routinePayload));
        toast.success('Plantilla de rutina actualizada con éxito');
      } else {
        await addDoc(collection(db, 'routines'), cleanPayload(routinePayload));
        toast.success('Plantilla de rutina creada en modo borrador');
      }
      setIsDefModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar la rutina');
    }
  };

  // Control nested form handlers
  const handleOpenAddControl = () => {
    setEditingControlIndex(null);
    setCtrlTitle('');
    setCtrlDescription('');
    setCtrlType('ok_nok');
    setCtrlRequired(true);
    setCtrlCommentMode('allowed');
    setCtrlReactionType('none');
    setCtrlReactionConfig({
      instructionText: '',
      ruleId: '',
      forumId: '',
      responsibleId: '',
      automatic: false
    });
    setCtrlValues([]);
    setIsControlFormOpen(true);
  };

  const handleOpenEditControl = (index: number) => {
    const ctrl = defControls[index];
    setEditingControlIndex(index);
    setCtrlTitle(ctrl.title);
    setCtrlDescription(ctrl.description);
    setCtrlType(ctrl.type);
    setCtrlRequired(ctrl.required);
    setCtrlCommentMode(ctrl.commentMode);
    setCtrlReactionType(ctrl.reactionType);
    if (ctrl.reactionConfig) {
      setCtrlReactionConfig({
        instructionText: ctrl.reactionConfig.instructionText || '',
        ruleId: ctrl.reactionConfig.ruleId || '',
        forumId: ctrl.reactionConfig.forumId || '',
        responsibleId: ctrl.reactionConfig.responsibleId || '',
        automatic: ctrl.reactionConfig.automatic || false
      });
    } else {
      setCtrlReactionConfig({
        instructionText: '',
        ruleId: '',
        forumId: '',
        responsibleId: '',
        automatic: false
      });
    }
    setCtrlValues(ctrl.values || []);
    setIsControlFormOpen(true);
  };

  const handleSaveControl = () => {
    if (!ctrlTitle.trim()) {
      toast.error('El título del control es obligatorio');
      return;
    }

    if (ctrlType === 'capture_value' && ctrlValues.length === 0) {
      toast.error('Debes definir al menos un valor numérico a capturar');
      return;
    }

    // Build the control object
    const forumObj = forums.find(f => f.id === ctrlReactionConfig.forumId);
    const respObj = users.find(u => u.uid === ctrlReactionConfig.responsibleId);

    const newControl: RoutineControl = {
      id: editingControlIndex !== null ? defControls[editingControlIndex].id : Math.random().toString(36).substr(2, 9),
      title: ctrlTitle.trim(),
      description: ctrlDescription.trim(),
      type: ctrlType,
      required: ctrlRequired,
      commentMode: ctrlCommentMode,
      reactionType: ctrlReactionType,
      reactionConfig: ctrlReactionType !== 'none' ? {
        instructionText: ctrlReactionConfig.instructionText,
        ruleId: ctrlReactionConfig.ruleId,
        forumId: ctrlReactionConfig.forumId,
        forumName: forumObj?.name || '',
        responsibleId: ctrlReactionConfig.responsibleId,
        responsibleName: respObj?.name || '',
        automatic: ctrlReactionConfig.automatic
      } : undefined,
      values: ctrlType === 'capture_value' ? ctrlValues : undefined
    };

    const updated = [...defControls];
    if (editingControlIndex !== null) {
      updated[editingControlIndex] = newControl;
    } else {
      updated.push(newControl);
    }

    setDefControls(updated);
    setIsControlFormOpen(false);
  };

  const handleRemoveControl = (index: number) => {
    const updated = [...defControls];
    updated.splice(index, 1);
    setDefControls(updated);
  };

  // Values capturing configurations nested actions
  const handleAddCaptureValue = () => {
    const newValue: CaptureValueConfig = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      unit: '',
      decimals: 2,
      required: true
    };
    setCtrlValues([...ctrlValues, newValue]);
  };

  const handleRemoveCaptureValue = (valId: string) => {
    setCtrlValues(ctrlValues.filter(v => v.id !== valId));
  };

  const handleUpdateCaptureValue = (valId: string, fields: Partial<CaptureValueConfig>) => {
    setCtrlValues(ctrlValues.map(v => v.id === valId ? { ...v, ...fields } : v));
  };

  // Open "Por Evento" / Manual Ad-Hoc execution dialog
  const handleOpenAdHocModal = () => {
    // Select first active event or scheduled routine
    const activeRoutines = routines.filter(r => r.status === 'active');
    setAdHocRoutineId(activeRoutines[0]?.id || '');
    setAdHocContext({
      workOrder: '',
      machine: '',
      product: '',
      shift: '',
      eventDateTime: format(new Date(), "yyyy-MM-dd'T'HH:mm")
    });
    setIsAdHocModalOpen(true);
  };

  // Save manual ad-hoc execution "por evento"
  const handleSaveAdHocExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adHocRoutineId) {
      toast.error('Por favor selecciona una rutina');
      return;
    }

    const companyId = dbUser?.companyId || activeCompanyId;
    if (!companyId) return;

    const routine = routines.find(r => r.id === adHocRoutineId);
    if (!routine) return;

    try {
      const initialControls: RoutineControlResponse[] = routine.controls.map(c => ({
        controlId: c.id,
        title: c.title,
        type: c.type,
        required: c.required,
        capturedValues: c.values ? c.values.reduce((acc, val) => ({ ...acc, [val.id]: '' }), {}) : {}
      }));

      const dateStr = adHocContext.eventDateTime ? adHocContext.eventDateTime.substring(0, 10) : format(new Date(), 'yyyy-MM-dd');

      const payload: Omit<RoutineExecution, 'id'> = {
        routineId: routine.id,
        routineTitle: routine.title,
        responsibleId: dbUser?.uid || '',
        responsibleName: dbUser?.name || 'Responsable',
        plannedDate: dateStr,
        status: 'pending',
        controls: initialControls,
        context: {
          workOrder: adHocContext.workOrder,
          machine: adHocContext.machine,
          product: adHocContext.product,
          shift: adHocContext.shift,
          eventDateTime: adHocContext.eventDateTime
        },
        companyId,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'routineExecutions'), cleanPayload(payload));
      toast.success('Ejecución registrada con éxito');
      setIsAdHocModalOpen(false);

      // Auto-open this execution for completion
      const createdExecution: RoutineExecution = {
        id: docRef.id,
        ...payload
      };
      handleStartExecution(createdExecution);
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar la ejecución');
    }
  };

  // Launch Active Execution Completion Wizard
  const handleStartExecution = (exec: RoutineExecution) => {
    setSelectedExecution(exec);
    setCurrentExecResponses(JSON.parse(JSON.stringify(exec.controls))); // deep copy
    setCurrentExecContext({
      workOrder: exec.context?.workOrder || '',
      machine: exec.context?.machine || '',
      product: exec.context?.product || '',
      shift: exec.context?.shift || '',
      eventDateTime: exec.context?.eventDateTime || ''
    });
    setIsExecutionModalOpen(true);
  };

  // Control Response updates in execution wizard
  const handleUpdateResponse = (controlId: string, fields: Partial<RoutineControlResponse>) => {
    const updated = currentExecResponses.map(resp => {
      if (resp.controlId === controlId) {
        const merged = { ...resp, ...fields };
        
        // Find the template control to evaluate results if needed
        const templateRoutine = routines.find(r => r.id === selectedExecution?.routineId);
        const templateCtrl = templateRoutine?.controls.find(c => c.id === controlId);

        if (templateCtrl) {
          // Auto evaluate capture values
          if (templateCtrl.type === 'capture_value' && merged.capturedValues) {
            let hasOutOfRange = false;
            let allFilled = true;

            templateCtrl.values?.forEach(v => {
              const enteredVal = parseFloat(String(merged.capturedValues?.[v.id]));
              if (isNaN(enteredVal)) {
                if (v.required) allFilled = false;
              } else {
                if ((v.min !== undefined && enteredVal < v.min) || (v.max !== undefined && enteredVal > v.max)) {
                  hasOutOfRange = true;
                }
              }
            });

            if (allFilled) {
              merged.result = hasOutOfRange ? 'out_of_range' : 'in_range';
            } else {
              merged.result = undefined;
            }
          }
        }
        return merged;
      }
      return resp;
    });

    setCurrentExecResponses(updated);
  };

  // Evaluate execution reactions for deviations (NOK or out_of_range)
  const executeReactionsForResponse = async (
    resp: RoutineControlResponse, 
    templateCtrl: RoutineControl, 
    execId: string, 
    execTitle: string, 
    companyId: string
  ) => {
    const isDeviation = resp.result === 'nok' || resp.result === 'out_of_range';
    if (!isDeviation) return { incidentId: undefined, actionId: undefined };

    const reactionType = templateCtrl.reactionType;
    if (reactionType === 'none' || reactionType === 'instruction') return { incidentId: undefined, actionId: undefined };

    const config = templateCtrl.reactionConfig;
    if (!config) return { incidentId: undefined, actionId: undefined };

    let generatedIncidentId: string | undefined;
    let generatedActionId: string | undefined;

    const titlePrefix = `Desviación en rutina: ${execTitle}`;
    const descText = `Control afectado: "${templateCtrl.title}".
Resultado registrado: ${resp.result === 'nok' ? 'NO Conforme' : 'Valor fuera de rango'}.
Comentario del responsable: ${resp.comment || 'Ninguno'}.
Ejecución ID: ${execId}`;

    // Helper: Create incident in Firestore
    const createIncidentDoc = async () => {
      const payload = {
        title: titlePrefix,
        description: descText,
        forumId: config.forumId || '',
        forumName: config.forumName || '',
        status: 'abierta',
        createdBy: dbUser?.uid || 'system',
        createdByName: dbUser?.name || 'Sistema',
        companyId,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'incidents'), payload);
      return docRef.id;
    };

    // Helper: Create action plan in Firestore
    const createActionDoc = async (linkedIncidentId?: string) => {
      const payload = {
        title: `Planificar acción correctora: ${templateCtrl.title}`,
        description: descText,
        type: 'accion',
        status: 'pendiente',
        priority: 'alta',
        targetDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 1 week from now
        assignedTo: config.responsibleId ? [config.responsibleId] : [dbUser?.uid || ''],
        assignedToNames: config.responsibleId ? [config.responsibleName || 'Responsable'] : [dbUser?.name || 'Responsable'],
        originForumId: config.forumId || '',
        originForumName: config.forumName || '',
        incidentId: linkedIncidentId || '',
        companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: dbUser?.uid || 'system',
        createdByName: dbUser?.name || 'Sistema'
      };
      const docRef = await addDoc(collection(db, 'actionPlans'), payload);
      return docRef.id;
    };

    // 1. Automatic reaction triggers immediately
    if (config.automatic) {
      try {
        if (reactionType === 'incident' || reactionType === 'both') {
          generatedIncidentId = await createIncidentDoc();
          console.log('Created automatic Incident:', generatedIncidentId);
        }
        if (reactionType === 'action' || reactionType === 'both') {
          generatedActionId = await createActionDoc(generatedIncidentId);
          console.log('Created automatic Action:', generatedActionId);
        }
        toast.success(`Acción automática ejecutada debido a la desviación en "${templateCtrl.title}"`);
      } catch (err) {
        console.error('Error triggering automatic reaction:', err);
      }
    } else {
      // 2. User-confirmed reaction (Prompts user inline)
      const confirmText = `Se ha detectado una desviación en el control "${templateCtrl.title}". ¿Deseas registrar la siguiente acción recomendada?\n\nTipo: ${reactionType === 'incident' ? 'Crear Incidencia' : reactionType === 'action' ? 'Crear Acción Correctora' : 'Crear Incidencia y Acción'}\nForo asignado: ${config.forumName || 'Sin foro'}\nResponsable: ${config.responsibleName || 'No definido'}`;
      
      const proceed = window.confirm(confirmText);
      if (proceed) {
        try {
          if (reactionType === 'incident' || reactionType === 'both') {
            generatedIncidentId = await createIncidentDoc();
          }
          if (reactionType === 'action' || reactionType === 'both') {
            generatedActionId = await createActionDoc(generatedIncidentId);
          }
          toast.success('Incidencia/acción correctora registrada correctamente.');
        } catch (err) {
          console.error('Error triggering user-confirmed reaction:', err);
        }
      }
    }

    return { incidentId: generatedIncidentId, actionId: generatedActionId };
  };

  // Submit/Complete Execution
  const handleFinalizeExecution = async () => {
    if (!selectedExecution) return;

    // Check that all required controls are answered
    const missingRequired = currentExecResponses.some(resp => {
      if (!resp.required) return false;
      
      const isOKNOK = resp.type === 'ok_nok';
      if (isOKNOK) {
        return !resp.result;
      } else {
        // Numeric capture values check
        return !resp.result || resp.result === undefined;
      }
    });

    if (missingRequired) {
      toast.error('Por favor, responde a todos los controles obligatorios antes de finalizar.');
      return;
    }

    // Also check required comments
    const missingComments = currentExecResponses.some(resp => {
      const templateRoutine = routines.find(r => r.id === selectedExecution.routineId);
      const templateCtrl = templateRoutine?.controls.find(c => c.id === resp.controlId);
      if (templateCtrl?.commentMode === 'required') {
        return !resp.comment || !resp.comment.trim();
      }
      return false;
    });

    if (missingComments) {
      toast.error('Algunos controles requieren comentarios obligatorios.');
      return;
    }

    const companyId = dbUser?.companyId || activeCompanyId;
    if (!companyId) return;

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      
      // Calculate delay
      const completionDelay = isAfter(startOfDay(new Date()), startOfDay(parseISO(selectedExecution.plannedDate))) 
        ? 'out_of_time' 
        : 'in_time';

      // Deep copy responses
      const responsesToSave = [...currentExecResponses];

      // Evaluate reactions & insert any linked docs
      let hasDeviations = false;
      const templateRoutine = routines.find(r => r.id === selectedExecution.routineId);

      for (let i = 0; i < responsesToSave.length; i++) {
        const resp = responsesToSave[i];
        const templateCtrl = templateRoutine?.controls.find(c => c.id === resp.controlId);
        
        const isDeviation = resp.result === 'nok' || resp.result === 'out_of_range';
        if (isDeviation) {
          hasDeviations = true;
        }

        if (templateCtrl) {
          const { incidentId, actionId } = await executeReactionsForResponse(
            resp, 
            templateCtrl, 
            selectedExecution.id, 
            selectedExecution.routineTitle, 
            companyId
          );

          responsesToSave[i] = {
            ...resp,
            completedBy: dbUser?.uid,
            completedByName: dbUser?.name,
            completedAt: new Date().toISOString(),
            generatedIncidentId: incidentId,
            generatedActionId: actionId
          };
        }
      }

      const globalResult = hasDeviations ? 'deviations' : 'compliant';

      const executionUpdates: Partial<RoutineExecution> = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        startedAt: selectedExecution.startedAt || new Date().toISOString(),
        completionDelay,
        controls: responsesToSave,
        globalResult,
        context: {
          workOrder: currentExecContext.workOrder,
          machine: currentExecContext.machine,
          product: currentExecContext.product,
          shift: currentExecContext.shift,
          eventDateTime: currentExecContext.eventDateTime
        }
      };

      await updateDoc(doc(db, 'routineExecutions', selectedExecution.id), cleanPayload(executionUpdates));
      toast.success('Ejecución finalizada con éxito');
      setIsExecutionModalOpen(false);
      setSelectedExecution(null);
    } catch (err) {
      console.error(err);
      toast.error('Error al finalizar la ejecución');
    }
  };

  // Set startedAt flag when opening an execution if not set
  const handleOpenActiveExecution = async (exec: RoutineExecution) => {
    if (!exec.startedAt && exec.status === 'planned') {
      try {
        await updateDoc(doc(db, 'routineExecutions', exec.id), {
          status: 'in_progress',
          startedAt: new Date().toISOString()
        });
        exec.status = 'in_progress';
        exec.startedAt = new Date().toISOString();
      } catch (err) {
        console.error(err);
      }
    }
    handleStartExecution(exec);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Title & Top Control bar */}
      <div className={clsx(
        "flex flex-col md:flex-row justify-between items-start md:items-center gap-4",
        showSectionHeaders ? "border-b border-gray-200 pb-5" : "pb-2"
      )}>
        {showSectionHeaders && (
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {t('routines.title', 'Control de Rutinas')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('routines.subtitle', 'Gestión y ejecución de autocontroles, chequeos diarios y rondas de supervisión Lean.')}
            </p>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          {activeTab === 'hoy' && (
            <button
              onClick={handleOpenAdHocModal}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('routines.eventExecution', 'Ejecución por Evento')}
            </button>
          )}

          {activeTab === 'definicion' && (
            <button
              onClick={handleOpenCreateRoutine}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('routines.newDefinition', 'Nueva Definición')}
            </button>
          )}
        </div>
      </div>

      {/* TABS CONTENT */}

      {/* 1. HOY VIEW */}
      {activeTab === 'hoy' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Cargando autocontroles...</div>
          ) : todayExecutions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center max-w-md mx-auto">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="font-bold text-gray-800 text-lg">¡Al día!</h3>
              <p className="text-sm text-gray-500 mt-1">
                No tienes ejecuciones programadas pendientes para hoy. Puedes iniciar una ejecución manual por evento con el botón superior.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayExecutions.map(exec => {
                const isOverdue = exec.plannedDate < todayDateStr && exec.status !== 'completed';
                
                return (
                  <div 
                    key={exec.id}
                    className={clsx(
                      "bg-white border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between hover:shadow-md",
                      isOverdue ? "border-red-200 bg-red-50/10" : "border-gray-200"
                    )}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className={clsx(
                          "text-xs font-bold uppercase px-2.5 py-1 rounded-full",
                          exec.status === 'completed' ? "bg-emerald-100 text-emerald-800" :
                          exec.status === 'in_progress' ? "bg-amber-100 text-amber-800" :
                          isOverdue ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                        )}>
                          {exec.status === 'completed' ? 'Completado' :
                           exec.status === 'in_progress' ? 'En Progreso' :
                           isOverdue ? 'Retrasado' : 'Pendiente'}
                        </span>

                        <span className="text-xs text-gray-400 font-medium">
                          F. Plan: {format(parseISO(exec.plannedDate), "dd MMM yy", { locale: es })}
                        </span>
                      </div>

                      <h3 className="font-bold text-gray-900 text-base line-clamp-1">{exec.routineTitle}</h3>
                      
                      {exec.context && (
                        <div className="mt-2 space-y-1 bg-gray-50 p-2 rounded-lg text-xs text-gray-600">
                          {exec.context.machine && <p><strong>Máquina:</strong> {exec.context.machine}</p>}
                          {exec.context.workOrder && <p><strong>OF:</strong> {exec.context.workOrder}</p>}
                          {exec.context.product && <p><strong>Producto:</strong> {exec.context.product}</p>}
                          {exec.context.shift && <p><strong>Turno:</strong> {exec.context.shift}</p>}
                        </div>
                      )}

                      <div className="mt-3 flex items-center text-xs text-gray-500 gap-2">
                        <span className="font-semibold text-gray-700">Responsable:</span>
                        <span>{exec.responsibleName}</span>
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        Controles: {exec.controls.length} definidos
                      </div>
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4 flex gap-2">
                      {exec.status !== 'completed' ? (
                        <button
                          onClick={() => handleOpenActiveExecution(exec)}
                          className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition gap-2"
                        >
                          <Play className="h-4 w-4" />
                          {exec.status === 'in_progress' ? 'Continuar' : 'Iniciar'}
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedExecution(exec); setIsDetailModalOpen(true); }}
                          className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver Detalle
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

      {/* 2. HISTORICO VIEW */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          {/* Filters card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Rutina</label>
              <select
                value={histRoutineFilter}
                onChange={(e) => setHistRoutineFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todas</option>
                {Array.from(new Set(executions.map(e => e.routineId))).map(rid => {
                  const label = executions.find(e => e.routineId === rid)?.routineTitle || rid;
                  return <option key={rid} value={rid}>{label}</option>;
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Responsable</label>
              <select
                value={histResponsibleFilter}
                onChange={(e) => setHistResponsibleFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Estado</label>
              <select
                value={histStatusFilter}
                onChange={(e) => setHistStatusFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos</option>
                <option value="planned">Planificado</option>
                <option value="in_progress">En Progreso</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Resultado</label>
              <select
                value={histResultFilter}
                onChange={(e) => setHistResultFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos</option>
                <option value="compliant">Conforme</option>
                <option value="deviations">Con Desviaciones</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fecha Plan</label>
              <input
                type="date"
                value={histDateFilter}
                onChange={(e) => setHistDateFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Búsqueda (Contexto)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="OF, máquina, prod..."
                  value={histContextSearch}
                  onChange={(e) => setHistContextSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 pl-8 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {filteredHistoryExecutions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Ninguna ejecución coincide con los filtros aplicados.</div>
            ) : (
              <Table
                data={filteredHistoryExecutions}
                columns={[
                  {
                    header: 'Fecha Plan',
                    accessor: (item) => (
                      <span className="font-mono text-xs">
                        {format(parseISO(item.plannedDate), 'dd/MM/yyyy')}
                      </span>
                    )
                  },
                  {
                    header: 'Rutina',
                    accessor: (item) => (
                      <span className="font-bold text-gray-900">{item.routineTitle}</span>
                    )
                  },
                  {
                    header: 'Responsable',
                    accessor: (item) => <span className="text-sm">{item.responsibleName}</span>
                  },
                  {
                    header: 'Contexto',
                    accessor: (item) => {
                      const ctx = item.context;
                      if (!ctx) return <span className="text-gray-400">-</span>;
                      return (
                        <div className="text-xs space-y-0.5">
                          {ctx.machine && <div><span className="text-gray-400">Máq:</span> {ctx.machine}</div>}
                          {ctx.workOrder && <div><span className="text-gray-400">OF:</span> {ctx.workOrder}</div>}
                          {ctx.product && <div><span className="text-gray-400">Prod:</span> {ctx.product}</div>}
                        </div>
                      );
                    }
                  },
                  {
                    header: 'Resultado',
                    accessor: (item) => {
                      if (item.status !== 'completed') {
                        return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">No completado</span>;
                      }
                      return (
                        <span className={clsx(
                          "text-xs font-bold px-2.5 py-1 rounded-full",
                          item.globalResult === 'compliant' ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        )}>
                          {item.globalResult === 'compliant' ? 'Conforme' : 'Desviaciones'}
                        </span>
                      );
                    }
                  },
                  {
                    header: 'Acciones',
                    accessor: (item) => (
                      <button
                        onClick={() => { setSelectedExecution(item); setIsDetailModalOpen(true); }}
                        className="inline-flex items-center px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded font-medium text-gray-700 transition gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        Ver detalle
                      </button>
                    )
                  }
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* 3. DEFINICION DE RUTINAS */}
      {activeTab === 'definicion' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {routines.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No hay rutinas definidas. Crea una nueva rutina usando el botón superior.</div>
            ) : (
              <Table
                data={routines}
                columns={[
                  {
                    header: 'Título',
                    accessor: (item) => (
                      <div>
                        <div className="font-bold text-gray-900">{item.title}</div>
                        <div className="text-xs text-gray-400 line-clamp-1">{item.description}</div>
                      </div>
                    )
                  },
                  {
                    header: 'Modo',
                    accessor: (item) => (
                      <span className={clsx(
                        "text-xs px-2.5 py-0.5 rounded font-medium uppercase tracking-wider",
                        item.activationMode === 'scheduled' ? "bg-indigo-50 text-indigo-700" : "bg-cyan-50 text-cyan-700"
                      )}>
                        {item.activationMode === 'scheduled' ? 'Programada' : 'Por Evento'}
                      </span>
                    )
                  },
                  {
                    header: 'Responsable',
                    accessor: (item) => <span className="text-sm">{item.responsibleName}</span>
                  },
                  {
                    header: 'Controles',
                    accessor: (item) => <span className="font-mono text-sm">{item.controls.length}</span>
                  },
                  {
                    header: 'Estado',
                    accessor: (item) => (
                      <button
                        onClick={() => toggleRoutineStatus(item)}
                        className="inline-flex items-center focus:outline-none"
                        title="Cambiar estado"
                      >
                        {item.status === 'active' ? (
                          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Activa
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                            Borrador
                          </span>
                        )}
                      </button>
                    )
                  },
                  {
                    header: 'Acciones',
                    accessor: (item) => (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEditRoutine(item)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition"
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateRoutine(item)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-blue-700 rounded transition"
                          title="Duplicar"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setRoutineToDelete(item); setIsConfirmDeleteOpen(true); }}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded transition"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  }
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* MODALS SECTION */}

      {/* A. CREACIÓN / EDICIÓN DEFINICIÓN RUTINA */}
      <Modal
        isOpen={isDefModalOpen}
        onClose={() => setIsDefModalOpen(false)}
        title={selectedRoutine ? "Editar Definición de Rutina" : "Nueva Definición de Rutina"}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSaveRoutineDefinition} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Título de la Rutina *</label>
              <input
                type="text"
                required
                value={defTitle}
                onChange={(e) => setDefTitle(e.target.value)}
                placeholder="Ej. Chequeo diario de prensa, Auditoría 5S, etc."
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Responsable *</label>
              <select
                value={defResponsibleId}
                onChange={(e) => setDefResponsibleId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                {assignableUsers.map(u => (
                  <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción / Instrucciones generales (Markdown permitido) *</label>
            <textarea
              rows={3}
              value={defDescription}
              onChange={(e) => setDefDescription(e.target.value)}
              placeholder="Escribe las directrices, objetivos de la rutina o guías de seguridad en formato Markdown..."
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-sans"
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-4">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-600" />
              Modo de Activación y Frecuencia
            </h3>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="activation_mode"
                  checked={defActivationMode === 'scheduled'}
                  onChange={() => setDefActivationMode('scheduled')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Programada (Periódica)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="activation_mode"
                  checked={defActivationMode === 'event'}
                  onChange={() => setDefActivationMode('event')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Por Evento (Manual ad-hoc)</span>
              </label>
            </div>

            {defActivationMode === 'scheduled' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de Inicio *</label>
                  <input
                    type="date"
                    required
                    value={defStartDate}
                    onChange={(e) => setDefStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Frecuencia *</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      required
                      min={1}
                      value={defRepeatEvery}
                      onChange={(e) => setDefRepeatEvery(parseInt(e.target.value) || 1)}
                      className="w-16 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-center"
                    />
                    <select
                      value={defRepeatUnit}
                      onChange={(e: any) => setDefRepeatUnit(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    >
                      <option value="day">Días</option>
                      <option value="week">Semanas</option>
                      <option value="month">Meses</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hora límite (Opcional)</label>
                  <input
                    type="time"
                    value={defEndTime}
                    onChange={(e) => setDefEndTime(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
              </div>
            )}

            {defActivationMode === 'scheduled' && defRepeatUnit === 'week' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Días de la semana que aplica:</label>
                <div className="flex gap-2">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, idx) => {
                    const dayNum = idx + 1;
                    const active = defDaysOfWeek.includes(dayNum);
                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => {
                          if (active) {
                            setDefDaysOfWeek(defDaysOfWeek.filter(d => d !== dayNum));
                          } else {
                            setDefDaysOfWeek([...defDaysOfWeek, dayNum].sort());
                          }
                        }}
                        className={clsx(
                          "w-8 h-8 rounded-full text-xs font-bold transition flex items-center justify-center border",
                          active 
                            ? "bg-blue-600 border-blue-600 text-white" 
                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Controls list */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <h3 className="font-bold text-gray-800 text-base">Controles de la Rutina ({defControls.length})</h3>
              <button
                type="button"
                onClick={handleOpenAddControl}
                className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded transition gap-1"
              >
                <Plus className="h-3 w-3" />
                Añadir Control
              </button>
            </div>

            {defControls.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                No hay controles definidos todavía. Pulsa "Añadir Control" para empezar.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {defControls.map((ctrl, idx) => (
                  <div key={ctrl.id} className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm">{ctrl.title}</h4>
                        {ctrl.required && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Obligatorio</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 pl-7">{ctrl.description}</p>
                      
                      <div className="mt-2 pl-7 flex flex-wrap gap-2 text-[11px]">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Tipo: {ctrl.type === 'ok_nok' ? 'OK/NOK' : 'Numérico'}
                        </span>
                        {ctrl.reactionType !== 'none' && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                            Reacción: {ctrl.reactionType === 'incident' ? 'Incidencia' : ctrl.reactionType === 'action' ? 'Acción' : ctrl.reactionType === 'both' ? 'Ambas' : 'Instrucción'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditControl(idx)}
                        className="p-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveControl(idx)}
                        className="p-1 bg-red-50 hover:bg-red-100 rounded text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setIsDefModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
            >
              Guardar plantilla (Borrador)
            </button>
          </div>
        </form>
      </Modal>

      {/* B. CONTROL NESTED ADD/EDIT FORM MODAL */}
      <Modal
        isOpen={isControlFormOpen}
        onClose={() => setIsControlFormOpen(false)}
        title={editingControlIndex !== null ? "Editar Control" : "Añadir Control"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Título / Pregunta / Instrucción *</label>
            <input
              type="text"
              required
              value={ctrlTitle}
              onChange={(e) => setCtrlTitle(e.target.value)}
              placeholder="Ej. ¿La presión de entrada está entre 2 y 4 bar?"
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción detallada / Criterio de aceptación</label>
            <textarea
              rows={2}
              value={ctrlDescription}
              onChange={(e) => setCtrlDescription(e.target.value)}
              placeholder="Explica qué buscar, cómo medir o los estándares visuales aceptables..."
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Control</label>
              <select
                value={ctrlType}
                onChange={(e: any) => setCtrlType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="ok_nok">Cumple / No Cumple (OK/NOK)</option>
                <option value="capture_value">Numérico (Captura de valores)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Comentario</label>
              <select
                value={ctrlCommentMode}
                onChange={(e: any) => setCtrlCommentMode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                <option value="allowed">Permitido (Opcional)</option>
                <option value="required">Obligatorio si se responde</option>
                <option value="none">Desactivado</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 items-center pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ctrlRequired}
                onChange={(e) => setCtrlRequired(e.target.checked)}
                className="text-blue-600 focus:ring-blue-500 h-4 w-4 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Respuesta Obligatoria</span>
            </label>
          </div>

          {/* If capture value: Numeric variables setup */}
          {ctrlType === 'capture_value' && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Parámetros Numéricos</h4>
                <button
                  type="button"
                  onClick={handleAddCaptureValue}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  + Añadir variable
                </button>
              </div>

              {ctrlValues.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-2">Define al menos un parámetro (Ej: Presión, Peso...)</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {ctrlValues.map((v, vidx) => (
                    <div key={v.id} className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-600">Parámetro {vidx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCaptureValue(v.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Eliminar
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Nombre (ej. Presión)"
                          value={v.name}
                          onChange={(e) => handleUpdateCaptureValue(v.id, { name: e.target.value })}
                          className="border border-gray-300 rounded p-1"
                        />
                        <input
                          type="text"
                          placeholder="Unidad (ej. bar)"
                          value={v.unit}
                          onChange={(e) => handleUpdateCaptureValue(v.id, { unit: e.target.value })}
                          className="border border-gray-300 rounded p-1"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Min (Opcional)"
                          value={v.min !== undefined ? v.min : ''}
                          onChange={(e) => handleUpdateCaptureValue(v.id, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="border border-gray-300 rounded p-1"
                        />
                        <input
                          type="number"
                          placeholder="Max (Opcional)"
                          value={v.max !== undefined ? v.max : ''}
                          onChange={(e) => handleUpdateCaptureValue(v.id, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                          className="border border-gray-300 rounded p-1"
                        />
                        <input
                          type="number"
                          placeholder="Decimales"
                          value={v.decimals}
                          onChange={(e) => handleUpdateCaptureValue(v.id, { decimals: parseInt(e.target.value) || 0 })}
                          className="border border-gray-300 rounded p-1 text-center"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deviation Reaction flow */}
          <div className="border border-gray-200 rounded-xl p-3 bg-amber-50/50 space-y-3">
            <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Reacción ante desviación (NOK o fuera de rango)
            </h4>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Acción recomendada</label>
              <select
                value={ctrlReactionType}
                onChange={(e: any) => setCtrlReactionType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 bg-white text-xs"
              >
                <option value="none">No realizar ninguna acción automática</option>
                <option value="instruction">Mostrar aviso / instrucción visual</option>
                <option value="incident">Crear una Incidencia en un Foro</option>
                <option value="action">Crear Acción Correctora</option>
                <option value="both">Crear ambas (Incidencia + Acción)</option>
              </select>
            </div>

            {ctrlReactionType === 'instruction' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Texto de la instrucción visual</label>
                <textarea
                  rows={2}
                  value={ctrlReactionConfig.instructionText}
                  onChange={(e) => setCtrlReactionConfig({ ...ctrlReactionConfig, instructionText: e.target.value })}
                  placeholder="Ej. Detener la línea inmediatamente, purgar el circuito y reintentar..."
                  className="w-full border border-gray-300 bg-white rounded-lg p-2 text-xs"
                />
              </div>
            )}

            {(ctrlReactionType === 'incident' || ctrlReactionType === 'action' || ctrlReactionType === 'both') && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Foro destino *</label>
                    <select
                      value={ctrlReactionConfig.forumId}
                      onChange={(e) => setCtrlReactionConfig({ ...ctrlReactionConfig, forumId: e.target.value })}
                      className="w-full border border-gray-300 bg-white rounded p-1.5"
                    >
                      <option value="">Selecciona foro...</option>
                      {forums.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 mb-1">Responsable asignado</label>
                    <select
                      value={ctrlReactionConfig.responsibleId}
                      onChange={(e) => setCtrlReactionConfig({ ...ctrlReactionConfig, responsibleId: e.target.value })}
                      className="w-full border border-gray-300 bg-white rounded p-1.5"
                    >
                      <option value="">Selecciona responsable...</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={ctrlReactionConfig.automatic}
                      onChange={(e) => setCtrlReactionConfig({ ...ctrlReactionConfig, automatic: e.target.checked })}
                      className="text-blue-600 focus:ring-blue-500 h-4 w-4 rounded"
                    />
                    <span>Disparar de forma automática sin preguntar</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setIsControlFormOpen(false)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveControl}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              Guardar Control
            </button>
          </div>
        </div>
      </Modal>

      {/* C. CREACIÓN MANUAL DE EJECUCIÓN (POR EVENTO / AD-HOC) */}
      <Modal
        isOpen={isAdHocModalOpen}
        onClose={() => setIsAdHocModalOpen(false)}
        title="Crear Ejecución por Evento / Ad-Hoc"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveAdHocExecution} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Seleccionar Rutina Activa *</label>
            <select
              required
              value={adHocRoutineId}
              onChange={(e) => setAdHocRoutineId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">-- Selecciona rutina --</option>
              {routines.filter(r => r.status === 'active').map(r => (
                <option key={r.id} value={r.id}>{r.title} ({r.activationMode === 'event' ? 'Por Evento' : 'Programada'})</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-3">
            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Datos Contextuales del Evento</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Orden de Fabricación (OF)</label>
                <input
                  type="text"
                  value={adHocContext.workOrder}
                  onChange={(e) => setAdHocContext({ ...adHocContext, workOrder: e.target.value })}
                  placeholder="Ej. OF-9921"
                  className="w-full border border-gray-300 bg-white rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Máquina / Equipo</label>
                <input
                  type="text"
                  value={adHocContext.machine}
                  onChange={(e) => setAdHocContext({ ...adHocContext, machine: e.target.value })}
                  placeholder="Ej. Línea 3"
                  className="w-full border border-gray-300 bg-white rounded-lg p-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Producto / Referencia</label>
                <input
                  type="text"
                  value={adHocContext.product}
                  onChange={(e) => setAdHocContext({ ...adHocContext, product: e.target.value })}
                  placeholder="Ej. REF-330"
                  className="w-full border border-gray-300 bg-white rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Turno de Trabajo</label>
                <select
                  value={adHocContext.shift}
                  onChange={(e) => setAdHocContext({ ...adHocContext, shift: e.target.value })}
                  className="w-full border border-gray-300 bg-white rounded-lg p-2 text-xs"
                >
                  <option value="">-- Selecciona turno --</option>
                  <option value="Mañana">Mañana</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noche">Noche</option>
                  <option value="Rotativo">Rotativo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha y Hora del Evento</label>
              <input
                type="datetime-local"
                value={adHocContext.eventDateTime}
                onChange={(e) => setAdHocContext({ ...adHocContext, eventDateTime: e.target.value })}
                className="w-full border border-gray-300 bg-white rounded-lg p-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setIsAdHocModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition"
            >
              Registrar e Iniciar
            </button>
          </div>
        </form>
      </Modal>

      {/* D. ASISTENTE DE EJECUCIÓN (COMPLETAR AUTOCONTROL) */}
      <Modal
        isOpen={isExecutionModalOpen}
        onClose={() => setIsExecutionModalOpen(false)}
        title={`Completar: ${selectedExecution?.routineTitle}`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Routine general instructions header (Markdown!) */}
          {selectedExecution && (
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-xl">
              <h4 className="font-bold text-blue-900 text-sm flex items-center gap-1.5 mb-1">
                <ClipboardList className="h-4 w-4" />
                Instrucciones de la Rutina
              </h4>
              <div className="text-xs text-blue-800 prose prose-sm max-w-none">
                <Markdown>{routines.find(r => r.id === selectedExecution.routineId)?.description || ''}</Markdown>
              </div>
            </div>
          )}

          {/* Context Details */}
          <div className="bg-gray-50 p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-500 mb-0.5">Orden de Fab (OF)</label>
              <input
                type="text"
                value={currentExecContext.workOrder}
                onChange={(e) => setCurrentExecContext({ ...currentExecContext, workOrder: e.target.value })}
                placeholder="OF..."
                className="w-full border border-gray-300 bg-white p-1.5 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-500 mb-0.5">Máquina / Equipo</label>
              <input
                type="text"
                value={currentExecContext.machine}
                onChange={(e) => setCurrentExecContext({ ...currentExecContext, machine: e.target.value })}
                placeholder="Máquina..."
                className="w-full border border-gray-300 bg-white p-1.5 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-500 mb-0.5">Producto</label>
              <input
                type="text"
                value={currentExecContext.product}
                onChange={(e) => setCurrentExecContext({ ...currentExecContext, product: e.target.value })}
                placeholder="Producto..."
                className="w-full border border-gray-300 bg-white p-1.5 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-500 mb-0.5">Turno</label>
              <select
                value={currentExecContext.shift}
                onChange={(e) => setCurrentExecContext({ ...currentExecContext, shift: e.target.value })}
                className="w-full border border-gray-300 bg-white p-1.5 rounded"
              >
                <option value="">--</option>
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Noche">Noche</option>
                <option value="Rotativo">Rotativo</option>
              </select>
            </div>
          </div>

          {/* Controls responses list */}
          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
            {currentExecResponses.map((resp, idx) => {
              const templateRoutine = routines.find(r => r.id === selectedExecution?.routineId);
              const templateCtrl = templateRoutine?.controls.find(c => c.id === resp.controlId);
              
              if (!templateCtrl) return null;

              const isDeviation = resp.result === 'nok' || resp.result === 'out_of_range';

              return (
                <div 
                  key={resp.controlId} 
                  className={clsx(
                    "border rounded-xl p-4 transition-all",
                    isDeviation ? "border-red-300 bg-red-50/5" : "border-gray-200 bg-white"
                  )}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm">{templateCtrl.title}</h4>
                        {templateCtrl.required && <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Obligatorio</span>}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-1 pl-7">{templateCtrl.description}</p>
                    </div>
                  </div>

                  {/* Actions area per control */}
                  <div className="mt-4 pl-7 space-y-4">
                    
                    {/* 1. OK / NOK option */}
                    {templateCtrl.type === 'ok_nok' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateResponse(resp.controlId, { result: 'ok' })}
                          className={clsx(
                            "inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition gap-1.5 border",
                            resp.result === 'ok'
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <Check className="h-4 w-4" />
                          Conforme (OK)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateResponse(resp.controlId, { result: 'nok' })}
                          className={clsx(
                            "inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition gap-1.5 border",
                            resp.result === 'nok'
                              ? "bg-red-600 border-red-600 text-white"
                              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          <X className="h-4 w-4" />
                          No Conforme (NOK)
                        </button>
                      </div>
                    )}

                    {/* 2. Numeric inputs capture */}
                    {templateCtrl.type === 'capture_value' && templateCtrl.values && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md">
                        {templateCtrl.values.map(v => {
                          const val = resp.capturedValues?.[v.id] || '';
                          return (
                            <div key={v.id} className="space-y-1">
                              <label className="block text-xs font-semibold text-gray-700">
                                {v.name} ({v.unit}) {v.required && '*'}
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step={1 / Math.pow(10, v.decimals)}
                                  value={val}
                                  onChange={(e) => {
                                    const nextVals = { ...resp.capturedValues, [v.id]: e.target.value };
                                    handleUpdateResponse(resp.controlId, { capturedValues: nextVals });
                                  }}
                                  placeholder={`${v.min !== undefined ? `Min ${v.min}` : ''} ${v.max !== undefined ? `Max ${v.max}` : ''}`}
                                  className="border border-gray-300 rounded p-1.5 text-xs flex-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                <span className="text-xs text-gray-400 font-bold uppercase">{v.unit}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reference visual guide banner */}
                    {templateCtrl.imageUrl && (
                      <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50 inline-flex items-center gap-2 text-xs">
                        <Image className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Ver imagen estándar de referencia:</span>
                        <a href={templateCtrl.imageUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Abrir enlace</a>
                      </div>
                    )}

                    {/* Evidence URL */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-gray-500">Enlace de evidencia (Opcional, ej. enlace a foto guardada)</label>
                      <input
                        type="url"
                        value={resp.evidenceUrl || ''}
                        onChange={(e) => handleUpdateResponse(resp.controlId, { evidenceUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Optional/Required comments input */}
                    {templateCtrl.commentMode !== 'none' && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-gray-500">
                          Comentario {templateCtrl.commentMode === 'required' && <span className="text-red-500">* (Obligatorio)</span>}
                        </label>
                        <input
                          type="text"
                          value={resp.comment || ''}
                          onChange={(e) => handleUpdateResponse(resp.controlId, { comment: e.target.value })}
                          placeholder="Añade observaciones o detalles..."
                          className="w-full border border-gray-300 p-1.5 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}

                    {/* DEVIATION INSIGHTS / REAL-TIME WARNINGS */}
                    {isDeviation && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-2">
                        <p className="font-bold flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Desviación detectada
                        </p>

                        {templateCtrl.reactionType === 'instruction' && templateCtrl.reactionConfig?.instructionText && (
                          <div className="p-2 bg-white rounded border border-red-100 font-medium text-red-900">
                            <strong>Instrucción inmediata:</strong> {templateCtrl.reactionConfig.instructionText}
                          </div>
                        )}

                        {templateCtrl.reactionType !== 'none' && templateCtrl.reactionType !== 'instruction' && (
                          <p className="italic">
                            Al finalizar, se {templateCtrl.reactionConfig?.automatic ? 'creará de manera automática' : 'propondrá crear'} la siguiente acción: <strong>{templateCtrl.reactionType === 'incident' ? 'Incidencia' : templateCtrl.reactionType === 'action' ? 'Acción correctora' : 'Incidencia y Acción'}</strong> en el foro <strong>{templateCtrl.reactionConfig?.forumName || 'Asignado'}</strong>.
                          </p>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsExecutionModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cerrar y guardar borrador
            </button>
            <button
              type="button"
              onClick={handleFinalizeExecution}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finalizar Ejecución
            </button>
          </div>
        </div>
      </Modal>

      {/* E. DETALLE EJECUCIÓN (READ ONLY DETAILS VIEW) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Detalle de ejecución: ${selectedExecution?.routineTitle}`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
            <div>
              <span className="block font-semibold text-gray-400 uppercase">Estado</span>
              <span className="font-bold text-gray-900">{selectedExecution?.status === 'completed' ? 'Completada' : 'No completada'}</span>
            </div>
            <div>
              <span className="block font-semibold text-gray-400 uppercase">Responsable</span>
              <span className="font-bold text-gray-900">{selectedExecution?.responsibleName}</span>
            </div>
            <div>
              <span className="block font-semibold text-gray-400 uppercase">Fecha Plan</span>
              <span className="font-bold text-gray-900">{selectedExecution && format(parseISO(selectedExecution.plannedDate), 'dd/MM/yyyy')}</span>
            </div>
            <div>
              <span className="block font-semibold text-gray-400 uppercase">Resultado Global</span>
              <span className={clsx(
                "font-bold uppercase",
                selectedExecution?.globalResult === 'compliant' ? "text-emerald-600" : "text-red-600"
              )}>
                {selectedExecution?.globalResult === 'compliant' ? 'Conforme' : 'Desviaciones'}
              </span>
            </div>
          </div>

          {selectedExecution?.context && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-2 bg-white text-xs">
              <h4 className="font-bold text-gray-800">Información del Contexto</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-gray-600">
                {selectedExecution.context.workOrder && <div><strong>Orden de Fab:</strong> {selectedExecution.context.workOrder}</div>}
                {selectedExecution.context.machine && <div><strong>Máquina/Equipo:</strong> {selectedExecution.context.machine}</div>}
                {selectedExecution.context.product && <div><strong>Producto:</strong> {selectedExecution.context.product}</div>}
                {selectedExecution.context.shift && <div><strong>Turno:</strong> {selectedExecution.context.shift}</div>}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-bold text-gray-800 text-sm border-b border-gray-200 pb-2">Resultados de los controles</h4>
            
            <div className="space-y-3">
              {selectedExecution?.controls.map((resp, idx) => {
                const isDeviation = resp.result === 'nok' || resp.result === 'out_of_range';
                return (
                  <div key={resp.controlId} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 text-xs">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] bg-gray-100 w-5 h-5 rounded-full flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-gray-900">{resp.title}</span>
                        </div>
                        {resp.comment && (
                          <p className="mt-1 pl-7 text-gray-500">
                            <strong>Comentario:</strong> {resp.comment}
                          </p>
                        )}
                        {resp.evidenceUrl && (
                          <p className="mt-1 pl-7 text-blue-600 font-medium">
                            <strong>Evidencia:</strong> <a href={resp.evidenceUrl} target="_blank" rel="noreferrer" className="underline">Ver enlace</a>
                          </p>
                        )}

                        {/* Generated Links block */}
                        {(resp.generatedIncidentId || resp.generatedActionId) && (
                          <div className="mt-2 pl-7 flex gap-2">
                            {resp.generatedIncidentId && (
                              <span className="bg-red-50 text-red-700 px-2.5 py-0.5 rounded border border-red-200 font-medium flex items-center gap-1 text-[10px]">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Incidencia registrada
                              </span>
                            )}
                            {resp.generatedActionId && (
                              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-200 font-medium flex items-center gap-1 text-[10px]">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Acción correctora creada
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <span className={clsx(
                        "text-xs font-bold px-2.5 py-1 rounded-full shrink-0",
                        resp.result === 'ok' || resp.result === 'in_range' ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      )}>
                        {resp.result === 'ok' ? 'OK' : 
                         resp.result === 'nok' ? 'NOK' : 
                         resp.result === 'in_range' ? 'Dentro rango' : 
                         resp.result === 'out_of_range' ? 'Fuera rango' : 
                         'Sin respuesta'}
                      </span>
                    </div>

                    {/* Display captured values */}
                    {resp.type === 'capture_value' && resp.capturedValues && (
                      <div className="mt-2 pl-7 flex flex-wrap gap-4 text-gray-600 bg-white p-2 rounded border border-gray-100">
                        {Object.entries(resp.capturedValues).map(([valId, val]) => (
                          <div key={valId}>
                            <span className="font-medium text-gray-400">Valor registrado:</span> <span className="font-bold text-gray-800">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setIsDetailModalOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* F. CONFIRM DELETE ROUTINE */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onCancel={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDeleteRoutine}
        title="Eliminar plantilla de rutina"
        message={`¿Estás seguro de que deseas eliminar la rutina "${routineToDelete?.title}"? Esta acción no se puede deshacer.`}
      />

    </div>
  );
}
