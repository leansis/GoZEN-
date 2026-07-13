import React, { useState, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { 
  ClipboardList, 
  AlertTriangle, 
  GraduationCap, 
  Award, 
  Calendar, 
  FileText,
  Search,
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  X, 
  Plus, 
  Edit2, 
  Save, 
  Check, 
  MessageSquare,
  TrendingUp,
  ExternalLink,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { ActionPlan, TrainingAction, Standard, Forum } from '../types';
import Modal from '../components/Modal';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Inicio() {
  const { dbUser } = useAuth();
  const { 
    actionPlans, 
    trainingActions, 
    userTaskLevels, 
    forums, 
    forumSessions, 
    standards, 
    tasks, 
    teams,
    loading 
  } = useAppData();

  // Selected action for detailed Slide-Over
  const [selectedAction, setSelectedAction] = useState<ActionPlan | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Stats Detail list states
  const [activeStatList, setActiveStatList] = useState<'pending' | 'overdue' | 'training' | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState('');

  // Dashboard view mode and selected team
  const [dashboardMode, setDashboardMode] = useState<'personal' | 'teams'>('personal');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');

  // Teams that depend on me (supervised teams)
  const mySupervisedTeams = useMemo(() => {
    if (!dbUser) return [];
    const userEmail = dbUser.email?.toLowerCase().trim();
    const userName = dbUser.name?.toLowerCase().trim();

    return teams.filter(t => 
      t.supervisorId === dbUser.uid || 
      t.supervisorId?.toLowerCase().trim() === userEmail ||
      t.supervisorName?.toLowerCase().trim() === userName
    );
  }, [teams, dbUser]);

  // Selected teams for indicators
  const selectedTeams = useMemo(() => {
    if (dashboardMode === 'personal') return [];
    if (selectedTeamId === 'all') return mySupervisedTeams;
    return mySupervisedTeams.filter(t => t.id === selectedTeamId);
  }, [dashboardMode, selectedTeamId, mySupervisedTeams]);

  // Compute team metrics
  const teamMetrics = useMemo(() => {
    if (selectedTeams.length === 0) {
      return {
        pendingActionsCount: 0,
        overdueActionsCount: 0,
        trainingInProgressCount: 0,
        polyvalencePct: 0,
        attendancePct: 0,
        pendingActionsList: [],
        overdueActionsList: [],
        trainingInProgressList: [],
        attendanceExpected: 0,
        attendanceAttended: 0,
        polyvalenceCurrent: 0,
        polyvalenceTarget: 0
      };
    }

    const teamMemberUids = new Set(selectedTeams.flatMap(t => t.members?.map(m => m.uid) || []));
    const teamForums = forums.filter(f => selectedTeams.some(t => t.id === f.teamId));
    const teamForumIds = new Set(teamForums.map(f => f.id));

    // 1. Pending Actions for the team
    const teamPendingActions = actionPlans.filter(a => {
      const isPending = a.status !== 'finalizada' && a.status !== 'cancelada';
      if (!isPending) return false;
      const isAssigned = a.assignedTo?.some(uid => teamMemberUids.has(uid));
      const isFromForum = a.originForumId && teamForumIds.has(a.originForumId);
      return isAssigned || isFromForum;
    });

    // 2. Overdue Actions for the team
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const teamOverdueActions = teamPendingActions.filter(a => {
      if (!a.targetDate) return false;
      const target = new Date(a.targetDate);
      return target < today;
    });

    // 3. Training Actions in progress for the team
    const teamTrainingInProgress = trainingActions.filter(t => 
      teamMemberUids.has(t.userId) && 
      (t.status === 'planificada' || t.status === 'retrasada')
    );

    // 4. Polyvalence for the team
    const teamLevels = userTaskLevels.filter(l => teamMemberUids.has(l.userId));
    let currentSum = 0;
    let targetSum = 0;
    teamLevels.forEach(l => {
      currentSum += l.currentLevel || 0;
      targetSum += l.targetLevel || 0;
    });
    const polyvalencePct = targetSum > 0 ? Math.round((Math.min(currentSum, targetSum) / targetSum) * 100) : 0;

    // 5. Attendance for the team completed sessions
    const teamSessions = forumSessions.filter(s => s.status === 'completed' && teamForumIds.has(s.forumId));
    let attendanceExpected = 0;
    let attendanceAttended = 0;
    teamSessions.forEach(s => {
      const expectedMembers = s.attendees?.filter(a => teamMemberUids.has(a.uid)) || [];
      if (expectedMembers.length > 0) {
        attendanceExpected += expectedMembers.length;
        attendanceAttended += expectedMembers.filter(a => a.present).length;
      } else {
        attendanceExpected += s.attendees?.length || 0;
        attendanceAttended += s.attendees?.filter(a => a.present).length || 0;
      }
    });
    const attendancePct = attendanceExpected > 0 ? Math.round((attendanceAttended / attendanceExpected) * 100) : 0;

    return {
      pendingActionsCount: teamPendingActions.length,
      overdueActionsCount: teamOverdueActions.length,
      trainingInProgressCount: teamTrainingInProgress.length,
      polyvalencePct,
      attendancePct,
      pendingActionsList: teamPendingActions,
      overdueActionsList: teamOverdueActions,
      trainingInProgressList: teamTrainingInProgress,
      attendanceExpected,
      attendanceAttended,
      polyvalenceCurrent: currentSum,
      polyvalenceTarget: targetSum
    };
  }, [selectedTeams, actionPlans, trainingActions, userTaskLevels, forums, forumSessions]);

  // Personal attendance stats
  const personalAttendanceStats = useMemo(() => {
    if (!dbUser) return { expected: 0, attended: 0, pct: 0 };

    const completedSessions = forumSessions.filter(s => s.status === 'completed');
    const expectedSessions = completedSessions.filter(s => s.attendees?.some(a => a.uid === dbUser.uid));
    const attendedSessions = expectedSessions.filter(s => s.attendees?.some(a => a.uid === dbUser.uid && a.present));

    const expected = expectedSessions.length;
    const attended = attendedSessions.length;
    const pct = expected > 0 ? Math.round((attended / expected) * 100) : 0;

    return { expected, attended, pct };
  }, [forumSessions, dbUser]);

  // 1. Filter Action Plans assigned to this user
  const myActions = useMemo(() => {
    if (!dbUser) return [];
    const userId = dbUser.uid;
    const userEmail = dbUser.email?.toLowerCase().trim();
    const userName = dbUser.name?.toLowerCase().trim();

    return actionPlans.filter(a => {
      // Direct match in assignedTo list
      const isAssigned = a.assignedTo?.includes(userId) || 
                         a.assignedToNames?.some(name => name.toLowerCase().trim() === userName);
      return isAssigned;
    });
  }, [actionPlans, dbUser]);

  // 2. Pending Actions (not finalized, cancelled or completed)
  const pendingActions = useMemo(() => {
    return myActions.filter(a => 
      a.status !== 'finalizada' && 
      a.status !== 'cancelada'
    );
  }, [myActions]);

  // 3. Overdue Actions (pending/in-progress/retrasada and targetDate is in the past)
  const overdueActions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return pendingActions.filter(a => {
      if (!a.targetDate) return false;
      const target = new Date(a.targetDate);
      return target < today;
    });
  }, [pendingActions]);

  // 4. Training Actions in progress for user
  const myTrainingInProgress = useMemo(() => {
    if (!dbUser) return [];
    return trainingActions.filter(t => 
      t.userId === dbUser.uid && 
      (t.status === 'planificada' || t.status === 'retrasada')
    );
  }, [trainingActions, dbUser]);

  // 5. User Polyvalence compliance calculation
  const polyvalenceStats = useMemo(() => {
    if (!dbUser) return { currentSum: 0, targetSum: 0, pct: 0 };
    
    const userLevels = userTaskLevels.filter(l => l.userId === dbUser.uid);
    let currentSum = 0;
    let targetSum = 0;

    userLevels.forEach(l => {
      currentSum += l.currentLevel || 0;
      targetSum += l.targetLevel || 0;
    });

    const pct = targetSum > 0 ? Math.round((Math.min(currentSum, targetSum) / targetSum) * 100) : 0;
    return { currentSum, targetSum, pct };
  }, [userTaskLevels, dbUser]);

  // 6. Today's meetings (forums sessions scheduled for today, or recurring forums today)
  const todayMeetings = useMemo(() => {
    if (!dbUser) return [];
    
    // Find teams user belongs to
    const userEmail = dbUser.email?.toLowerCase().trim();
    const userName = dbUser.name?.toLowerCase().trim();

    const myTeamIds = new Set(
      teams.filter(t => {
        const isSupervisor = t.supervisorId === dbUser.uid || 
                             t.supervisorId?.toLowerCase().trim() === userEmail ||
                             t.supervisorName?.toLowerCase().trim() === userName;
        const isMember = t.members?.some(m => m.uid === dbUser.uid);
        return isSupervisor || isMember;
      }).map(t => t.id)
    );

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const dayOfWeek = new Date().getDay(); // 0 is Sunday, 1 is Monday...

    // Map day numbers from standard JS to 1-7 (Mon-Sun)
    const normalizedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

    // Filter forums for user's teams
    const userForums = forums.filter(f => myTeamIds.has(f.teamId));

    // Get today's active sessions or forums that should meet today
    const sessionsToday = forumSessions.filter(s => {
      if (!s.scheduledAt) return false;
      return s.scheduledAt.startsWith(todayStr);
    });

    const recurringToday = userForums.filter(f => {
      // If we already have a session for this forum today, don't double show
      const hasSessionToday = sessionsToday.some(s => s.forumId === f.id);
      if (hasSessionToday) return false;

      // Check recurrence
      if (f.frequency === 'diaria') return true;
      if (f.recurrence?.daysOfWeek?.includes(normalizedDayOfWeek)) return true;
      return false;
    });

    const items = [];
    sessionsToday.forEach(s => {
      const forum = forums.find(f => f.id === s.forumId);
      if (forum && myTeamIds.has(forum.teamId)) {
        items.push({
          id: s.id,
          name: forum.name,
          time: s.scheduledAt ? s.scheduledAt.split('T')[1]?.substring(0, 5) : '00:00',
          status: s.status,
          type: 'sesion',
          forumId: forum.id
        });
      }
    });

    recurringToday.forEach(f => {
      items.push({
        id: f.id,
        name: f.name,
        time: f.recurrence?.startTime || 'Planificado',
        status: 'scheduled',
        type: 'recurrente',
        forumId: f.id
      });
    });

    return items;
  }, [forums, forumSessions, teams, dbUser]);

  // 7. Standards responsible for
  const myStandards = useMemo(() => {
    if (!dbUser) return [];
    return standards.filter(s => 
      s.responsibleId === dbUser.uid || 
      s.responsibleName?.toLowerCase().trim() === dbUser.name?.toLowerCase().trim()
    );
  }, [standards, dbUser]);

  // Handle action status updates directly in the dashboard
  const handleUpdateStatus = async (actionId: string, newStatus: any) => {
    try {
      const actionRef = doc(db, 'actionPlans', actionId);
      await updateDoc(actionRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Estado actualizado a ${newStatus}`);
      
      // Update local detailed state if open
      if (selectedAction && selectedAction.id === actionId) {
        setSelectedAction(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error("Error updating action status:", err);
      toast.error("Error al actualizar el estado");
    }
  };

  // Handle saving action details/notes
  const handleSaveNotes = async () => {
    if (!selectedAction) return;
    setIsSavingAction(true);
    try {
      const actionRef = doc(db, 'actionPlans', selectedAction.id);
      await updateDoc(actionRef, {
        notes: editedNotes,
        updatedAt: new Date().toISOString()
      });
      setSelectedAction(prev => prev ? { ...prev, notes: editedNotes } : null);
      setIsEditingNotes(false);
      toast.success("Notas de progreso guardadas");
    } catch (err) {
      console.error("Error saving action notes:", err);
      toast.error("Error al guardar las notas");
    } finally {
      setIsSavingAction(false);
    }
  };

  // Welcome message based on time of day
  const welcomeMessage = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return '¡Buenos días!';
    if (hours < 20) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  }, []);

  // Filtered stats list items
  const filteredStatItems = useMemo(() => {
    let baseList: any[] = [];
    if (activeStatList === 'pending') {
      baseList = dashboardMode === 'personal' ? pendingActions : teamMetrics.pendingActionsList;
    } else if (activeStatList === 'overdue') {
      baseList = dashboardMode === 'personal' ? overdueActions : teamMetrics.overdueActionsList;
    } else if (activeStatList === 'training') {
      baseList = dashboardMode === 'personal' ? myTrainingInProgress : teamMetrics.trainingInProgressList;
    }

    if (!listSearchQuery) return baseList;

    return baseList.filter(item => {
      const name = item.title || item.name || '';
      return name.toLowerCase().includes(listSearchQuery.toLowerCase());
    });
  }, [activeStatList, dashboardMode, pendingActions, overdueActions, myTrainingInProgress, teamMetrics, listSearchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-sm font-semibold">Cargando tu dashboard de Inicio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-3xl py-5 px-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12">
          <TrendingUp size={200} />
        </div>
        <div className="relative z-10 max-w-xl">
          <span className="bg-blue-600/55 text-blue-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Mi Panel Principal
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1.5">
            {welcomeMessage}, {dbUser?.name}
          </h1>
          <p className="text-blue-100 text-xs mt-1 leading-relaxed">
            Aquí tienes el resumen ejecutivo de tu actividad para hoy. Monitorea tus acciones, objetivos de polivalencia y reuniones programadas.
          </p>
        </div>
      </div>

      {/* Selector: Personal vs Teams */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-2xl">
            <Users size={20} />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-extrabold text-gray-900">Modo de Visualización</h2>
            <p className="text-xs text-gray-500">Alterna entre tus indicadores personales y los de tus equipos a cargo.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => {
                setDashboardMode('personal');
                setSelectedTeamId('all');
              }}
              className={clsx(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer",
                dashboardMode === 'personal' ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-850"
              )}
            >
              Mi Actividad
            </button>
            <button
              onClick={() => setDashboardMode('teams')}
              className={clsx(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                dashboardMode === 'teams' ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-850",
                mySupervisedTeams.length === 0 && "opacity-55 cursor-not-allowed"
              )}
              disabled={mySupervisedTeams.length === 0}
              title={mySupervisedTeams.length === 0 ? "No lideras ningún equipo" : "Ver indicadores de tus equipos"}
            >
              Mis Equipos
              {mySupervisedTeams.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">
                  {mySupervisedTeams.length}
                </span>
              )}
            </button>
          </div>

          {dashboardMode === 'teams' && mySupervisedTeams.length > 0 && (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-700 shadow-sm animate-fade-in"
            >
              <option value="all">Todos mis equipos (Agregado)</option>
              {mySupervisedTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Dynamic Grid of Main Metrics (Interactive Bento Box) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Metric 1: Pending Actions */}
        <div 
          onClick={() => {
            setActiveStatList('pending');
            setListSearchQuery('');
          }}
          className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-all">
              <ClipboardList size={22} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600 transition-colors uppercase tracking-wider">
              {dashboardMode === 'personal' ? 'Acciones' : 'Acciones Eq.'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-black text-gray-900 tracking-tight">
              {dashboardMode === 'personal' ? pendingActions.length : teamMetrics.pendingActionsCount}
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Pendientes</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-blue-600">
            <span>Ver listado</span>
            <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Metric 2: Overdue Actions */}
        <div 
          onClick={() => {
            setActiveStatList('overdue');
            setListSearchQuery('');
          }}
          className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-red-300 transition-all cursor-pointer group relative overflow-hidden"
        >
          {((dashboardMode === 'personal' ? overdueActions.length : teamMetrics.overdueActionsCount) > 0) && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
          )}
          <div className="flex justify-between items-start">
            <div className={clsx(
              "p-3 rounded-xl transition-all",
              (dashboardMode === 'personal' ? overdueActions.length : teamMetrics.overdueActionsCount) > 0 
                ? "bg-red-50 text-red-600 group-hover:bg-red-100" 
                : "bg-gray-50 text-gray-400"
            )}>
              <AlertTriangle size={22} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 group-hover:text-red-600 transition-colors uppercase tracking-wider">
              Vencidas
            </span>
          </div>
          <div className="mt-4">
            <h3 className={clsx(
              "text-4xl font-black tracking-tight",
              (dashboardMode === 'personal' ? overdueActions.length : teamMetrics.overdueActionsCount) > 0 ? "text-red-600" : "text-gray-900"
            )}>
              {dashboardMode === 'personal' ? overdueActions.length : teamMetrics.overdueActionsCount}
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Fuera de plazo</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-red-600">
            <span>Ver críticas</span>
            <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Metric 3: Training actions in progress */}
        <div 
          onClick={() => {
            setActiveStatList('training');
            setListSearchQuery('');
          }}
          className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-violet-300 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="flex justify-between items-start">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl group-hover:bg-violet-100 transition-all">
              <GraduationCap size={22} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 group-hover:text-violet-600 transition-colors uppercase tracking-wider">
              {dashboardMode === 'personal' ? 'Formación' : 'Formación Eq.'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-black text-gray-900 tracking-tight">
              {dashboardMode === 'personal' ? myTrainingInProgress.length : teamMetrics.trainingInProgressCount}
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-1">En curso</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-violet-600">
            <span>{dashboardMode === 'personal' ? 'Mis formaciones' : 'Formaciones Eq.'}</span>
            <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Metric 4: Polyvalence compliance percentage */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-sm transition-all relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <Award size={22} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Polivalencia
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-black text-gray-900 tracking-tight">
              {dashboardMode === 'personal' ? polyvalenceStats.pct : teamMetrics.polyvalencePct}%
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Cumplimiento</p>
          </div>
          
          {/* Small progress line */}
          <div className="mt-5">
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${dashboardMode === 'personal' ? polyvalenceStats.pct : teamMetrics.polyvalencePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase mt-1.5">
              <span>Nivel: {dashboardMode === 'personal' ? polyvalenceStats.currentSum : teamMetrics.polyvalenceCurrent} pts</span>
              <span>Meta: {dashboardMode === 'personal' ? polyvalenceStats.targetSum : teamMetrics.polyvalenceTarget} pts</span>
            </div>
          </div>
        </div>

        {/* Metric 5: Meeting Attendance Rate */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-sm transition-all relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Calendar size={22} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Asistencia
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-black text-gray-900 tracking-tight">
              {dashboardMode === 'personal' ? personalAttendanceStats.pct : teamMetrics.attendancePct}%
            </h3>
            <p className="text-sm text-gray-500 font-medium mt-1">Asistencia Foros</p>
          </div>
          
          {/* Small progress line */}
          <div className="mt-5">
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${dashboardMode === 'personal' ? personalAttendanceStats.pct : teamMetrics.attendancePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase mt-1.5">
              {dashboardMode === 'personal' ? (
                <>
                  <span>Asistido: {personalAttendanceStats.attended}</span>
                  <span>Total: {personalAttendanceStats.expected}</span>
                </>
              ) : (
                <>
                  <span>Asistido: {teamMetrics.attendanceAttended}</span>
                  <span>Total: {teamMetrics.attendanceExpected}</span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Main Core View Area */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Side: Forums and Standards (Col span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Meetings Today */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Calendar className="text-blue-600" size={18} />
                <h2 className="text-sm font-bold text-gray-800">Reuniones para Hoy</h2>
              </div>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {todayMeetings.length} programadas
              </span>
            </div>

            <div className="mt-4 space-y-3 flex-1">
              {todayMeetings.map((meet, index) => (
                <div 
                  key={index}
                  className="p-3 bg-slate-50 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-slate-100 transition-all"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-800 leading-tight">
                      {meet.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
                      <Clock size={11} className="text-gray-400" />
                      <span>{meet.time}</span>
                    </div>
                  </div>
                  <span className={clsx(
                    "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                    meet.status === 'in_progress' ? 'bg-green-100 text-green-800 animate-pulse' : 'bg-gray-200 text-gray-600'
                  )}>
                    {meet.status === 'in_progress' ? 'En Vivo' : 'Programado'}
                  </span>
                </div>
              ))}

              {todayMeetings.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-xs">
                  <p className="font-semibold text-gray-500">No tienes foros programados para hoy</p>
                  <p className="text-[10px] mt-0.5">¡Buen día para avanzar en tus estándares!</p>
                </div>
              )}
            </div>
          </div>

          {/* Card: My Associated Standards */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="text-violet-600" size={18} />
                <h2 className="text-sm font-bold text-gray-800">Mis Estándares</h2>
              </div>
              <span className="bg-violet-50 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {myStandards.length} asignados
              </span>
            </div>

            <div className="mt-4 space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {myStandards.map((std) => (
                <div 
                  key={std.id}
                  className="flex flex-col gap-1.5 p-3 rounded-xl border border-gray-100 bg-slate-50/50"
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-bold text-gray-800 line-clamp-2">
                      {std.name}
                    </p>
                    <span className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                      {std.relationType === 'activity' ? 'ÁREA' : std.relationType === 'process' ? 'PROCESO' : 'TAREA'}
                    </span>
                  </div>
                  
                  {std.nextReviewDate && (
                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold mt-1">
                      <span>Próxima revisión:</span>
                      <span className={clsx(
                        "font-bold",
                        new Date(std.nextReviewDate) < new Date() ? "text-red-600" : "text-gray-700"
                      )}>
                        {new Date(std.nextReviewDate).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {myStandards.length === 0 && (
                <div className="py-6 text-center text-gray-400 text-xs">
                  <p className="font-semibold text-gray-500">No tienes estándares asignados</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Quick Action Plan Manager (Col span 3) */}
        <div className="lg:col-span-3 space-y-6">
          
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-blue-600" size={18} />
                <h2 className="text-sm font-bold text-gray-800">
                  {dashboardMode === 'personal' ? 'Mi Lista de Acciones' : 'Acciones de mis Equipos'}
                </h2>
              </div>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse-subtle">
                {(dashboardMode === 'personal' ? pendingActions : teamMetrics.pendingActionsList).length} en proceso
              </span>
            </div>

            {/* Quick Filter actions list */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                    <th className="pb-3 font-semibold">Acción</th>
                    <th className="pb-3 font-semibold">Prioridad</th>
                    <th className="pb-3 font-semibold">Fecha Límite</th>
                    <th className="pb-3 font-semibold">Estado</th>
                    <th className="pb-3 text-right font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {(dashboardMode === 'personal' ? pendingActions : teamMetrics.pendingActionsList).slice(0, 8).map((act) => (
                    <tr 
                      key={act.id} 
                      className="group/row hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-3.5 pr-2 max-w-[200px]">
                        <p className="font-bold text-gray-800 truncate" title={act.title}>
                          {act.title}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                          {act.description || 'Sin descripción adicional'}
                        </p>
                      </td>
                      <td className="py-3.5">
                        <span className={clsx(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded",
                          act.priority === 'critica' && "bg-red-100 text-red-700",
                          act.priority === 'alta' && "bg-orange-100 text-orange-700",
                          act.priority === 'media' && "bg-yellow-100 text-yellow-800",
                          act.priority === 'baja' && "bg-blue-100 text-blue-700"
                        )}>
                          {act.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 text-gray-600 text-[11px]">
                        {act.targetDate ? new Date(act.targetDate).toLocaleDateString('es-ES') : '-'}
                      </td>
                      <td className="py-3.5">
                        <select
                          value={act.status}
                          onChange={(e) => handleUpdateStatus(act.id, e.target.value)}
                          className={clsx(
                            "px-2 py-1 rounded text-[10px] font-bold border outline-none cursor-pointer",
                            act.status === 'pendiente' && "bg-gray-50 text-gray-600 border-gray-200",
                            act.status === 'en_progreso' && "bg-blue-50 text-blue-600 border-blue-100",
                            act.status === 'retrasada' && "bg-red-50 text-red-600 border-red-100",
                            act.status === 'bloqueada' && "bg-orange-50 text-orange-600 border-orange-150"
                          )}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="en_progreso">En Curso</option>
                          <option value="bloqueada">Bloqueada</option>
                          <option value="retrasada">Retrasada</option>
                          <option value="finalizada">Finalizada</option>
                        </select>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedAction(act);
                            setEditedNotes(act.notes || '');
                            setIsEditingNotes(false);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Ver detalle"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {(dashboardMode === 'personal' ? pendingActions : teamMetrics.pendingActionsList).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        <p className="font-semibold">
                          {dashboardMode === 'personal' ? '¡Felicidades! No tienes acciones pendientes.' : 'No hay acciones pendientes para los equipos seleccionados.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(dashboardMode === 'personal' ? pendingActions : teamMetrics.pendingActionsList).length > 8 && (
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-3.5 text-center">
                Mostrando las primeras 8 de {(dashboardMode === 'personal' ? pendingActions : teamMetrics.pendingActionsList).length} acciones pendientes
              </p>
            )}
          </div>

        </div>

      </div>

      {/* --- STATS DETAILED LIST MODAL --- */}
      <AnimatePresence>
        {activeStatList && (
          <Modal
            isOpen={true}
            onClose={() => setActiveStatList(null)}
            title={
              activeStatList === 'pending' ? 'Acciones Pendientes' :
              activeStatList === 'overdue' ? 'Acciones Fuera de Plazo (Vencidas)' :
              'Formaciones en Curso'
            }
          >
            <div className="space-y-4">
              {/* Search bar inside list */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Items List container */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredStatItems.map((item, index) => {
                  const isTraining = activeStatList === 'training';
                  
                  return (
                    <div 
                      key={item.id || index}
                      onClick={() => {
                        if (!isTraining) {
                          setSelectedAction(item);
                          setEditedNotes(item.notes || '');
                          setIsEditingNotes(false);
                          setActiveStatList(null); // Close this modal to show the detail slideover
                        }
                      }}
                      className={clsx(
                        "p-3.5 border rounded-xl flex justify-between items-start transition-all gap-4",
                        isTraining ? "bg-slate-50/50 border-gray-100" : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm cursor-pointer"
                      )}
                    >
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-gray-800">
                          {item.title || item.name}
                        </h4>
                        
                        {isTraining ? (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-semibold mt-1">
                            <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
                              Objetivo: Nivel {item.targetLevel}
                            </span>
                            {item.trainerName && (
                              <span>Formador: {item.trainerName}</span>
                            )}
                            {item.plannedDate && (
                              <span>Fecha: {new Date(item.plannedDate).toLocaleDateString('es-ES')}</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 line-clamp-1">
                            {item.description || 'Sin descripción'}
                          </p>
                        )}
                      </div>

                      {/* Right badge */}
                      {!isTraining && (
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={clsx(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                            item.priority === 'critica' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                          )}>
                            {item.priority}
                          </span>
                          {item.targetDate && (
                            <span className="text-[9px] text-gray-400 font-bold">
                              {new Date(item.targetDate).toLocaleDateString('es-ES')}
                            </span>
                          )}
                        </div>
                      )}

                      {isTraining && (
                        <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0">
                          {item.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  );
                })}

                {filteredStatItems.length === 0 && (
                  <div className="py-12 text-center text-gray-400 text-xs">
                    No se encontraron elementos coincidentes.
                  </div>
                )}
              </div>

              {/* Close button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStatList(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* --- ACTION DETAIL SLIDE-OVER / DRAWER --- */}
      <AnimatePresence>
        {selectedAction && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAction(null)}
              className="absolute inset-0 bg-black"
            />

            {/* Slide drawer container */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                <div className="space-y-1">
                  <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Detalle de Acción
                  </span>
                  <h3 className="text-sm font-bold text-gray-800 mt-1">
                    {selectedAction.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedAction(null)}
                  className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                
                {/* Description */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descripción</h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed font-semibold">
                    {selectedAction.description || 'Sin descripción adicional disponible.'}
                  </div>
                </div>

                {/* Priority & Target Date Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50/50 border border-gray-100 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Prioridad</span>
                    <p className="text-xs font-bold text-gray-800 capitalize">{selectedAction.priority}</p>
                  </div>
                  <div className="p-3 bg-slate-50/50 border border-gray-100 rounded-xl space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Fecha Límite</span>
                    <p className="text-xs font-bold text-gray-800">
                      {selectedAction.targetDate ? new Date(selectedAction.targetDate).toLocaleDateString('es-ES', { dateStyle: 'medium' }) : '-'}
                    </p>
                  </div>
                </div>

                {/* Status Dropdown */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Actualizar Estado
                  </label>
                  <div className="flex gap-2">
                    {['pendiente', 'en_progreso', 'bloqueada', 'finalizada'].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(selectedAction.id, st)}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex-1 text-center",
                          selectedAction.status === st 
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        {st === 'pendiente' ? 'Pendiente' :
                         st === 'en_progreso' ? 'En Curso' :
                         st === 'bloqueada' ? 'Bloqueada' : 'Completada'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes & Progress Update Area */}
                <div className="space-y-3.5 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare size={13} />
                      Notas de Seguimiento y Progreso
                    </label>
                    {!isEditingNotes ? (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={12} />
                        Editar Notas
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNotes}
                          disabled={isSavingAction}
                          className="text-xs text-green-600 hover:text-green-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Save size={12} />
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setEditedNotes(selectedAction.notes || '');
                            setIsEditingNotes(false);
                          }}
                          className="text-xs text-gray-400 hover:text-gray-500 font-bold cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingNotes ? (
                    <textarea
                      rows={5}
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="Escribe detalles del progreso de la acción, obstáculos encontrados, etc..."
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    />
                  ) : (
                    <div className="p-4 bg-slate-50/70 border border-dashed border-gray-200 rounded-xl text-xs text-gray-600 leading-relaxed min-h-[100px] whitespace-pre-wrap">
                      {selectedAction.notes || 'No se han registrado notas de seguimiento para esta acción. Haz clic en "Editar Notas" para añadir tus comentarios.'}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-100 bg-slate-50/30 flex justify-between">
                {selectedAction.originForumName && (
                  <div className="text-[10px] text-gray-400 font-bold flex flex-col">
                    <span>Origen de Acción:</span>
                    <span className="text-gray-600 font-extrabold uppercase mt-0.5">{selectedAction.originForumName}</span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedAction(null)}
                  className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-gray-200"
                >
                  Listo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
