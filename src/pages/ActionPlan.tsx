import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  List, 
  LayoutDashboard, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal,
  ChevronRight,
  History,
  User as UserIcon,
  Trash2,
  Edit2,
  Tag,
  Search,
  XCircle,
  X,
  ChevronDown,
  ArrowUp
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { 
  ActionPlan, 
  ActionStatus, 
  ActionPriority, 
  ActionType,
  SubAction, 
  SubActionAudit,
  User,
  ActionCategory
} from '../types';
import Table, { Column } from '../components/Table';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateAutomaticStatus } from '../lib/action-utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

const STATUS_OPTIONS: { value: ActionStatus; label: string; color: string; bg: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 'en_progreso', label: 'En Curso', color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'retrasada', label: 'Retrasada', color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'finalizada', label: 'Finalizada', color: 'text-green-600', bg: 'bg-green-100' },
  { value: 'bloqueada', label: 'Bloqueada', color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'cancelada', label: 'Cancelada', color: 'text-gray-400', bg: 'bg-gray-200' },
];

const PRIORITY_OPTIONS: { value: ActionPriority; label: string; color: string }[] = [
  { value: 'baja', label: 'Baja', color: 'text-blue-600' },
  { value: 'media', label: 'Media', color: 'text-orange-600' },
  { value: 'alta', label: 'Alta', color: 'text-red-400' },
  { value: 'critica', label: 'Crítica', color: 'text-red-700' },
];

