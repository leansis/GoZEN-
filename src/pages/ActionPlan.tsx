import React, { useState, useEffect } from 'react';
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
  X
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
import { 
  ActionPlan, 
  ActionStatus, 
  ActionPriority, 
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

const STATUS_OPTIONS: { value: ActionStatus; label: string; color: string; bg: string }[] = [
  { value: 'pendiente', label: 'Pendiente', color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 'en_progreso', label: 'En Progreso', color: 'text-blue-600', bg: 'bg-blue-100' },
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
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [subActions, setSubActions] = useState<SubAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [editingAction, setEditingAction] = useState<Partial<ActionPlan> | null>(null);
  const [actionToDelete, setActionToDelete] = useState<ActionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const companyId = dbUser?.companyId || activeCompanyId;

  // Filter actions based on permissions
  const filteredActions = React.useMemo(() => {
    if (isAdmin) return actions;
    
    const supervisorTeams = teams.filter(t => t.supervisorId === dbUser?.uid || t.supervisorId === dbUser?.email);
    const managedUserIds = new Set<string>();
    supervisorTeams.forEach(t => {
      t.members?.forEach((m: any) => managedUserIds.add(m.uid));
    });

    return actions.filter(action => {
      const isCreator = action.createdBy === dbUser?.uid;
      const isAssignee = action.assignedTo.includes(dbUser?.uid || '');
      const isInManagedTeam = action.assignedTo.some(uid => managedUserIds.has(uid));
      
      if (isSupervisor) {
        return isCreator || isAssignee || isInManagedTeam;
      }
      return isCreator || isAssignee;
    });
  }, [actions, isAdmin, isSupervisor, dbUser, teams]);

  // Filter assignable users based on hierarchy
  const assignableUsers = React.useMemo(() => {
    let reachable: User[] = [];

    if (isAdmin) {
      reachable = [...users];
    } else {
      const supervisorTeams = teams.filter(t => t.supervisorId === dbUser?.uid || t.supervisorId === dbUser?.email);
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
      const actionPayload: any = {
        title: editingAction.title,
        description: editingAction.description || '',
        status: editingAction.status || 'pendiente',
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
        )
      };

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
        className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group mb-3"
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
            {action.categoryName && (
              <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1 uppercase">
                <Tag size={10} />
                {action.categoryName}
              </span>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {action.status !== 'finalizada' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleFinalizeAction(action); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-green-600"
                title="Finalizar"
              >
                <CheckCircle2 size={14} />
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
          <span className="font-bold text-gray-800">{a.title}</span>
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
          <p className="text-gray-500 text-sm">Gestiona y realiza seguimiento de las acciones operativas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-1 flex shadow-sm">
            <button 
              onClick={() => setView('kanban')}
              className={clsx("p-1.5 rounded-md transition-all", view === 'kanban' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}
              title="Vista Kanban"
            >
              <LayoutDashboard size={20} />
            </button>
            <button 
              onClick={() => setView('list')}
              className={clsx("p-1.5 rounded-md transition-all", view === 'list' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}
              title="Vista Lista"
            >
              <List size={20} />
            </button>
          </div>
          <button 
            onClick={() => { setEditingAction({ assignedTo: [], assignedToNames: [] }); setTempSubActions([]); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 active:scale-95 duration-200"
          >
            <Plus size={20} />
            <span className="font-semibold">Nueva Acción</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Kanban View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Cargando acciones...</p>
        </div>
      ) : (
        <>
          {view === 'kanban' ? (
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
                      <span className="bg-white border border-gray-200 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
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
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
                    placeholder="Ej: Revisar manual de mantenimiento"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
                  <textarea 
                    rows={4}
                    value={editingAction?.description || ''}
                    onChange={(e) => setEditingAction({ ...editingAction, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm resize-none"
                    placeholder="Detalles de la acción..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Acción</label>
                    <select 
                      value={editingAction?.categoryId || ''}
                      onChange={(e) => setEditingAction({ ...editingAction, categoryId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-white text-sm"
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
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-white text-sm"
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Estado</label>
                    <select 
                      value={editingAction?.status || 'pendiente'}
                      onChange={(e) => setEditingAction({ ...editingAction, status: e.target.value as ActionStatus })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-white text-sm"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Vencimiento</label>
                    <input 
                      type="date"
                      required
                      value={editingAction?.targetDate || ''}
                      onChange={(e) => setEditingAction({ ...editingAction, targetDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Asignar a</label>
                  {assignableUsers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-1.5 border border-gray-200 rounded-xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
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
                          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-30 flex flex-col max-h-80">
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
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-sm"
                    placeholder="Observaciones de progreso..."
                  />
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
                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Plus size={16} />
                    <span className="text-xs font-bold">Añadir</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {tempSubActions.map((sub, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 space-y-4 shadow-sm relative group hover:border-blue-200 transition-colors">
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
            {editingAction?.id && editingAction.status !== 'finalizada' && (
              <button
                type="button"
                onClick={() => handleFinalizeAction(editingAction as ActionPlan)}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-green-600 hover:bg-green-50 rounded-xl transition-all border border-green-100 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Finalizar Acción
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
              className="w-full sm:w-auto px-10 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
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
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:bg-white hover:shadow-md">
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
