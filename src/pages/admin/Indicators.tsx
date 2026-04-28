
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ExternalLink,
  Info,
  Layers,
  MessagesSquare,
  Network,
  BarChart3,
  Award,
  Coins,
  Clock,
  Users
} from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { useAuth } from '../../AuthContext';
import Modal from '../../components/Modal';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestore-utils';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

interface IndicatorForm {
  name: string;
  description: string;
  formula: string;
  scopeIds: string[];
  link: string;
  typology: 'calidad' | 'coste' | 'plazo' | 'personas' | '';
}

const INITIAL_FORM: IndicatorForm = {
  name: '',
  description: '',
  formula: '',
  scopeIds: [],
  link: '',
  typology: '',
};

export default function Indicators() {
  const { forums, indicators, loading: dataLoading } = useAppData();
  const { activeCompanyId, isGlobalAdmin } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IndicatorForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const filteredIndicators = indicators.filter(indicator =>
    indicator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    indicator.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (indicator?: any) => {
    if (indicator) {
      setEditingId(indicator.id);
      setForm({
        name: indicator.name,
        description: indicator.description || '',
        formula: indicator.formula || '',
        scopeIds: indicator.scopeIds || [],
        link: indicator.link || '',
        typology: indicator.typology || '',
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      toast.error('Debes seleccionar una empresa primero');
      return;
    }

    if (!form.name || form.scopeIds.length === 0) {
      toast.error('Nombre y Alcance son obligatorios');
      return;
    }

    setIsSaving(true);
    const scopeNames = forums
      .filter(f => form.scopeIds.includes(f.id))
      .map(f => f.name);

    const indicatorData: any = {
      name: form.name,
      description: form.description,
      formula: form.formula,
      scopeIds: form.scopeIds,
      scopeNames,
      link: form.link,
      typology: form.typology || null,
      companyId: activeCompanyId,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'indicators', editingId), indicatorData);
        toast.success('Indicador actualizado');
      } else {
        indicatorData.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'indicators'), indicatorData);
        console.log("Indicator created with ID:", docRef.id);
        toast.success('Indicador creado');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving indicator:', error);
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'indicators');
      toast.error('Error al guardar el indicador');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este indicador?')) return;

    try {
      await deleteDoc(doc(db, 'indicators', id));
      toast.success('Indicador eliminado');
    } catch (error) {
      console.error('Error deleting indicator:', error);
      handleFirestoreError(error, OperationType.DELETE, 'indicators');
      toast.error('Error al eliminar el indicador');
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Indicadores
          </h1>
          <p className="text-gray-500 mt-1">Gestión de indicadores de desempeño para foros.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold"
        >
          <Plus size={20} />
          Nuevo Indicador
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar indicadores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Indicador</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fórmula</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Alcance</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredIndicators.map((indicator) => (
                <tr key={indicator.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        {indicator.typology === 'calidad' && <Award size={18} className="text-amber-500" />}
                        {indicator.typology === 'coste' && <Coins size={18} className="text-emerald-500" />}
                        {indicator.typology === 'plazo' && <Clock size={18} className="text-blue-500" />}
                        {indicator.typology === 'personas' && <Users size={18} className="text-purple-500" />}
                        {!indicator.typology && <Network size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-gray-800">{indicator.name}</div>
                          {indicator.typology && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {indicator.typology}
                            </span>
                          )}
                        </div>
                        {indicator.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">{indicator.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                      {indicator.formula || '-'}
                    </code>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {indicator.scopeNames?.map((name: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {name}
                        </span>
                      ))}
                      {(!indicator.scopeNames || indicator.scopeNames.length === 0) && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 text-right">
                      <button
                        onClick={() => handleOpenModal(indicator)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(indicator.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIndicators.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Network size={48} className="text-gray-200 mb-4" />
                      <p>No se encontraron indicadores.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Editar Indicador' : 'Nuevo Indicador'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Nombre del Indicador *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej. OEE de Línea 1"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Explica qué mide este indicador..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Fórmula
              </label>
              <input
                type="text"
                value={form.formula}
                onChange={(e) => setForm({ ...form, formula: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej. (Producción OK / Teórico) * 100"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tipología
              </label>
              <select
                value={form.typology}
                onChange={(e: any) => setForm({ ...form, typology: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Sin tipología</option>
                <option value="calidad">Calidad</option>
                <option value="coste">Coste</option>
                <option value="plazo">Plazo</option>
                <option value="personas">Personas</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Alcance (Foros donde se revisa) *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 max-h-48 overflow-y-auto">
                {forums.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.scopeIds.includes(f.id)}
                      onChange={(e) => {
                        const newScope = e.target.checked
                          ? [...form.scopeIds, f.id]
                          : form.scopeIds.filter(id => id !== f.id);
                        setForm({ ...form, scopeIds: newScope });
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                Código Iframe / Link
                <span className="text-[10px] text-gray-400 font-normal">Soporta códigos HTML embed</span>
              </label>
              <textarea
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder="Pega aquí el enlace o código embed..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition font-bold flex items-center gap-2"
            >
              {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingId ? 'Actualizar' : 'Crear'} Indicador
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

