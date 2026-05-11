import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  List, 
  LayoutDashboard, 
  Calendar, 
  AlertCircle, 
  AlertTriangle,
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
import { motion, AnimatePresence } from 'motion/react';
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
import { 
  db, 
  handleDiagnosticError 
} from '../firebase';
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
  ActionCategory,
  Incident
} from '../types';
import Table, { Column } from '../components/Table';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateAutomaticStatus } from '../lib/action-utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Indicator } from '../types';

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
  const { dbUser, company, isAdmin, isSupervisor, activeCompanyId } = useAuth();
  const { forums, getTeamParentChain } = useAppData();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'kanban' | 'escalated'>('kanban');
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [onlyMineEscalated, setOnlyMineEscalated] = useState(false);
  const [subActions, setSubActions] = useState<SubAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
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
      setIsEscalated(false);
      setEscalatedToForumId(editingAction.escalatedToForumId || '');
    } else {
      setShowIncidentSelector(false);
      setIncidentSearchQuery('');
      setShowUserSelector(false);
      setUserSearchQuery('');
    }
  }, [editingAction]);

  const [actionToDelete, setActionToDelete] = useState<ActionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showIncidentSelector, setShowIncidentSelector] = useState(false);
  const [incidentSearchQuery, setIncidentSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [backToActionId, setBackToActionId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const checkIsReadOnly = (item: any) => {
    if (!item) return false;
    
    // Admins have full access
    if (isAdmin) return false;
    
    // Determine the current owner
    const ownerId = item.isEscalated && item.escalatedToForumId 
      ? item.escalatedToForumId 
      : (item.escalationHistory?.length ? item.escalationHistory[item.escalationHistory.length - 1].toForumId : (item.originForumId || item.forumId));
    
    // If we have a forum filter, we can only edit if we are the owner
    if (filterForumId) {
      return ownerId !== filterForumId;
    }
    
    // If no filter (Global View), standard users can't edit escalated items 
    if (!filterForumId && item.isEscalated) return true;

    return false;
  };

  const shouldBeInEscaladosColumn = (item: any) => {
    if (!item) return false;
    
    // Determine the current owner
    const ownerId = item.isEscalated && item.escalatedToForumId 
      ? item.escalatedToForumId 
      : (item.escalationHistory?.length ? item.escalationHistory[item.escalationHistory.length - 1].toForumId : (item.originForumId || item.forumId));
    
    // If no specific forum filter is applied (Global View), 
    // all items that ARE currently escalated go to the "Escalados" column.
    if (!filterForumId) return !!item.isEscalated;
    
    // Filtered by forumId:
    const isOwner = ownerId === filterForumId;
    const isOrigin = (item.originForumId || item.forumId) === filterForumId;
    const isInHistory = item.escalationHistory?.some((h: any) => h.fromForumId === filterForumId);

    // 1. We are NOT the owner but we sent it away
    if (!isOwner && (isOrigin || isInHistory)) return true;
    
    // 2. We ARE the owner and it is currently escalated but has no date (incoming)
    // Incidents don't have targetDate, so we check if they are converted to actions
    const hasIncomingNoDate = item.isEscalated && (('targetDate' in item ? !item.targetDate : item.status !== 'en_accion'));
    if (isOwner && hasIncomingNoDate) return true;
    
    return false;
  };

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
      const actionOriginId = action.originForumId || (action as any).forumId;
      const isForumVisible = actionOriginId && visibleForumIds.has(actionOriginId);
      const isEscalatedTarget = action.escalatedToForumId && visibleForumIds.has(action.escalatedToForumId);
      const isEscalatedSender = action.escalationHistory?.some((h: any) => visibleForumIds.has(h.fromForumId));
      
      return isCreator || isResponsible || isForumVisible || isEscalatedTarget || isEscalatedSender;
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
      list = list.filter(a => 
        (a.originForumId || (a as any).forumId) === filterForumId || 
        a.escalatedToForumId === filterForumId ||
        a.escalationHistory?.some((h: any) => h.fromForumId === filterForumId)
      );
    }

    return list.map(a => ({
      ...a,
      status: calculateAutomaticStatus(a.targetDate, a.status)
    }));
  }, [actions, isAdmin, dbUser, teams, forums, onlyResponsible, filterTeamId, filterForumId]);

  // Filter incidents based on visibility rules
  const visibleIncidents = React.useMemo(() => {
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

    // 5. Filter incidents
    let list = isAdmin ? incidents : incidents.filter(incident => {
      const isCreator = incident.createdBy === userUid;
      const isForumVisible = visibleForumIds.has(incident.forumId);
      const isEscalatedTarget = incident.escalatedToForumId && visibleForumIds.has(incident.escalatedToForumId);
      const isEscalationInvolved = incident.escalationHistory?.some((h: any) => visibleForumIds.has(h.fromForumId));
      
      return isCreator || isForumVisible || isEscalatedTarget || isEscalationInvolved;
    });

    if (filterTeamId) {
      const forumIds = forums.filter(f => f.teamId === filterTeamId).map(f => f.id);
      list = list.filter(i => 
        forumIds.includes(i.forumId) || 
        (i.escalatedToForumId && forumIds.includes(i.escalatedToForumId))
      );
    }

    if (filterForumId) {
      list = list.filter(i => 
        i.forumId === filterForumId || 
        i.escalatedToForumId === filterForumId ||
        i.escalationHistory?.some(h => h.fromForumId === filterForumId)
      );
    }

    return list;
  }, [incidents, teams, forums, dbUser, isAdmin, filterTeamId, filterForumId]);

  // Filter incidents based on status (Legacy filteredIncidents for UI display if needed)
  const filteredIncidents = React.useMemo(() => {
    return visibleIncidents.filter(i => i.status === 'abierta' || !i.status);
  }, [visibleIncidents]);

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

    // Load Indicators
    const qIndicators = query(collection(db, 'indicators'), where('companyId', '==', companyId));
    const unsubIndicators = onSnapshot(qIndicators, (snap) => {
      setIndicators(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Indicator)));
    }, (err) => handleSnapError(err, 'indicators'));

    // Load Incidents
    const qIncidents = query(
      collection(db, 'incidents'),
      where('companyId', '==', companyId)
    );
    const unsubIncidents = onSnapshot(qIncidents, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setIncidents(docs);
    }, (err) => {
      handleSnapError(err, 'incidents');
      handleDiagnosticError(err, OperationType.LIST, 'incidents');
    });

    return () => {
      unsubActions();
      unsubSubActions();
      unsubUsers();
      unsubCategories();
      unsubTeams();
      unsubIndicators();
      unsubIncidents();
    };
  }, [companyId, dbUser]);

  const handleCloseModal = async () => {
    if (editingAction?.id && filterForumId) {
       // Mark as read for the current forum if they were notified
       if ((editingAction as any).viewedUpdates?.[filterForumId] === false) {
          const ref = doc(db, type === 'incidencia' ? 'incidents' : 'actionPlans', editingAction.id);
          await updateDoc(ref, {
             [`viewedUpdates.${filterForumId}`]: true
          });
       }
    }
    if (type === 'incidencia' && backToActionId) {
      const prevAction = actions.find(a => a.id === backToActionId);
      if (prevAction) {
        setEditingAction(prevAction as any);
        setType('accion');
        setBackToActionId(null);
        return;
      }
    }
    setEditingAction(null); 
    setTempSubActions([]); 
    setShowUserSelector(false);
    setUserSearchQuery('');
    setBackToActionId(null);
  };

  const checkAndResolveIncident = async (incidentId: string, currentActionId?: string, isCompleting?: boolean) => {
    if (!incidentId) return;
    
    // Get all actions linked to this incident
    // Note: 'tasks' in ActionPlan refers to actions
    const linkedActions = (actions as ActionPlan[]).filter(a => a.incidentId === incidentId);
    
    // Check if all actions are 'finalizada'
    // We must account for the action currently being updated if it's not in the list yet or has old status
    const allDone = linkedActions.every(a => {
      if (a.id === currentActionId) return isCompleting;
      return a.status === 'finalizada';
    });

    if (allDone && linkedActions.length > 0) {
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'resuelta'
      });
    }
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser) {
      setError("Debes estar autenticado para guardar acciones.");
      return;
    }
    if (!companyId || !editingAction?.title || (type !== 'incidencia' && !editingAction?.targetDate)) {
      setError("Por favor, completa todos los campos (título y fecha).");
      return;
    }

    try {
      const now = new Date().toISOString();

      if (type === 'incidencia') {
        const incidentPayload: any = {
          title: editingAction.title,
          description: editingAction.description || '',
          forumId: (editingAction as any).forumId || (editingAction as any).originForumId || '',
          forumName: forums.find(f => f.id === ((editingAction as any).forumId || (editingAction as any).originForumId))?.name || '',
          indicatorId: editingAction.indicatorId || '',
          indicatorName: editingAction.indicatorName || '',
          companyId: companyId,
          createdAt: editingAction.createdAt || now,
          createdBy: editingAction.createdBy || dbUser.uid,
          createdByName: editingAction.createdByName || dbUser.name,
          isEscalated: isEscalated,
          escalatedToForumId: escalatedToForumId || '',
          status: editingAction.status || 'abierta',
          viewedUpdates: editingAction.viewedUpdates || {},
          modifiedFields: editingAction.modifiedFields || []
        };

        const isNewlyEscalated = isEscalated && !editingAction.isEscalated;
        const escalationChanged = isEscalated && (editingAction.escalatedToForumId !== escalatedToForumId);

        if (isNewlyEscalated || escalationChanged) {
          incidentPayload.escalatedBy = dbUser.uid;
          incidentPayload.escalatedByName = dbUser.name;
          incidentPayload.escalatedAt = now;
          
          const fromForumName = forums.find(f => f.id === ((editingAction as any).originForumId || incidentPayload.forumId))?.name || 'Origen';
          const toForumName = forums.find(f => f.id === escalatedToForumId)?.name || 'Foro superior';
          
          const historyEntry: any = {
            fromForumId: (editingAction as any).originForumId || incidentPayload.forumId || '',
            fromForumName: fromForumName,
            toForumId: escalatedToForumId,
            toForumName: toForumName,
            at: now,
            by: dbUser.uid,
            byName: dbUser.name,
            note: `Escalado de ${fromForumName} a ${toForumName}`
          };
          
          incidentPayload.escalationHistory = [...(editingAction.escalationHistory || []), historyEntry];

          // Clear notification markers if re-escalating
          incidentPayload.viewedUpdates = {};
          incidentPayload.modifiedFields = [];
        }

        // Notification Track for incidents
        if (editingAction.id) {
          const original = incidents.find(i => i.id === editingAction.id);
          const ownerId = original?.isEscalated && original.escalatedToForumId 
            ? original.escalatedToForumId 
            : (original?.forumId);
            
          if (original && filterForumId === ownerId) {
            const modifiedKeys: string[] = [];
            if (original.title !== incidentPayload.title) modifiedKeys.push('title');
            if (original.description !== incidentPayload.description) modifiedKeys.push('description');
            if (original.status !== incidentPayload.status) modifiedKeys.push('status');
            
            if (modifiedKeys.length > 0) {
              const updateObj: Record<string, boolean> = { ...(original.viewedUpdates || {}) };
              
              // Notify origin
              const originId = original.forumId;
              if (originId && originId !== filterForumId) updateObj[originId] = false;
              
              // Notify history
              original.escalationHistory?.forEach((h: any) => {
                if (h.fromForumId && h.fromForumId !== filterForumId) {
                  updateObj[h.fromForumId] = false;
                }
              });

              incidentPayload.viewedUpdates = updateObj;
              incidentPayload.modifiedFields = modifiedKeys;
            }
          }
        }

        if (editingAction.id) {
          // If editing an existing incident
          const incidentRef = doc(db, 'incidents', editingAction.id);
          await updateDoc(incidentRef, incidentPayload);
        } else {
          // Creating a new incident
          await addDoc(collection(db, 'incidents'), incidentPayload);
        }

        if (backToActionId) {
          const prevAction = actions.find(a => a.id === backToActionId);
          if (prevAction) {
            setEditingAction(prevAction as any);
            setType('accion');
            setBackToActionId(null);
            return;
          }
        }

        setEditingAction(null);
        setError(null);
        return;
      }

      // Create a clean object with only the fields we want to save
      // This prevents sending 'id' field to addDoc or 'undefined' values
      const autoStatus = calculateAutomaticStatus(editingAction.targetDate, editingAction.status || 'pendiente');
      
      const actionPayload: any = {
        title: editingAction.title,
        description: editingAction.description || '',
        type: type,
        status: autoStatus,
        priority: (editingAction as any).priority || 'media',
        categoryId: editingAction.categoryId || '',
        categoryName: categories.find(c => c.id === editingAction.categoryId)?.name || '',
        targetDate: editingAction.targetDate,
        dateChangeCount: editingAction.dateChangeCount || 0,
        notes: editingAction.notes || '',
        customFields: editingAction.customFields || {},
        companyId: companyId,
        updatedAt: now,
        assignedTo: editingAction.assignedTo || [],
        assignedToNames: (editingAction.assignedTo || []).map(uid => 
          users.find(u => u.uid === uid)?.name || 'Desconocido'
        ),
        isEscalated: isEscalated,
        escalatedToForumId: escalatedToForumId || '',
        originForumId: editingAction.originForumId || filterForumId || '',
        originForumName: forums.find(f => f.id === (editingAction.originForumId || filterForumId))?.name || '',
        incidentId: editingAction.incidentId || '',
        viewedUpdates: editingAction.viewedUpdates || {},
        modifiedFields: editingAction.modifiedFields || []
      };

      const isNewlyEscalated = isEscalated && !editingAction.isEscalated;
      const escalationChanged = isEscalated && (editingAction.escalatedToForumId !== escalatedToForumId);

      if (isNewlyEscalated || escalationChanged) {
        actionPayload.escalatedBy = dbUser.uid;
        actionPayload.escalatedByName = dbUser.name;
        actionPayload.escalatedAt = now;
        
        // Add to history
        const fromForumName = forums.find(f => f.id === (editingAction.originForumId || filterForumId))?.name || 'Origen';
        const toForumName = forums.find(f => f.id === escalatedToForumId)?.name || 'Foro superior';
        
        const historyEntry: any = {
          fromForumId: editingAction.originForumId || filterForumId || '',
          fromForumName: fromForumName,
          toForumId: escalatedToForumId,
          toForumName: toForumName,
          at: now,
          by: dbUser.uid,
          byName: dbUser.name,
          note: `Escalado de ${fromForumName} a ${toForumName}`
        };
        
        actionPayload.escalationHistory = [...(editingAction.escalationHistory || []), historyEntry];

        // (1) Una acción escalada pierde el responsable y fecha originales
        actionPayload.assignedTo = [];
        actionPayload.assignedToNames = [];
        actionPayload.targetDate = "";
        actionPayload.status = "pendiente";
        
        // Clear notification markers if re-escalating
        actionPayload.viewedUpdates = {};
        actionPayload.modifiedFields = [];
      }

      // Notification Track for actions
      if (editingAction.id) {
        const original = actions.find(a => a.id === editingAction.id);
        const ownerId = original?.isEscalated && original.escalatedToForumId 
          ? original.escalatedToForumId 
          : (original?.originForumId || (original as any)?.forumId);

        if (original && filterForumId === ownerId) {
          const modifiedKeys: string[] = [];
          if (original.title !== actionPayload.title) modifiedKeys.push('title');
          if (original.description !== actionPayload.description) modifiedKeys.push('description');
          if (original.status !== actionPayload.status) modifiedKeys.push('status');
          if (JSON.stringify(original.assignedTo) !== JSON.stringify(actionPayload.assignedTo)) modifiedKeys.push('assignedTo');
          if (original.targetDate !== actionPayload.targetDate) modifiedKeys.push('targetDate');
          if (original.notes !== actionPayload.notes) modifiedKeys.push('notes');
          if (JSON.stringify(original.customFields) !== JSON.stringify(actionPayload.customFields)) modifiedKeys.push('customFields');
          
          if (modifiedKeys.length > 0) {
            const updateObj: Record<string, boolean> = { ...(original.viewedUpdates || {}) };
            
            // Notify origin
            const originId = original.originForumId || (original as any).forumId;
            if (originId && originId !== filterForumId) updateObj[originId] = false;
            
            // Notify history
            original.escalationHistory?.forEach((h: any) => {
              if (h.fromForumId && h.fromForumId !== filterForumId) {
                updateObj[h.fromForumId] = false;
              }
            });

            actionPayload.viewedUpdates = updateObj;
            actionPayload.modifiedFields = modifiedKeys;
          }
        }
      }

      let actionId = editingAction.id;
      const splitMode = company?.settings?.actionPlanMultipleAssigneeMode === 'split';
      const assignees = actionPayload.assignedTo || [];

      if (splitMode && assignees.length > 1 && type === 'accion') {
        // Handle Splitting logic
        const firstUid = assignees[0];
        const firstActionPayload = {
          ...actionPayload,
          assignedTo: [firstUid],
          assignedToNames: [users.find(u => u.uid === firstUid)?.name || 'Desconocido']
        };

        if (editingAction.id) {
          // Update the original document for the first assignee
          const originalAction = actions.find(a => a.id === editingAction.id);
          if (originalAction && originalAction.targetDate !== editingAction.targetDate) {
            firstActionPayload.dateChangeCount = (originalAction.dateChangeCount || 0) + 1;
          }
          await updateDoc(doc(db, 'actionPlans', editingAction.id), firstActionPayload);
          actionId = editingAction.id;
        } else {
          // Create the first document
          const newAction = {
            ...firstActionPayload,
            createdBy: dbUser.uid,
            createdByName: dbUser.name,
            createdAt: now
          };
          const docRef = await addDoc(collection(db, 'actionPlans'), newAction);
          actionId = docRef.id;
        }

        // Link incident to the first action only
        if (actionId && editingAction.incidentId && !editingAction.id) {
          await updateDoc(doc(db, "incidents", editingAction.incidentId), {
            status: 'en_accion',
            actionId: actionId
          });
        }

        // Handle Subactions for the first action
        for (const sub of tempSubActions) {
          if (sub.id) {
            const original = subActions.find(s => s.id === sub.id);
            if (original && (original.title !== sub.title || original.completed !== sub.completed || original.currentProposedDate !== sub.currentProposedDate)) {
              const subUpdates: any = { title: sub.title || '', completed: !!sub.completed, currentProposedDate: sub.currentProposedDate || '' };
              if (original.currentProposedDate !== sub.currentProposedDate) {
                subUpdates.dateHistory = [...(original.dateHistory || []), { date: sub.currentProposedDate || '', setAt: now, setBy: dbUser.name }];
              }
              await updateDoc(doc(db, 'subActions', sub.id), subUpdates);
            }
          } else {
            await addDoc(collection(db, 'subActions'), {
              title: sub.title || '',
              actionId: actionId,
              companyId: companyId,
              completed: !!sub.completed,
              currentProposedDate: sub.currentProposedDate || '',
              dateHistory: sub.currentProposedDate ? [{ date: sub.currentProposedDate, setAt: now, setBy: dbUser.name }] : []
            });
          }
        }

        // Create separate actions for the rest of assignees
        for (let i = 1; i < assignees.length; i++) {
          const uid = assignees[i];
          const splitPayload = {
            ...actionPayload,
            assignedTo: [uid],
            assignedToNames: [users.find(u => u.uid === uid)?.name || 'Desconocido'],
            createdBy: dbUser.uid,
            createdByName: dbUser.name,
            createdAt: now,
            updatedAt: now
          };
          const docRef = await addDoc(collection(db, 'actionPlans'), splitPayload);
          const newActionId = docRef.id;

          // Duplicate subactions for the split action
          for (const sub of tempSubActions) {
            await addDoc(collection(db, 'subActions'), {
              title: sub.title || '',
              actionId: newActionId,
              companyId: companyId,
              completed: !!sub.completed,
              currentProposedDate: sub.currentProposedDate || '',
              dateHistory: sub.currentProposedDate ? [{ date: sub.currentProposedDate, setAt: now, setBy: dbUser.name }] : []
            });
          }
        }
      } else {
        // Standard non-split logic
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

          // Auto-resolve incident if status is finalizada
          if (actionPayload.status === 'finalizada' && originalAction?.incidentId) {
            await checkAndResolveIncident(originalAction.incidentId, editingAction.id, true);
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

        // If this action was linked to an incident, update the incident status
        if (actionId && editingAction.incidentId && !editingAction.id) {
          await updateDoc(doc(db, "incidents", editingAction.incidentId), {
            status: 'en_accion',
            actionId: actionId
          });
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

  const handleFinalizeAction = async (action: any) => {
    try {
      const isIncident = action.type === 'incidencia' || 'indicatorId' in action;
      const collectionName = isIncident ? 'incidents' : 'actionPlans';
      const newStatus = isIncident ? 'resuelta' : 'finalizada';

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };
      
      if (!isIncident) {
        updateData.priority = action.priority || 'media';
      }

      await updateDoc(doc(db, collectionName, action.id), updateData);
      
      if (editingAction?.id === action.id) {
        setEditingAction({ ...editingAction, status: newStatus as any });
      }
      
      // Auto-resolve incident if applicable (for actions linked to incidents)
      if (!isIncident && action.incidentId) {
        await checkAndResolveIncident(action.incidentId, action.id, true);
      }
    } catch (err) {
      console.error("Error finalizing:", err);
      setError("Error al finalizar el item.");
    }
  };

  const handleCancelAction = async (action: ActionPlan) => {
    try {
      await updateDoc(doc(db, 'actionPlans', action.id), {
        status: 'cancelada',
        priority: action.priority || 'media',
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
    setType('accion');
    setEditingAction({ ...action });
    setTempSubActions(subActions.filter(s => s.actionId === action.id));
  };

  const openEditIncidentModal = (incident: Incident) => {
    setType('incidencia');
    setEditingAction({
      id: incident.id,
      title: incident.title,
      description: incident.description,
      originForumId: incident.forumId,
      originForumName: incident.forumName,
      indicatorId: incident.indicatorId,
      indicatorName: incident.indicatorName,
      createdAt: incident.createdAt,
      createdBy: incident.createdBy,
      type: 'incidencia'
    });
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

  // Incident Drag & Drop logic
  const handleDragStart = (e: React.DragEvent, incident: Incident) => {
    e.dataTransfer.setData('incidentId', incident.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnColumn = async (e: React.DragEvent, columnValue: string) => {
    e.preventDefault();
    const incidentId = e.dataTransfer.getData('incidentId');
    const actionId = e.dataTransfer.getData('actionId');

    if (incidentId) {
      const incident = incidents.find(i => i.id === incidentId);
      if (!incident || !dbUser || !companyId || columnValue === 'incidencias') return;

      if (columnValue === 'escalados') {
        // Escalate as incident, not action
        setEditingAction({
          id: incident.id,
          title: incident.title,
          description: incident.description,
          originForumId: incident.forumId,
          originForumName: incident.forumName,
          indicatorId: incident.indicatorId,
          indicatorName: incident.indicatorName,
          isEscalated: incident.isEscalated || false,
          escalatedToForumId: incident.escalatedToForumId || "",
          escalationHistory: incident.escalationHistory || [],
          createdAt: incident.createdAt,
          createdBy: incident.createdBy,
          createdByName: incident.createdByName,
          status: incident.status || 'abierta'
        } as any);
        setType('incidencia');
        setIsEscalated(true);
        setEscalatedToForumId(incident.escalatedToForumId || "");
        return;
      }

      try {
        const now = new Date().toISOString();
        let targetDate = '';
        
        // Determine target date based on column
        const today = new Date();
        if (columnValue === 'atrasadas') {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          targetDate = yesterday.toISOString().split('T')[0];
        } else if (columnValue === 'hoy') {
          targetDate = today.toISOString().split('T')[0];
        } else {
          // default for proximas
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          targetDate = nextWeek.toISOString().split('T')[0];
        }

        const actionPayload: any = {
          title: incident.title,
          description: incident.description || '',
          type: 'incidencia',
          status: 'pendiente',
          priority: 'media',
          targetDate: targetDate,
          dateChangeCount: 0,
          notes: '',
          companyId: companyId,
          createdAt: now,
          updatedAt: now,
          createdBy: dbUser.uid,
          createdByName: dbUser.name,
          assignedTo: [dbUser.uid],
          assignedToNames: [dbUser.name],
          originForumId: incident.forumId,
          originForumName: incident.forumName,
          incidentId: incident.id,
          indicatorId: incident.indicatorId || '',
          indicatorName: incident.indicatorName || '',
          isEscalated: incident.isEscalated || false,
          escalatedToForumId: incident.escalatedToForumId || "",
          escalationHistory: incident.escalationHistory || []
        };

        // Add the action
        const actionRef = await addDoc(collection(db, 'actionPlans'), actionPayload);
        
        // Update the incident instead of deleting it
        await updateDoc(doc(db, 'incidents', incident.id), {
          status: 'en_accion',
          actionId: actionRef.id
        });

        // Open the modal to refine details
        const newAction = { id: actionRef.id, ...actionPayload };
        openEditModal(newAction as ActionPlan);
        
      } catch (err) {
        handleDiagnosticError(err, OperationType.WRITE, 'actionPlans/incidents');
        console.error("Error converting incident to action:", err);
        setError("Error al convertir la incidencia en acción.");
      }
    } else if (actionId) {
      const action = actions.find(a => a.id === actionId);
      if (!action || columnValue === 'incidencias') return;

      try {
        if (columnValue === 'escalados') {
          // Open edit modal to specify escalation forum
          openEditModal(action);
          // We'll handle the actual escalation field update in the modal save
          return;
        }

        if (columnValue === 'proximas') {
          // Open edit modal to change date
          openEditModal(action);
          return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        if (columnValue === 'hoy' && action.targetDate !== todayStr) {
          await updateDoc(doc(db, 'actionPlans', action.id), {
            targetDate: todayStr,
            priority: action.priority || 'media',
            updatedAt: new Date().toISOString(),
            isEscalated: false // Un-escalate if manually moved to Hoy
          });
        }
      } catch (err) {
        console.error("Error moving action:", err);
      }
    }
  };

  const renderIncidentCard = (incident: Incident) => {
    if (!incident) return null;
    
    // Context-aware escalation logic
    const itemOwnerId = incident.isEscalated && incident.escalatedToForumId ? incident.escalatedToForumId : (incident.escalationHistory?.length ? incident.escalationHistory[incident.escalationHistory.length - 1].toForumId : incident.forumId);
    const isItemOwner = filterForumId ? itemOwnerId === filterForumId : true;
    const isComingFromBelow = filterForumId ? (isItemOwner && incident.forumId !== filterForumId) : false;
    const isGoingToAbove = filterForumId ? !isItemOwner : (!!incident.isEscalated);

    return (
      <div 
        key={incident.id}
        draggable={!isGoingToAbove}
        onDragStart={(e) => {
          if (isGoingToAbove) return;
          handleDragStart(e, incident);
        }}
        onClick={() => openEditIncidentModal(incident)}
        className={clsx(
          "bg-white rounded-xl border border-red-100 transition-all group mb-2 shadow-sm active:scale-95 relative overflow-hidden",
          isGoingToAbove ? "cursor-pointer shadow-none" : "hover:border-red-300 cursor-pointer"
        )}
      >
        {incident.viewedUpdates?.[filterForumId || ''] === false && (
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute top-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md z-30"
            title="Actualizado"
          />
        )}
        
        <div className={clsx(
          "p-2.5 transition-all duration-200",
          isGoingToAbove && "opacity-50 grayscale-[0.5]"
        )}>
          <div className="flex justify-between items-start gap-1 mb-1.5">
            <div className="flex gap-1 items-start">
              {isComingFromBelow && (
                <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0 transform rotate-180" />
              )}
              {isGoingToAbove && (
                <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              )}
              <h5 className="font-bold text-gray-800 text-[10px] leading-tight group-hover:text-red-600 transition-colors line-clamp-2">
                {incident.title}
              </h5>
            </div>
            <div className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-gray-400">
              <Clock size={9} />
              {(() => {
                const d = new Date(incident.createdAt);
                return !isNaN(d.getTime()) ? format(d, "dd MMM", { locale: es }) : 'N/A';
              })()}
            </div>
            <span className="text-[7px] font-black text-red-600 bg-red-50 px-1 py-0.5 rounded uppercase">Incid.</span>
          </div>
        </div>
      </div>
    );
  };

  // Kanban logic - Grouping by Date
  const getActionDateCategory = (action: ActionPlan): string => {
    // If it's escalated AND we are NOT in the "Escalados" column context (which we handle in the loop)
    // we want to know its "natural" column if it's been escalated TO this user (general view).
    // But for simplicity in the general view, we keep the user's existing preference if they want a separate column.
    
    const dateStr = action.targetDate;
    if (!dateStr) return 'sin_fecha';
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (targetDate < today) return 'atrasadas';
    if (targetDate.getTime() === today.getTime()) return 'hoy';
    return 'proximas';
  };

  const DATE_COLUMNS = [
    { value: 'incidencias', label: 'Incidencias', color: 'text-red-600', bg: 'bg-red-50', icon: <AlertTriangle size={12} /> },
    { value: 'atrasadas', label: 'Retrasadas', color: 'text-blue-600', bg: 'bg-blue-50', icon: <div className="relative"><Clock size={12} /><span className="absolute -top-1 -right-1 text-[8px] font-bold">-</span></div> },
    { value: 'hoy', label: 'Hoy', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock size={12} /> },
    { value: 'proximas', label: 'Próximas', color: 'text-blue-600', bg: 'bg-blue-50', icon: <div className="relative"><Clock size={12} /><span className="absolute -top-1 -right-1 text-[8px] font-bold">+</span></div> },
    { value: 'escalados', label: 'Escalados', color: 'text-blue-900', bg: 'bg-blue-100', icon: <ArrowUp size={12} /> },
  ];

  const renderActionCard = (action: ActionPlan) => {
    if (!action) return null;
    const assignedNames = action.assignedToNames?.join(', ') || 'Sin asignar';
    const subActionStats = subActions.filter(s => s.actionId === action.id);
    const completedCount = subActionStats.filter(s => s.completed).length;
    
    // Check for linked incident
    const linkedIncident = incidents.find(i => i.id === action.incidentId);
    
    const handleDragStartAction = (e: React.DragEvent) => {
      e.dataTransfer.setData('actionId', action.id);
      e.dataTransfer.effectAllowed = 'move';
    };

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
    
    const itemOwnerId = action.isEscalated && action.escalatedToForumId ? action.escalatedToForumId : (action.escalationHistory?.length ? action.escalationHistory[action.escalationHistory.length - 1].toForumId : (action.originForumId || (action as any).forumId));
    const isItemOwner = filterForumId ? itemOwnerId === filterForumId : true;
    const isComingFromBelow = filterForumId ? (isItemOwner && (action.originForumId || (action as any).forumId) !== filterForumId) : false;
    const isGoingToAbove = filterForumId ? !isItemOwner : false;
    const isEscalationAnywhere = !!action.isEscalated;

    return (
      <div 
        key={action.id}
        draggable={!isGoingToAbove}
        onDragStart={(e) => {
          if (isGoingToAbove) return;
          e.dataTransfer.setData('actionId', action.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={clsx(
          "bg-white rounded-xl border border-gray-100 transition-all group mb-2 shadow-sm active:scale-95 relative overflow-hidden",
          isGoingToAbove ? "cursor-pointer shadow-none" : "hover:border-blue-200 cursor-pointer"
        )}
        onClick={() => openEditModal(action)}
      >
        {action.viewedUpdates?.[filterForumId || ''] === false && (
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute top-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md z-30"
            title="Actualizado"
          />
        )}
        <div className={clsx(
          "p-2.5 transition-all duration-200",
          isGoingToAbove && "opacity-50 grayscale-[0.5]"
        )}>
          <div className="flex justify-between items-start mb-1.5">
            <div className="flex flex-wrap gap-1 items-start">
              {isComingFromBelow && (
                <ArrowUp className="w-3.5 h-3.5 text-blue-500 shrink-0 transform rotate-180" />
              )}
              {isGoingToAbove && (
                <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              )}
              <h4 className="font-bold text-gray-800 text-[10px] leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                {action.title}
                {action.incidentId && (
                  <AlertCircle size={10} className="inline-block ml-1 text-red-500" />
                )}
              </h4>
            </div>
            {(!checkIsReadOnly(action) || isAdmin) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <button 
                  onClick={(e) => { e.stopPropagation(); openEditModal(action); }}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center text-[9px] text-gray-400 gap-1.5 font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1">
                <UserIcon size={10} />
                <span className="truncate">{assignedNames.split(',')[0] || '---'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={10} />
                <span>{formatDateSafe(action.targetDate).split('202')[0]}</span>
              </div>
            </div>
          </div>

          {linkedIncident && (
            <div className="mt-1.5 p-1.5 bg-red-50/30 rounded border border-red-100 flex flex-col gap-0.5">
               <span className="text-[7px] font-black text-red-600 uppercase opacity-60">Origen: Incid.</span>
               <p className="text-[8px] text-red-800 line-clamp-1 font-medium italic opacity-80">"{linkedIncident.title}"</p>
            </div>
          )}

          {subActionStats.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-50">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${(completedCount / subActionStats.length) * 100}%` }}
                  />
                </div>
                <span className="text-[8px] font-black text-gray-400">{completedCount}/{subActionStats.length}</span>
              </div>
            </div>
          )}
        </div>
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
            {a.isEscalated && (
              <span className="bg-orange-50 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border border-orange-100 flex items-center gap-1">
                <AlertCircle size={10} /> Escalado {a.escalatedToForumId ? `a ${forums.find(f => f.id === a.escalatedToForumId)?.name}` : ''}
              </span>
            )}
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
    ...categories.filter(c => c.active).map(cat => ({
      header: cat.name,
      accessor: (a: ActionPlan) => (
        <span className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">
          {a.customFields?.[cat.id] || '-'}
        </span>
      ),
      sortable: true,
      sortAccessor: (a: ActionPlan) => a.customFields?.[cat.id] || ''
    })),
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
          <span className="text-xs">{(() => {
            if (!a.targetDate) return 'N/A';
            const d = new Date(a.targetDate);
            return !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : 'N/A';
          })()}</span>
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
          </div>
          <button 
            onClick={() => { 
              setEditingAction({ assignedTo: [], assignedToNames: [], priority: 'media' }); 
              setTempSubActions([]); 
            }}
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

        <div className="flex items-center gap-3 ml-auto bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] tracking-widest uppercase font-black text-gray-500">Solo mis acciones</span>
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
            <div className="flex flex-row gap-1.5 overflow-x-auto pb-4 custom-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none min-h-[600px]">
              {DATE_COLUMNS.map(col => {
                const isIncidents = col.value === 'incidencias';
                const isEscalados = col.value === 'escalados';
                
                const itemsInColumn = isIncidents 
                  ? filteredIncidents.filter(i => {
                      if (!i) return false;
                      const ownerId = i.isEscalated && i.escalatedToForumId ? i.escalatedToForumId : (i.escalationHistory?.length ? i.escalationHistory[i.escalationHistory.length - 1].toForumId : i.forumId);
                      const isOwner = filterForumId ? ownerId === filterForumId : true;
                      
                      return isOwner && !i.isEscalated && i.status !== 'en_accion';
                    })
                  : isEscalados
                    ? [
                        ...filteredActions.filter(a => a && shouldBeInEscaladosColumn(a)),
                        ...filteredIncidents.filter(i => i && shouldBeInEscaladosColumn(i))
                      ]
                    : filteredActions.filter(a => {
                        if (!a) return false;
                        if (shouldBeInEscaladosColumn(a)) return false;
                        return a.status !== 'finalizada' && getActionDateCategory(a) === col.value;
                      });

                return (
                  <div 
                    key={col.value} 
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn(col.value);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => {
                      setDragOverColumn(null);
                      handleDropOnColumn(e, col.value);
                    }}
                    className={clsx(
                      "flex-none w-[85vw] sm:w-[250px] lg:flex-1 lg:min-w-0 rounded-2xl border flex flex-col snap-start transition-all duration-200",
                      dragOverColumn === col.value 
                        ? "bg-blue-50/50 border-blue-400 border-2" 
                        : "bg-white border-gray-100"
                    )}
                  >
                    <div className={clsx(
                      "p-3 border-b flex items-center justify-between sticky top-0 backdrop-blur-sm rounded-t-2xl z-10",
                      col.bg
                    )}>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                         <span className={col.color}>{(col as any).icon}</span>
                         <h4 className={clsx("font-black uppercase tracking-tighter text-[10px] truncate", col.color)}>{col.label}</h4>
                      </div>
                      <span className="bg-white/50 text-gray-500 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-gray-100 shadow-sm">
                        {itemsInColumn.length}
                      </span>
                    </div>
                    <div className="p-2.5 overflow-y-auto flex-1 custom-scrollbar space-y-2 bg-gray-50/30">
                      {itemsInColumn.map(item => {
                        if (!item) return null;
                        return 'indicatorId' in item ? renderIncidentCard(item as Incident) : renderActionCard(item as ActionPlan);
                      })}
                      {itemsInColumn.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-300 opacity-40">
                          {isIncidents ? <AlertTriangle size={32} className="mb-2" /> : <Clock size={32} className="mb-2" />}
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            {isIncidents ? "Sin incidencias" : "Sin acciones"}
                          </p>
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
                onDelete={(a) => (isAdmin || !checkIsReadOnly(a)) && setActionToDelete(a)}
                onFinalize={(a) => !checkIsReadOnly(a) && handleFinalizeAction(a)}
                ignoreEscalation={isAdmin}
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
        onClose={handleCloseModal}
        title={
          <div className="flex items-center gap-6">
            <span>{editingAction?.id ? (type === 'incidencia' ? 'Editar Incidencia' : 'Editar Acción') : (type === 'incidencia' ? 'Nueva Incidencia' : 'Nueva Acción')}</span>
            {!editingAction?.id && (
              <div className="flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 h-[32px] w-[200px]">
                <button
                  type="button"
                  onClick={() => setType('accion')}
                  className={clsx(
                    "flex-1 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all",
                    type === 'accion' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Acción
                </button>
                <button
                  type="button"
                  onClick={() => setType('incidencia')}
                  className={clsx(
                    "flex-1 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all",
                    type === 'incidencia' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Incidencia
                </button>
              </div>
            )}
          </div>
        }
        maxWidth="max-w-5xl"
      >
        {(() => {
          const isReadOnly = checkIsReadOnly(editingAction);
          return (
            <form 
              onSubmit={(e) => {
                if (isReadOnly) {
                  e.preventDefault();
                  setEditingAction(null);
                  return;
                }
                handleSaveAction(e);
              }} 
              className="flex flex-col max-h-[85vh]"
            >
              <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                {isReadOnly && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      <ArrowUp size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase tracking-tight">Modo Lectura</p>
                      <p className="text-[10px] text-blue-600 font-medium">Esta acción ha sido escalada y no puede modificarse en este foro.</p>
                    </div>
                  </div>
                )}
                <div className={clsx(
                  "grid gap-8",
                  type === 'incidencia' ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-5"
                )}>
                  <div className={type === 'incidencia' ? "space-y-6" : "lg:col-span-3 space-y-6"}>
                    {(() => {
                        const renderLabel = (text: string, fieldName: string) => {
                            const isModified = editingAction?.modifiedFields?.includes(fieldName);
                            const showMark = isModified && (editingAction as any)?.viewedUpdates?.[filterForumId || ''] === false;
                            
                            return (
                                <div className="flex items-center gap-2 mb-1">
                                <label className="block text-sm font-semibold text-gray-700">{text}</label>
                                {showMark && (
                                    <motion.div 
                                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                                    />
                                )}
                                </div>
                            );
                        };
                        return (
                            <>
                            <div>
                              {renderLabel(`Título ${type === 'incidencia' ? 'de la incidencia' : 'de la acción'}`, 'title')}
                              <input 
                                type="text"
                                required
                                readOnly={isReadOnly}
                                disabled={isReadOnly}
                                value={editingAction?.title || ''}
                                onChange={(e) => editingAction && setEditingAction({ ...editingAction, title: e.target.value })}
                                className={clsx(
                                  "w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm",
                                  isReadOnly && "bg-gray-50 opacity-75 cursor-default focus:ring-gray-200"
                                )}
                                placeholder={type === 'incidencia' ? "Ej: Fallo en el sistema de refrigeración" : "Ej: Revisar manual de mantenimiento"}
                              />
                    </div>

                {type === 'accion' && (
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Incidencia vinculada</label>
                    <div className={clsx(
                      "w-full px-4 py-3 border border-gray-200 rounded-xl bg-white flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 transition-all",
                      isReadOnly && "bg-gray-50 opacity-75 cursor-default"
                    )}
                    onClick={() => !isReadOnly && setShowIncidentSelector(!showIncidentSelector)}
                    >
                      <span className={clsx("text-sm", !editingAction?.incidentId && "text-gray-400")}>
                        {editingAction?.incidentId 
                          ? incidents.find(i => i.id === editingAction.incidentId)?.title || "Incidencia no encontrada"
                          : "Ninguna"
                        }
                      </span>
                      {!isReadOnly && <Search size={16} className="text-gray-400" />}
                    </div>

                    {showIncidentSelector && !isReadOnly && (
                      <>
                        <div 
                          className="fixed inset-0 z-20" 
                          onClick={() => setShowIncidentSelector(false)}
                        />
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-30 flex flex-col max-h-80 overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Buscar incidencia..."
                                value={incidentSearchQuery}
                                onChange={(e) => setIncidentSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                              />
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            <button
                              type="button"
                              onClick={() => {
                                editingAction && setEditingAction({ ...editingAction, incidentId: "" });
                                setShowIncidentSelector(false);
                                setIncidentSearchQuery("");
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
                            >
                              <X size={14} />
                              Ninguna
                            </button>
                            {visibleIncidents
                              .filter(i => i.title.toLowerCase().includes(incidentSearchQuery.toLowerCase()))
                              .map(i => (
                                <button
                                  key={i.id}
                                  type="button"
                                  onClick={() => {
                                    editingAction && setEditingAction({ ...editingAction, incidentId: i.id });
                                    setShowIncidentSelector(false);
                                    setIncidentSearchQuery("");
                                  }}
                                  className={clsx(
                                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                                    editingAction?.incidentId === i.id ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700 hover:bg-gray-50"
                                  )}
                                >
                                  <div className="font-bold">{i.title}</div>
                                  <div className="text-[10px] opacity-60 uppercase tracking-tight">{i.forumName}</div>
                                </button>
                              ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {type === 'accion' && editingAction?.incidentId && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-red-600" size={20} />
                      <div>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Esta acción proviene de una incidencia</p>
                        <p className="text-sm font-bold text-red-800">{incidents.find(i => i.id === editingAction.incidentId)?.title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const inc = incidents.find(i => i.id === editingAction.incidentId);
                        if (inc) {
                          if (editingAction.id) {
                            setBackToActionId(editingAction.id);
                          }
                          setEditingAction(inc as any);
                          setType('incidencia');
                        }
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shrink-0"
                    >
                      Ver Incidencia
                    </button>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-semibold text-gray-700">Descripción</label>
                    {editingAction?.modifiedFields?.includes('description') && (editingAction as any)?.viewedUpdates?.[filterForumId || ''] === false && (
                      <motion.div 
                         animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                         transition={{ duration: 1.5, repeat: Infinity }}
                         className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      />
                    )}
                  </div>
                  <textarea 
                    rows={4}
                    readOnly={isReadOnly}
                    value={editingAction?.description || ''}
                    onChange={(e) => editingAction && setEditingAction({ ...editingAction, description: e.target.value })}
                    className={clsx(
                      "w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm resize-none",
                      isReadOnly && "bg-gray-50 opacity-75 cursor-default focus:ring-gray-200"
                    )}
                    placeholder="Detalles..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Foro (Origen)</label>
                    <select 
                      value={editingAction?.originForumId || ''}
                      disabled={isReadOnly}
                      onChange={(e) => editingAction && setEditingAction({ ...editingAction, originForumId: e.target.value })}
                      className={clsx(
                        "w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm",
                        isReadOnly && "bg-gray-50 opacity-75 cursor-not-allowed"
                      )}
                    >
                      <option value="">Seleccionar...</option>
                      {forums.sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                        <option key={f.id} value={f.id}>{f.name} ({f.teamName})</option>
                      ))}
                    </select>
                  </div>

                  {type === 'incidencia' ? (
                    <>
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha</label>
                        <input 
                          type="date"
                          required
                          readOnly={isReadOnly}
                      value={(() => {
                        if (!editingAction?.createdAt) return new Date().toISOString().split('T')[0];
                        const d = new Date(editingAction.createdAt);
                        return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                      })()}
                      onChange={(e) => {
                        if (editingAction) {
                          const d = new Date(e.target.value);
                          if (!isNaN(d.getTime())) {
                            setEditingAction({ ...editingAction, createdAt: d.toISOString() });
                          }
                        }
                      }}
                          className={clsx(
                            "w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm",
                            isReadOnly && "bg-gray-50 opacity-75 cursor-default focus:ring-gray-200"
                          )}
                        />
                      </div>
                      <div className="sm:col-span-2">
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Indicador Asociado</label>
                         <select 
                           value={editingAction?.indicatorId || ''}
                           disabled={isReadOnly}
                           onChange={(e) => editingAction && setEditingAction({ ...editingAction, indicatorId: e.target.value, indicatorName: (e.target as any).options[e.target.selectedIndex].text })}
                           className={clsx(
                             "w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm",
                             isReadOnly && "bg-gray-50 opacity-75 cursor-not-allowed"
                           )}
                         >
                           <option value="">Ninguno</option>
                           {indicators.map(i => (
                             <option key={i.id} value={i.id}>{i.name} ({i.typology})</option>
                           ))}
                         </select>
                      </div>
                    </>
                  ) : (
                    <>
                      {categories.filter(c => c.active).map(cat => (
                        <div key={cat.id} className="sm:col-span-1">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{cat.name}</label>
                          <select 
                            value={editingAction?.customFields?.[cat.id] || ''}
                            disabled={isReadOnly}
                            onChange={(e) => {
                              editingAction && setEditingAction({ 
                                ...editingAction, 
                                customFields: {
                                  ...(editingAction.customFields || {}),
                                  [cat.id]: e.target.value
                                } 
                              });
                            }}
                            className={clsx(
                              "w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm",
                              isReadOnly && "bg-gray-50 opacity-75 cursor-not-allowed"
                            )}
                          >
                            <option value="">Seleccionar...</option>
                            {cat.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                        <div className="sm:col-span-1">
                          <div className="flex items-center gap-2 mb-1">
                            <label className="block text-sm font-semibold text-gray-700">Vencimiento</label>
                            {editingAction?.modifiedFields?.includes('targetDate') && (editingAction as any)?.viewedUpdates?.[filterForumId || ''] === false && (
                              <motion.div 
                                 animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                                 transition={{ duration: 1.5, repeat: Infinity }}
                                 className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                              />
                            )}
                          </div>
                          <input 
                             type="date"
                             required
                             disabled={isReadOnly}
                             value={editingAction?.targetDate || ''}
                             onChange={(e) => {
                               const newDate = e.target.value;
                               const newStatus = calculateAutomaticStatus(newDate, editingAction?.status || 'pendiente');
                               editingAction && setEditingAction({ ...editingAction, targetDate: newDate, status: newStatus });
                             }}
                             className={clsx(
                               "w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm",
                               isReadOnly && "bg-gray-50 opacity-75 cursor-default focus:ring-gray-200"
                             )}
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Prioridad</label>
                          <select 
                            value={(editingAction as any)?.priority || 'media'}
                            disabled={isReadOnly}
                            onChange={(e) => editingAction && setEditingAction({ ...editingAction, priority: e.target.value as Priority })}
                            className={clsx(
                              "w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-sm",
                              isReadOnly && "bg-gray-50 opacity-75 cursor-not-allowed"
                            )}
                          >
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Crítica</option>
                          </select>
                        </div>
                    </>
                  )}
                </div>

                <div>
                   <label className="block text-sm font-semibold text-gray-700 mb-1 text-[11px] uppercase tracking-wider opacity-60">Archivos / Adjuntos</label>
                   <div className="flex items-center gap-3 p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Plus size={16} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600">Añadir archivos o evidencias</p>
                        <p className="text-[10px] text-gray-400 font-medium">Imágenes, PDF o documentos (Máx. 10MB)</p>
                      </div>
                   </div>
                </div>

                {type !== 'incidencia' && (
                  <>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-1">
                        <label className="block text-sm font-semibold text-gray-700">Asignar a</label>
                        {editingAction?.modifiedFields?.includes('assignedTo') && (editingAction as any)?.viewedUpdates?.[filterForumId || ''] === false && (
                          <motion.div 
                             animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                             transition={{ duration: 1.5, repeat: Infinity }}
                             className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                          />
                        )}
                      </div>
                      {assignableUsers.length > 0 ? (
                        <div className="space-y-2">
                          <div className={clsx(
                            "flex flex-wrap gap-1.5 min-h-[38px] p-1.5 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-500",
                            isReadOnly && "bg-gray-50 opacity-75 cursor-default"
                          )}>
                            {editingAction?.assignedTo?.map(uid => {
                              const user = users.find(u => u.uid === uid);
                              if (!user) return null;
                              return (
                                <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                                  {user.name}
                                  {!isReadOnly && (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        const updated = editingAction.assignedTo?.filter(id => id !== uid) || [];
                                        editingAction && setEditingAction({ ...editingAction, assignedTo: updated });
                                      }}
                                      className="hover:text-blue-900"
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => setShowUserSelector(!showUserSelector)}
                                className="flex-1 text-left px-2 text-sm text-gray-400 font-medium min-w-[120px]"
                              >
                                {(!editingAction?.assignedTo || editingAction.assignedTo.length === 0) ? "Seleccionar personas..." : "Añadir más..."}
                              </button>
                            )}
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
                                  {assignableUsers
                                    .filter(u => {
                                      const matchesSearch = u.name.toLowerCase().includes(userSearchQuery.toLowerCase());
                                      
                                      if (editingAction) {
                                        // Use escalation target if escalated, otherwise use origin
                                        const forumId = (editingAction as any).escalatedToForumId || 
                                                       (editingAction as any).forumId || 
                                                       (editingAction as ActionPlan).originForumId;
                                        if (forumId) {
                                          const forum = forums.find(f => f.id === forumId);
                                          if (forum) {
                                            const team = teams.find(t => t.id === forum.teamId);
                                            if (team) {
                                              const memberIds = new Set(team.members?.map((m: any) => typeof m === 'string' ? m : m.uid) || []);
                                              // Handling different member structures (string[] or {uid, name}[])
                                              if (team.hasGroups && team.groups) {
                                                team.groups.forEach((g: any) => {
                                                  g.members?.forEach((m: any) => memberIds.add(typeof m === 'string' ? m : m.uid));
                                                });
                                              }
                                              return matchesSearch && memberIds.has(u.uid);
                                            }
                                          }
                                        }
                                      }
                                      
                                      return matchesSearch;
                                    })
                                    .map(user => {
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
                                            editingAction && setEditingAction({ ...editingAction, assignedTo: updated });
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
                                    })
                                  }
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
                        readOnly={isReadOnly}
                        value={editingAction?.notes || ''}
                        onChange={(e) => editingAction && setEditingAction({ ...editingAction, notes: e.target.value })}
                        className={clsx(
                          "w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm",
                          isReadOnly && "bg-gray-50 opacity-75 cursor-default focus:ring-gray-200"
                        )}
                        placeholder="Observaciones de progreso..."
                      />
                    </div>
                  </>
                )}

                <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={20} className="text-orange-600" />
                      <span className="font-bold text-gray-800 text-sm">Escalación</span>
                    </div>
                    <label className={clsx(
                      "relative inline-flex items-center",
                      isReadOnly ? "cursor-default" : "cursor-pointer"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={isEscalated}
                        disabled={isReadOnly}
                        onChange={(e) => setIsEscalated(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                  </div>
                  
                  {isEscalated && (
                    <div className="animate-in slide-in-from-top-2 duration-200 space-y-4">
                       <div>
                         <label className="block text-xs font-bold text-orange-700 mb-2 uppercase tracking-wider">Escalar a otro Foro</label>
                         <select 
                           value={escalatedToForumId}
                           disabled={isReadOnly}
                           onChange={(e) => setEscalatedToForumId(e.target.value)}
                           className={clsx(
                             "w-full px-4 py-2.5 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm",
                             isReadOnly && "bg-gray-50 opacity-75 cursor-not-allowed"
                           )}
                         >
                           <option value="">Seleccionar foro destino...</option>
                           {forums
                             .filter(f => {
                               const originId = editingAction?.originForumId || (editingAction as any)?.forumId || filterForumId;
                               const originForum = forums.find(of => of.id === originId);
                               if (!originForum) return false;
                               
                               const parentTeamChain = getTeamParentChain(originForum.teamId);
                               const targetTeamIndex = parentTeamChain.indexOf(f.teamId);
                               const maxLevels = Number(company?.settings?.maxEscalationLevels || 1);
                               
                               return f.id !== originId && targetTeamIndex !== -1 && (targetTeamIndex + 1) <= maxLevels;
                             })
                             .map(f => (
                               <option key={f.id} value={f.id}>{f.name} ({f.teamName})</option>
                             ))}
                         </select>
                       </div>

                       {editingAction?.escalationHistory && editingAction.escalationHistory.length > 0 && (
                          <div className="bg-white/50 rounded-xl border border-orange-100 p-4">
                             <h4 className="text-[10px] font-black text-orange-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                               <History size={12} />
                               Historial de Escalación
                             </h4>
                             <div className="space-y-4 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-orange-100">
                                {editingAction.escalationHistory.map((entry, idx) => (
                                  <div key={idx} className="relative pl-6">
                                     <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-orange-100 border-2 border-orange-400 flex items-center justify-center">
                                        <div className="w-1 h-1 bg-orange-600 rounded-full" />
                                     </div>
                                     <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
                                        <div className="flex justify-between items-start mb-1">
                                           <span className="text-[10px] font-bold text-gray-700 uppercase">{entry.toForumName}</span>
                                           <span className="text-[9px] text-gray-400 font-medium">{(() => {
                                             const d = new Date(entry.at);
                                             return !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy HH:mm') : 'N/A';
                                           })()}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-600 leading-relaxed italic">"{entry.note}"</p>
                                        <p className="text-[9px] text-gray-400 mt-1 font-medium">Por: {entry.byName}</p>
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                       )}
                    </div>
                  )}
                </div>
                            </>
                        );
                    })()}
              </div>

              {type !== 'incidencia' && (
                <div className="lg:col-span-2 space-y-4 lg:border-l lg:border-gray-100 lg:pl-8 pt-8 lg:pt-0">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Subacciones</h3>
                      <p className="text-xs text-gray-400">Pasos detallados para completar</p>
                    </div>
                    {!isReadOnly && (
                      <button 
                        type="button"
                        onClick={addTempSubAction}
                        className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-all"
                      >
                        <Plus size={16} />
                        <span className="text-xs font-bold">Añadir</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {tempSubActions.map((sub, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 space-y-4 relative group hover:border-blue-200 transition-colors">
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox"
                            checked={sub.completed}
                            disabled={isReadOnly}
                            onChange={(e) => handleSubActionChange(idx, 'completed', e.target.checked)}
                            className={clsx(
                              "mt-1 w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 transition-all border-gray-300",
                              isReadOnly ? "cursor-default" : "cursor-pointer"
                            )}
                          />
                          <textarea
                            rows={1}
                            readOnly={isReadOnly}
                            value={sub.title || ''}
                            onChange={(e) => handleSubActionChange(idx, 'title', e.target.value)}
                            className="flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm font-medium text-gray-800 placeholder-gray-400 resize-none"
                            placeholder="Título de la subacción..."
                          />
                          {!isReadOnly && (
                            <button 
                              type="button"
                              onClick={() => removeTempSubAction(idx, sub.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            >
                               <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                           <div className="flex items-center gap-2">
                              <Clock size={14} className="text-gray-400" />
                              <input 
                                type="date"
                                value={sub.currentProposedDate || ''}
                                disabled={isReadOnly}
                                onChange={(e) => handleSubActionChange(idx, 'currentProposedDate', e.target.value)}
                                className={clsx(
                                  "bg-gray-50 border-none rounded-lg px-2 py-1 text-xs text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none",
                                  isReadOnly && "opacity-50 cursor-not-allowed"
                                )}
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
                    {(tempSubActions?.length || 0) === 0 && (
                      <div className="text-center py-12 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                         <CheckCircle2 size={32} className="mx-auto text-gray-300 mb-2" />
                         <p className="text-sm text-gray-400">Sin pasos adicionales</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-gray-100">
            {!isReadOnly && editingAction?.id && (editingAction as any).status !== 'finalizada' && (editingAction as any).status !== 'resuelta' && editingAction.status !== 'cancelada' && (
              <button
                type="button"
                onClick={() => handleFinalizeAction(editingAction)}
                className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-green-600 hover:bg-green-50 rounded-xl transition-all border border-green-100 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Finalizar
              </button>
            )}
            {!isReadOnly && editingAction?.id && editingAction.status !== 'cancelada' && (
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
              className={clsx(
                "w-full sm:w-auto px-6 py-3 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all",
                isReadOnly && "flex-1"
              )}
            >
              Cerrar
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="w-full sm:w-auto px-10 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {editingAction?.id ? 'Guardar Cambios' : (type === 'incidencia' ? 'Crear Incidencia' : 'Crear Acción')}
              </button>
            )}
          </div>
        </form>
        );
      })()}
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
                                {(() => {
                                 if (!audit.setAt) return '-';
                                 const d = new Date(audit.setAt);
                                 return !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy HH:mm') : '-';
                               })()}
                              </span>
                           </div>
                           <p className="text-sm font-semibold text-gray-800">
                             Nueva fecha: <span className="text-blue-600 uppercase">
                               {(() => {
                                if (!audit.date) return '-';
                                const d = new Date(audit.date);
                                return !isNaN(d.getTime()) ? format(d, 'dd MMMM yyyy', { locale: es }) : '-';
                              })()}
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