export default function ActionPlanPage() {
  const { dbUser, isAdmin, isSupervisor, activeCompanyId } = useAuth();
  const { forums } = useAppData();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'kanban' | 'escalated'>('kanban');
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [onlyMineEscalated, setOnlyMineEscalated] = useState(false);
  const [subActions, setSubActions] = useState<SubAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [editingAction, setEditingAction] = useState<Partial<ActionPlan> | null>(null);

  // New State for Filters
  const [filterTeamId, setFilterTeamId] = useState<string>('');
  const [filterForumId, setFilterForumId] = useState<string>('');
  const [onlyResponsible, setOnlyResponsible] = useState<boolean>(false);
  
  // New State for Escalation & Type
  const [type, setType] = useState<ActionType>('accion');
  const [isEscalated, setIsEscalated] = useState(false);
  const [escalatedToForumId, setEscalatedToForumId] = useState('');

  useEffect(() => {
    if (editingAction) {
      setType(editingAction.type || 'accion');
      setIsEscalated(editingAction.isEscalated || false);
      setEscalatedToForumId(editingAction.escalatedToForumId || '');
    }
  }, [editingAction]);

  const [actionToDelete, setActionToDelete] = useState<ActionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const companyId = dbUser?.companyId || activeCompanyId;

  // Filter actions based on permissions and user request
  const filteredActions = React.useMemo(() => {
    if (!dbUser) return [];

    const userUid = dbUser.uid;
    const userEmail = dbUser.email.toLowerCase().trim();
    const userName = dbUser.name?.toLowerCase().trim();

    // 1. Identify teams I lead or supervise (to find hierarchy)
    const teamsILeadOrSupervise = teams.filter(t => 
      t.supervisorId === userUid || 
      t.supervisorId?.toLowerCase().trim() === userEmail ||
      (userName && t.supervisorId?.toLowerCase().trim() === userName) ||
      (userName && t.supervisorName?.toLowerCase().trim() === userName) ||
      (t.groups || []).some((g: any) => 
        g.leaderId === userUid || 
        (userName && g.leaderId?.toLowerCase().trim() === userName) ||
        (userName && g.leaderName?.toLowerCase().trim() === userName)
      )
    );

    // 2. Build the set of all "Governed" team IDs (including descendants)
    const governedTeamIds = new Set<string>();
    const getDescendants = (teamId: string) => {
      const children = teams.filter(t => t.parentTeamId === teamId);
      children.forEach(c => {
        if (!governedTeamIds.has(c.id)) {
          governedTeamIds.add(c.id);
          getDescendants(c.id);
        }
      });
    };

    teamsILeadOrSupervise.forEach(t => {
      governedTeamIds.add(t.id);
      getDescendants(t.id);
    });

    // 3. Identify teams I participate in
    const participantTeamIds = new Set<string>(
      teams.filter(t => 
        t.members?.some((m: any) => (m.uid || m) === userUid) ||
        (t.groups || []).some((g: any) => g.members?.some((m: any) => (m.uid || m) === userUid))
      ).map(t => t.id)
    );

    // 4. Identify forums associated with governed and participant teams
    const visibleForumIds = new Set<string>(
      forums.filter(f => governedTeamIds.has(f.teamId) || participantTeamIds.has(f.teamId)).map(f => f.id)
    );

    // 5. BASE FILTER (Permissions/Default View)
    // - I am responsible
    // - I created it
    // - It belongs to a forum I participate in or lead (including hierarchy)
    let list = isAdmin ? actions : actions.filter(action => {
      const isCreator = action.createdBy === userUid;
      const isResponsible = action.assignedTo.includes(userUid);
      const isForumVisible = action.originForumId && visibleForumIds.has(action.originForumId);
      const isEscalatedTarget = action.escalatedToForumId && visibleForumIds.has(action.escalatedToForumId);
      
      return isCreator || isResponsible || isForumVisible || isEscalatedTarget;
    });

    // 6. AD-HOC FILTERS (User Input)
    if (onlyResponsible) {
      list = list.filter(a => a.assignedTo.includes(userUid));
    }

    if (filterTeamId) {
      // Find forums for this team
      const forumIdsInTeam = forums.filter(f => f.teamId === filterTeamId).map(f => f.id);
      list = list.filter(a => 
        (a.originForumId && forumIdsInTeam.includes(a.originForumId)) ||
        (a.escalatedToForumId && forumIdsInTeam.includes(a.escalatedToForumId))
      );
    }

    if (filterForumId) {
      list = list.filter(a => a.originForumId === filterForumId || a.escalatedToForumId === filterForumId);
    }

    return list.map(a => ({
      ...a,
      status: calculateAutomaticStatus(a.targetDate, a.status)
    }));
  }, [actions, isAdmin, dbUser, teams, forums, onlyResponsible, filterTeamId, filterForumId]);

  // Filter assignable users based on hierarchy
  const assignableUsers = React.useMemo(() => {
    let reachable: User[] = [];

    if (isAdmin) {
      reachable = [...users];
    } else {
      const supervisorTeams = teams.filter(t => 
        t.supervisorId === dbUser?.uid || 
        t.supervisorId === dbUser?.email ||
        (t.groups || []).some((g: any) => g.leaderId === dbUser?.uid)
      );
      const managedUserIds = new Set<string>();
      supervisorTeams.forEach(t => {
        t.members?.forEach((m: any) => managedUserIds.add(m.uid));
      });

      if (isSupervisor) {
        reachable = users.filter(u => managedUserIds.has(u.uid) || u.uid === dbUser?.uid);
      } else {
        reachable = users.filter(u => u.uid === dbUser?.uid);
      }
    }

    return reachable.sort((a, b) => a.name.localeCompare(b.name));
  }, [users, isAdmin, isSupervisor, dbUser, teams]);

  // Subactions state for the modal
  const [tempSubActions, setTempSubActions] = useState<Partial<SubAction>[]>([]);
  const [selectedSubActionForHistory, setSelectedSubActionForHistory] = useState<SubAction | null>(null);

  useEffect(() => {
    if (!companyId) {
      if (!dbUser && !activeCompanyId) return; 
      setIsLoading(false);
      setActions([]);
      setSubActions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Helper for safe snapshot errors
    const handleSnapError = (err: any, source: string) => {
      console.error(`Error loading ${source}:`, err);
      // Only set globally visible error for critical Action collection
      if (source === 'actions') {
        setError(`Error al cargar ${source}. Puede que falten permisos o índices.`);
      }
    };

    // Load Actions - Remove orderBy to avoid missing index errors (sort in memory instead)
    const qActions = query(
      collection(db, 'actionPlans'),
      where('companyId', '==', companyId)
    );
    const unsubActions = onSnapshot(qActions, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionPlan));
      // Sort in memory by createdAt desc
      docs.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setActions(docs);
      setIsLoading(false);
    }, (err) => handleSnapError(err, 'actions'));

    // Load Subactions
    const qSubActions = query(
      collection(db, 'subActions'),
      where('companyId', '==', companyId)
    );
    const unsubSubActions = onSnapshot(qSubActions, (snap) => {
      setSubActions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubAction)));
    }, (err) => handleSnapError(err, 'subactions'));

    // Load Users for assignment
    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    }, (err) => handleSnapError(err, 'users'));

    // Load Action Categories
    const qCategories = query(collection(db, 'actionCategories'), where('companyId', '==', companyId));
    const unsubCategories = onSnapshot(qCategories, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionCategory));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(data);
    }, (err) => handleSnapError(err, 'categories'));

    // Load Teams for hierarchy
    const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId));
    const unsubTeams = onSnapshot(qTeams, (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleSnapError(err, 'teams'));

    return () => {
      unsubActions();
      unsubSubActions();
      unsubUsers();
      unsubCategories();
      unsubTeams();
    };
  }, [companyId, dbUser]);

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser) {
      setError("Debes estar autenticado para guardar acciones.");
      return;
    }
    if (!companyId || !editingAction?.title || !editingAction?.targetDate) {
      setError("Por favor, completa todos los campos (título y fecha).");
      return;
    }

    try {
      const now = new Date().toISOString();

      // Create a clean object with only the fields we want to save
      // This prevents sending 'id' field to addDoc or 'undefined' values
      const autoStatus = calculateAutomaticStatus(editingAction.targetDate, editingAction.status || 'pendiente');
      
      const actionPayload: any = {
        title: editingAction.title,
        description: editingAction.description || '',
        type: type,
        status: autoStatus,
        priority: editingAction.priority || 'media',
        categoryId: editingAction.categoryId || '',
        categoryName: categories.find(c => c.id === editingAction.categoryId)?.name || '',
        targetDate: editingAction.targetDate,
        dateChangeCount: editingAction.dateChangeCount || 0,
        notes: editingAction.notes || '',
        companyId: companyId,
        updatedAt: now,
        assignedTo: editingAction.assignedTo || [],
        assignedToNames: (editingAction.assignedTo || []).map(uid => 
          users.find(u => u.uid === uid)?.name || 'Desconocido'
        ),
        isEscalated: isEscalated,
        escalatedToForumId: escalatedToForumId || '',
        originForumId: editingAction.originForumId || '',
        originForumName: forums.find(f => f.id === editingAction.originForumId)?.name || ''
      };

      if (isEscalated && !editingAction.isEscalated) {
        actionPayload.escalatedBy = dbUser.uid;
        actionPayload.escalatedByName = dbUser.name;
        actionPayload.escalatedAt = now;
      }

      let actionId = editingAction.id;

      if (editingAction.id) {
        // Update existing action
        const originalAction = actions.find(a => a.id === editingAction.id);
        const isCreator = originalAction?.createdBy === dbUser.uid;
        const isAssignee = originalAction?.assignedTo.includes(dbUser.uid);
        
        if (!isAdmin && !isSupervisor && !isCreator && !isAssignee) {
          throw new Error("No tienes permiso para editar esta acción.");
        }

        if (isAssignee && !isCreator && !isSupervisor && !isAdmin) {
          // Rule: Assignee can only change status and notes
          const restrictedData: any = {
            status: editingAction.status,
            notes: editingAction.notes,
            updatedAt: now
          };
          // If the date changed (even if restricted, we check for logic consistency)
          if (originalAction && originalAction.targetDate !== editingAction.targetDate) {
            restrictedData.dateChangeCount = (originalAction.dateChangeCount || 0) + 1;
            restrictedData.targetDate = editingAction.targetDate;
            restrictedData.status = calculateAutomaticStatus(editingAction.targetDate, editingAction.status || 'pendiente');
          }
          await updateDoc(doc(db, 'actionPlans', editingAction.id), restrictedData);
        } else {
          // Check if date changed to increment count
          if (originalAction && originalAction.targetDate !== editingAction.targetDate) {
            actionPayload.dateChangeCount = (originalAction.dateChangeCount || 0) + 1;
          }
          await updateDoc(doc(db, 'actionPlans', editingAction.id), actionPayload);
        }
      } else {
        // Create new action
        const newAction = {
          ...actionPayload,
          createdBy: dbUser.uid,
          createdByName: dbUser.name,
          createdAt: now
        };
        const docRef = await addDoc(collection(db, 'actionPlans'), newAction);
        actionId = docRef.id;
      }

      // Handle Subactions
      if (actionId) {
        for (const sub of tempSubActions) {
          if (sub.id) {
            // Update existing subaction
            const original = subActions.find(s => s.id === sub.id);
            if (original && (
              original.title !== sub.title || 
              original.completed !== sub.completed || 
              original.currentProposedDate !== sub.currentProposedDate
            )) {
              const subUpdates: any = {
                title: sub.title || '',
                completed: !!sub.completed,
                currentProposedDate: sub.currentProposedDate || ''
              };

              if (original.currentProposedDate !== sub.currentProposedDate) {
                const newAudit: SubActionAudit = {
                  date: sub.currentProposedDate || '',
                  setAt: now,
                  setBy: dbUser.name
                };
                subUpdates.dateHistory = [...(original.dateHistory || []), newAudit];
              }
              
              await updateDoc(doc(db, 'subActions', sub.id), subUpdates);
            }
          } else {
            // Create new subaction
            const newSub = {
              title: sub.title || '',
              actionId: actionId,
              companyId: companyId,
              completed: !!sub.completed,
              currentProposedDate: sub.currentProposedDate || '',
              dateHistory: sub.currentProposedDate ? [{
                date: sub.currentProposedDate,
                setAt: now,
                setBy: dbUser.name
              }] : []
            };
            await addDoc(collection(db, 'subActions'), newSub);
          }
        }
      }

      setEditingAction(null);
      setTempSubActions([]);
      setError(null);
    } catch (err: any) {
      console.error("Error saving action:", err);
      setError(err.message || "Error al guardar la acción.");
    }
  };

  const handleDeleteAction = async () => {
    if (!actionToDelete) return;
    try {
      // Find subs to delete
      const subsToDelete = subActions.filter(s => s.actionId === actionToDelete.id);
      for (const sub of subsToDelete) {
        await deleteDoc(doc(db, 'subActions', sub.id));
      }
      await deleteDoc(doc(db, 'actionPlans', actionToDelete.id));
      setActionToDelete(null);
    } catch (err) {
      console.error("Error deleting action:", err);
      setError("Error al eliminar la acción.");
    }
  };

  const toggleSubAction = async (sub: SubAction) => {
    try {
      await updateDoc(doc(db, 'subActions', sub.id), {
        completed: !sub.completed
      });
    } catch (err) {
      console.error("Error toggling subaction:", err);
    }
  };

  const handleFinalizeAction = async (action: ActionPlan) => {
    try {
      await updateDoc(doc(db, 'actionPlans', action.id), {
        status: 'finalizada',
        updatedAt: new Date().toISOString()
      });
      if (editingAction?.id === action.id) {
        setEditingAction({ ...editingAction, status: 'finalizada' });
      }
    } catch (err) {
      console.error("Error finalizing action:", err);
      setError("Error al finalizar la acción.");
    }
  };

  const handleCancelAction = async (action: ActionPlan) => {
    try {
      await updateDoc(doc(db, 'actionPlans', action.id), {
        status: 'cancelada',
        updatedAt: new Date().toISOString()
      });
      if (editingAction?.id === action.id) {
        setEditingAction({ ...editingAction, status: 'cancelada' });
      }
    } catch (err) {
      console.error("Error cancelling action:", err);
      setError("Error al cancelar la acción.");
    }
  };

  const openEditModal = (action: ActionPlan) => {
    setEditingAction({ ...action });
    setTempSubActions(subActions.filter(s => s.actionId === action.id));
  };

  const addTempSubAction = () => {
    setTempSubActions([...tempSubActions, { title: '', completed: false, currentProposedDate: '' }]);
  };

  const removeTempSubAction = async (index: number, subId?: string) => {
    if (subId) {
      try {
        await deleteDoc(doc(db, 'subActions', subId));
      } catch (err) {
        console.error("Error deleting subaction:", err);
      }
    }
    setTempSubActions(tempSubActions.filter((_, i) => i !== index));
  };

  const handleSubActionChange = (index: number, field: keyof SubAction, value: any) => {
    const newSubs = [...tempSubActions];
    newSubs[index] = { ...newSubs[index], [field]: value };
    setTempSubActions(newSubs);
  };

  // Kanban logic - Grouping by Date
  const getActionDateCategory = (dateStr: string): string => {
    if (!dateStr) return 'sin_fecha';
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    if (targetDate < today) return 'atrasadas';
    if (targetDate.getTime() === today.getTime()) return 'hoy';
    if (targetDate < nextWeek) return 'esta_semana';
    return 'proximas';
  };

  const DATE_COLUMNS = [
    { value: 'atrasadas', label: 'Atrasadas', color: 'text-red-600', bg: 'bg-red-100' },
    { value: 'hoy', label: 'Para Hoy', color: 'text-blue-600', bg: 'bg-blue-100' },
    { value: 'esta_semana', label: 'Esta Semana', color: 'text-orange-600', bg: 'bg-orange-100' },
    { value: 'proximas', label: 'Próximas', color: 'text-gray-600', bg: 'bg-gray-100' },
  ];

  const renderActionCard = (action: ActionPlan) => {
    const assignedNames = action.assignedToNames?.join(', ') || 'Sin asignar';
    const subActionStats = subActions.filter(s => s.actionId === action.id);
    const completedCount = subActionStats.filter(s => s.completed).length;
    
    // Defensive date formatting
    const formatDateSafe = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        return format(d, 'dd MMM yyyy', { locale: es });
      } catch (e) {
        return 'Error fecha';
      }
    };
    
    return (
      <div 
        key={action.id}
        className="bg-white p-4 rounded-xl border border-gray-200 transition-all cursor-pointer group mb-3"
        onClick={() => openEditModal(action)}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-wrap gap-1.5">
            <span className={clsx(
              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
              PRIORITY_OPTIONS.find(p => p.value === action.priority)?.color.replace('text-', 'bg-').replace('600', '100').replace('400', '100').replace('700', '200')
            )}>
              {PRIORITY_OPTIONS.find(p => p.value === action.priority)?.label}
            </span>
            {action.isEscalated && (
              <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-100 flex items-center gap-1 uppercase" title="Escalado">
                <AlertCircle size={10} />
                Escalado
              </span>
            )}
            {action.type === 'incidencia' && (
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-red-100 flex items-center gap-1 uppercase">
                <AlertCircle size={10} />
                Incidencia
              </span>
            )}
            {action.categoryName && (
              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1 uppercase">
                <Tag size={10} />
                {action.categoryName}
              </span>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {action.status !== 'finalizada' && action.status !== 'cancelada' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleFinalizeAction(action); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-green-600"
                title="Finalizar"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            {action.status !== 'cancelada' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleCancelAction(action); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-orange-600"
                title="Cerrar / Cancelar"
              >
                <XCircle size={14} />
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); openEditModal(action); }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setActionToDelete(action); }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <h4 className="font-bold text-gray-800 text-sm mb-1">{action.title}</h4>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
          {action.description || 'Sin descripción'}
        </p>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center text-[10px] text-gray-500 gap-1.5">
            <UserIcon size={12} className="text-gray-400" />
            <span className="truncate">{assignedNames}</span>
          </div>
          <div className="flex items-center text-[10px] text-gray-500 gap-1.5 font-medium">
            <Calendar size={12} className="text-gray-400" />
            <span>Fin: {formatDateSafe(action.targetDate)}</span>
            {action.dateChangeCount && action.dateChangeCount > 0 ? (
              <span className="flex items-center gap-0.5 text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100 ml-1" title={`${action.dateChangeCount} cambios de fecha`}>
                <History size={10} />
                {action.dateChangeCount}
              </span>
            ) : null}
          </div>
        </div>

        {subActionStats.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center text-[10px] mb-1">
              <span className="text-gray-500 font-medium">Subacciones</span>
              <span className="text-blue-600 font-bold">{completedCount}/{subActionStats.length}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${(completedCount / subActionStats.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const actionColumns: Column<ActionPlan>[] = [
    { 
      header: 'Título', 
      accessor: (a) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800">{a.title}</span>
            {a.isEscalated && <span className="bg-orange-50 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border border-orange-100 flex items-center gap-1"><AlertCircle size={10} /> Escalado</span>}
            {a.type === 'incidencia' && <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border border-red-100 flex items-center gap-1"><AlertCircle size={10} /> Incidencia</span>}
          </div>
          <span className="text-xs text-gray-500 truncate max-w-[200px]">{a.description}</span>
        </div>
      ),
      sortable: true,
      sortAccessor: (a) => a.title
    },
    {
      header: 'Estado',
      accessor: (a) => {
        const s = STATUS_OPTIONS.find(so => so.value === a.status);
        return (
          <span className={clsx("px-2 py-1 rounded-full text-xs font-bold", s?.bg, s?.color)}>
            {s?.label}
          </span>
        );
      },
      sortable: true,
      sortAccessor: (a) => a.status
    },
    {
      header: 'Categoría',
      accessor: (a) => (
        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
          {a.categoryName || '-'}
        </span>
      ),
      sortable: true,
      sortAccessor: (a) => a.categoryName || ''
    },
    {
      header: 'Prioridad',
      accessor: (a) => {
        const p = PRIORITY_OPTIONS.find(po => po.value === a.priority);
        return (
          <span className={clsx("font-bold text-xs", p?.color)}>
            {p?.label}
          </span>
        );
      },
      sortable: true,
      sortAccessor: (a) => a.priority
    },
    {
      header: 'Asignado a',
      accessor: (a) => (
        <div className="flex items-center gap-1.5">
          <UserIcon size={14} className="text-gray-400" />
          <span className="text-xs truncate max-w-[150px]">{a.assignedToNames?.join(', ') || 'N/A'}</span>
        </div>
      ),
      sortable: true,
      sortAccessor: (a) => a.assignedToNames?.join(', ') || ''
    },
    {
      header: 'Fecha Fin',
      accessor: (a) => (
        <div className="flex items-center gap-1.5 min-w-[120px]">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-xs">{a.targetDate ? format(new Date(a.targetDate), 'dd/MM/yyyy') : 'N/A'}</span>
          {a.dateChangeCount && a.dateChangeCount > 0 ? (
            <span className="flex items-center gap-0.5 text-orange-600 bg-orange-50 px-1 hover:bg-orange-100 rounded text-[10px] border border-orange-100" title={`${a.dateChangeCount} cambios`}>
              <History size={10} />
              {a.dateChangeCount}
            </span>
          ) : null}
        </div>
      ),
      sortable: true,
      sortAccessor: (a) => a.targetDate
    },
    {
      header: 'Progreso',
      accessor: (a) => {
        const subs = subActions.filter(s => s.actionId === a.id);
        if (subs.length === 0) return <span className="text-xs text-gray-400">-</span>;
        const comp = subs.filter(s => s.completed).length;
        return (
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 h-1.5 overflow-hidden">
               <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(comp / subs.length) * 100}%` }} />
            </div>
            <span className="text-[10px] font-bold text-gray-500">{comp}/{subs.length}</span>
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-0" style={{ zoom: '0.75' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Plan de Acciones</h1>
          <p className="text-gray-500 text-sm">Gestiona y realiza seguimiento de las acciones operativas. </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-1 flex">
            <button 
              onClick={() => setView('kanban')}
              className={clsx("p-1.5 rounded-md transition-all", view === 'kanban' ? "bg-blue-50 text-blue-600" : "text-gray-400")}
              title="Vista Kanban"
            >
              <LayoutDashboard size={20} />
            </button>
            <button 
              onClick={() => setView('list')}
              className={clsx("p-1.5 rounded-md transition-all", view === 'list' ? "bg-blue-50 text-blue-600" : "text-gray-400")}
              title="Vista Lista"
            >
              <List size={20} />
            </button>
            <button 
              onClick={() => setView('escalated')}
              className={clsx("p-1.5 rounded-md transition-all", view === 'escalated' ? "bg-orange-50 text-orange-600" : "text-gray-400")}
              title="Vista Escalados"
            >
              <AlertCircle size={20} />
            </button>
          </div>
          <button 
            onClick={() => { setEditingAction({ assignedTo: [], assignedToNames: [] }); setTempSubActions([]); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition duration-200"
          >
            <Plus size={20} />
            <span className="font-semibold">Nueva Acción</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Equipo:</label>
          <select 
            value={filterTeamId}
            onChange={(e) => {
              setFilterTeamId(e.target.value);
              setFilterForumId(''); // Reset forum filter when team changes
            }}
            className="bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px] appearance-none cursor-pointer"
          >
            <option value="">Todos los equipos</option>
            {teams.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Foro:</label>
          <select 
            value={filterForumId}
            onChange={(e) => setFilterForumId(e.target.value)}
            className="bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px] appearance-none cursor-pointer"
          >
            <option value="">Todos los foros</option>
            {forums
              .filter(f => !filterTeamId || f.teamId === filterTeamId)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-3 ml-auto px-4 border-l border-gray-100">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Solo mis acciones</span>
          <button
            onClick={() => setOnlyResponsible(!onlyResponsible)}
            className={clsx(
              "w-10 h-5 rounded-full relative transition-all duration-300",
              onlyResponsible ? "bg-blue-600" : "bg-gray-200"
            )}
          >
            <div className={clsx(
              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
              onlyResponsible ? "left-6" : "left-1"
            )} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Main Content View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Cargando acciones...</p>
        </div>
      ) : (
        <>
          {view === 'kanban' && (
            <div className="flex flex-row gap-4 overflow-x-auto pb-6 custom-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none">
              {DATE_COLUMNS.map(col => {
                const actionsInColumn = filteredActions.filter(a => getActionDateCategory(a.targetDate) === col.value);
                return (
                  <div key={col.value} className="flex-none w-[85vw] sm:w-[350px] lg:flex-1 lg:min-w-0 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col max-h-[calc(100vh-250px)] snap-center">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-gray-50/80 backdrop-blur-sm rounded-t-2xl z-10">
                      <div className="flex items-center gap-2">
                         <span className={clsx("w-3 h-3 rounded-full", col.color.replace('text-', 'bg-'))}></span>
                         <h3 className="font-bold text-gray-800">{col.label}</h3>
                      </div>
                      <span className="bg-white border border-gray-200 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                        {actionsInColumn.length}
                      </span>
                    </div>
                    <div className="p-3 overflow-y-auto flex-1 custom-scrollbar space-y-3">
                      {actionsInColumn.map(renderActionCard)}
                      {actionsInColumn.length === 0 && (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center opacity-50">
                          <Clock size={24} className="text-gray-300 mb-2" />
                          <span className="text-xs text-gray-400">Sin acciones</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'list' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
              <Table
                columns={actionColumns}
                data={filteredActions}
                onEdit={openEditModal}
                onDelete={setActionToDelete}
                onFinalize={handleFinalizeAction}
              />
              {filteredActions.length === 0 && (
                <div className="p-12 text-center text-gray-400 border-t border-gray-100">
                  No hay acciones disponibles para mostrar.
                </div>
              )}
            </div>
          )}

          {view === 'escalated' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="flex items-center gap-4 py-2">
                 <span className="text-gray-700 font-bold text-sm">Filtrar escalados por mi</span>
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={onlyMineEscalated}
                      onChange={(e) => setOnlyMineEscalated(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 transition-all"></div>
                 </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                <div className="space-y-4">
                  <h2 className="bg-blue-50/50 py-2.5 text-center text-blue-700 font-bold tracking-[0.2em] uppercase text-xs rounded-xl border border-blue-100/50">
                    ACCIONES
                  </h2>
                  <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {(() => {
                      const escalatedActions = filteredActions.filter(a => a.isEscalated && (a.type === 'accion' || !a.type));
                      const finalFilter = onlyMineEscalated ? escalatedActions.filter(a => a.escalatedBy === dbUser?.uid) : escalatedActions;
                      
                      if (finalFilter.length === 0) return <p className="text-center py-12 text-gray-400 italic text-sm">No hay acciones escaladas</p>;
                      
                      return finalFilter.map(action => {
                        const subCount = subActions.filter(s => s.actionId === action.id).length;
                        return (
                          <div 
                            key={action.id}
                            onClick={() => openEditModal(action)}
                            className="bg-[#C1B7CE] p-5 rounded-2xl relative hover:brightness-95 transition-all cursor-pointer group"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-[#4F4F4F] text-lg leading-tight pr-8">{action.title}</h4>
                              <ArrowUp size={20} className="text-white absolute right-5 top-5 group-hover:scale-125 transition-transform" />
                            </div>
                            <p className="text-sm text-[#5F5F5F] font-semibold mt-1">
                              {action.createdByName || 'Usuario'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#707070] font-bold bg-white/30 px-2 py-0.5 rounded uppercase tracking-wider">
                                {action.escalatedAt ? format(new Date(action.escalatedAt), 'dd MMM yyyy', { locale: es }) : (action.createdAt ? format(new Date(action.createdAt), 'dd MMM yyyy', { locale: es }) : 'N/A')}
                              </span>
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between">
                              <div className="w-9 h-9 rounded-full bg-[#A89CB8] border-2 border-white flex items-center justify-center text-white text-sm font-black">
                                {subCount}
                              </div>
                              <span className="text-[10px] font-black text-white/80 uppercase tracking-tighter">Detalles</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="bg-red-50/50 py-2.5 text-center text-red-700 font-bold tracking-[0.2em] uppercase text-xs rounded-xl border border-red-100/50">
                    INCIDENCIAS
                  </h2>
                  <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {(() => {
                      const escalatedIncidents = filteredActions.filter(a => a.isEscalated && a.type === 'incidencia');
                      const finalFilter = onlyMineEscalated ? escalatedIncidents.filter(a => a.escalatedBy === dbUser?.uid) : escalatedIncidents;
                      
                      if (finalFilter.length === 0) return <p className="text-center py-12 text-gray-400 italic text-sm">No hay incidencias escaladas</p>;

                      return finalFilter.map(action => {
                        const subCount = subActions.filter(s => s.actionId === action.id).length;
                        return (
                          <div 
                            key={action.id}
                            onClick={() => openEditModal(action)}
                            className="bg-[#C1B7CE] p-5 rounded-2xl relative hover:brightness-95 transition-all cursor-pointer group"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-[#4F4F4F] text-lg leading-tight pr-8">{action.title}</h4>
                              <ArrowUp size={20} className="text-white absolute right-5 top-5 group-hover:scale-125 transition-transform" />
                            </div>
                            <p className="text-sm text-[#5F5F5F] font-semibold mt-1">
                              {action.createdByName || 'Usuario'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-[#707070] font-bold bg-white/30 px-2 py-0.5 rounded uppercase tracking-wider">
                                {action.escalatedAt ? format(new Date(action.escalatedAt), 'dd MMM yyyy', { locale: es }) : (action.createdAt ? format(new Date(action.createdAt), 'dd MMM yyyy', { locale: es }) : 'N/A')}
                              </span>
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between">
                              <div className="w-9 h-9 rounded-full bg-[#A89CB8] border-2 border-white flex items-center justify-center text-white text-sm font-black">
                                {subCount}
                              </div>
                              <span className="text-[10px] font-black text-white/80 uppercase tracking-tighter">Detalles</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Action Modal */}
      <Modal
        isOpen={!!editingAction}
        onClose={() => { 
          setEditingAction(null); 
          setTempSubActions([]); 
          setShowUserSelector(false);
          setUserSearchQuery('');
        }}
        title={editingAction?.id ? "Editar Acción" : "Nueva Acción"}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleSaveAction} className="flex flex-col max-h-[85vh]">
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Título de la acción</label>
                  <input 
                    type="text"
                    required
                    value={editingAction?.title || ''}
                    onChange={(e) => setEditingAction({ ...editingAction, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    placeholder="Ej: Revisar manual de mantenimiento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
                  <textarea 
                    rows={4}
                    value={editingAction?.description || ''}
                    onChange={(e) => setEditingAction({ ...editingAction, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none"
                    placeholder="Detalles de la acción..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                    <div className="flex p-1 bg-gray-50 rounded-xl border border-gray-100 h-[42px]">
                      <button
                        type="button"
                        onClick={() => setType('accion')}
                        className={clsx(
                          "flex-1 rounded-lg text-xs font-bold transition-all",
                          type === 'accion' ? "bg-white text-blue-600" : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        Acción
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('incidencia')}
                        className={clsx(
                          "flex-1 rounded-lg text-xs font-bold transition-all",
                          type === 'incidencia' ? "bg-white text-orange-600" : "text-gray-400 hover:text-gray-600"
                        )}
                      >
                        Incidencia
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Foro (Origen)</label>
                    <select 
                      value={editingAction?.originForumId || ''}
                      onChange={(e) => setEditingAction({ ...editingAction, originForumId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {forums.sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.teamName})</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Categoría</label>
                    <select 
                      value={editingAction?.categoryId || ''}
                      onChange={(e) => setEditingAction({ ...editingAction, categoryId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Prioridad</label>
                    <select 
                      value={editingAction?.priority || 'media'}
                      onChange={(e) => setEditingAction({ ...editingAction, priority: e.target.value as ActionPriority })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm"
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Estado
                    </label>
                    <div className="relative">
                      <select 
                        value={editingAction?.status || 'pendiente'}
                        onChange={(e) => setEditingAction({ ...editingAction, status: e.target.value as ActionStatus })}
                        disabled={editingAction?.status === 'pendiente' || editingAction?.status === 'en_progreso' || editingAction?.status === 'retrasada'}
                        className={clsx(
                          "w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm appearance-none",
                          (editingAction?.status === 'pendiente' || editingAction?.status === 'en_progreso' || editingAction?.status === 'retrasada') && "bg-gray-50 text-gray-500 cursor-not-allowed"
                        )}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      {(editingAction?.status === 'pendiente' || editingAction?.status === 'en_progreso' || editingAction?.status === 'retrasada') && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">Auto</span>
                        </div>
                      )}
                    </div>
                    {(editingAction?.status === 'pendiente' || editingAction?.status === 'en_progreso' || editingAction?.status === 'retrasada') && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">Calculado según la fecha.</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Vencimiento</label>
                    <input 
                      type="date"
                      required
                      value={editingAction?.targetDate || ''}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const newStatus = calculateAutomaticStatus(newDate, editingAction?.status || 'pendiente');
                        setEditingAction({ ...editingAction, targetDate: newDate, status: newStatus });
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Asignar a</label>
                  {assignableUsers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-1.5 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-500">
                        {editingAction?.assignedTo?.map(uid => {
                          const user = users.find(u => u.uid === uid);
                          if (!user) return null;
                          return (
                            <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                              {user.name}
                              <button 
                                type="button"
                                onClick={() => {
                                  const updated = editingAction.assignedTo?.filter(id => id !== uid) || [];
                                  setEditingAction({ ...editingAction, assignedTo: updated });
                                }}
                                className="hover:text-blue-900"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setShowUserSelector(!showUserSelector)}
                          className="flex-1 text-left px-2 text-sm text-gray-400 font-medium min-w-[120px]"
                        >
                          {(!editingAction?.assignedTo || editingAction.assignedTo.length === 0) ? "Seleccionar personas..." : "Añadir más..."}
                        </button>
                      </div>

                      {showUserSelector && (
                        <>
                          <div 
                            className="fixed inset-0 z-20" 
                            onClick={() => setShowUserSelector(false)}
                          />
                          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl z-30 flex flex-col max-h-80">
                            <div className="p-2 border-b border-gray-100">
                              <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Buscar por nombre..."
                                  value={userSearchQuery}
                                  onChange={(e) => setUserSearchQuery(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                            <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                              {(() => {
                                const filtered = assignableUsers.filter(u => 
                                  u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
                                );
                                if (filtered.length === 0) {
                                  return <p className="text-center py-4 text-xs text-gray-400 font-medium">No se encontraron resultados</p>;
                                }
                                return filtered.map(user => {
                                  const isAssigned = editingAction?.assignedTo?.includes(user.uid);
                                  return (
                                    <button
                                      key={user.uid}
                                      type="button"
                                      onClick={() => {
                                        const current = editingAction?.assignedTo || [];
                                        const updated = isAssigned 
                                          ? current.filter(id => id !== user.uid)
                                          : [...current, user.uid];
                                        setEditingAction({ ...editingAction, assignedTo: updated });
                                      }}
                                      className={clsx(
                                        "w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between",
                                        isAssigned ? "bg-blue-50 text-blue-600 font-bold" : "hover:bg-gray-50 text-gray-600"
                                      )}
                                    >
                                      <span>{user.name}</span>
                                      {isAssigned && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-xl border border-gray-100">
                      Solo puedes asignarte acciones a ti mismo o a miembros de tu equipo.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Notas de seguimiento</label>
                  <textarea 
                    rows={2}
                    value={editingAction?.notes || ''}
                    onChange={(e) => setEditingAction({ ...editingAction, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    placeholder="Observaciones de progreso..."
                  />
                </div>

                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <AlertCircle size={20} className="text-orange-600" />
                       <span className="font-bold text-gray-800 text-sm">Escalación de PDCAs</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isEscalated}
                        onChange={(e) => setIsEscalated(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                  </div>
                  
                  {isEscalated && (
                    <div className="animate-in slide-in-from-top-2 duration-200 pb-2">
                       <label className="block text-xs font-bold text-orange-700 mb-2 uppercase tracking-wider">Escalar a otro Foro</label>
                       <select 
                        value={escalatedToForumId}
                        onChange={(e) => setEscalatedToForumId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm"
                       >
                          <option value="">Seleccionar foro destino...</option>
                          {forums.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.teamName})</option>
                          ))}
                       </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4 lg:border-l lg:border-gray-100 lg:pl-8 pt-8 lg:pt-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-800">Subacciones</h3>
                    <p className="text-xs text-gray-400">Pasos detallados para completar</p>
                  </div>
                  <button 
                    type="button"
                    onClick={addTempSubAction}
                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={16} />
                    <span className="text-xs font-bold">Añadir</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {tempSubActions.map((sub, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 space-y-4 relative group hover:border-blue-200 transition-colors">
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox"
                          checked={sub.completed}
                          onChange={(e) => handleSubActionChange(idx, 'completed', e.target.checked)}
                          className="mt-1 w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 transition-all border-gray-300 cursor-pointer"
                        />
                        <textarea
                          rows={1}
                          value={sub.title || ''}
                          onChange={(e) => handleSubActionChange(idx, 'title', e.target.value)}
                          className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm font-medium text-gray-800 placeholder-gray-400 resize-none"
                          placeholder="Título de la subacción..."
                        />
                        <button 
                          type="button"
                          onClick={() => removeTempSubAction(idx, sub.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                         <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            <input 
                              type="date"
                              value={sub.currentProposedDate || ''}
                              onChange={(e) => handleSubActionChange(idx, 'currentProposedDate', e.target.value)}
                              className="bg-gray-50 border-none rounded-lg px-2 py-1 text-xs text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                         </div>
                         {sub.id && (
                          <button 
                            type="button"
                            onClick={() => setSelectedSubActionForHistory(sub as SubAction)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                            title="Ver histórico"
                          >
                            <History size={16} />
                          </button>
                         )}
                      </div>
                    </div>
                  ))}
                  {tempSubActions.length === 0 && (
                    <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                       <CheckCircle2 size={32} className="mx-auto text-gray-300 mb-2" />
                       <p className="text-sm text-gray-400">Sin pasos adicionales</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-gray-100">
            {editingAction?.id && editingAction.status !== 'finalizada' && editingAction.status !== 'cancelada' && (
              <button
                type="button"
                onClick={() => handleFinalizeAction(editingAction as ActionPlan)}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-green-600 hover:bg-green-50 rounded-xl transition-all border border-green-100 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Finalizar
              </button>
            )}
            {editingAction?.id && editingAction.status !== 'cancelada' && (
              <button
                type="button"
                onClick={() => handleCancelAction(editingAction as ActionPlan)}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-orange-600 hover:bg-orange-50 rounded-xl transition-all border border-orange-100 flex items-center justify-center gap-2"
              >
                <XCircle size={18} />
                Cancelar Acción
              </button>
            )}
            <button
              type="button"
              onClick={() => { setEditingAction(null); setTempSubActions([]); }}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-10 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={!!selectedSubActionForHistory}
        onClose={() => setSelectedSubActionForHistory(null)}
        title={`Histórico de Fechas: ${selectedSubActionForHistory?.title}`}
      >
        <div className="space-y-4">
           {selectedSubActionForHistory?.dateHistory && selectedSubActionForHistory.dateHistory.length > 0 ? (
             <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-50"></div>
                <div className="space-y-6">
                   {selectedSubActionForHistory.dateHistory.map((audit, i) => (
                     <div key={i} className="relative pl-10">
                        <div className="absolute left-0 w-6 h-6 bg-blue-100 border-2 border-white rounded-full flex items-center justify-center -translate-x-1.5 ring-4 ring-white">
                           <Clock size={12} className="text-blue-600" />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 transition-all hover:bg-white">
                           <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-blue-700">Cambio de planificación</p>
                              <span className="text-[10px] text-gray-400">
                                {audit.setAt ? format(new Date(audit.setAt), 'dd/MM/yyyy HH:mm') : '-'}
                              </span>
                           </div>
                           <p className="text-sm font-semibold text-gray-800">
                             Nueva fecha: <span className="text-blue-600 uppercase">
                               {audit.date ? format(new Date(audit.date), 'dd MMMM yyyy', { locale: es }) : '-'}
                             </span>
                           </p>
                           <p className="text-[10px] text-gray-500 mt-1">Establecido por: <span className="font-bold">{audit.setBy}</span></p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           ) : (
             <div className="text-center py-10 opacity-50">
                <History size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No hay histórico registrado todavía.</p>
             </div>
           )}
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={!!actionToDelete}
        title="Eliminar Acción"
        message={`¿Estás seguro de que deseas eliminar la acción "${actionToDelete?.title}"? Esta acción no se puede deshacer y eliminará también todas sus subacciones.`}
        onConfirm={handleDeleteAction}
        onCancel={() => setActionToDelete(null)}
      />
    </div>
  );
}
