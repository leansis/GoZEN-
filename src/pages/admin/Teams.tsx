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
  const [memberSearch, setMemberSearch] = useState('');
  const [processSearch, setProcessSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'members' | 'groups'>('basic');

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
    if (!editingTeam?.name || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      const teamData: any = {
        name: editingTeam.name,
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

      // Reset team supervisor info if requested to be removed
      teamData.supervisorId = '';
      teamData.supervisorName = '';

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
        onClose={() => { 
          setEditingTeam(null); 
          setSaveError(null); 
          setActiveTab('basic');
          setMemberSearch('');
          setProcessSearch('');
        }}
        title={editingTeam?.id ? "Editar Equipo" : "Nuevo Equipo"}
        maxWidth="max-w-4xl"
      >
        {editingTeam && (
          <form onSubmit={handleSave} className="flex flex-col h-[70vh]">
            <div className="flex border-b border-gray-100 mb-6 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('basic')}
                className={`px-4 py-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'basic' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Información Básica
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`px-4 py-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'members' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Miembros y Procesos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('groups')}
                className={`px-4 py-2 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeTab === 'groups' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Grupos {editingTeam.groups && editingTeam.groups.length > 0 && `(${editingTeam.groups.length})`}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              {saveError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {saveError}
                </div>
              )}
              
              {activeTab === 'basic' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nombre del Equipo</label>
                      <input
                        type="text"
                        required
                        value={editingTeam.name || ''}
                        onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                        className="w-full rounded-xl border-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        placeholder="Ej: Equipo de Producción A"
                      />
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Equipo Padre (Opcional)</label>
                      <select
                        value={editingTeam.parentTeamId || ''}
                        onChange={(e) => setEditingTeam({ ...editingTeam, parentTeamId: e.target.value })}
                        className="w-full rounded-xl border-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm bg-white"
                      >
                        <option value="">Ninguno</option>
                        {teams.filter(t => t.id !== editingTeam.id).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex flex-col h-full">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Seleccionar Miembros</label>
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="Buscar miembros..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
                      />
                    </div>
                    <div className="flex-1 min-h-[300px] overflow-y-auto border border-gray-100 rounded-xl p-3 space-y-1 bg-gray-50/50">
                      {[...users]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase()))
                        .map(u => (
                        <label key={u.uid} className="flex items-center space-x-3 p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={editingTeam.members?.some(m => m.uid === u.uid) || false}
                            onChange={() => toggleMember(u.uid, u.name, u.photoURL)}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{u.name}</span>
                            <span className="text-[10px] text-gray-400 capitalize">{u.role}</span>
                          </div>
                        </label>
                      ))}
                      {users.filter(u => u.name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                        <p className="text-center py-10 text-gray-400 text-sm italic">No se encontraron usuarios</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col h-full">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Asignar Procesos</label>
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder="Buscar procesos..."
                        value={processSearch}
                        onChange={(e) => setProcessSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-sans"
                      />
                    </div>
                    <div className="flex-1 min-h-[300px] overflow-y-auto border border-gray-100 rounded-xl p-3 space-y-1 bg-gray-50/50">
                      {processes.length > 0 ? processes
                        .sort((a,b) => a.name.localeCompare(b.name))
                        .filter(p => p.name.toLowerCase().includes(processSearch.toLowerCase()))
                        .map(p => (
                        <label key={p.id} className="flex items-center space-x-3 p-2.5 hover:bg-white hover:shadow-sm rounded-lg transition-all cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={editingTeam.processIds?.includes(p.id) || false}
                            onChange={() => toggleProcess(p.id)}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                          />
                          <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{p.name}</span>
                        </label>
                      )) : (
                        <p className="text-center py-10 text-gray-400 text-sm italic">No hay procesos definidos</p>
                      )}
                      {processes.filter(p => p.name.toLowerCase().includes(processSearch.toLowerCase())).length === 0 && processes.length > 0 && (
                        <p className="text-center py-10 text-gray-400 text-sm italic">No se encontraron procesos</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'groups' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${editingTeam.hasGroups ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-400 border border-gray-200'}`}>
                          <UsersIcon size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-800">Estructura por Grupos</h4>
                          <p className="text-[11px] text-gray-500">Divide el equipo en grupos más pequeños con sus propios líderes.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTeam.hasGroups || false}
                            onChange={(e) => setEditingTeam({ ...editingTeam, hasGroups: e.target.checked, groups: e.target.checked ? (editingTeam.groups || []) : [] })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        
                        {editingTeam.hasGroups && (
                          <button
                            type="button"
                            onClick={addGroup}
                            className="flex items-center text-xs px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100"
                          >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Nuevo Grupo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {editingTeam.hasGroups && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {(editingTeam.groups || []).map((group, _) => (
                        <div key={group.id} className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all space-y-4 relative group/card">
                          <div className="flex justify-between items-center gap-4">
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                              className="font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-base flex-1 outline-none"
                              placeholder="Nombre del Grupo"
                            />
                            <button
                              type="button"
                              onClick={() => removeGroup(group.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                              title="Eliminar grupo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Supervisor del Grupo</label>
                              <select
                                value={group.leaderId}
                                onChange={(e) => updateGroup(group.id, { leaderId: e.target.value })}
                                className="block w-full rounded-xl border-gray-200 shadow-sm p-2.5 border text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                              >
                                <option value="">Seleccionar supervisor...</option>
                                {editingTeam.members?.map(m => (
                                  <option key={m.uid} value={m.uid}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Miembros del Grupo</label>
                              <div className="max-h-48 overflow-y-auto border border-gray-100 bg-gray-50/30 rounded-xl p-2.5 space-y-1.5">
                                {editingTeam.members?.map(m => (
                                  <label key={m.uid} className="flex items-center space-x-2.5 p-1.5 hover:bg-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-gray-100">
                                    <input
                                      type="checkbox"
                                      checked={group.members.some(gm => gm.uid === m.uid)}
                                      onChange={() => toggleGroupMember(group.id, m)}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-600 font-medium">{m.name}</span>
                                  </label>
                                ))}
                                {(!editingTeam.members || editingTeam.members.length === 0) && (
                                  <p className="text-[10px] text-gray-400 italic text-center py-4">Asigna miembros al equipo primero</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(editingTeam.groups || []).length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl">
                          No hay grupos definidos. Pulsa el botón superior para empezar.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center pt-8 border-t border-gray-100 mt-6 shrink-0">
              <div className="flex items-center gap-2">
                {activeTab !== 'basic' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'groups' ? 'members' : 'basic')}
                    className="px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-blue-100"
                  >
                    Anterior
                  </button>
                )}
                {activeTab !== 'groups' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'basic' ? 'members' : 'groups')}
                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all border border-gray-200"
                  >
                    Siguiente
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingTeam(null); setSaveError(null); setActiveTab('basic'); }}
                  className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-10 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-xl shadow-blue-200"
                >
                  {editingTeam.id ? 'Actualizar Equipo' : 'Crear Equipo'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
