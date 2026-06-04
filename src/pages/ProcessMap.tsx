import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { Activity, Process, Task, Team, UserTaskLevel } from '../types';
import { ChevronDown, ChevronRight, User, Users, Target, X, Paperclip, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';

export default function ProcessMap() {
  const { dbUser, isAdmin, isSupervisor } = useAuth();
  const appData = useAppData();
  
  const activities = [...appData.activities].sort((a, b) => (a.order || 0) - (b.order || 0));
  const processes = [...appData.processes].sort((a, b) => (a.order || 0) - (b.order || 0));
  const tasks = [...appData.tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
  const userTaskLevels = appData.userTaskLevels;
  
  const [teams, setTeams] = useState<Team[]>([]);
  const loading = appData.loading;
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalTab, setModalTab] = useState<'ranking' | 'attachments'>('ranking');

  useEffect(() => {
    let fetchedTeams = appData.teams;
    if (!isAdmin && isSupervisor && dbUser) {
      fetchedTeams = fetchedTeams.filter(t => t.supervisorId === dbUser.uid);
    }
    setTeams(fetchedTeams);
  }, [appData.teams, isAdmin, isSupervisor, dbUser]);

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

  const getProcessStats = (processId: string) => {
    const processTasks = tasks.filter(t => t.processId === processId);
    
    let teamsToConsider = teams;
    if (selectedTeamId !== 'all') {
      teamsToConsider = teams.filter(t => t.id === selectedTeamId);
    }

    // Get all members from considered teams
    const members = new Set<string>();
    teamsToConsider.forEach(team => {
      team.members.forEach(m => members.add(m.uid));
    });

    let cappedCurrent = 0;
    let totalTarget = 0;
    let hasEvaluatedTasks = false;

    processTasks.forEach(task => {
      members.forEach(memberUid => {
        const level = userTaskLevels.find(l => l.taskId === task.id && l.userId === memberUid);
        if (level) {
          const current = level.currentLevel || 0;
          const target = level.targetLevel || 0;
          
          if (current > 0) {
            hasEvaluatedTasks = true;
          }

          cappedCurrent += Math.min(current, target);
          totalTarget += target;
        }
      });
    });

    const coverage = totalTarget > 0 ? Math.round((cappedCurrent / totalTarget) * 100) : 0;

    return { coverage, hasEvaluatedTasks, taskCount: processTasks.length };
  };

  const getTaskRanking = (taskId: string) => {
    let teamsToConsider = teams;
    if (selectedTeamId !== 'all') {
      teamsToConsider = teams.filter(t => t.id === selectedTeamId);
    }

    const userMap = new Map<string, string>();
    teamsToConsider.forEach(team => {
      team.members.forEach(m => userMap.set(m.uid, m.name));
    });

    const ranking = userTaskLevels
      .filter(l => l.taskId === taskId && userMap.has(l.userId) && l.currentLevel > 0)
      .map(l => ({
        userId: l.userId,
        name: userMap.get(l.userId) || 'Usuario desconocido',
        level: l.currentLevel
      }))
      .sort((a, b) => b.level - a.level);

    return ranking;
  };

  const getTaskUserCount = (taskId: string) => {
    let teamsToConsider = teams;
    if (selectedTeamId !== 'all') {
      teamsToConsider = teams.filter(t => t.id === selectedTeamId);
    }
    const members = new Set<string>();
    teamsToConsider.forEach(team => {
      team.members?.forEach(m => members.add(m.uid));
    });

    return userTaskLevels.filter(
      l => l.taskId === taskId && members.has(l.userId) && (l.currentLevel || 0) >= 1
    ).length;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando mapa de procesos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Mapa de Procesos</h1>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
          <Users className="w-5 h-5 text-gray-500" />
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="border-none bg-transparent focus:ring-0 text-sm font-medium text-gray-700 cursor-pointer outline-none"
          >
            <option value="all">Todos los equipos</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-8 pt-4 gap-4 snap-x">
        {activities.map((activity, index) => {
          const activityProcesses = processes.filter(p => p.activityId === activity.id);
          
          return (
            <div key={activity.id} className="flex-shrink-0 w-80 snap-start flex flex-col">
              {/* Chevron Header */}
              <div className="relative mb-6 drop-shadow-md h-24">
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
              </div>

              {/* Processes List */}
              <div className="flex flex-col gap-3 flex-1">
                {activityProcesses.map(process => {
                  const stats = getProcessStats(process.id);
                  const isExpanded = expandedProcesses.has(process.id);
                  const processTasks = tasks.filter(t => t.processId === process.id);
                  
                  return (
                    <div 
                      key={process.id} 
                      className={clsx(
                        "rounded-lg border shadow-sm transition-all duration-200",
                        stats.hasEvaluatedTasks ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                      )}
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
                          <span className="text-xs font-medium text-gray-500 bg-white/60 px-2 py-1 rounded">
                            {stats.taskCount} tareas
                          </span>
                          
                          <div className="flex items-center gap-1.5" title="Cobertura vs Objetivo">
                            <Target className={clsx("w-4 h-4", stats.coverage >= 100 ? "text-green-600" : stats.coverage >= 50 ? "text-yellow-600" : "text-red-500")} />
                            <span className={clsx(
                              "text-sm font-bold",
                              stats.coverage >= 100 ? "text-green-700" : stats.coverage >= 50 ? "text-yellow-700" : "text-red-600"
                            )}>
                              {stats.coverage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tasks Dropdown */}
                      {isExpanded && processTasks.length > 0 && (
                        <div className="border-t border-gray-200/60 bg-white/50 p-3 flex flex-col gap-2 rounded-b-lg">
                          {processTasks.map(task => {
                            const userCount = getTaskUserCount(task.id);
                            const hasAttachments = task.attachments && task.attachments.length > 0;
                            
                            return (
                              <div 
                                key={task.id} 
                                className="text-sm bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setModalTab('ranking');
                                }}
                              >
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0"></div>
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                    <span className="text-gray-700 font-medium leading-tight">{task.name}</span>
                                    {hasAttachments && (
                                      <span title="Contiene documentos">
                                        <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 inline" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200 flex-shrink-0" title={`${userCount} personas con nivel >= 1`}>
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="font-semibold">{userCount}</span>
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

      {/* Task Ranking Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800 line-clamp-1" title={selectedTask.name}>
                  {selectedTask.name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="text-gray-500 hover:text-gray-700 bg-white p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/50 px-4">
              <button
                onClick={() => setModalTab('ranking')}
                className={clsx(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 text-center transition-all",
                  modalTab === 'ranking'
                    ? "border-blue-600 text-blue-600 font-extrabold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                Habilidades
              </button>
              <button
                onClick={() => setModalTab('attachments')}
                className={clsx(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 text-center transition-all flex items-center justify-center gap-1.5",
                  modalTab === 'attachments'
                    ? "border-blue-600 text-blue-600 font-extrabold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <span>Adjuntos</span>
                {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                  <span className={clsx(
                    "px-2 py-0.5 text-[10px] font-extrabold rounded-full",
                    modalTab === 'attachments' ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-650"
                  )}>
                    {selectedTask.attachments.length}
                  </span>
                )}
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {modalTab === 'ranking' ? (
                (() => {
                  const ranking = getTaskRanking(selectedTask.id);
                  if (ranking.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No hay habilidades validadas</p>
                        <p className="text-gray-400 text-sm mt-1">Nadie en los equipos seleccionados tiene nivel en esta tarea aún.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {ranking.map((user, idx) => (
                        <div key={user.userId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:border-blue-200 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm bg-blue-50 text-blue-700 border border-blue-100">
                              {idx + 1}
                            </div>
                            <span className="font-medium text-gray-800">{user.name}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 text-blue-700 font-semibold text-sm">
                            <span>Nivel {user.level}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-4">
                  {selectedTask.description && (
                    <div className="space-y-1.5">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descripción de la tarea</h4>
                      <div className="markdown-body text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[150px] overflow-y-auto">
                        <ReactMarkdown>{selectedTask.description}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Archivos y Documentación</h4>
                    {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedTask.attachments.map((att: any, idx) => {
                          const url = typeof att === 'string' ? att : att.url;
                          const name = typeof att === 'string' ? att : att.name;
                          return (
                            <li key={idx} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-sm transition-all">
                              <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                                <Paperclip size={16} className="text-blue-500 shrink-0" />
                                <span className="text-xs font-semibold text-gray-800 truncate" title={name}>
                                  {name}
                                </span>
                              </div>
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                              >
                                Ver <ExternalLink size={10} />
                              </a>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <div className="p-6 bg-gray-50/50 rounded-xl text-center border border-dashed border-gray-200">
                        <Paperclip size={24} className="text-gray-300 mx-auto mb-2 opacity-30" />
                        <p className="text-xs text-gray-500 font-medium">No hay documentos adjuntos para esta tarea.</p>
                        <p className="text-[10px] text-gray-400 mt-1">Los adjuntos se pueden gestionar desde la administración de tareas.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
