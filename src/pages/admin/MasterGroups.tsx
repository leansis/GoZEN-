import React, { useState } from 'react';
import { Plus, Search, ListChecks } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useAppData } from '../../contexts/AppDataContext';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { MasterGroup } from '../../types';
import Modal from '../../components/Modal';
import Table from '../../components/Table';
import { handleFirestoreError, OperationType } from '../../lib/firestore-utils';

export default function MasterGroups() {
  const { activeCompanyId } = useAuth();
  const { masterGroups } = useAppData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Partial<MasterGroup> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = masterGroups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !editingGroup?.name) return;

    try {
      if (editingGroup.id) {
        await updateDoc(doc(db, 'masterGroups', editingGroup.id), {
          name: editingGroup.name
        });
      } else {
        await addDoc(collection(db, 'masterGroups'), {
          name: editingGroup.name,
          companyId: activeCompanyId,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingGroup(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'masterGroups');
    }
  };

  const columns = [
    { header: 'Nombre del Grupo', accessor: 'name' as keyof MasterGroup },
    { 
      header: 'Fecha de Creación', 
      accessor: (g: MasterGroup) => new Date(g.createdAt).toLocaleDateString('es-ES') 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grupos</h1>
          <p className="text-sm text-gray-500">Gestión global de nombres de grupos para equipos</p>
        </div>
        <button
          onClick={() => {
            setEditingGroup({ name: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-200"
        >
          <Plus size={18} />
          Nuevo grupo
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar grupo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={filteredGroups}
          onEdit={(g) => {
            setEditingGroup(g);
            setIsModalOpen(true);
          }}
          onDelete={async (g) => {
            if (window.confirm('¿Estás seguro de eliminar este grupo maestro?')) {
              try {
                await deleteDoc(doc(db, 'masterGroups', g.id));
              } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `masterGroups/${g.id}`);
              }
            }
          }}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGroup?.id ? 'Editar Grupo' : 'Nuevo Grupo'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nombre del Grupo
            </label>
            <input
              type="text"
              required
              value={editingGroup?.name || ''}
              onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              placeholder="Ej: Mañana, Tarde, Equipo A..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-200"
            >
              {editingGroup?.id ? 'Guardar Cambios' : 'Crear Grupo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
