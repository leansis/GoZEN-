import React, { useState, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { 
  AlertCircle, Search, Filter, Calendar, Users as UsersIcon, 
  MessagesSquare, ArrowUpRight, CheckCircle2, Trash2, X,
  ExternalLink, ChevronRight, Share2, ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Table, { Column } from '../components/Table';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import clsx from 'clsx';
import { Incident, ActionPlan } from '../types';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Incidents() {
  const { dbUser, isAdmin } = useAuth();
  const { incidents, teams, forums, indicators, loading, actionPlans, users, actionCategories } = useAppData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterForumId, setFilterForumId] = useState('');
  
  // Selected Incident state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showTraceability, setShowTraceability] = useState(false);
  
  // Secondary modals (on top of traceability)
  const [editingActionInTraceability, setEditingActionInTraceability] = useState<ActionPlan | null>(null);
  const [editingIncidentInTraceability, setEditingIncidentInTraceability] = useState<Incident | null>(null);
  
  // Delete confirm state
  const [incidentToDelete, setIncidentToDelete] = useState<Incident | null>(null);

  const isLeanManager = dbUser?.role === 'lean_promotor';
  const canDelete = isAdmin || isLeanManager;

  const linkedActions = useMemo(() => {
    if (!selectedIncident) return [];
    return actionPlans.filter(a => a.incidentId === selectedIncident.id);
  }, [selectedIncident, actionPlans]);

  const handleDeleteIncident = async () => {
    if (!incidentToDelete) return;
    try {
      await deleteDoc(doc(db, 'incidents', incidentToDelete.id));
      setIncidentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'incidents');
    }
  };

  const checkAndResolveIncident = async (incidentId: string) => {
    if (!incidentId) return;
    const linkedActions = actionPlans.filter(a => a.incidentId === incidentId);
    const allDone = linkedActions.every(a => a.status === 'finalizada');

    if (allDone && linkedActions.length > 0) {
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'resuelta'
      });
    }
  };

  const handleUpdateAction = async (action: ActionPlan, updates: Partial<ActionPlan>) => {
    try {
      const payload: any = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      if (!payload.priority) {
        payload.priority = action.priority || 'media';
      }
      
      // If we are updating names based on assignedTo
      if (updates.assignedTo) {
        payload.assignedToNames = updates.assignedTo.map(uid => 
          users.find(u => u.uid === uid)?.name || 'Desconocido'
        );
      }

      await updateDoc(doc(db, 'actionPlans', action.id), payload);
      if (updates.status === 'finalizada' && action.incidentId) {
        await checkAndResolveIncident(action.incidentId);
      }
      setEditingActionInTraceability(null);
    } catch (err) {
      console.error("Error updating action:", err);
    }
  };

  const handleUpdateIncidentDetail = async (incident: Incident, updates: Partial<Incident>) => {
    try {
      await updateDoc(doc(db, 'incidents', incident.id), updates);
      setEditingIncidentInTraceability(null);
      // Also update selectedIncident for the main modal if it's the same
      if (selectedIncident?.id === incident.id) {
        setSelectedIncident({ ...selectedIncident, ...updates });
      }
    } catch (err) {
      console.error("Error updating incident:", err);
    }
  };

  const filteredIncidents = useMemo(() => {
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

    // 5. BASE FILTER
    let list = isAdmin ? incidents : incidents.filter(incident => {
      const isCreator = incident.createdBy === userUid;
      const isForumVisible = visibleForumIds.has(incident.forumId);
      const isEscalatedTarget = incident.escalatedToForumId && visibleForumIds.has(incident.escalatedToForumId);
      const isEscalationInvolved = incident.escalationHistory?.some((h: any) => visibleForumIds.has(h.fromForumId));
      
      return isCreator || isForumVisible || isEscalatedTarget || isEscalationInvolved;
    });

    // 6. SEARCH & SELECT FILTERS
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => 
        i.title.toLowerCase().includes(q) || 
        i.description.toLowerCase().includes(q) ||
        i.indicatorName?.toLowerCase().includes(q) ||
        i.forumName?.toLowerCase().includes(q)
      );
    }

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

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [incidents, teams, forums, dbUser, isAdmin, searchQuery, filterTeamId, filterForumId]);

  const columns: Column<Incident>[] = [
    {
      header: 'Incidencia',
      accessor: (i) => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{i.title}</span>
          <span className="text-xs text-gray-500 line-clamp-1">{i.description}</span>
        </div>
      )
    },
    {
      header: 'Foro Origen',
      accessor: (i) => (
        <div className="flex items-center gap-2">
          <MessagesSquare size={14} className="text-gray-400" />
          <span className="text-sm">{i.forumName}</span>
        </div>
      )
    },
    {
      header: 'Indicador',
      accessor: (i) => i.indicatorName ? (
        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">
          {i.indicatorName}
        </span>
      ) : <span className="text-gray-400">-</span>
    },
    {
      header: 'Estado',
      accessor: (i) => (
        <span className={clsx(
          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
          i.status === 'abierta' ? "bg-orange-100 text-orange-700" :
          i.status === 'en_accion' ? "bg-blue-100 text-blue-700" :
          i.status === 'resuelta' ? "bg-green-100 text-green-700" :
          "bg-gray-100 text-gray-700"
        )}>
          {i.status || 'abierta'}
        </span>
      )
    },
    {
      header: 'Escalado',
      accessor: (i) => i.isEscalated ? (
        <div className="flex items-center gap-1 text-orange-600">
          <ArrowUpRight size={14} strokeWidth={3} />
          <span className="text-xs font-bold uppercase">Escalada</span>
        </div>
      ) : <span className="text-gray-400">-</span>
    },
    {
      header: 'Fecha',
      accessor: (i) => (
        <div className="flex flex-col text-xs text-gray-500">
          <span className="font-medium">{format(new Date(i.createdAt), 'dd MMM yyyy', { locale: es })}</span>
          <span>{format(new Date(i.createdAt), 'HH:mm')}h</span>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Incidencias</h1>
          <p className="text-gray-500 mt-1">Gestión y visualización de incidencias detectadas en foros.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por título, descripción, foro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <UsersIcon size={18} className="text-gray-400" />
          <select
            value={filterTeamId}
            onChange={(e) => {
              setFilterTeamId(e.target.value);
              setFilterForumId('');
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Equipos</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <MessagesSquare size={18} className="text-gray-400" />
          <select
            value={filterForumId}
            onChange={(e) => setFilterForumId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Todos los Foros</option>
            {forums
              .filter(f => !filterTeamId || f.teamId === filterTeamId)
              .map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Abiertas</p>
            <p className="text-2xl font-bold text-gray-900">{filteredIncidents.filter(i => i.status === 'abierta').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">En acción</p>
            <p className="text-2xl font-bold text-gray-900">{filteredIncidents.filter(i => i.status === 'en_accion').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Resueltas</p>
            <p className="text-2xl font-bold text-gray-900">{filteredIncidents.filter(i => i.status === 'resuelta').length}</p>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <Table
          data={filteredIncidents}
          columns={columns}
          searchable={false}
          onDelete={canDelete ? setIncidentToDelete : undefined}
          onRowDoubleClick={(i) => {
            setSelectedIncident(i);
            setIsDetailModalOpen(true);
            setShowTraceability(false);
          }}
        />
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalle de Incidencia"
        maxWidth="max-w-2xl"
      >
        {selectedIncident && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className={clsx(
                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                selectedIncident.status === 'abierta' ? "bg-orange-100 text-orange-700" :
                selectedIncident.status === 'en_accion' ? "bg-blue-100 text-blue-700" :
                "bg-green-100 text-green-700"
              )}>
                {selectedIncident.status || 'abierta'}
              </span>
              <button
                onClick={() => setShowTraceability(!showTraceability)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors px-3 py-2 bg-blue-50 rounded-lg"
              >
                <Share2 size={16} />
                {showTraceability ? "Ocultar trazabilidad" : "Ver trazabilidad"}
              </button>
            </div>

            {showTraceability ? (
              <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="relative flex flex-col items-center gap-12">
                  {/* Incident Node */}
                  <div 
                    onDoubleClick={() => setEditingIncidentInTraceability(selectedIncident)}
                    className="z-10 w-full max-w-sm bg-white p-4 rounded-xl shadow-md border-2 border-orange-500 cursor-pointer hover:shadow-lg transition-all"
                    title="Doble clic para ver detalle"
                  >
                    <div className="flex items-center gap-2 text-orange-600 mb-2">
                      <AlertCircle size={18} />
                      <span className="text-xs font-bold uppercase font-mono">Incidencia</span>
                    </div>
                    <h4 className="font-bold text-gray-900">{selectedIncident.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{selectedIncident.forumName}</p>
                  </div>

                  {/* Vertical line connecting nodes */}
                  {linkedActions.length > 0 && (
                    <div className="absolute top-16 bottom-0 w-1 bg-gray-200 left-1/2 -translate-x-1/2" />
                  )}

                  {/* Action Nodes */}
                  <div className="w-full flex flex-col items-center gap-6">
                    {linkedActions.length > 0 ? (
                      linkedActions.map((action) => (
                        <div 
                          key={action.id} 
                          onDoubleClick={() => setEditingActionInTraceability(action)}
                          className="z-10 w-full max-w-sm bg-white p-4 rounded-xl shadow-md border-2 border-blue-500 relative cursor-pointer hover:shadow-lg transition-all"
                          title="Doble clic para ver detalle"
                        >
                          <div className="flex items-center gap-2 text-blue-600 mb-2">
                            <ClipboardList size={18} />
                            <span className="text-xs font-bold uppercase font-mono">Acción Vinculada</span>
                          </div>
                          <h4 className="font-bold text-gray-900">{action.title}</h4>
                          <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Foro: {action.originForumName || 'N/A'}</p>
                          <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className={clsx(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              action.status === 'finalizada' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {action.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-400 italic">No hay acciones vinculadas aún.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Título</label>
                    <p className="text-lg font-bold text-gray-900">{selectedIncident.title}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</label>
                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                      {selectedIncident.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <MessagesSquare className="text-gray-400" size={18} />
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Foro Origen</p>
                        <p className="text-sm font-semibold">{selectedIncident.forumName}</p>
                      </div>
                    </div>

                    {selectedIncident.indicatorName && (
                      <div className="flex items-center gap-3">
                        <ArrowUpRight className="text-gray-400" size={18} />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Indicador</p>
                          <p className="text-sm font-semibold">{selectedIncident.indicatorName}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <Calendar className="text-gray-400" size={18} />
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Creada el</p>
                        <p className="text-sm font-semibold">
                          {format(new Date(selectedIncident.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-6 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-bold text-gray-600 uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!incidentToDelete}
        onCancel={() => setIncidentToDelete(null)}
        onConfirm={handleDeleteIncident}
        title="Eliminar Incidencia"
        message="¿Estás seguro de que deseas eliminar esta incidencia? Esta acción no se puede deshacer."
      />

      {/* Secondary Incident Detail Modal (on top) */}
      <Modal
        isOpen={!!editingIncidentInTraceability}
        onClose={() => setEditingIncidentInTraceability(null)}
        title="Detalle de Incidencia (Trazabilidad)"
        maxWidth="max-w-xl"
      >
        {editingIncidentInTraceability && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Título</label>
                    <input 
                      className="w-full text-lg font-bold text-gray-900 border-none px-0 focus:ring-0" 
                      value={editingIncidentInTraceability.title}
                      onChange={(e) => setEditingIncidentInTraceability({...editingIncidentInTraceability, title: e.target.value})}
                      disabled={!isAdmin && !isLeanManager}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</label>
                    <textarea 
                      className="w-full text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                      rows={4}
                      value={editingIncidentInTraceability.description}
                      onChange={(e) => setEditingIncidentInTraceability({...editingIncidentInTraceability, description: e.target.value})}
                      disabled={!isAdmin && !isLeanManager}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setEditingIncidentInTraceability(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
                {(isAdmin || isLeanManager) && (
                  <button
                    onClick={() => handleUpdateIncidentDetail(editingIncidentInTraceability, {
                      title: editingIncidentInTraceability.title,
                      description: editingIncidentInTraceability.description
                    })}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-bold uppercase tracking-wider"
                  >
                    Guardar Cambios
                  </button>
                )}
              </div>
          </div>
        )}
      </Modal>

      {/* Action Detail Modal (on top) */}
      <Modal
        isOpen={!!editingActionInTraceability}
        onClose={() => setEditingActionInTraceability(null)}
        title="Detalle de Acción"
        maxWidth="max-w-2xl"
      >
        {editingActionInTraceability && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Título</label>
                  <input 
                    type="text"
                    className="w-full text-lg font-bold text-gray-900 border-none px-0 focus:ring-0 bg-transparent"
                    value={editingActionInTraceability.title}
                    onChange={(e) => setEditingActionInTraceability({...editingActionInTraceability, title: e.target.value})}
                    disabled={!canDelete && !editingActionInTraceability.assignedTo?.includes(dbUser?.uid || '')}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción</label>
                  <textarea 
                    className="w-full text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[100px] focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editingActionInTraceability.description}
                    onChange={(e) => setEditingActionInTraceability({...editingActionInTraceability, description: e.target.value})}
                    disabled={!canDelete}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Responsable</label>
                  <select 
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    value={editingActionInTraceability.assignedTo?.[0] || ""}
                    onChange={(e) => setEditingActionInTraceability({
                      ...editingActionInTraceability, 
                      assignedTo: e.target.value ? [e.target.value] : []
                    })}
                    disabled={!canDelete}
                  >
                    <option value="">Sin asignar</option>
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha Límite</label>
                    <input 
                      type="date"
                      className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      value={editingActionInTraceability.targetDate}
                      onChange={(e) => setEditingActionInTraceability({...editingActionInTraceability, targetDate: e.target.value})}
                      disabled={!canDelete}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado</label>
                    <select 
                      className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      value={editingActionInTraceability.status}
                      onChange={(e) => setEditingActionInTraceability({...editingActionInTraceability, status: e.target.value as any})}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En Progreso</option>
                      <option value="finalizada">Finalizada</option>
                      <option value="retrasada">Retrasada</option>
                      <option value="bloqueada">Bloqueada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>

                {/* Custom Fields (Categories) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {actionCategories.filter(c => c.active).map(cat => (
                    <div key={cat.id}>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{cat.name}</label>
                      <select 
                        className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={editingActionInTraceability.customFields?.[cat.id] || ''}
                        onChange={(e) => setEditingActionInTraceability({
                          ...editingActionInTraceability, 
                          customFields: {
                            ...(editingActionInTraceability.customFields || {}),
                            [cat.id]: e.target.value
                          }
                        })}
                      >
                        <option value="">Seleccionar...</option>
                        {cat.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notas / Seguimiento</label>
                  <textarea 
                    className="w-full text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 min-h-[80px] focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editingActionInTraceability.notes}
                    onChange={(e) => setEditingActionInTraceability({...editingActionInTraceability, notes: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setEditingActionInTraceability(null)}
                className="px-6 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-bold text-gray-600 uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateAction(editingActionInTraceability, {
                  title: editingActionInTraceability.title,
                  description: editingActionInTraceability.description,
                  status: editingActionInTraceability.status,
                  assignedTo: editingActionInTraceability.assignedTo,
                  targetDate: editingActionInTraceability.targetDate,
                  notes: editingActionInTraceability.notes,
                  customFields: editingActionInTraceability.customFields || {}
                })}
                className="px-8 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 transition-all text-sm font-bold uppercase tracking-wider"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

