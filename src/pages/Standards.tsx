import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { Standard, Activity, Process, Task } from '../types';
import { 
  Map as MapIcon, 
  List, 
  Network, 
  Search, 
  FileText, 
  ExternalLink, 
  ChevronDown, 
  ChevronRight, 
  Paperclip, 
  X, 
  Filter, 
  ArrowRight,
  Info
} from 'lucide-react';
import clsx from 'clsx';
import Table from '../components/Table';
import ReactMarkdown from 'react-markdown';
import D3GraphView from '../components/D3GraphView';

export default function Standards() {
  const { dbUser } = useAuth();
  const appData = useAppData();
  
  const activities = useMemo(() => [...appData.activities].sort((a, b) => (a.order || 0) - (b.order || 0)), [appData.activities]);
  const processes = useMemo(() => [...appData.processes].sort((a, b) => (a.order || 0) - (b.order || 0)), [appData.processes]);
  const tasks = useMemo(() => [...appData.tasks].sort((a, b) => (a.order || 0) - (b.order || 0)), [appData.tasks]);
  const standards = appData.standards || [];
  const loading = appData.loading;

  // View tabs
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'graph'>('graph');

  // Filters
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [selectedProcessId, setSelectedProcessId] = useState<string>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('all');

  // Interactive Map View States
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedNodeForStandards, setSelectedNodeForStandards] = useState<{
    type: 'activity' | 'process';
    id: string;
    name: string;
  } | null>(null);

  // Graph View States
  const [selectedGraphNode, setSelectedGraphNode] = useState<Standard | null>(null);

  // Reset sub-filters when parent changes
  useEffect(() => {
    setSelectedProcessId('all');
    setSelectedTaskId('all');
  }, [selectedAreaId]);

  useEffect(() => {
    setSelectedTaskId('all');
  }, [selectedProcessId]);

  // Helper for relations display name
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

  // Helper for direct URL button in list
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
        <ExternalLink size={14} />
        <span>Abrir Enlace</span>
      </a>
    );
  };

  // Filtered Standards for List and Graph
  const filteredStandards = useMemo(() => {
    return standards.filter(std => {
      // Search filter
      if (globalSearch) {
        const search = globalSearch.toLowerCase();
        const matchesName = std.name.toLowerCase().includes(search);
        const matchesResponsible = (std.responsibleName || '').toLowerCase().includes(search);
        const matchesRelation = getRelationText(std).toLowerCase().includes(search);
        if (!matchesName && !matchesResponsible && !matchesRelation) {
          return false;
        }
      }

      // Hierarchy Area (Activity) Filter
      if (selectedAreaId !== 'all') {
        if (std.relationType === 'activity') {
          const ids = std.activityIds || (std.activityId ? [std.activityId] : []);
          if (!ids.includes(selectedAreaId)) return false;
        } else if (std.relationType === 'process') {
          const ids = std.processIds || (std.processId ? [std.processId] : []);
          const matches = ids.some(pid => {
            const proc = processes.find(p => p.id === pid);
            return proc && proc.activityId === selectedAreaId;
          });
          if (!matches) return false;
        } else if (std.relationType === 'task') {
          const ids = std.taskIds || (std.taskId ? [std.taskId] : []);
          const matches = ids.some(tid => {
            const t = tasks.find(tsk => tsk.id === tid);
            if (!t) return false;
            const proc = processes.find(p => p.id === t.processId);
            return proc && proc.activityId === selectedAreaId;
          });
          if (!matches) return false;
        }
      }

      // Hierarchy Process Filter
      if (selectedProcessId !== 'all') {
        if (std.relationType === 'activity') {
          return false;
        } else if (std.relationType === 'process') {
          const ids = std.processIds || (std.processId ? [std.processId] : []);
          if (!ids.includes(selectedProcessId)) return false;
        } else if (std.relationType === 'task') {
          const ids = std.taskIds || (std.taskId ? [std.taskId] : []);
          const matches = ids.some(tid => {
            const t = tasks.find(tsk => tsk.id === tid);
            return t && t.processId === selectedProcessId;
          });
          if (!matches) return false;
        }
      }

      // Hierarchy Task Filter
      if (selectedTaskId !== 'all') {
        if (std.relationType === 'activity' || std.relationType === 'process') {
          return false;
        } else if (std.relationType === 'task') {
          const ids = std.taskIds || (std.taskId ? [std.taskId] : []);
          if (!ids.includes(selectedTaskId)) return false;
        }
      }

      return true;
    });
  }, [standards, globalSearch, selectedAreaId, selectedProcessId, selectedTaskId, activities, processes, tasks]);

  // Check if any filter is active
  const isFilterApplied = useMemo(() => {
    return globalSearch !== '' || selectedAreaId !== 'all' || selectedProcessId !== 'all' || selectedTaskId !== 'all';
  }, [globalSearch, selectedAreaId, selectedProcessId, selectedTaskId]);

  // Compute standards for graph including related standards when a filter is applied
  const standardsForGraph = useMemo(() => {
    if (!isFilterApplied) {
      return standards.map(std => ({
        ...std,
        isGreyedOut: false
      }));
    }

    const matchingIds = new Set(filteredStandards.map(std => std.id));
    const relatedIds = new Set<string>();

    filteredStandards.forEach(std => {
      if (std.relatedStandardIds) {
        std.relatedStandardIds.forEach(id => {
          if (!matchingIds.has(id)) {
            relatedIds.add(id);
          }
        });
      }
    });

    standards.forEach(std => {
      if (std.relatedStandardIds) {
        const hasMatchingRelation = std.relatedStandardIds.some(id => matchingIds.has(id));
        if (hasMatchingRelation && !matchingIds.has(std.id)) {
          relatedIds.add(std.id);
        }
      }
    });

    const result: (Standard & { isGreyedOut: boolean })[] = [];
    standards.forEach(std => {
      if (matchingIds.has(std.id)) {
        result.push({
          ...std,
          isGreyedOut: false
        });
      } else if (relatedIds.has(std.id)) {
        result.push({
          ...std,
          isGreyedOut: true
        });
      }
    });

    return result;
  }, [standards, filteredStandards, isFilterApplied]);

  // Available options for the filtered dropdowns
  const availableProcesses = useMemo(() => {
    if (selectedAreaId === 'all') return processes;
    return processes.filter(p => p.activityId === selectedAreaId);
  }, [processes, selectedAreaId]);

  const availableTasks = useMemo(() => {
    if (selectedProcessId !== 'all') {
      return tasks.filter(t => t.processId === selectedProcessId);
    }
    if (selectedAreaId !== 'all') {
      const activeProcessIds = processes.filter(p => p.activityId === selectedAreaId).map(p => p.id);
      return tasks.filter(t => activeProcessIds.includes(t.processId));
    }
    return tasks;
  }, [tasks, processes, selectedAreaId, selectedProcessId]);

  // Process map helpers
  const toggleProcess = (processId: string) => {
    setExpandedProcesses(prev => {
      const next = new Set(prev);
      if (next.has(processId)) {
        next.delete(processId);
      } else {
        next.add(processId);
      }
      return next;
    });
  };

  const getTaskStandards = (task: Task) => {
    return standards.filter(std => {
      return std.relationType === 'task' && (std.taskId === task.id || (std.taskIds && std.taskIds.includes(task.id)));
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500 space-y-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
        <p className="font-semibold text-sm">Cargando estándares...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and main navigation tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estándares</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualiza y consulta la documentación y estándares asociados de la compañía.
          </p>
        </div>

        {/* View Toggle tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab('graph')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === 'graph' ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Network className="w-4 h-4" />
            <span>Grafo</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === 'map' ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <MapIcon className="w-4 h-4" />
            <span>Mapa de Proceso</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
              activeTab === 'list' ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <List className="w-4 h-4" />
            <span>Listado</span>
          </button>
        </div>
      </div>

      {/* Shared Filter Bar (highly applicable for List & Graph) */}
      {activeTab !== 'map' && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Filter className="w-4 h-4 text-gray-500" />
            <span>Filtros de búsqueda</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            {/* Area Dropdown */}
            <div>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="all">Todas las Áreas</option>
                {activities.map(act => (
                  <option key={act.id} value={act.id}>{act.name}</option>
                ))}
              </select>
            </div>

            {/* Process Dropdown */}
            <div>
              <select
                value={selectedProcessId}
                onChange={(e) => setSelectedProcessId(e.target.value)}
                disabled={selectedAreaId === 'all' && processes.length > 50}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="all">
                  {selectedAreaId === 'all' ? 'Todos los Procesos' : 'Filtrar Proceso'}
                </option>
                {availableProcesses.map(proc => (
                  <option key={proc.id} value={proc.id}>{proc.name}</option>
                ))}
              </select>
            </div>

            {/* Task Dropdown */}
            <div>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="all">Todas las Tareas</option>
                {availableTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Render selected view */}

      {/* TAB 1: PROCESS MAP VIEW */}
      {activeTab === 'map' && (
        <div className="flex overflow-x-auto pb-8 pt-2 gap-4 snap-x">
          {activities.map((activity, index) => {
            const activityProcesses = processes.filter(p => p.activityId === activity.id);
            const activityStandards = standards.filter(std => std.relationType === 'activity' && (std.activityId === activity.id || (std.activityIds && std.activityIds.includes(activity.id))));
            const hasActivityStandards = activityStandards.length > 0;
            
            return (
              <div key={activity.id} className="flex-shrink-0 w-80 snap-start flex flex-col">
                {/* Process Map Header Chevron */}
                <div className="relative mb-6 drop-shadow-md h-24 group">
                  <div 
                    className="bg-blue-800 text-white p-4 font-bold text-center flex items-center justify-center h-full"
                    style={{
                      clipPath: activities.length === 1 ? 'none' : 
                                 index === 0 ? 'polygon(0% 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 0% 100%)' :
                                 index === activities.length - 1 ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 16px 50%)' :
                                 'polygon(0% 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 0% 100%, 16px 50%)'
                    }}
                  >
                    <span className={clsx("relative z-20", index > 0 && "pl-2", index < activities.length - 1 && "pr-2")}>
                      {activity.name}
                    </span>
                  </div>
                  {hasActivityStandards && (
                    <button
                      onClick={() => setSelectedNodeForStandards({ type: 'activity', id: activity.id, name: activity.name })}
                      className="absolute top-2 right-4 z-30 p-1 px-2 bg-white/25 hover:bg-white/40 text-white rounded-full transition-all shadow-sm flex items-center gap-1 text-[11px] font-bold backdrop-blur-sm cursor-pointer"
                      title="Ver estándares asociados a esta actividad"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{activityStandards.length}</span>
                    </button>
                  )}
                </div>

                {/* Processes List under this Activity */}
                <div className="flex flex-col gap-3 flex-1">
                  {activityProcesses.map(process => {
                    const isExpanded = expandedProcesses.has(process.id);
                    const processTasks = tasks.filter(t => t.processId === process.id);
                    const processStandards = standards.filter(std => std.relationType === 'process' && (std.processId === process.id || (std.processIds && std.processIds.includes(process.id))));
                    const hasProcessStandards = processStandards.length > 0;
                    
                    return (
                      <div 
                        key={process.id} 
                        className="rounded-lg border bg-white border-gray-200 shadow-sm transition-all duration-200 hover:border-gray-300"
                      >
                        <div 
                          className="p-4 cursor-pointer hover:bg-black/5 flex flex-col gap-2"
                          onClick={() => toggleProcess(process.id)}
                        >
                          <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-gray-800 leading-tight">{process.name}</h3>
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                                {processTasks.length} tareas
                              </span>
                              {hasProcessStandards && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNodeForStandards({ type: 'process', id: process.id, name: process.name });
                                  }}
                                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                  title="Ver estándares asociados a este proceso"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>{processStandards.length}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tasks Dropdown (Polivalencia stats removed) */}
                        {isExpanded && processTasks.length > 0 && (
                          <div className="border-t border-gray-100 bg-gray-50/50 p-3 flex flex-col gap-2 rounded-b-lg">
                            {processTasks.map(task => {
                              const taskStandards = getTaskStandards(task);
                              const hasAttachments = taskStandards.length > 0;
                              
                              return (
                                <div 
                                  key={task.id} 
                                  className="text-sm bg-white p-2.5 rounded-lg border border-gray-150 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
                                  onClick={() => {
                                    setSelectedTask(task);
                                  }}
                                >
                                  <div className="flex items-start gap-2 min-w-0 flex-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                      <span className="text-gray-700 font-medium leading-tight">{task.name}</span>
                                      {hasAttachments && (
                                        <span title="Contiene documentos">
                                          <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 inline" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {activityProcesses.length === 0 && (
                    <div className="text-center p-4 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-lg">
                      Sin procesos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: STANDARDS READ-ONLY LIST VIEW */}
      {activeTab === 'list' && (
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
                  header: 'Contenido',
                  accessor: (item) => getContentViewLink(item)
                }
              ]}
              searchable={false}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              No se encontraron estándares correspondientes a los filtros indicados.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RELATIONSHIPS GRAPH VIEW */}
      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main SVG Graph Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col p-4">
            <D3GraphView 
              standards={standardsForGraph}
              selectedNode={selectedGraphNode}
              onSelectNode={setSelectedGraphNode}
            />
          </div>

          {/* Side Drawer with Details for Selected Node */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
            {selectedGraphNode ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-gray-150 pb-3">
                  <div>
                    <span className={clsx(
                      "text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase",
                      selectedGraphNode.relationType === 'activity' ? "bg-amber-100 text-amber-800" :
                      selectedGraphNode.relationType === 'process' ? "bg-violet-100 text-violet-800" :
                      "bg-blue-100 text-blue-800"
                    )}>
                      {selectedGraphNode.relationType === 'activity' ? 'Estándar de Área' :
                       selectedGraphNode.relationType === 'process' ? 'Estándar de Proceso' :
                       'Estándar de Tarea'}
                    </span>
                    <h3 className="font-bold text-gray-800 text-base mt-1.5 leading-snug">
                      {selectedGraphNode.name}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedGraphNode(null)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Responsable</span>
                    <span className="font-medium text-gray-700">{selectedGraphNode.responsibleName || 'Desconocido'}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Relación Jerárquica</span>
                    <span className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-1 rounded block mt-0.5">
                      {getRelationText(selectedGraphNode)}
                    </span>
                  </div>

                  {/* Validity Info */}
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div>
                      <span className="block text-[9px] font-bold text-gray-400 uppercase">Revisado</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {selectedGraphNode.lastReviewDate ? new Date(selectedGraphNode.lastReviewDate + 'T00:00:00').toLocaleDateString('es-ES') : 'Pendiente'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-gray-400 uppercase">Validez</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {selectedGraphNode.validityMonths !== undefined ? `${selectedGraphNode.validityMonths} meses` : '12 meses'}
                      </span>
                    </div>
                  </div>

                  {/* Connected Relations (Graph lines) */}
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Relacionado con ({selectedGraphNode.relatedStandardIds?.length || 0})
                    </span>
                    {selectedGraphNode.relatedStandardIds && selectedGraphNode.relatedStandardIds.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {selectedGraphNode.relatedStandardIds.map(id => {
                          const relNode = standards.find(s => s.id === id);
                          if (!relNode) return null;
                          return (
                            <button
                              key={id}
                              onClick={() => setSelectedGraphNode(relNode)}
                              className="w-full text-left flex items-center justify-between p-2 rounded bg-blue-50/50 hover:bg-blue-50 border border-blue-100/40 text-xs text-blue-800 transition-colors cursor-pointer font-medium"
                            >
                              <span className="truncate pr-2">{relNode.name}</span>
                              <ArrowRight size={12} className="shrink-0 text-blue-500" />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic block py-1 bg-gray-50 rounded text-center border border-dashed border-gray-200">
                        No hay estándares referenciados.
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  {getContentViewLink(selectedGraphNode)}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 min-h-[300px]">
                <Network size={36} className="text-gray-300 stroke-[1.2] mb-2" />
                <p className="text-xs font-semibold text-gray-500">Selecciona un nodo del grafo</p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">Haz clic en cualquiera de los círculos para ver sus relaciones y detalles de validez.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TASK STANDARDS & DOCUMENTATION PREVIEW */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  Tarea
                </span>
                <h2 className="text-lg font-bold text-gray-800 mt-1 line-clamp-1" title={selectedTask.name}>
                  {selectedTask.name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="text-gray-500 hover:text-gray-700 bg-white p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
              {/* Task Description */}
              {selectedTask.description && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Descripción de la tarea</h4>
                  <div className="markdown-body text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[160px] overflow-y-auto custom-scrollbar">
                    <ReactMarkdown>{selectedTask.description}</ReactMarkdown>
                  </div>
                </div>
              )}
              
              {/* Associated Standards */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Estándares y Documentación</h4>
                {getTaskStandards(selectedTask).length > 0 ? (
                  <ul className="space-y-2">
                    {getTaskStandards(selectedTask).map((std, idx) => {
                      const url = std.contentType === 'file' ? std.fileUrl : std.externalLink;
                      const name = std.name;
                      return (
                        <li key={std.id || idx} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-150 hover:border-blue-300 hover:shadow-sm transition-all">
                          <div className="flex flex-col min-w-0 flex-1 pr-3">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Paperclip size={15} className="text-blue-500 shrink-0" />
                              <span className="text-xs font-semibold text-gray-850 truncate" title={name}>
                                {name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                              <span>Responsable: {std.responsibleName || 'Desconocido'}</span>
                            </div>
                          </div>
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-750 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                          >
                            Ver <ExternalLink size={10} />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-8 bg-gray-50/50 rounded-xl text-center border border-dashed border-gray-200">
                    <Paperclip size={28} className="text-gray-300 mx-auto mb-2 opacity-30" />
                    <p className="text-xs text-gray-500 font-medium">No hay estándares asociados a esta tarea.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NODE STANDARDS (ACTIVITY / PROCESS) PREVIEW */}
      {selectedNodeForStandards && (() => {
        const selectedNodeStandards = standards.filter(std => std.relationType === selectedNodeForStandards.type && (
          selectedNodeForStandards.type === 'activity' 
            ? (std.activityId === selectedNodeForStandards.id || (std.activityIds && std.activityIds.includes(selectedNodeForStandards.id))) 
            : (std.processId === selectedNodeForStandards.id || (std.processIds && std.processIds.includes(selectedNodeForStandards.id)))
        ));
        
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    {selectedNodeForStandards.type === 'activity' ? 'Actividad' : 'Proceso'}
                  </span>
                  <h2 className="text-lg font-bold text-gray-850 mt-1 line-clamp-1" title={selectedNodeForStandards.name}>
                    {selectedNodeForStandards.name}
                  </h2>
                </div>
                <button 
                  onClick={() => setSelectedNodeForStandards(null)}
                  className="text-gray-500 hover:text-gray-700 bg-white p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Estándares y Documentación</h4>
                  {selectedNodeStandards.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedNodeStandards.map((std, idx) => {
                        const url = std.contentType === 'file' ? std.fileUrl : std.externalLink;
                        const name = std.name;
                        return (
                          <li key={std.id || idx} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-150 hover:border-blue-300 hover:shadow-sm transition-all">
                            <div className="flex flex-col min-w-0 flex-1 pr-3">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <Paperclip size={15} className="text-blue-500 shrink-0" />
                                <span className="text-xs font-semibold text-gray-850 truncate" title={name}>
                                  {name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                                <span>Responsable: {std.responsibleName || 'Desconocido'}</span>
                              </div>
                            </div>
                            <a 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-750 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                            >
                              Ver <ExternalLink size={10} />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-8 bg-gray-50/50 rounded-xl text-center border border-dashed border-gray-200">
                      <Paperclip size={28} className="text-gray-300 mx-auto mb-2 opacity-30" />
                      <p className="text-xs text-gray-500 font-medium">
                        No hay estándares asociados a {selectedNodeForStandards.type === 'activity' ? 'esta actividad' : 'este proceso'}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
