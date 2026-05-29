import React, { useState, useRef } from 'react';
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
  Users,
  Code,
  Eye,
  Download,
  Upload
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
  htmlSourceType: 'url' | 'custom_html';
  customHtmlId: string;
  typology: 'calidad' | 'coste' | 'plazo' | 'personas' | '';
}

const INITIAL_FORM: IndicatorForm = {
  name: '',
  description: '',
  formula: '',
  scopeIds: [],
  link: '',
  htmlSourceType: 'url',
  customHtmlId: '',
  typology: '',
};

export default function Indicators() {
  const { forums, indicators, customHtmls, loading: dataLoading } = useAppData();
  const { activeCompanyId, dbUser } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<'indicators' | 'html_repo'>('indicators');

  // Indicators state
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IndicatorForm>(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Custom HTMLs state
  const [htmlSearchTerm, setHtmlSearchTerm] = useState('');
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [editingHtmlId, setEditingHtmlId] = useState<string | null>(null);
  const [htmlForm, setHtmlForm] = useState({ name: '', html: '' });
  const [isSavingHtml, setIsSavingHtml] = useState(false);
  const [htmlEditorTab, setHtmlEditorTab] = useState<'write' | 'preview'>('write');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const filteredIndicators = indicators.filter(indicator =>
    indicator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    indicator.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredHtmls = (customHtmls || []).filter(h =>
    h.name.toLowerCase().includes(htmlSearchTerm.toLowerCase())
  );

  // INDICATOR HANDLERS
  const handleOpenModal = (indicator?: any) => {
    if (indicator) {
      setEditingId(indicator.id);
      setForm({
        name: indicator.name,
        description: indicator.description || '',
        formula: indicator.formula || '',
        scopeIds: indicator.scopeIds || [],
        link: indicator.link || '',
        htmlSourceType: indicator.htmlSourceType || 'url',
        customHtmlId: indicator.customHtmlId || '',
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

    if (form.htmlSourceType === 'custom_html' && !form.customHtmlId) {
      toast.error('Por favor, selecciona un archivo HTML del repositorio');
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
      link: form.htmlSourceType === 'url' ? form.link : '',
      htmlSourceType: form.htmlSourceType,
      customHtmlId: form.htmlSourceType === 'custom_html' ? form.customHtmlId : '',
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

  // CUSTOM HARD HTML RECORD HANDLERS
  const handleOpenHtmlModal = (htmlObj?: any) => {
    if (htmlObj) {
      setEditingHtmlId(htmlObj.id);
      setHtmlForm({
        name: htmlObj.name,
        html: htmlObj.html
      });
    } else {
      setEditingHtmlId(null);
      setHtmlForm({
        name: '',
        html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 24px;
      color: #1e293b;
      background: #f8fafc;
      text-align: center;
    }
    .card {
      background: white;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      display: inline-block;
      max-width: 400px;
    }
    h1 { color: #2563eb; margin-top: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Indicador de Planta</h1>
    <p>¡Edita este código HTML o sube tu plantilla personalizada!</p>
  </div>
</body>
</html>`
      });
    }
    setHtmlEditorTab('write');
    setIsHtmlModalOpen(true);
  };

  const handleSaveHtml = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      toast.error('Debes seleccionar una empresa primero');
      return;
    }
    if (!htmlForm.name.trim()) {
      toast.error('El nombre del archivo es obligatorio');
      return;
    }
    if (!htmlForm.html.trim()) {
      toast.error('El contenido HTML es obligatorio');
      return;
    }

    setIsSavingHtml(true);
    // Sanitize file name to always end in .html if omitted
    let finalName = htmlForm.name.trim();
    if (!finalName.endsWith('.html') && !finalName.endsWith('.htm')) {
      finalName += '.html';
    }

    const htmlData: any = {
      name: finalName,
      html: htmlForm.html,
      companyId: activeCompanyId,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingHtmlId) {
        await updateDoc(doc(db, 'customHtmls', editingHtmlId), htmlData);
        toast.success('Archivo HTML del repositorio actualizado');
      } else {
        htmlData.createdAt = new Date().toISOString();
        htmlData.createdBy = dbUser?.uid || '';
        await addDoc(collection(db, 'customHtmls'), htmlData);
        toast.success('Archivo HTML guardado en el repositorio');
      }
      setIsHtmlModalOpen(false);
    } catch (error) {
      console.error('Error saving Custom HTML:', error);
      handleFirestoreError(error, editingHtmlId ? OperationType.UPDATE : OperationType.CREATE, 'customHtmls');
      toast.error('Error al guardar el archivo HTML');
    } finally {
      setIsSavingHtml(false);
    }
  };

  const handleDeleteHtml = async (id: string) => {
    // Check if any indicators reference this HTML file
    const referencedIndicators = indicators.filter(i => i.htmlSourceType === 'custom_html' && i.customHtmlId === id);
    let confirmMsg = '¿Estás seguro de eliminar este archivo HTML de la base de datos?';
    if (referencedIndicators.length > 0) {
      confirmMsg = `¡ATENCIÓN! Este archivo HTML está enlazado a ${referencedIndicators.length} indicador(es) (${referencedIndicators.map(i => i.name).join(', ')}). Si lo eliminas, estos no se visualizarán correctamente. ¿Continuar con la eliminación?`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, 'customHtmls', id));
      toast.success('Archivo HTML eliminado correctamente');
    } catch (error) {
      console.error('Error deleting html:', error);
      handleFirestoreError(error, OperationType.DELETE, 'customHtmls');
      toast.error('Error al eliminar el archivo del repositorio');
    }
  };

  const handleDownloadHtml = (htmlObj: any) => {
    try {
      const blob = new Blob([htmlObj.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = htmlObj.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Archivo descargado con éxito');
    } catch (e) {
      toast.error('Error al descargar el archivo');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setHtmlForm({
        name: file.name,
        html: content
      });
      toast.success(`Leído correctamente: ${file.name}`);
    };
    reader.onerror = () => {
      toast.error('No se pudo leer el archivo local');
    };
    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
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
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Panel de Indicadores
          </h1>
          <p className="text-gray-500 mt-1">Gestión de indicadores de desempeño y repositorio de visualizaciones custom HTML.</p>
        </div>
        
        {activeTab === 'indicators' ? (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold"
          >
            <Plus size={20} />
            Nuevo Indicador
          </button>
        ) : (
          <button
            onClick={() => handleOpenHtmlModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold"
          >
            <Plus size={20} />
            Subir / Crear HTML
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-3 pt-3 rounded-2xl border">
        <button
          onClick={() => setActiveTab('indicators')}
          className={clsx(
            "px-6 py-3 font-bold text-xs uppercase tracking-wider pb-4 transition-all flex items-center gap-2 border-b-2",
            activeTab === 'indicators'
              ? "border-blue-600 text-blue-600 font-black"
              : "border-transparent text-gray-500 hover:text-gray-800"
          )}
        >
          <BarChart3 size={16} />
          Definiciones ({indicators.length})
        </button>
        <button
          onClick={() => setActiveTab('html_repo')}
          className={clsx(
            "px-6 py-3 font-bold text-xs uppercase tracking-wider pb-4 transition-all flex items-center gap-2 border-b-2",
            activeTab === 'html_repo'
              ? "border-blue-600 text-blue-600 font-black"
              : "border-transparent text-gray-500 hover:text-gray-800"
          )}
        >
          <Code size={16} />
          Repositorio HTML ({customHtmls?.length || 0})
        </button>
      </div>

      {activeTab === 'indicators' ? (
        /* INDICATORS TAB VIEW */
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
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Origen Visualización</th>
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
                              <span className="text-[9px] font-black uppercase tracking-widest text-gray-450 bg-gray-100 px-1.5 py-0.5 rounded">
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
                      <code className="px-2 py-1 bg-gray-100 text-gray-650 rounded text-xs font-mono">
                        {indicator.formula || '-'}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {indicator.htmlSourceType === 'custom_html' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-55 text-emerald-700 rounded-lg text-xs font-black">
                          <Code size={13} />
                          Local HTML: "{customHtmls?.find(h => h.id === indicator.customHtmlId)?.name || 'Eliminado'}"
                        </span>
                      ) : indicator.link ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-55 text-blue-700 rounded-lg text-xs font-medium">
                          <ExternalLink size={13} />
                          Enlace / Iframe Externo
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">No configurado</span>
                      )}
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
      ) : (
        /* HTML REPO TAB VIEW */
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center gap-4 flex-wrap">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar archivos HTML..."
                value={htmlSearchTerm}
                onChange={(e) => setHtmlSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition transition-all"
              />
            </div>
            
            <div className="flex gap-2 text-sm text-gray-400 items-center">
              <Info size={16} />
              <span>Sube tus archivos .html creados externamente para mostrarlos offline en la reunión</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del Archivo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tamaño</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Indicadores Enlazados</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha de Guardado</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredHtmls.map((htmlObj) => {
                  const linkedCount = indicators.filter(i => i.htmlSourceType === 'custom_html' && i.customHtmlId === htmlObj.id).length;
                  const sizeKB = ((htmlObj.html?.length || 0) / 1024).toFixed(1);
                  return (
                    <tr key={htmlObj.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Code size={18} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{htmlObj.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">ID: {htmlObj.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-650 font-mono">
                        {sizeKB} KB
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {linkedCount > 0 ? (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full font-bold text-xs">
                            {linkedCount} indicador(es)
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Sin usar</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {htmlObj.createdAt ? new Date(htmlObj.createdAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 text-right">
                          <button
                            onClick={() => handleDownloadHtml(htmlObj)}
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Descargar código HTML"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenHtmlModal(htmlObj)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar código fuente"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteHtml(htmlObj.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar de la base de datos"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredHtmls.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Code size={48} className="text-gray-200 mb-4" />
                        <p>No se encontraron plantillas HTML de visualización.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INDICATOR CREATOR MODAL */}
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
                rows={2}
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
                <option value="personas font-normal">Personas</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Alcance (Foros donde se revisa) *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
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

            {/* NEW ORIGIN CHOOSER SECTION */}
            <div className="md:col-span-2 space-y-3 p-4 bg-gray-55/70 rounded-2xl border border-gray-100">
              <label className="block text-sm font-extrabold text-blue-900">
                Visualización en Reuniones
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, htmlSourceType: 'url' })}
                  className={clsx(
                    "p-3 rounded-xl border text-center transition-all font-bold text-xs flex flex-col items-center gap-1.5",
                    form.htmlSourceType === 'url'
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                      : "bg-white border-gray-200 hover:border-blue-200 text-gray-700 hover:text-blue-600"
                  )}
                >
                  <ExternalLink size={18} />
                  Iframe / Link Externo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, htmlSourceType: 'custom_html' });
                    if (!form.customHtmlId && customHtmls && customHtmls.length > 0) {
                      setForm(f => ({ ...f, customHtmlId: customHtmls[0].id }));
                    }
                  }}
                  className={clsx(
                    "p-3 rounded-xl border text-center transition-all font-bold text-xs flex flex-col items-center gap-1.5",
                    form.htmlSourceType === 'custom_html'
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : "bg-white border-gray-200 hover:border-emerald-200 text-gray-700 hover:text-emerald-600"
                  )}
                >
                  <Code size={18} />
                  Archivo HTML Local
                </button>
              </div>

              {form.htmlSourceType === 'url' ? (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Enlace / Fragmento de inserción
                  </label>
                  <input
                    type="text"
                    value={form.link}
                    onChange={(e) => setForm({ ...form, link: e.target.value })}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://app.powerbi.com/view?r=... o cualquier URL de reporte"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Puedes pegar un enlace directo a un informe interactivo de PowerBI, Tableau, Google Sheets, etc.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-gray-500">
                    Seleccionar Archivo HTML del Repositorio
                  </label>
                  
                  {(!customHtmls || customHtmls.length === 0) ? (
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-xs border border-amber-100 flex flex-col gap-2">
                      <p>⚠️ No tienes plantillas HTML en tu repositorio aún.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          setActiveTab('html_repo');
                        }}
                        className="px-3 py-1.5 bg-amber-600 text-white font-extrabold rounded-lg hover:bg-amber-700 transition self-start"
                      >
                        Subir un HTML Primero
                      </button>
                    </div>
                  ) : (
                    <select
                      value={form.customHtmlId}
                      onChange={(e) => setForm({ ...form, customHtmlId: e.target.value })}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">-- Elige un archivo HTML --</option>
                      {customHtmls.map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({((h.html?.length || 0)/1024).toFixed(1)} KB)</option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-gray-400 font-medium">
                    Se renderizará de forma offline y aislada dentro del foro usando el iframe incrustado.
                  </p>
                </div>
              )}
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
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition font-bold flex items-center gap-2 cursor-pointer"
            >
              {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingId ? 'Actualizar' : 'Crear'} Indicador
            </button>
          </div>
        </form>
      </Modal>

      {/* REPOSITORY HTML UPLOADER / CREATOR MODAL */}
      <Modal
        isOpen={isHtmlModalOpen}
        onClose={() => setIsHtmlModalOpen(false)}
        title={editingHtmlId ? 'Editar Archivo HTML' : 'Subir / Crear Archivo HTML para Indicadores'}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleSaveHtml} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left controller panel */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-gray-700 uppercase">Cargar archivo local</h4>
                  <p className="text-[10px] text-gray-400">Automatiza importando un archivo `.html` existente</p>
                </div>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".html,.htm"
                  className="hidden"
                />
                
                <button
                  type="button"
                  onClick={triggerFileSelect}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition text-xs font-black shadow-sm cursor-pointer"
                >
                  <Upload size={14} />
                  Seleccionar HTML
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nombre del archivo (Ej. oee_mensual.html) *
                </label>
                <input
                  type="text"
                  required
                  value={htmlForm.name}
                  onChange={(e) => setHtmlForm({ ...htmlForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold"
                  placeholder="Ej. reporte_diario.html"
                />
              </div>

              <div className="flex-1 flex flex-col min-h-[300px]">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-gray-700">
                    Editor de Código HTML *
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {(htmlForm.html.length / 1024).toFixed(1)} KB
                  </span>
                </div>
                
                <textarea
                  required
                  value={htmlForm.html}
                  onChange={(e) => setHtmlForm({ ...htmlForm, html: e.target.value })}
                  className="w-full flex-1 p-3 bg-gray-900 text-gray-100 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none min-h-[300px]"
                  placeholder="Escribe o pega aquí el código fuente HTML..."
                />
              </div>

            </div>

            {/* Right Side Live Preview Container */}
            <div className="lg:col-span-5 flex flex-col border border-gray-200 rounded-2xl overflow-hidden min-h-[350px]">
              <div className="p-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                  <Eye size={14} className="text-emerald-600" />
                  Previsualización en Directo
                </span>
                
                <span className="px-2 py-0.5 bg-white border border-gray-150 rounded text-[9px] font-mono text-gray-400 shadow-sm">
                  Sandbox acts-as-iframe
                </span>
              </div>
              
              <div className="flex-1 bg-white relative">
                {htmlForm.html ? (
                  <iframe
                    srcDoc={htmlForm.html}
                    className="w-full h-full border-none min-h-[380px]"
                    title="live-preview"
                    sandbox="allow-scripts allow-popups allow-forms allow-modals"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8 text-center text-gray-400 min-h-[380px]">
                    <div className="space-y-2">
                      <Code size={36} className="mx-auto opacity-30" />
                      <p className="text-xs">El código HTML que ingreses se previsualizará en tiempo real aquí.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsHtmlModalOpen(false)}
              className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingHtml}
              className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition font-bold flex items-center gap-2 cursor-pointer"
            >
              {isSavingHtml && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingHtmlId ? 'Actualizar código' : 'Guardar en Repositorio'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
