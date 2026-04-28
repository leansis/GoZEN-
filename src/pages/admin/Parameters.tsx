import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Settings, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../../lib/firestore-utils';

export default function Parameters() {
  const { company, activeCompanyId, isAdmin } = useAuth();
  const [horizonMonths, setHorizonMonths] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (company?.settings?.forumVirtualHorizonMonths) {
      setHorizonMonths(company.settings.forumVirtualHorizonMonths);
    }
  }, [company]);

  const handleSave = async () => {
    if (!activeCompanyId) return;
    
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'companies', activeCompanyId), {
        'settings.forumVirtualHorizonMonths': horizonMonths
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving parameters:', err);
      setError('Error al guardar los parámetros');
      handleFirestoreError(err, OperationType.WRITE, `companies/${activeCompanyId}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <AlertCircle size={48} className="mb-4 text-red-500" />
        <h2 className="text-xl font-semibold">Acceso Denegado</h2>
        <p>No tienes permisos para acceder a esta página.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="text-blue-600" />
            Parámetros de la Empresa
          </h1>
          <p className="text-gray-500">Configuración global de la lógica del sistema</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Foros y Reuniones</h2>
          <p className="text-sm text-gray-500">Configura cómo se generan las sesiones virtuales de los foros</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horizonte de pre-generación (meses)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Define cuántos meses de antelación se mostrarán para las sesiones recurrentes de los foros que no han sido creadas manualmente.
              </p>
            </div>
            <div className="w-full md:w-32">
              <input
                type="number"
                min="1"
                max="24"
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(parseInt(e.target.value) || 1)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-semibold"
              />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-sm text-blue-700 border border-blue-100">
            <AlertCircle size={20} className="shrink-0" />
            <p>
              <strong>Nota:</strong> Este parámetro afecta a la visualización de sesiones en el calendario de foros. 
              Por defecto es 3 meses para optimizar el rendimiento. Aumentar este valor puede ralentizar la carga si hay muchos foros.
            </p>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          {error && (
            <span className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={16} />
              {error}
            </span>
          )}
          {success && (
            <span className="text-sm text-green-600 flex items-center gap-1 animate-in fade-in slide-in-from-right-4">
              <CheckCircle2 size={16} />
              Parámetros guardados correctamente
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}
