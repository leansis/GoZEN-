import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Tag, Trash2, Edit2, GripVertical, CheckCircle2, Circle } from 'lucide-react';
import clsx from 'clsx';
import { ActionCategory } from '../../types';

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
        options: editingCategory.options || [],
        active: editingCategory.active !== false,
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

  const handleToggleActive = async (category: ActionCategory) => {
    try {
      await updateDoc(doc(db, 'actionCategories', category.id), {
        active: !category.active,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error toggling active status:", error);
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
              header: 'Estado', 
              accessor: (c) => (
                <button
                  onClick={() => handleToggleActive(c)}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                    c.active 
                      ? "bg-green-100 text-green-700 hover:bg-green-200" 
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  {c.active ? (
                    <><CheckCircle2 className="w-3 h-3" /> Activo</>
                  ) : (
                    <><Circle className="w-3 h-3" /> Inactivo</>
                  )}
                </button>
              )
            },
            { 
              header: 'Opciones', 
              accessor: (c) => (
                <div className="flex flex-wrap gap-1">
                  {(c.options?.length ?? 0) > 0 ? (
                    c.options!.slice(0, 3).map((opt, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500">
                        {opt}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 italic text-[10px]">Sin opciones</span>
                  )}
                  {(c.options?.length ?? 0) > 3 && (
                    <span className="text-[10px] text-gray-400">+{(c.options?.length ?? 0) - 3}</span>
                  )}
                </div>
              )
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
        title={editingCategory?.id ? "Editar Campo de Acción" : "Nuevo Campo de Acción"}
        maxWidth="max-w-2xl"
      >
        {editingCategory && (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del Campo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tipología, Criticidad, Impacto..."
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={editingCategory.active !== false}
                  onChange={(e) => setEditingCategory({ ...editingCategory, active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="categoryActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Campo Activo
                </label>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800">Opciones del Campo</h3>
                    <p className="text-xs text-gray-500">Define los valores que el usuario podrá seleccionar.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = editingCategory.options || [];
                      setEditingCategory({ ...editingCategory, options: [...current, ''] });
                    }}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {(editingCategory.options || []).map((opt, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={opt}
                        placeholder={`Valor ${index + 1}`}
                        onChange={(e) => {
                          const newOpts = [...(editingCategory.options || [])];
                          newOpts[index] = e.target.value;
                          setEditingCategory({ ...editingCategory, options: newOpts });
                        }}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-1 focus:ring-blue-400 outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = (editingCategory.options || []).filter((_, i) => i !== index);
                          setEditingCategory({ ...editingCategory, options: newOpts });
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {(!editingCategory.options || editingCategory.options.length === 0) && (
                    <div className="text-center py-6 text-gray-400 text-sm italic">
                      Añade al menos una opción para este campo.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={() => { setEditingCategory(null); setSaveError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95"
              >
                {editingCategory.id ? 'Actualizar Campo' : 'Crear Campo'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
