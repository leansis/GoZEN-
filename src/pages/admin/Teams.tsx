import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteField, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Team, User, Process, TeamGroup, TeamMember } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Trash2, Users as UsersIcon } from 'lucide-react';

export default function Teams() {
  const { dbUser, activeCompanyId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [editingTeam, setEditingTeam] = useState<Partial<Team> | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId || ''));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      setLoading(false);
    });

    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId || ''));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { id: string })));
    });

    const qProcesses = query(collection(db, 'processes'), where('companyId', '==', companyId || ''));
    const unsubProcesses = onSnapshot(qProcesses, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)));
    });

    return () => {
      unsubTeams();
      unsubUsers();
      unsubProcesses();
    };
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingTeam?.name || !editingTeam?.supervisorId || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      const teamData: any = {
        name: editingTeam.name,
        supervisorId: editingTeam.supervisorId,
        supervisorName: users.find(u => u.uid === editingTeam.supervisorId)?.name || '',
        members: (editingTeam.members || []).map(m => {
          const user = users.find(u => u.uid === m.uid);
          return {
            uid: m.uid,
            name: user ? user.name : m.name,
            photoURL: user?.photoURL || (m as any).photoURL || null
          };
        }),
        processIds: editingTeam.processIds || [],
        companyId: companyId || '',
        hasGroups: editingTeam.hasGroups || false,
        groups: (editingTeam.groups || []).map(g => ({
          ...g,
          leaderName: users.find(u => u.uid === g.leaderId)?.name || g.leaderName || ''
        }))
      };

      if (editingTeam.parentTeamId) {
        teamData.parentTeamId = editingTeam.parentTeamId;
      } else if (editingTeam.id) {
        teamData.parentTeamId = deleteField();
      }

      if (editingTeam.id) {
        await updateDoc(doc(db, 'teams', editingTeam.id), teamData);
      } else {
        await addDoc(collection(db, 'teams'), teamData);
      }
      setEditingTeam(null);
    } catch (error: any) {
      console.error('Error saving team:', error);
      setSaveError(error.message || 'Error al guardar el equipo. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (teamToDelete) {
      try {
        await deleteDoc(doc(db, 'teams', teamToDelete.id));
      } catch (error: any) {
        console.error('Error deleting team:', error);
        setSaveError(error.message || 'Error al eliminar el equipo. Verifica los permisos.');
      }
    }
  };

  const toggleMember = (uid: string, name: string, photoURL?: string) => {
    if (!editingTeam) return;
    const members = editingTeam.members || [];
    const exists = members.find(m => m.uid === uid);
    if (exists) {
      setEditingTeam({ ...editingTeam, members: members.filter(m => m.uid !== uid) });
    } else {
      setEditingTeam({ ...editingTeam, members: [...members, { uid, name, photoURL } as any] });
    }
  };

  const toggleProcess = (processId: string) => {
    if (!editingTeam) return;
    const processIds = editingTeam.processIds || [];
    if (processIds.includes(processId)) {
      setEditingTeam({ ...editingTeam, processIds: processIds.filter(id => id !== processId) });
    } else {
      setEditingTeam({ ...editingTeam, processIds: [...processIds, processId] });
    }
  };

  const addGroup = () => {
    if (!editingTeam) return;
    const groups = editingTeam.groups || [];
    const newGroup: TeamGroup = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Grupo ${groups.length + 1}`,
      leaderId: '',
      leaderName: '',
      members: []
    };
    setEditingTeam({ ...editingTeam, groups: [...groups, newGroup], hasGroups: true });
  };

  const removeGroup = (groupId: string) => {
    if (!editingTeam) return;
    const groups = (editingTeam.groups || []).filter(g => g.id !== groupId);
    setEditingTeam({ ...editingTeam, groups });
  };

  const updateGroup = (groupId: string, data: Partial<TeamGroup>) => {
    if (!editingTeam) return;
    const groups = (editingTeam.groups || []).map(g => 
      g.id === groupId ? { ...g, ...data } : g
    );
    setEditingTeam({ ...editingTeam, groups });
  };

  const toggleGroupMember = (groupId: string, member: TeamMember) => {
    if (!editingTeam) return;
    const group = (editingTeam.groups || []).find(g => g.id === groupId);
    if (!group) return;

    const memberExists = group.members.some(m => m.uid === member.uid);
    const updatedMembers = memberExists
      ? group.members.filter(m => m.uid !== member.uid)
      : [...group.members, member];

    updateGroup(groupId, { members: updatedMembers });
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Equipos</h1>
        <button
          onClick={() => setEditingTeam({ members: [], processIds: [] })}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Equipo
        </button>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <Table<Team>
        data={teams}
        columns={[
          { header: 'Equipo', accessor: 'name', sortable: true },
          { 
            header: 'Supervisor', 
            accessor: (t) => t.supervisorName || users.find(u => u.uid === t.supervisorId)?.name || 'Desconocido',
            sortable: true,
            sortAccessor: (t) => t.supervisorName || users.find(u => u.uid === t.supervisorId)?.name || ''
          },
          { 
            header: 'Grupos', 
            accessor: (t) => t.hasGroups ? (t.groups?.length || 0) : 'N/A', 
            sortable: true 
          },
          { header: 'Miembros', accessor: (t) => t.members?.length || 0, sortable: true },
          { header: 'Procesos', accessor: (t) => t.processIds?.length || 0, sortable: true },
        ]}
        onEdit={setEditingTeam}
        onDelete={setTeamToDelete}
      />

      <ConfirmModal
        isOpen={!!teamToDelete}
        title="Eliminar Equipo"
        message={`¿Estás seguro de que deseas eliminar el equipo ${teamToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setTeamToDelete(null)}
      />

      <Modal
        isOpen={!!editingTeam}
        onClose={() => { setEditingTeam(null); setSaveError(null); }}
        title={editingTeam?.id ? "Editar Equipo" : "Nuevo Equipo"}
        maxWidth="max-w-4xl"
      >
        {editingTeam && (
          <form onSubmit={handleSave} className="space-y-6">
            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {saveError}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del Equipo</label>
                <input
                  type="text"
                  required
                  value={editingTeam.name || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  className="w-full rounded-xl border-gray-200 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="Ej: Equipo de Producción A"
                />
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Supervisor</label>
                <select
                  required
                  value={editingTeam.supervisorId || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, supervisorId: e.target.value })}
                  className="w-full rounded-xl border-gray-200 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {users
                    .filter(u => u.role === 'supervisor' || u.role === 'admin' || u.role === 'lean_promotor')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(u => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Equipo Padre (Opcional)</label>
                <select
                  value={editingTeam.parentTeamId || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, parentTeamId: e.target.value })}
                  className="w-full rounded-xl border-gray-200 shadow-sm p-2.5 border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                >
                  <option value="">Ninguno</option>
                  {teams.filter(t => t.id !== editingTeam.id).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar Miembros</label>
                <div className="h-64 overflow-y-auto border border-gray-100 rounded-xl p-3 space-y-1 bg-gray-50/50">
                  {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                    <label key={u.uid} className="flex items-center space-x-3 p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTeam.members?.some(m => m.uid === u.uid) || false}
                        onChange={() => toggleMember(u.uid, u.name, u.photoURL)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Asignar Procesos</label>
                <div className="h-64 overflow-y-auto border border-gray-100 rounded-xl p-3 space-y-1 bg-gray-50/50">
                  {processes.length > 0 ? processes.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                    <label key={p.id} className="flex items-center space-x-3 p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingTeam.processIds?.includes(p.id) || false}
                        onChange={() => toggleProcess(p.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{p.name}</span>
                    </label>
                  )) : (
                    <p className="text-center py-10 text-gray-400 text-sm italic">No hay procesos definidos</p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasGroups"
                    checked={editingTeam.hasGroups || false}
                    onChange={(e) => setEditingTeam({ ...editingTeam, hasGroups: e.target.checked, groups: e.target.checked ? (editingTeam.groups || []) : [] })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasGroups" className="text-sm font-bold text-gray-700">Este equipo tiene varios grupos</label>
                </div>
                {editingTeam.hasGroups && (
                  <button
                    type="button"
                    onClick={addGroup}
                    className="flex items-center text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-bold"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Añadir Grupo
                  </button>
                )}
              </div>

              {editingTeam.hasGroups && (
                <div className="space-y-4">
                  {(editingTeam.groups || []).map((group, gIdx) => (
                    <div key={group.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex justify-between items-center">
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                          className="font-bold text-gray-800 bg-transparent border-none focus:ring-0 p-0"
                          placeholder="Nombre del Grupo"
                        />
                        <button
                          type="button"
                          onClick={() => removeGroup(group.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Líder del Grupo</label>
                          <select
                            value={group.leaderId}
                            onChange={(e) => updateGroup(group.id, { leaderId: e.target.value })}
                            className="block w-full rounded-lg border-gray-300 shadow-sm p-1.5 border text-sm"
                          >
                            <option value="">Seleccionar líder...</option>
                            {editingTeam.members?.map(m => (
                              <option key={m.uid} value={m.uid}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Miembros del Grupo</label>
                          <div className="max-h-32 overflow-y-auto border bg-white rounded-lg p-2 space-y-1">
                            {editingTeam.members?.map(m => (
                              <label key={m.uid} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={group.members.some(gm => gm.uid === m.uid)}
                                  onChange={() => toggleGroupMember(group.id, m)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-700">{m.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(editingTeam.groups || []).length === 0 && (
                    <p className="text-center py-4 text-sm text-gray-400 italic">No hay grupos definidos.</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end pt-8 border-t border-gray-100 gap-3">
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-10 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-xl shadow-blue-200"
              >
                Guardar Equipo
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
