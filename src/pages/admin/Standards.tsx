import React, { useState, useRef, useMemo } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { Standard, Activity, Process, Task } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Upload, Loader2, Link as LinkIcon, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Standards() {
  const { dbUser, activeCompanyId } = useAuth();
  const { activities, processes, tasks, standards, users, loading: dataLoading } = useAppData();

  const [editingStandard, setEditingStandard] = useState<Partial<Standard> | null>(null);
  const [standardToDelete, setStandardToDelete] = useState<Standard | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [relationSearch, setRelationSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateNextReviewDate = (lastReviewDateStr?: string, months: number = 12): string => {
    if (!lastReviewDateStr) return '';
    const date = new Date(lastReviewDateStr);
    if (isNaN(date.getTime())) return '';
    // Use UTC or local based on the date string
    // Standard inputs (type="date") yield YYYY-MM-DD
    // If we parse that with new Date(YYYY-MM-DD), it might be treated as UTC, which can cause timezone shifts depending on local time.
    // To prevent shifting, parse the parts manually:
    const [year, month, day] = lastReviewDateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setMonth(d.getMonth() + months);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;
    if (!companyId) {
      toast.error('No se pudo identificar la compañía activa.');
      return;
    }

    if (!editingStandard?.name) {
      setSaveError('El nombre es obligatorio.');
      return;
    }

    if (!editingStandard.responsibleId) {
      setSaveError('El responsable es obligatorio.');
      return;
    }

    if (!editingStandard.relationType) {
      setSaveError('Debes seleccionar el tipo de relación jerárquica (Actividad, Proceso o Tarea).');
      return;
    }

    // Validation for selections
    if (editingStandard.relationType === 'activity') {
      const selected = editingStandard.activityIds || (editingStandard.activityId ? [editingStandard.activityId] : []);
      if (selected.length === 0) {
        setSaveError('Debes seleccionar al menos una actividad.');
        return;
      }
    } else if (editingStandard.relationType === 'process') {
      const selected = editingStandard.processIds || (editingStandard.processId ? [editingStandard.processId] : []);
      if (selected.length === 0) {
        setSaveError('Debes seleccionar al menos un proceso.');
        return;
      }
    } else if (editingStandard.relationType === 'task') {
      const selected = editingStandard.taskIds || (editingStandard.taskId ? [editingStandard.taskId] : []);
      if (selected.length === 0) {
        setSaveError('Debes seleccionar al menos una tarea.');
        return;
      }
    }

    // Validation for content
    if (!editingStandard.contentType) {
      setSaveError('Debes seleccionar el tipo de contenido.');
      return;
    }
    if (editingStandard.contentType === 'link' && !editingStandard.externalLink) {
      setSaveError('Debes ingresar un enlace externo.');
      return;
    }
    if (editingStandard.contentType === 'file' && !editingStandard.fileUrl) {
      setSaveError('Debes subir un archivo para el estándar.');
      return;
    }

    try {
      const respUser = users.find(u => u.uid === editingStandard.responsibleId || u.id === editingStandard.responsibleId);
      const responsibleName = respUser ? respUser.name : 'Desconocido';

      const validityMonths = editingStandard.validityMonths !== undefined ? Number(editingStandard.validityMonths) : 12;
      const lastReviewDate = editingStandard.lastReviewDate || '';
      const nextReviewDate = lastReviewDate ? calculateNextReviewDate(lastReviewDate, validityMonths) : '';

      const standardData: any = {
        name: editingStandard.name,
        responsibleId: editingStandard.responsibleId,
        responsibleName,
        relationType: editingStandard.relationType,
        contentType: editingStandard.contentType,
        companyId,
        createdAt: editingStandard.createdAt || new Date().toISOString(),
        lastReviewDate,
        validityMonths,
        nextReviewDate,
      };

      if (editingStandard.id) {
        const existingStd = standards.find(s => s.id === editingStandard.id);
        if (existingStd && existingStd.lastReviewDate !== lastReviewDate) {
          standardData.reviewActionCreated = false;
        } else if (existingStd) {
          standardData.reviewActionCreated = existingStd.reviewActionCreated || false;
        }
      } else {
        standardData.reviewActionCreated = false;
      }

      // Clear non-applicable relations and populate arrays
      if (editingStandard.relationType === 'activity') {
        const selected = editingStandard.activityIds || (editingStandard.activityId ? [editingStandard.activityId] : []);
        standardData.activityIds = selected;
        standardData.activityId = selected[0] || '';
        standardData.processId = '';
        standardData.processIds = [];
        standardData.taskId = '';
        standardData.taskIds = [];
      } else if (editingStandard.relationType === 'process') {
        const selected = editingStandard.processIds || (editingStandard.processId ? [editingStandard.processId] : []);
        standardData.activityId = '';
        standardData.activityIds = [];
        standardData.processIds = selected;
        standardData.processId = selected[0] || '';
        standardData.taskId = '';
        standardData.taskIds = [];
      } else if (editingStandard.relationType === 'task') {
        const selected = editingStandard.taskIds || (editingStandard.taskId ? [editingStandard.taskId] : []);
        standardData.activityId = '';
        standardData.activityIds = [];
        standardData.processId = '';
        standardData.processIds = [];
        standardData.taskIds = selected;
        standardData.taskId = selected[0] || '';
      }

      // Clear non-applicable content
      if (editingStandard.contentType === 'file') {
        standardData.fileUrl = editingStandard.fileUrl;
        standardData.fileName = editingStandard.fileName;
        standardData.externalLink = '';
      } else {
        standardData.fileUrl = '';
        standardData.fileName = '';
        standardData.externalLink = editingStandard.externalLink;
      }

      if (editingStandard.id) {
        await updateDoc(doc(db, 'standards', editingStandard.id), standardData);
        toast.success('Estándar actualizado correctamente');
      } else {
        await addDoc(collection(db, 'standards'), standardData);
        toast.success('Estándar creado correctamente');
      }

      setEditingStandard(null);
    } catch (error: any) {
      console.error('Error saving standard:', error);
      setSaveError(error.message || 'Error al guardar el estándar.');
    }
  };

  const handleDelete = async () => {
    if (standardToDelete) {
      try {
        await deleteDoc(doc(db, 'standards', standardToDelete.id));
        toast.success('Estándar eliminado correctamente');
        setStandardToDelete(null);
      } catch (error: any) {
        console.error('Error deleting standard:', error);
        toast.error('Error al eliminar el estándar.');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const storageRef = ref(storage, `standards/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      setEditingStandard(prev => ({
        ...prev!,
        fileUrl: url,
        fileName: file.name
      }));
      toast.success('Archivo subido correctamente');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error al subir el archivo a Storage.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getRelationText = (item: Standard) => {
    if (item.relationType === 'activity') {
      const ids = item.activityIds || (item.activityId ? [item.activityId] : []);
      if (ids.length === 0) return 'Ninguna';
      const names = ids.map(id => activities.find(a => a.id === id)?.name || 'Desconocida');
      return `Actividades: ${names.join(', ')}`;
    }
    if (item.relationType === 'process') {
      const ids = item.processIds || (item.processId ? [item.processId] : []);
      if (ids.length === 0) return 'Ninguno';
      const names = ids.map(id => processes.find(p => p.id === id)?.name || 'Desconocido');
      return `Procesos: ${names.join(', ')}`;
    }
    if (item.relationType === 'task') {
      const ids = item.taskIds || (item.taskId ? [item.taskId] : []);
      if (ids.length === 0) return 'Ninguna';
      const names = ids.map(id => tasks.find(t => t.id === id)?.name || 'Desconocida');
      return `Tareas: ${names.join(', ')}`;
    }
    return 'Ninguno';
  };

  const getContentViewLink = (item: Standard) => {
    if (item.contentType === 'file') {
      return (
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
        >
          <FileText size={14} />
          <span>{item.fileName || 'Ver Archivo'}</span>
        </a>
      );
    }
    return (
      <a
        href={item.externalLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
      >
        <LinkIcon size={14} />
        <span>Abrir Enlace</span>
      </a>
    );
  };

  if (dataLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-500">Cargando datos...</div>;
  }

  const filteredStandards = standards.filter(std => {
    if (!globalSearch) return true;
    const search = globalSearch.toLowerCase();
    const relationName = getRelationText(std).toLowerCase();
    return (
      std.name.toLowerCase().includes(search) ||
      (std.responsibleName || '').toLowerCase().includes(search) ||
      relationName.includes(search)
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estándares</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona la documentación estándar asociada a las actividades, procesos y tareas.
          </p>
        </div>
        <button
          onClick={() => setEditingStandard({ 
            relationType: 'task', 
            contentType: 'link',
            validityMonths: 12,
            lastReviewDate: new Date().toISOString().split('T')[0]
          })}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Estándar
        </button>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar estándares por nombre, responsable o relación..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredStandards.length > 0 ? (
          <Table<Standard>
            data={filteredStandards}
            columns={[
              {
                header: 'Nombre',
                accessor: 'name',
                sortable: true,
                sortAccessor: (item) => item.name
              },
              {
                header: 'Responsable',
                accessor: (item) => item.responsibleName || 'Sin asignar',
                sortable: true,
                sortAccessor: (item) => item.responsibleName || ''
              },
              {
                header: 'Relación Jerárquica',
                accessor: (item) => getRelationText(item),
                sortable: true,
                sortAccessor: (item) => getRelationText(item)
              },
              {
                header: 'Última Revisión',
                accessor: (item) => item.lastReviewDate ? new Date(item.lastReviewDate + 'T00:00:00').toLocaleDateString('es-ES') : 'Pendiente',
                sortable: true,
                sortAccessor: (item) => item.lastReviewDate || ''
              },
              {
                header: 'Validez',
                accessor: (item) => item.validityMonths !== undefined ? `${item.validityMonths} meses` : '12 meses',
                sortable: true,
                sortAccessor: (item) => String(item.validityMonths || 12)
              },
              {
                header: 'Próxima Revisión',
                accessor: (item) => {
                  const nextDate = item.nextReviewDate || (item.lastReviewDate ? calculateNextReviewDate(item.lastReviewDate, item.validityMonths ?? 12) : '');
                  if (!nextDate) return 'Pendiente';
                  return new Date(nextDate + 'T00:00:00').toLocaleDateString('es-ES');
                },
                sortable: true,
                sortAccessor: (item) => item.nextReviewDate || ''
              },
              {
                header: 'Contenido',
                accessor: (item) => getContentViewLink(item)
              }
            ]}
            onEdit={setEditingStandard}
            onDelete={setStandardToDelete}
            searchable={false}
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No se encontraron estándares. Haz clic en "Nuevo Estándar" para comenzar.
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!standardToDelete}
        title="Eliminar Estándar"
        message={`¿Estás seguro de que deseas eliminar el estándar "${standardToDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setStandardToDelete(null)}
      />

      <Modal
        isOpen={!!editingStandard}
        onClose={() => { setEditingStandard(null); setSaveError(null); setRelationSearch(''); }}
        title={editingStandard?.id ? "Editar Estándar" : "Nuevo Estándar"}
      >
        {editingStandard && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                {saveError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Estándar</label>
              <input
                type="text"
                required
                value={editingStandard.name || ''}
                onChange={(e) => setEditingStandard({ ...editingStandard, name: e.target.value })}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Ej: Instrucción Técnica de Montaje"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Responsable</label>
              <select
                required
                value={editingStandard.responsibleId || ''}
                onChange={(e) => setEditingStandard({ ...editingStandard, responsibleId: e.target.value })}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              >
                <option value="">Seleccionar responsable...</option>
                {users.map(u => (
                  <option key={u.id || u.uid} value={u.uid || u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Hierarchy Level Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Relacionar con Jerarquía</label>
              <div className="flex gap-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="relationType"
                    checked={editingStandard.relationType === 'activity'}
                    onChange={() => {
                      setEditingStandard({ ...editingStandard, relationType: 'activity', activityId: '', activityIds: [], processId: '', processIds: [], taskId: '', taskIds: [] });
                      setRelationSearch('');
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Actividad
                </label>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="relationType"
                    checked={editingStandard.relationType === 'process'}
                    onChange={() => {
                      setEditingStandard({ ...editingStandard, relationType: 'process', activityId: '', activityIds: [], processId: '', processIds: [], taskId: '', taskIds: [] });
                      setRelationSearch('');
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Proceso
                </label>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="relationType"
                    checked={editingStandard.relationType === 'task'}
                    onChange={() => {
                      setEditingStandard({ ...editingStandard, relationType: 'task', activityId: '', activityIds: [], processId: '', processIds: [], taskId: '', taskIds: [] });
                      setRelationSearch('');
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Tarea
                </label>
              </div>
            </div>

            {/* Dynamic Relation Checkboxes */}
            {editingStandard.relationType === 'activity' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Relacionar con Actividades</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = activities.map(a => a.id);
                      const currentSelected = editingStandard.activityIds || (editingStandard.activityId ? [editingStandard.activityId] : []);
                      const isAllSelected = allIds.every(id => currentSelected.includes(id));
                      setEditingStandard({
                        ...editingStandard,
                        activityIds: isAllSelected ? [] : allIds,
                        activityId: isAllSelected ? '' : allIds[0] || ''
                      });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-850 font-semibold"
                  >
                    {(activities.map(a => a.id).every(id => (editingStandard.activityIds || (editingStandard.activityId ? [editingStandard.activityId] : [])).includes(id))) ? 'Desmarcar todas' : 'Seleccionar todas'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Buscar actividad..."
                  value={relationSearch}
                  onChange={(e) => setRelationSearch(e.target.value)}
                  className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2.5 space-y-1.5 bg-gray-50">
                  {activities.filter(a => a.name.toLowerCase().includes(relationSearch.toLowerCase())).map(a => {
                    const currentSelected = editingStandard.activityIds || (editingStandard.activityId ? [editingStandard.activityId] : []);
                    const isChecked = currentSelected.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let newIds = [...currentSelected];
                            if (isChecked) {
                              newIds = newIds.filter(id => id !== a.id);
                            } else {
                              newIds.push(a.id);
                            }
                            setEditingStandard({
                              ...editingStandard,
                              activityIds: newIds,
                              activityId: newIds[0] || ''
                            });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{a.name}</span>
                      </label>
                    );
                  })}
                  {activities.filter(a => a.name.toLowerCase().includes(relationSearch.toLowerCase())).length === 0 && (
                    <p className="text-center text-xs text-gray-500 py-4">No se encontraron actividades.</p>
                  )}
                </div>
              </div>
            )}

            {editingStandard.relationType === 'process' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Relacionar con Procesos</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = processes.map(p => p.id);
                      const currentSelected = editingStandard.processIds || (editingStandard.processId ? [editingStandard.processId] : []);
                      const isAllSelected = allIds.every(id => currentSelected.includes(id));
                      setEditingStandard({
                        ...editingStandard,
                        processIds: isAllSelected ? [] : allIds,
                        processId: isAllSelected ? '' : allIds[0] || ''
                      });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-850 font-semibold"
                  >
                    {(processes.map(p => p.id).every(id => (editingStandard.processIds || (editingStandard.processId ? [editingStandard.processId] : [])).includes(id))) ? 'Desmarcar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Buscar proceso..."
                  value={relationSearch}
                  onChange={(e) => setRelationSearch(e.target.value)}
                  className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2.5 space-y-1.5 bg-gray-50">
                  {processes.filter(p => {
                    const act = activities.find(a => a.id === p.activityId);
                    const label = `${p.name} ${act ? `(${act.name})` : ''}`;
                    return label.toLowerCase().includes(relationSearch.toLowerCase());
                  }).map(p => {
                    const act = activities.find(a => a.id === p.activityId);
                    const currentSelected = editingStandard.processIds || (editingStandard.processId ? [editingStandard.processId] : []);
                    const isChecked = currentSelected.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let newIds = [...currentSelected];
                            if (isChecked) {
                              newIds = newIds.filter(id => id !== p.id);
                            } else {
                              newIds.push(p.id);
                            }
                            setEditingStandard({
                              ...editingStandard,
                              processIds: newIds,
                              processId: newIds[0] || ''
                            });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="truncate flex flex-col">
                          <span className="font-medium">{p.name}</span>
                          {act && <span className="text-[10px] text-gray-400">{act.name}</span>}
                        </div>
                      </label>
                    );
                  })}
                  {processes.filter(p => p.name.toLowerCase().includes(relationSearch.toLowerCase())).length === 0 && (
                    <p className="text-center text-xs text-gray-500 py-4">No se encontraron procesos.</p>
                  )}
                </div>
              </div>
            )}

            {editingStandard.relationType === 'task' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Relacionar con Tareas</label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = tasks.map(t => t.id);
                      const currentSelected = editingStandard.taskIds || (editingStandard.taskId ? [editingStandard.taskId] : []);
                      const isAllSelected = allIds.every(id => currentSelected.includes(id));
                      setEditingStandard({
                        ...editingStandard,
                        taskIds: isAllSelected ? [] : allIds,
                        taskId: isAllSelected ? '' : allIds[0] || ''
                      });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-850 font-semibold"
                  >
                    {(tasks.map(t => t.id).every(id => (editingStandard.taskIds || (editingStandard.taskId ? [editingStandard.taskId] : [])).includes(id))) ? 'Desmarcar todas' : 'Seleccionar todas'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Buscar tarea o proceso..."
                  value={relationSearch}
                  onChange={(e) => setRelationSearch(e.target.value)}
                  className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2.5 space-y-1.5 bg-gray-50">
                  {tasks.filter(t => {
                    const proc = processes.find(p => p.id === t.processId);
                    const label = `${t.name} ${proc ? `(${proc.name})` : ''}`;
                    return label.toLowerCase().includes(relationSearch.toLowerCase());
                  }).map(t => {
                    const proc = processes.find(p => p.id === t.processId);
                    const currentSelected = editingStandard.taskIds || (editingStandard.taskId ? [editingStandard.taskId] : []);
                    const isChecked = currentSelected.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded transition-colors text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            let newIds = [...currentSelected];
                            if (isChecked) {
                              newIds = newIds.filter(id => id !== t.id);
                            } else {
                              newIds.push(t.id);
                            }
                            setEditingStandard({
                              ...editingStandard,
                              taskIds: newIds,
                              taskId: newIds[0] || ''
                            });
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="truncate flex flex-col">
                          <span className="font-medium">{t.name}</span>
                          {proc && <span className="text-[10px] text-gray-400">{proc.name}</span>}
                        </div>
                      </label>
                    );
                  })}
                  {tasks.filter(t => t.name.toLowerCase().includes(relationSearch.toLowerCase())).length === 0 && (
                    <p className="text-center text-xs text-gray-500 py-4">No se encontraron tareas.</p>
                  )}
                </div>
              </div>
            )}

            {/* Content Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de Contenido</label>
              <div className="flex gap-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="contentType"
                    checked={editingStandard.contentType === 'file'}
                    onChange={() => setEditingStandard({ ...editingStandard, contentType: 'file' })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Documento Subido (Storage)
                </label>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="contentType"
                    checked={editingStandard.contentType === 'link'}
                    onChange={() => setEditingStandard({ ...editingStandard, contentType: 'link' })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Enlace Externo
                </label>
              </div>
            </div>

            {/* Content inputs based on selection */}
            {editingStandard.contentType === 'link' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Enlace Externo (URL)</label>
                <input
                  type="url"
                  required
                  value={editingStandard.externalLink || ''}
                  onChange={(e) => setEditingStandard({ ...editingStandard, externalLink: e.target.value })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="https://google.com/document/..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subir Documento</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-gray-500" />
                    )}
                    <span>{editingStandard.fileUrl ? 'Cambiar Archivo' : 'Seleccionar Archivo'}</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                  />
                  {editingStandard.fileUrl && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                      <CheckCircle2 size={14} />
                      <span className="truncate max-w-[180px]" title={editingStandard.fileName}>
                        {editingStandard.fileName || 'Archivo subido'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-150">
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha Última Revisión</label>
                <input
                  type="date"
                  value={editingStandard.lastReviewDate || ''}
                  onChange={(e) => setEditingStandard({ ...editingStandard, lastReviewDate: e.target.value })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Validez (meses)</label>
                <input
                  type="number"
                  min="1"
                  value={editingStandard.validityMonths !== undefined ? editingStandard.validityMonths : 12}
                  onChange={(e) => setEditingStandard({ ...editingStandard, validityMonths: parseInt(e.target.value) || 12 })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center justify-between text-sm">
              <span className="font-medium text-blue-800">Próxima Revisión Calculada:</span>
              <span className="font-bold text-blue-900">
                {editingStandard.lastReviewDate ? (
                  new Date(calculateNextReviewDate(editingStandard.lastReviewDate, editingStandard.validityMonths ?? 12) + 'T00:00:00').toLocaleDateString('es-ES')
                ) : (
                  'Indica la fecha de última revisión'
                )}
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setEditingStandard(null)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm flex items-center"
              >
                Guardar Estándar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
