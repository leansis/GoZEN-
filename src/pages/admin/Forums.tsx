import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  MessagesSquare, 
  Trash2, 
  Edit2, 
  Search, 
  Clock, 
  RefreshCcw, 
  Folder
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { db } from '../../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { Forum, ForumFrequency } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-utils';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import clsx from 'clsx';
import { format, addMonths } from 'date-fns';
import { toast } from 'react-hot-toast';

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

export default function AdminForums() {
  const { dbUser, activeCompanyId } = useAuth();
  const { forums, teams } = useAppData();
  
  const [isForumModalOpen, setIsForumModalOpen] = useState(false);
  const [editingForum, setEditingForum] = useState<Partial<Forum> | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter forums belonging to the active company
  const companyForums = useMemo(() => {
    const targetCompanyId = activeCompanyId || dbUser?.companyId;
    if (!targetCompanyId) return [];
    return forums.filter(f => f.companyId === targetCompanyId);
  }, [forums, activeCompanyId, dbUser]);

  // Apply search query
  const filteredForums = useMemo(() => {
    return companyForums.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.teamName && f.teamName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [companyForums, searchQuery]);

  const handleSaveForum = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetCompanyId = activeCompanyId || dbUser?.companyId;
    if (!targetCompanyId || !dbUser) {
      toast.error('Error de autenticación: No se pudo identificar la empresa activa o el usuario.');
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    try {
      const { id, ...dataToSave } = editingForum as any;
      
      const forumData: any = {
        ...dataToSave,
        companyId: targetCompanyId,
        createdBy: dbUser.uid,
        createdAt: dataToSave.createdAt || new Date().toISOString(),
        sections: dataToSave.sections || []
      };

      if (!showRecurrence) {
        delete forumData.recurrence;
      } else {
        forumData.frequency = 'periodic';
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

      // Local validation before sending to Firestore
      if (!forumData.name || forumData.name.trim() === '') {
        toast.error('El nombre del foro es requerido.');
        setIsSaving(false);
        return;
      }

      if (!forumData.teamId || forumData.teamId.trim() === '') {
        toast.error('Debe seleccionar un equipo responsable para este foro.');
        setIsSaving(false);
        return;
      }

      // Sanitize fields to prevent sending undefined fields to Firestore
      const cleanForumData: any = {};
      Object.keys(forumData).forEach(key => {
        if (forumData[key] !== undefined && forumData[key] !== null) {
          cleanForumData[key] = forumData[key];
        }
      });

      const colRef = collection(db, 'forums');
      if (id) {
        const docRef = doc(db, 'forums', id);
        await updateDoc(docRef, cleanForumData);
        toast.success('Foro actualizado correctamente');
      } else {
        await addDoc(colRef, cleanForumData);
        toast.success('Foro creado correctamente');
      }
      setIsForumModalOpen(false);
      setEditingForum(null);
      setShowRecurrence(false);
    } catch (err: any) {
      console.error("Error saving forum:", err);
      
      let errorMsg = "Error al guardar el foro";
      if (err?.code === 'permission-denied') {
        errorMsg = "Error de permisos: No tienes autorización (Admin/Supervisor/Promotor) o los datos no cumplen con las reglas de seguridad de Firestore.";
      } else if (err?.message?.includes('permission-denied')) {
        errorMsg = "Error de permisos de Firestore: No tienes autorización o los campos obligatorios no cumplen con el formato de seguridad.";
      } else if (err?.code) {
        errorMsg = `Error de Firebase (${err.code}): ${err.message || 'Error desconocido'}`;
      } else if (err?.message) {
        errorMsg = `Error al guardar: ${err.message}`;
      }
      
      toast.error(errorMsg, { duration: 6000 });
      handleFirestoreError(err, OperationType.WRITE, 'forums');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteForum = async (forum: Forum) => {
    if (window.confirm('¿Estás seguro de eliminar este foro? Se eliminará su definición maestra.')) {
      try {
        await deleteDoc(doc(db, 'forums', forum.id));
      } catch (err: any) {
        console.error("Error deleting forum:", err);
        handleFirestoreError(err, OperationType.DELETE, `forums/${forum.id}`);
      }
    }
  };

  const getFrequencyLabel = (forum: Forum) => {
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Maestro de Foros</h1>
          <p className="text-sm text-gray-500">Configuración maestra, periodicidad y secciones de los foros de reunión</p>
        </div>
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
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm"
        >
          <Plus size={18} />
          Nuevo Foro
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar foro o equipo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Table
          columns={forumColumns}
          data={filteredForums}
          onEdit={(f) => {
            setEditingForum(f);
            setShowRecurrence(f.frequency === 'periodic');
            setIsForumModalOpen(true);
          }}
          onDelete={handleDeleteForum}
        />
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
    </div>
  );
}
