import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  MessagesSquare, 
  Users, 
  Calendar, 
  History,
  Play,
  Settings,
  Trash2,
  Edit2,
  Search,
  ChevronRight,
  MoreHorizontal,
  Clock,
  RefreshCcw,
  X,
  CalendarRange
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';
import { Forum, ForumFrequency, ForumSection, ForumSession, ForumAttendee, ForumRecurrence } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import Modal from '../components/Modal';
import Table from '../components/Table';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { format, addWeeks, addMonths, addDays, parseISO, getDay, isBefore, isAfter, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import ForumCalendar from '../components/ForumCalendar';

const DAYS_OF_WEEK = [
  { id: 1, label: 'L' },
  { id: 2, label: 'M' },
  { id: 3, label: 'X' },
  { id: 4, label: 'J' },
  { id: 5, label: 'V' },
  { id: 6, label: 'S' },
  { id: 7, label: 'D' },
];

const PRE_ESTABLISHED_SECTIONS = [
  { id: 'indicators', title: 'Revisión de indicadores', duration: 10 },
  { id: 'actions', title: 'Plan de acción', duration: 15 },
  { id: 'topics', title: 'Temas nuevos', duration: 10 },
  { id: 'closing', title: 'Cierre y acuerdos', duration: 5 }
];

export default function Forums() {
  const { dbUser, company, isAdmin, isSupervisor, isLeanPromotor, isGlobalAdmin, activeCompanyId } = useAuth();
  const { forums, forumSessions, teams, users } = useAppData();
  const navigate = useNavigate();
  
  const [isForumModalOpen, setIsForumModalOpen] = useState(false);
  const [editingForum, setEditingForum] = useState<Partial<Forum> | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isExecutionsModalOpen, setIsExecutionsModalOpen] = useState(false);
  const [executionsPage, setExecutionsPage] = useState(1);
  const EXECUTIONS_PER_PAGE = 5;
  const [selectedForumForSession, setSelectedForumForSession] = useState<Forum | null>(null);
  const [selectedForumIdForExecutions, setSelectedForumIdForExecutions] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sessionTime, setSessionTime] = useState(format(new Date(), 'HH:mm'));
  const [isSaving, setIsSaving] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'sessions' | 'calendar' | 'history'>('sessions');

  const visibleTeamIds = useMemo(() => {
    if (isGlobalAdmin || isLeanPromotor || isAdmin) return null;
    if (!dbUser) return new Set<string>();

    const userEmail = dbUser.email.toLowerCase().trim();
    const userName = dbUser.name?.toLowerCase().trim();

    const baseIds = teams.filter(t => {
      // Supervisor check (UID, email, or name)
      const isSupervisor = t.supervisorId === dbUser.uid || 
                          (t.supervisorId?.toLowerCase().trim() === userEmail) ||
                          (userName && t.supervisorId?.toLowerCase().trim() === userName) ||
                          (userName && t.supervisorName?.toLowerCase().trim() === userName);
      
      // Member check (UID, email, or name)
      const isMember = t.members?.some(m => {
        const mObj = m as any;
        const mUid = mObj.uid || (typeof mObj === 'string' ? mObj : '');
        const mEmail = mObj.email?.toLowerCase().trim() || (typeof mObj === 'string' && mObj.includes('@') ? mObj.toLowerCase().trim() : '');
        const mName = mObj.name?.toLowerCase().trim() || (typeof mObj === 'string' && !mObj.includes('@') ? mObj.toLowerCase().trim() : '');
        
        return mUid === dbUser.uid || 
               (mEmail && mEmail === userEmail) || 
               (userName && mName === userName);
      });

      // Group member/leader check
      const isGroupMember = t.groups?.some(g => 
        g.leaderId === dbUser.uid || 
        (userName && g.leaderId?.toLowerCase().trim() === userName) ||
        (userName && g.leaderName?.toLowerCase().trim() === userName) ||
        g.members?.some(m => {
          const mObj = m as any;
          const mUid = mObj.uid || (typeof mObj === 'string' ? mObj : '');
          const mEmail = mObj.email?.toLowerCase().trim() || (typeof mObj === 'string' && mObj.includes('@') ? mObj.toLowerCase().trim() : '');
          const mName = mObj.name?.toLowerCase().trim() || (typeof mObj === 'string' && !mObj.includes('@') ? mObj.toLowerCase().trim() : '');
          
          return mUid === dbUser.uid || 
                 (mEmail && mEmail === userEmail) || 
                 (userName && mName === userName);
        })
      );

      return isSupervisor || isMember || isGroupMember;
    }).map(t => t.id);

    const supervisorTeamIds = teams.filter(t => 
      t.supervisorId === dbUser.uid || 
      t.supervisorId?.toLowerCase().trim() === userEmail ||
      (userName && t.supervisorId?.toLowerCase().trim() === userName) ||
      (userName && t.supervisorName?.toLowerCase().trim() === userName)
    ).map(t => t.id);
    
    const descendantIds = new Set<string>(baseIds);
    let queue = [...supervisorTeamIds];
    
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = teams.filter(t => t.parentTeamId === parentId);
      children.forEach(child => {
        if (!descendantIds.has(child.id)) {
          descendantIds.add(child.id);
          queue.push(child.id);
        }
      });
    }
    return descendantIds;
  }, [teams, dbUser, isAdmin, isLeanPromotor, isGlobalAdmin]);

  const visibleSessions = useMemo(() => {
    if (!visibleTeamIds) return forumSessions;
    return forumSessions.filter(session => {
      const forum = forums.find(f => f.id === session.forumId);
      return forum && visibleTeamIds.has(forum.teamId);
    });
  }, [forumSessions, forums, visibleTeamIds]);

  const filteredForums = useMemo(() => {
    const list = visibleTeamIds 
      ? forums.filter(f => visibleTeamIds.has(f.teamId))
      : forums;
    return list.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [forums, visibleTeamIds, searchQuery]);

  const filteredSessions = useMemo(() => {
    const actual = visibleSessions.filter(s => 
      s.forumName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter by date if in 'sessions' mode (Today)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let filteredActual = actual;

    if (viewMode === 'sessions' && !searchQuery) {
      filteredActual = actual.filter(s => s.scheduledAt.startsWith(todayStr));
    }

    filteredActual.sort((a,b) => b.scheduledAt.localeCompare(a.scheduledAt));

    // For the calendar or today's sessions, we also want to see the PLANNED sessions from recurring forums
    const virtual: ForumSession[] = [];
    const visibleForums = visibleTeamIds 
      ? forums.filter(f => visibleTeamIds.has(f.teamId))
      : forums;

    const now = new Date();
    // In sessions mode, we only care about today. In calendar, use the company setting.
    const horizonMonths = company?.settings?.forumVirtualHorizonMonths ?? 3;
    const lookaheadDays = viewMode === 'sessions' ? 1 : horizonMonths * 30;
    const futureLimit = addDays(now, lookaheadDays); 

    visibleForums.forEach(forum => {
      // Define recurrence parameters based on frequency if it's standard
      let recurrence = forum.recurrence as any;
      
      if (!recurrence && forum.frequency !== 'adhoc') {
        // Create an implicit recurrence for standard frequencies
        recurrence = {
          repeatEvery: 1,
          repeatUnit: forum.frequency === 'diaria' ? 'day' : forum.frequency === 'semanal' ? 'week' : 'month',
          startDate: forum.createdAt?.split('T')[0] || format(startOfMonth(now), 'yyyy-MM-dd'),
          startTime: '09:00'
        };
        
        // For weekly, we might want to default to today's day or Monday
        if (forum.frequency === 'semanal') {
          const startDay = getDay(parseISO(recurrence.startDate)) || 7;
          recurrence.daysOfWeek = [startDay === 0 ? 7 : startDay];
        }
      }

      if (recurrence) {
        const { repeatEvery, repeatUnit, daysOfWeek, startDate, startTime } = recurrence;
        let current = parseISO(startDate);
        const startWindow = startOfMonth(now);
        
        // Optimization: if startDate is way in the past, jump to near startWindow
        if (isBefore(current, startWindow)) {
          // Simplistic jump logic
          if (repeatUnit === 'day') {
            const diff = Math.floor((startWindow.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
            current = addDays(current, diff);
          } else if (repeatUnit === 'week') {
            const diff = Math.floor((startWindow.getTime() - current.getTime()) / (1000 * 60 * 60 * 24 * 7));
            current = addWeeks(current, diff);
          } else if (repeatUnit === 'month') {
            const diff = (startWindow.getFullYear() - current.getFullYear()) * 12 + (startWindow.getMonth() - current.getMonth());
            current = addMonths(current, Math.max(0, diff));
          }
        }

        let safety = 0;
        while (isBefore(current, futureLimit) && safety < 100) {
          safety++;
          if (isAfter(current, startWindow) || format(current, 'yyyy-MM-dd') === format(startWindow, 'yyyy-MM-dd')) {
            // Check days of week if weekly
            const dayNum = getDay(current) === 0 ? 7 : getDay(current);
            if (repeatUnit !== 'week' || !daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(dayNum)) {
              
              const dateStr = format(current, 'yyyy-MM-dd');
              const hasReal = actual.some(s => s.forumId === forum.id && s.scheduledAt.startsWith(dateStr));
              const isSkipped = forum.skippedDates?.includes(dateStr);
              
              if (!hasReal && !isSkipped) {
                // In sessions mode, only add if it's today
                if (viewMode !== 'sessions' || dateStr === todayStr) {
                    virtual.push({
                      id: `virtual-${forum.id}-${dateStr}`,
                      forumId: forum.id,
                      forumName: forum.name,
                      scheduledAt: `${dateStr}T${startTime || '09:00'}:00`,
                      status: 'scheduled',
                      attendees: [],
                      currentSectionIndex: 0,
                      results: {},
                      companyId: forum.companyId,
                      createdBy: forum.createdBy
                    });
                }
              }
            }
          }

          if (repeatUnit === 'day') current = addDays(current, repeatEvery || 1);
          else if (repeatUnit === 'week') {
            // For weekly, we increment day by day to check daysOfWeek if they exist
            if (daysOfWeek && daysOfWeek.length > 0) {
              current = addDays(current, 1);
            } else {
              current = addWeeks(current, repeatEvery || 1);
            }
          }
          else if (repeatUnit === 'month') current = addMonths(current, repeatEvery || 1);
          else break;
        }
      }
    });

    return [...filteredActual, ...virtual].sort((a,b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }, [visibleSessions, forums, visibleTeamIds, searchQuery, viewMode]);

  const handleRescheduleSession = async (sessionId: string, newDateTime: string) => {
    try {
      if (sessionId.startsWith('virtual-')) {
        // ID format: virtual-${forumId}-${dateStr} (where dateStr is YYYY-MM-DD)
        const parts = sessionId.split('-');
        // Extract the last 3 parts as they are YYYY-MM-DD
        const dateStr = parts.slice(-3).join('-');
        // Join all parts in the middle as forumId
        const forumId = parts.slice(1, -3).join('-');
        
        const forum = forums.find(f => f.id === forumId);
        if (!forum || !dbUser || !activeCompanyId) return;

        // Add original date to skippedDates to prevent virtual session duplication
        const updatedSkippedDates = Array.from(new Set([...(forum.skippedDates || []), dateStr]));
        await updateDoc(doc(db, 'forums', forum.id), {
          skippedDates: updatedSkippedDates
        });

        // Create a new real session from the virtual one
        const team = teams.find(t => t.id === forum.teamId);
        let invitedAttendees: ForumAttendee[] = [];

        if (team?.hasGroups && team.groups && team.groups.length > 0) {
          team.groups.forEach(group => {
            group.members.forEach(m => {
              invitedAttendees.push({
                uid: m.uid,
                name: m.name,
                present: true,
                groupId: group.id,
                groupName: group.name,
                isLeader: group.leaderId === m.uid
              });
            });
          });
        } else {
          invitedAttendees = (team?.members || []).map(m => ({
            uid: m.uid,
            name: m.name,
            present: true,
            isLeader: team?.supervisorId === m.uid
          }));
        }

        const sessionData: Omit<ForumSession, 'id'> = {
          forumId: forum.id,
          forumName: forum.name,
          scheduledAt: newDateTime,
          status: 'scheduled',
          attendees: invitedAttendees,
          currentSectionIndex: 0,
          results: {},
          companyId: activeCompanyId,
          createdBy: dbUser.uid
        };

        await addDoc(collection(db, 'forumSessions'), sessionData);
      } else {
        const session = forumSessions.find(s => s.id === sessionId);
        if (!session) return;

        const forum = forums.find(f => f.id === session.forumId);
        if (forum) {
          const originalDateStr = session.scheduledAt.split('T')[0];
          const updatedSkippedDates = Array.from(new Set([...(forum.skippedDates || []), originalDateStr]));
          await updateDoc(doc(db, 'forums', forum.id), {
            skippedDates: updatedSkippedDates
          });
        }

        // Update existing session
        await updateDoc(doc(db, 'forumSessions', sessionId), {
          scheduledAt: newDateTime
        });
      }
    } catch (err) {
      console.error("Error rescheduling session:", err);
    }
  };

  const getFutureExecutions = (forum: Forum) => {
    const future: ForumSession[] = [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const horizonMonths = company?.settings?.forumVirtualHorizonMonths ?? 3;
    const futureLimit = addDays(new Date(), horizonMonths * 30);

    // Real scheduled sessions
    const realSessions = forumSessions.filter(s => 
      s.forumId === forum.id && 
      s.status === 'scheduled' && 
      s.scheduledAt >= format(new Date(), "yyyy-MM-dd'T'HH:mm")
    );

    // Calculate virtual sessions
    const virtual: ForumSession[] = [];
    let recurrence = forum.recurrence as any;
    const now = new Date();
    
    if (!recurrence && forum.frequency !== 'adhoc') {
      recurrence = {
        repeatEvery: 1,
        repeatUnit: forum.frequency === 'diaria' ? 'day' : forum.frequency === 'semanal' ? 'week' : 'month',
        startDate: forum.createdAt?.split('T')[0] || format(startOfMonth(now), 'yyyy-MM-dd'),
        startTime: '09:00'
      };
      if (forum.frequency === 'semanal') {
        const startDay = getDay(parseISO(recurrence.startDate)) || 7;
        recurrence.daysOfWeek = [startDay === 0 ? 7 : startDay];
      }
    }

    if (recurrence) {
      const { repeatEvery, repeatUnit, daysOfWeek, startDate, startTime } = recurrence;
      let current = parseISO(startDate);
      const startRange = new Date();
      
      if (isBefore(current, startRange)) {
        if (repeatUnit === 'day') current = addDays(current, Math.floor((startRange.getTime() - current.getTime()) / (1000 * 3600 * 24)));
        else if (repeatUnit === 'week') current = addWeeks(current, Math.floor((startRange.getTime() - current.getTime()) / (1000 * 3600 * 24 * 7)));
        else if (repeatUnit === 'month') {
          const diff = (startRange.getFullYear() - current.getFullYear()) * 12 + (startRange.getMonth() - current.getMonth());
          current = addMonths(current, Math.max(0, diff));
        }
      }

      let safety = 0;
      while (isBefore(current, futureLimit) && virtual.length < 30 && safety < 100) {
        safety++;
        if (isAfter(current, startRange) || format(current, 'yyyy-MM-dd') === todayStr) {
          const dayNum = getDay(current) === 0 ? 7 : getDay(current);
          if (repeatUnit !== 'week' || !daysOfWeek || daysOfWeek.length === 0 || daysOfWeek.includes(dayNum)) {
            const dateStr = format(current, 'yyyy-MM-dd');
            const hasReal = forumSessions.some(s => s.forumId === forum.id && s.scheduledAt.startsWith(dateStr));
            const isSkipped = forum.skippedDates?.includes(dateStr);
            if (!hasReal && !isSkipped) {
              virtual.push({
                id: `virtual-${forum.id}-${dateStr}`,
                forumId: forum.id,
                forumName: forum.name,
                scheduledAt: `${dateStr}T${startTime || '09:00'}:00`,
                status: 'scheduled',
                attendees: [],
                currentSectionIndex: 0,
                results: {},
                companyId: forum.companyId,
                createdBy: forum.createdBy
              });
            }
          }
        }
        if (repeatUnit === 'day') current = addDays(current, repeatEvery || 1);
        else if (repeatUnit === 'week') current = daysOfWeek?.length ? addDays(current, 1) : addWeeks(current, repeatEvery || 1);
        else if (repeatUnit === 'month') current = addMonths(current, repeatEvery || 1);
        else break;
      }
    }

    return [...realSessions, ...virtual].sort((a,b) => a.scheduledAt.localeCompare(b.scheduledAt));
  };

  const handleSaveForum = async (e: React.FormEvent) => {
    if (!activeCompanyId || !dbUser || isSaving) return;

    setIsSaving(true);
    try {
      const { id, ...dataToSave } = editingForum as any;
      
      const forumData: any = {
        ...dataToSave,
        companyId: activeCompanyId,
        createdBy: dbUser.uid,
        createdAt: dataToSave.createdAt || new Date().toISOString(),
        sections: dataToSave.sections || []
      };

      if (!showRecurrence) {
        delete forumData.recurrence;
      } else {
        forumData.frequency = 'periodic';
        // Ensure recurrence has at least the basic defaults if it was partially defined
        forumData.recurrence = {
          repeatEvery: forumData.recurrence?.repeatEvery || 1,
          repeatUnit: forumData.recurrence?.repeatUnit || 'week',
          daysOfWeek: forumData.recurrence?.daysOfWeek || [],
          startDate: forumData.recurrence?.startDate || format(new Date(), 'yyyy-MM-dd'),
          startTime: forumData.recurrence?.startTime || '09:00',
          endTime: forumData.recurrence?.endTime || '09:30',
          ...(forumData.recurrence?.endDate ? { endDate: forumData.recurrence.endDate } : {})
        };
      }

      const colRef = collection(db, 'forums');
      if (id) {
        const docRef = doc(db, 'forums', id);
        await updateDoc(docRef, forumData);
      } else {
        await addDoc(colRef, forumData);
      }
      setIsForumModalOpen(false);
      setEditingForum(null);
      setShowRecurrence(false);
    } catch (err: any) {
      console.error("Error saving forum:", err);
      handleFirestoreError(err, OperationType.WRITE, 'forums');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForumForSession || !dbUser || !activeCompanyId || isSaving) return;
    setIsSaving(true);
    try {
      // Find team members to invite as attendees
      const team = teams.find(t => t.id === selectedForumForSession.teamId);
      let invitedAttendees: ForumAttendee[] = [];

      if (team?.hasGroups && team.groups && team.groups.length > 0) {
        // Collect all members from all groups
        team.groups.forEach(group => {
          group.members.forEach(m => {
            invitedAttendees.push({
              uid: m.uid,
              name: m.name,
              present: true,
              groupId: group.id,
              groupName: group.name,
              isLeader: group.leaderId === m.uid
            });
          });
        });
      } else {
        invitedAttendees = (team?.members || []).map(m => ({
          uid: m.uid,
          name: m.name,
          present: true,
          isLeader: team?.supervisorId === m.uid
        }));
      }
      
      // Add date to skippedDates to prevent virtual session duplication if this replaces a virtual instance
      const updatedSkippedDates = Array.from(new Set([...(selectedForumForSession.skippedDates || []), sessionDate]));
      try {
        await updateDoc(doc(db, 'forums', selectedForumForSession.id), {
          skippedDates: updatedSkippedDates
        });
      } catch (err) {
        console.warn("Could not update skippedDates on forum, but proceeding with session creation:", err);
      }

      const sessionData: Omit<ForumSession, 'id'> = {
        forumId: selectedForumForSession.id,
        forumName: selectedForumForSession.name,
        scheduledAt: `${sessionDate}T${sessionTime}:00`,
        status: 'scheduled',
        attendees: invitedAttendees,
        currentSectionIndex: 0,
        results: {},
        companyId: activeCompanyId,
        createdBy: dbUser.uid
      };

      await addDoc(collection(db, 'forumSessions'), sessionData);
      setIsSessionModalOpen(false);
      setSelectedForumForSession(null);
    } catch (err: any) {
      console.error("Error creating session:", err);
      handleFirestoreError(err, OperationType.WRITE, 'forumSessions');
    } finally {
      setIsSaving(false);
    }
  };

  const getFrequencyLabel = (forum: Forum) => {
    if (forum.frequency === 'periodic' && forum.recurrence) {
      const { repeatEvery, repeatUnit, daysOfWeek } = forum.recurrence;
      const unit = repeatUnit === 'day' ? 'días' : repeatUnit === 'week' ? 'semanas' : 'meses';
      let label = `Cada ${repeatEvery} ${unit}`;
      if (repeatUnit === 'week' && daysOfWeek && daysOfWeek.length > 0) {
        const days = daysOfWeek.map(d => DAYS_OF_WEEK.find(dw => dw.id === d)?.label).join(', ');
        label += ` (${days})`;
      }
      return label;
    }
    const standard: Record<string, string> = {
      diaria: 'Diaria',
      semanal: 'Semanal',
      mensual: 'Mensual',
      adhoc: 'Puntual',
      periodic: 'Periódico'
    };
    return standard[forum.frequency] || forum.frequency;
  };

  const forumColumns = [
    { header: 'Nombre', accessor: 'name' as keyof Forum },
    { header: 'Equipo', accessor: 'teamName' as keyof Forum },
    { header: 'Frecuencia', accessor: (f: Forum) => getFrequencyLabel(f) },
    { 
      header: 'Duración', 
      accessor: (f: Forum) => `${f.estimatedDuration} min`
    },
    { 
      header: 'Secciones', 
      accessor: (f: Forum) => f.sections?.length || 0
    }
  ];

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Foros</h1>
          <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Gestión de equipo y reuniones</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('sessions')}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all font-bold text-[10px] uppercase",
                viewMode === 'sessions' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50",
              )}
            >
              <MessagesSquare size={14} />
              Hoy
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all font-bold text-[10px] uppercase",
                viewMode === 'history' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50",
              )}
            >
              <History size={14} />
              Historial
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all font-bold text-[10px] uppercase",
                viewMode === 'calendar' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50",
              )}
            >
              <CalendarRange size={14} />
              Calendario
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all font-bold text-[10px] uppercase",
                viewMode === 'list' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50",
              )}
            >
              <Settings size={14} />
              Config
            </button>
          </div>
          {(isAdmin || isSupervisor) && (
            <button
              onClick={() => {
                setEditingForum({ 
                  name: '', 
                  frequency: 'diaria', 
                  estimatedDuration: 15, 
                  sections: [],
                  teamId: ''
                });
                setShowRecurrence(false);
                setIsForumModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-xs"
            >
              <Plus size={16} />
              Nuevo Foro
            </button>
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar foro o sesión..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
      {viewMode === 'calendar' ? (
        <ForumCalendar 
          sessions={filteredSessions} 
          onVirtualSessionClick={(session) => {
            const forum = forums.find(f => f.id === session.forumId);
            if (forum) {
              setSelectedForumForSession(forum);
              setSessionDate(session.scheduledAt.split('T')[0]);
              setSessionTime(session.scheduledAt.split('T')[1].substring(0, 5));
              setIsSessionModalOpen(true);
            }
          }}
          onReschedule={handleRescheduleSession}
          canReschedule={(session) => {
            if (session.status === 'completed') return false;
            if (isGlobalAdmin || isLeanPromotor || isAdmin) return true;
            const forum = forums.find(f => f.id === session.forumId);
            if (!forum) return false;
            const team = teams.find(t => t.id === forum.teamId);
            return team?.supervisorId === dbUser?.uid || forum.createdBy === dbUser?.uid;
          }}
        />
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <Table
            columns={forumColumns}
            data={filteredForums}
            onEdit={(f) => {
              setEditingForum(f);
              setShowRecurrence(f.frequency === 'periodic');
              setIsForumModalOpen(true);
            }}
            onDelete={async (f) => {
              if (window.confirm('¿Estás seguro de eliminar este foro?')) {
                await deleteDoc(doc(db, 'forums', f.id));
              }
            }}
            actions={(f: Forum) => (
              <button
                onClick={() => {
                  setSelectedForumIdForExecutions(f.id);
                  setIsExecutionsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                title="Futuras Ejecuciones"
              >
                <CalendarRange size={16} />
                <span className="text-[10px] font-bold">PRÓXIMAS</span>
              </button>
            )}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredSessions.map(session => (
            <div 
              key={session.id}
              onClick={async () => {
                if (session.id.startsWith('virtual-')) {
                  try {
                    const forum = forums.find(f => f.id === session.forumId);
                    if (!forum || !dbUser || !activeCompanyId) return;
                    
                    const dateStr = session.scheduledAt.split('T')[0];
                    const updatedSkippedDates = Array.from(new Set([...(forum.skippedDates || []), dateStr]));
                    await updateDoc(doc(db, 'forums', forum.id), {
                      skippedDates: updatedSkippedDates
                    });

                    const team = teams.find(t => t.id === forum.teamId);
                    let invitedAttendees: ForumAttendee[] = [];
                    if (team?.hasGroups && team.groups) {
                      team.groups.forEach(g => g.members.forEach(m => invitedAttendees.push({
                        uid: m.uid, name: m.name, present: true, groupId: g.id, groupName: g.name, isLeader: g.leaderId === m.uid
                      })));
                    } else {
                      invitedAttendees = (team?.members || []).map(m => ({ uid: m.uid, name: m.name, present: true, isLeader: team?.supervisorId === m.uid }));
                    }

                    const docRef = await addDoc(collection(db, 'forumSessions'), {
                      forumId: forum.id,
                      forumName: forum.name,
                      scheduledAt: session.scheduledAt,
                      status: 'scheduled',
                      attendees: invitedAttendees,
                      currentSectionIndex: 0,
                      results: {},
                      companyId: activeCompanyId,
                      createdBy: dbUser.uid
                    });
                    navigate(`/forums/${docRef.id}`);
                  } catch (err) {
                    console.error("Error starting virtual session:", err);
                  }
                } else {
                  navigate(`/forums/${session.id}`);
                }
              }}
              className="group bg-white p-4 rounded-xl border border-gray-100 transition-all cursor-pointer relative overflow-hidden hover:border-blue-200"
            >
              <div className={clsx(
                "absolute top-0 right-0 w-1 h-full",
                session.status === 'scheduled' ? "bg-blue-400" :
                session.status === 'in_progress' ? "bg-orange-400 animate-pulse" :
                session.status === 'completed' ? "bg-green-400" : "bg-gray-400"
              )} />
              
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <MessagesSquare size={18} />
                  </div>
                  <span className={clsx(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    session.status === 'scheduled' ? "bg-blue-50 text-blue-600" :
                    session.status === 'in_progress' ? "bg-orange-50 text-orange-600" :
                    session.status === 'completed' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                  )}>
                    {session.status === 'scheduled' ? 'Programado' :
                     session.status === 'in_progress' ? 'En Curso' :
                     session.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {session.forumName}
                </h3>
                
                <div className="space-y-1 mt-auto">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <Calendar size={12} />
                    {format(new Date(session.scheduledAt), "eee d MMM, HH:mm", { locale: es })}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <Users size={12} />
                    {session.attendees.length} invitados
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex -space-x-1.5">
                    {session.attendees.slice(0, 3).map((a, i) => (
                      <div key={i} className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px] font-bold text-blue-600 uppercase">
                        {a.name.charAt(0)}
                      </div>
                    ))}
                    {session.attendees.length > 3 && (
                      <div className="w-5 h-5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold text-gray-600">
                        +{session.attendees.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

          {filteredSessions.length === 0 && (
            <div className="py-12 text-center bg-white rounded-2xl border border-gray-100">
              <div className="inline-flex p-3 bg-gray-50 rounded-xl text-gray-300 mb-3">
                <MessagesSquare size={32} />
              </div>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-widest whitespace-pre-wrap">
                {viewMode === 'sessions' 
                  ? "Sin reuniones para hoy" 
                  : "Historial vacío"}
              </p>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Forum Definition Modal */}
      <Modal
        isOpen={isForumModalOpen}
        onClose={() => { setIsForumModalOpen(false); setEditingForum(null); setShowRecurrence(false); }}
        title={editingForum?.id ? "Editar Foro" : "Nuevo Foro"}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveForum} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del Foro</label>
              <input
                type="text"
                required
                value={editingForum?.name || ''}
                onChange={(e) => setEditingForum({ ...editingForum, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                placeholder="Ej: GAP Cocteleras Grupo C"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Equipo Responsable</label>
              <select
                required
                value={editingForum?.teamId || ''}
                onChange={(e) => {
                  const team = teams.find(t => t.id === e.target.value);
                  setEditingForum({ ...editingForum, teamId: e.target.value, teamName: team?.name });
                }}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              >
                <option value="">Seleccionar equipo...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Duración Estimada (min)</label>
              <input
                type="number"
                required
                value={editingForum?.estimatedDuration || 15}
                onChange={(e) => setEditingForum({ ...editingForum, estimatedDuration: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
            </div>
            
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const nextShow = !showRecurrence;
                    setShowRecurrence(nextShow);
                    if (nextShow && !editingForum?.recurrence) {
                      setEditingForum({
                        ...editingForum,
                        frequency: 'periodic',
                        recurrence: {
                          repeatEvery: 1,
                          repeatUnit: 'week',
                          daysOfWeek: [],
                          startDate: format(new Date(), 'yyyy-MM-dd'),
                          startTime: '09:00',
                          endTime: '09:30'
                        }
                      });
                    }
                  }}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                    showRecurrence 
                      ? "bg-blue-50 border-blue-200 text-blue-600" 
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <RefreshCcw size={18} className={clsx(showRecurrence && "animate-spin-slow")} />
                  {showRecurrence ? 'Recurrencia Activa' : 'Configurar Recurrencia'}
                </button>
                
                {!showRecurrence && (
                  <div className="flex-1">
                    <select
                      required
                      value={editingForum?.frequency || 'diaria'}
                      onChange={(e) => setEditingForum({ ...editingForum, frequency: e.target.value as ForumFrequency })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    >
                      <option value="diaria">Diaria</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensual">Mensual</option>
                      <option value="adhoc">Ad-hoc (Puntual)</option>
                    </select>
                  </div>
                )}
              </div>

              {showRecurrence && (
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Fecha de inicio</label>
                      <input
                        type="date"
                        value={editingForum?.recurrence?.startDate || format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => {
                          const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: '', startTime: '09:00', endTime: '09:30' };
                          setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, startDate: e.target.value } });
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">Hora de inicio</label>
                      <input
                        type="time"
                        value={editingForum?.recurrence?.startTime || '09:00'}
                        onChange={(e) => {
                          const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '', endTime: '09:30' };
                          setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, startTime: e.target.value } });
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center px-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hora de finalización</label>
                      </div>
                      <input
                        type="time"
                        value={editingForum?.recurrence?.endTime || '09:30'}
                        onChange={(e) => {
                          const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '' };
                          setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, endTime: e.target.value } });
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span className="font-medium">Repetir cada</span>
                    <input
                      type="number"
                      min="1"
                      value={editingForum?.recurrence?.repeatEvery || 1}
                      onChange={(e) => {
                        const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '09:30' };
                        setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, repeatEvery: parseInt(e.target.value) || 1 } });
                      }}
                      className="w-16 px-2 py-1 bg-white border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <select
                      value={editingForum?.recurrence?.repeatUnit || 'week'}
                      onChange={(e) => {
                        const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '09:30' };
                        setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, repeatUnit: e.target.value as any } });
                      }}
                      className="px-2 py-1 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="day">días</option>
                      <option value="week">semanas</option>
                      <option value="month">meses</option>
                    </select>
                  </div>

                  {editingForum?.recurrence?.repeatUnit === 'week' && (
                    <div className="flex gap-2 justify-between">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '09:30' };
                            const currentDays = recurrence.daysOfWeek || [];
                            const newDays = currentDays.includes(day.id)
                              ? currentDays.filter(d => d !== day.id)
                              : [...currentDays, day.id];
                            setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, daysOfWeek: newDays } });
                          }}
                          className={clsx(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                            editingForum?.recurrence?.daysOfWeek?.includes(day.id)
                              ? "bg-blue-600 text-white scale-110"
                              : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                          )}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-medium whitespace-nowrap">Hasta el</span>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="date"
                        value={editingForum?.recurrence?.endDate || ''}
                        disabled={!editingForum?.recurrence?.endDate}
                        onChange={(e) => {
                          const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '09:30' };
                          setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, endDate: e.target.value } });
                        }}
                        className={clsx(
                          "flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all",
                          !editingForum?.recurrence?.endDate && "opacity-50 cursor-not-allowed"
                        )}
                        placeholder="Sin fecha de fin"
                      />
                      {!editingForum?.recurrence?.endDate ? (
                        <button
                          type="button"
                          onClick={() => {
                            const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '09:30' };
                            setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: { ...recurrence, endDate: format(addMonths(new Date(), 6), 'yyyy-MM-dd') } });
                          }}
                          className="text-xs text-blue-600 hover:underline font-bold"
                        >
                          Definir fin
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const recurrence = editingForum?.recurrence || { repeatEvery: 1, repeatUnit: 'week', daysOfWeek: [], startDate: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '09:30' };
                            const newRec = { ...recurrence };
                            delete newRec.endDate;
                            setEditingForum({ ...editingForum, frequency: 'periodic', recurrence: newRec });
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar fecha de fin"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
             <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-semibold text-gray-700">Secciones Preestablecidas</label>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRE_ESTABLISHED_SECTIONS.map((section) => {
                  const isSelected = (editingForum?.sections || []).some(s => s.id === section.id);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        const sections = [...(editingForum?.sections || [])];
                        if (isSelected) {
                          setEditingForum({ ...editingForum, sections: sections.filter(s => s.id !== section.id) });
                        } else {
                          sections.push({
                            id: section.id,
                            title: section.title,
                            duration: section.duration,
                            order: sections.length + 1
                          });
                          // Re-sort by order to keep it somewhat consistent if needed, 
                          // but here we just append. Maybe keep the same order as PRE_ESTABLISHED_SECTIONS?
                          // Let's keep the order of PRE_ESTABLISHED_SECTIONS.
                          const newSections = PRE_ESTABLISHED_SECTIONS
                            .filter(ps => isSelected ? ps.id !== section.id : (sections.some(s => s.id === ps.id) || ps.id === section.id))
                            .map((ps, idx) => ({
                              ...ps,
                              order: idx + 1
                            }));
                          
                          setEditingForum({ ...editingForum, sections: newSections });
                        }
                      }}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                        isSelected 
                          ? "bg-blue-50 border-blue-200 text-blue-700" 
                          : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                        isSelected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300"
                      )}>
                        {isSelected && <Plus size={14} className="rotate-45" />}
                      </div>
                      <span className="text-sm font-medium">{section.title}</span>
                    </button>
                  );
                })}
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => { setIsForumModalOpen(false); setEditingForum(null); setShowRecurrence(false); }}
              className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : null}
              {editingForum?.id ? 'Guardar Cambios' : 'Crear Foro'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Future Executions Modal */}
      <Modal
        isOpen={isExecutionsModalOpen}
        onClose={() => { 
          setIsExecutionsModalOpen(false); 
          setSelectedForumIdForExecutions(null); 
          setExecutionsPage(1);
        }}
        title="Próximas Ejecuciones"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {(() => {
            const currentForum = forums.find(f => f.id === selectedForumIdForExecutions);
            if (!currentForum) return null;

            return (
              <>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-800">{currentForum.name}</h4>
                    <p className="text-xs text-gray-500">Equipo: {currentForum.teamName}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedForumForSession(currentForum);
                      setIsSessionModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold"
                  >
                    <Plus size={14} />
                    Nueva puntual
                  </button>
                </div>

                <div className="space-y-2">
                  {(() => {
                    const allExecutions = getFutureExecutions(currentForum);
              const totalExecutions = allExecutions.length;
              const totalPages = Math.ceil(totalExecutions / EXECUTIONS_PER_PAGE);
              const startIdx = (executionsPage - 1) * EXECUTIONS_PER_PAGE;
              const paginatedExecutions = allExecutions.slice(startIdx, startIdx + EXECUTIONS_PER_PAGE);

              return (
                <>
                  {paginatedExecutions.map((session, idx) => (
                    <div key={`${session.id}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-100 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          "w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold",
                          session.id.startsWith('virtual-') ? "bg-gray-50 text-gray-400" : "bg-blue-50 text-blue-600"
                        )}>
                          <span className="text-[10px] leading-tight">
                            {format(parseISO(session.scheduledAt), 'MMM', { locale: es })}
                          </span>
                          <span className="text-base leading-tight">
                            {format(parseISO(session.scheduledAt), 'd')}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">
                              {format(parseISO(session.scheduledAt), 'HH:mm')}
                            </span>
                            {session.id.startsWith('virtual-') && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Planificada</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {format(parseISO(session.scheduledAt), "EEEE d 'de' MMMM", { locale: es })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          className="text-xs border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const time = session.scheduledAt.split('T')[1];
                            handleRescheduleSession(session.id, `${e.target.value}T${time}`);
                          }}
                        />
                        {!session.id.startsWith('virtual-') && (
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar esta sesión programada?')) {
                                await deleteDoc(doc(db, 'forumSessions', session.id));
                              }
                            }}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {totalExecutions === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400 font-medium">No hay próximas ejecuciones programadas.</p>
                    </div>
                  )}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4 px-1">
                      <p className="text-xs text-gray-400">
                        Mostrando <span className="font-bold text-gray-600">{startIdx + 1}-{Math.min(startIdx + EXECUTIONS_PER_PAGE, totalExecutions)}</span> de <span className="font-bold text-gray-600">{totalExecutions}</span>
                      </p>
                      <div className="flex gap-1">
                        <button
                          disabled={executionsPage === 1}
                          onClick={() => setExecutionsPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider"
                        >
                          Anterior
                        </button>
                        <button
                          disabled={executionsPage === totalPages}
                          onClick={() => setExecutionsPage(p => Math.min(totalPages, p + 1))}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 disabled:opacity-50 transition-all font-bold text-[10px] uppercase tracking-wider"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Program Session Modal */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => { setIsSessionModalOpen(false); setSelectedForumForSession(null); }}
        title="Programar Sesión de Foro"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-4">
            <h4 className="font-bold text-blue-800 text-sm mb-1">{selectedForumForSession?.name}</h4>
            <p className="text-xs text-blue-600 italic">Equipo: {selectedForumForSession?.teamName}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Hora</label>
            <input
              type="time"
              required
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => { setIsSessionModalOpen(false); setSelectedForumForSession(null); }}
              className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : null}
              Programar Sesión
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
