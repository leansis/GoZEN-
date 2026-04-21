import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Tag } from 'lucide-react';

export interface ActionCategory {
  id: string;
  name: string;
  companyId: string;
  createdAt: string;
}

export default function ActionCategories() {
  const { dbUser, activeCompanyId } = useAuth();
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [editingCategory, setEditingCategory] = useState<Partial<ActionCategory> | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<ActionCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const q = query(
      collection(db, 'actionCategories'), 
      where('companyId', '==', companyId || '')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionCategory));
      // Manual sorting to avoid index requirements
      data.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingCategory?.name || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      const categoryData = {
        name: editingCategory.name,
        companyId: companyId || '',
        updatedAt: new Date().toISOString()
      };

      if (editingCategory.id) {
        const ref = doc(db, 'actionCategories', editingCategory.id);
        await updateDoc(ref, categoryData);
      } else {
        await addDoc(collection(db, 'actionCategories'), {
          ...categoryData,
          createdAt: new Date().toISOString()
        });
      }
      setEditingCategory(null);
    } catch (error: any) {
      console.error('Error saving action category:', error);
      setSaveError(error.message || 'Error al guardar la categoría.');
    }
  };

  const handleDelete = async () => {
    if (categoryToDelete) {
      try {
        await deleteDoc(doc(db, 'actionCategories', categoryToDelete.id));
        setCategoryToDelete(null);
      } catch (error: any) {
        console.error('Error deleting category:', error);
        setSaveError(error.message || 'Error al eliminar la categoría.');
      }
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-600" />
            Categorías de Acción
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona los tipos de acciones disponibles en el Plan de Acción (Seguridad, Calidad, etc.)</p>
        </div>
        <button
          onClick={() => setEditingCategory({})}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Categoría
        </button>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {saveError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <Table<ActionCategory>
          data={categories}
          columns={[
            { header: 'Nombre de Categoría', accessor: 'name', sortable: true },
            { 
              header: 'Creado el', 
              accessor: (c) => c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-' 
            },
          ]}
          onEdit={setEditingCategory}
          onDelete={setCategoryToDelete}
        />
      </div>

      <ConfirmModal
        isOpen={!!categoryToDelete}
        title="Eliminar Categoría"
        message={`¿Estás seguro de que deseas eliminar la categoría "${categoryToDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setCategoryToDelete(null)}
      />

      <Modal
        isOpen={!!editingCategory}
        onClose={() => { setEditingCategory(null); setSaveError(null); }}
        title={editingCategory?.id ? "Editar Categoría" : "Nueva Categoría"}
      >
        {editingCategory && (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                required
                placeholder="Ej: Seguirdad, Calidad, Mejora..."
                value={editingCategory.name || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-all"
              >
                Guardar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
