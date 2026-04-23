import React, { useState } from 'react';
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
  X
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
import { Forum, ForumFrequency, ForumAgendaItem, ForumSession, ForumAttendee, ForumRecurrence } from '../types';
import Modal from '../components/Modal';
import Table from '../components/Table';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { format, addWeeks, addMonths, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

const DAYS_OF_WEEK = [
  { id: 1, label: 'L' },
  { id: 2, label: 'M' },
  { id: 3, label: 'X' },
  { id: 4, label: 'J' },
  { id: 5, label: 'V' },
  { id: 6, label: 'S' },
  { id: 7, label: 'D' },
];

export default function Forums() {
  const { dbUser, isAdmin, isSupervisor, activeCompanyId } = useAuth();
  const { forums, forumSessions, teams, users } = useAppData();
  const navigate = useNavigate();
  
  const [isForumModalOpen, setIsForumModalOpen] = useState(false);
  const [editingForum, setEditingForum] = useState<Partial<Forum> | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedForumForSession, setSelectedForumForSession] = useState<Forum | null>(null);
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sessionTime, setSessionTime] = useState(format(new Date(), 'HH:mm'));
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'sessions'>('sessions');

  const filteredForums = forums.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSessions = forumSessions.filter(s => 
    s.forumName.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a,b) => b.scheduledAt.localeCompare(a.scheduledAt));

  const handleSaveForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !dbUser) return;

    try {
      const { id, ...dataToSave } = editingForum as any;
      
      const forumData: any = {
        ...dataToSave,
        companyId: activeCompanyId,
        createdBy: dbUser.uid,
        createdAt: dataToSave.createdAt || new Date().toISOString(),
        agenda: dataToSave.agenda || []
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

      if (id) {
        await updateDoc(doc(db, 'forums', id), forumData);
      } else {
        await addDoc(collection(db, 'forums'), forumData);
      }
      setIsForumModalOpen(false);
      setEditingForum(null);
      setShowRecurrence(false);
    } catch (err) {
      console.error("Error saving forum:", err);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForumForSession || !dbUser || !activeCompanyId) return;

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
              present: false,
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
          present: false,
          isLeader: team?.supervisorId === m.uid
        }));
      }

      const sessionData: Omit<ForumSession, 'id'> = {
        forumId: selectedForumForSession.id,
        forumName: selectedForumForSession.name,
        scheduledAt: `${sessionDate}T${sessionTime}:00`,
        status: 'scheduled',
        attendees: invitedAttendees,
        currentAgendaStep: 0,
        results: {},
        companyId: activeCompanyId,
        createdBy: dbUser.uid
      };

      await addDoc(collection(db, 'forumSessions'), sessionData);
      setIsSessionModalOpen(false);
      setSelectedForumForSession(null);
    } catch (err) {
      console.error("Error creating session:", err);
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
      header: 'Pasos Agenda', 
      accessor: (f: Forum) => f.agenda?.length || 0
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Foros y Reuniones</h1>
          <p className="text-sm text-gray-500">Gestión de foros de equipo y seguimiento de reuniones</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'sessions' : 'list')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm shadow-sm"
          >
            {viewMode === 'list' ? <History size={18} /> : <MessagesSquare size={18} />}
            {viewMode === 'list' ? 'Ver Sesiones' : 'Ver Definiciones'}
          </button>
          {(isAdmin || isSupervisor) && (
            <button
              onClick={() => {
                setEditingForum({ 
                  name: '', 
                  frequency: 'diaria', 
                  estimatedDuration: 15, 
                  agenda: [],
                  teamId: ''
                });
                setShowRecurrence(false);
                setIsForumModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-200"
            >
              <Plus size={18} />
              Nuevo Foro
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar foro o sesión..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                  setSelectedForumForSession(f);
                  setIsSessionModalOpen(true);
                }}
                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                title="Programar Sesión"
              >
                <Calendar size={18} />
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map(session => (
            <div 
              key={session.id}
              onClick={() => navigate(`/forums/${session.id}`)}
              className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
            >
              <div className={clsx(
                "absolute top-0 right-0 w-1.5 h-full",
                session.status === 'scheduled' ? "bg-blue-400" :
                session.status === 'in_progress' ? "bg-orange-400 animate-pulse" :
                session.status === 'completed' ? "bg-green-400" : "bg-gray-400"
              )} />
              
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <MessagesSquare size={24} />
                  </div>
                  <span className={clsx(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    session.status === 'scheduled' ? "bg-blue-50 text-blue-600" :
                    session.status === 'in_progress' ? "bg-orange-50 text-orange-600" :
                    session.status === 'completed' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                  )}>
                    {session.status === 'scheduled' ? 'Programado' :
                     session.status === 'in_progress' ? 'En Curso' :
                     session.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">
                  {session.forumName}
                </h3>
                
                <div className="space-y-2 mt-auto">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={14} />
                    {format(new Date(session.scheduledAt), "eeee d 'de' MMMM, HH:mm", { locale: es })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users size={14} />
                    {session.attendees.length} invitados
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                  <div className="flex -space-x-2">
                    {session.attendees.slice(0, 3).map((a, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase">
                        {a.name.charAt(0)}
                      </div>
                    ))}
                    {session.attendees.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600">
                        +{session.attendees.length - 3}
                      </div>
                    )}
                  </div>
                  <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Play size={18} fill="currentColor" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredSessions.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="inline-flex p-4 bg-gray-50 rounded-2xl text-gray-300 mb-4">
                <MessagesSquare size={48} />
              </div>
              <p className="text-gray-400 font-medium whitespace-pre-wrap">No hay sesiones de foro programadas.\n¡Empieza por definir un foro o programar una sesión!</p>
            </div>
          )}
        </div>
      )}

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
                      ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm" 
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
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110"
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
                <label className="block text-sm font-semibold text-gray-700">Agenda / Pasos del Foro</label>
                <button
                  type="button"
                  onClick={() => {
                    const agenda = [...(editingForum?.agenda || [])];
                    agenda.push({
                      id: Math.random().toString(36).substr(2, 9),
                      title: '',
                      order: agenda.length + 1
                    });
                    setEditingForum({ ...editingForum, agenda });
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center gap-1"
                >
                  <Plus size={16} /> Añadir Paso
                </button>
             </div>
             <div className="space-y-3">
                {(editingForum?.agenda || []).sort((a,b) => a.order - b.order).map((item, idx) => (
                  <div key={item.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-gray-200 text-xs font-bold text-gray-400">
                      {idx + 1}
                    </div>
                    <input
                      type="text"
                      required
                      value={item.title}
                      onChange={(e) => {
                        const agenda = [...(editingForum?.agenda || [])];
                        agenda[idx].title = e.target.value;
                        setEditingForum({ ...editingForum, agenda });
                      }}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none"
                      placeholder="Título del paso de la agenda"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const agenda = (editingForum?.agenda || []).filter((_, i) => i !== idx);
                        setEditingForum({ ...editingForum, agenda });
                      }}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {(editingForum?.agenda || []).length === 0 && (
                  <p className="text-center py-4 text-sm text-gray-400 italic">No hay pasos definidos aún.</p>
                )}
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setIsForumModalOpen(false); setEditingForum(null); }}
              className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-200"
            >
              Guardar Foro
            </button>
          </div>
        </form>
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
              onClick={() => { setIsSessionModalOpen(false); setSelectedForumForSession(null); }}
              className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-200"
            >
              Programar Sesión
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
