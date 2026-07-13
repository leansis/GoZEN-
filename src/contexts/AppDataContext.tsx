import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Team, Process, Task, Criterion, UserTaskLevel, TrainingAction, Activity, Forum, ForumSession, MasterGroup, Indicator, Incident, ActionPlan, ActionCategory, CustomHtml, Standard } from '../types';

interface AppDataContextType {
  activities: Activity[];
  teams: Team[];
  processes: Process[];
  tasks: Task[];
  criteria: Criterion[];
  userTaskLevels: UserTaskLevel[];
  trainingActions: TrainingAction[];
  teamTargets: any[];
  users: any[];
  forums: Forum[];
  forumSessions: ForumSession[];
  masterGroups: MasterGroup[];
  indicators: Indicator[];
  incidents: Incident[];
  actionPlans: ActionPlan[];
  actionCategories: ActionCategory[];
  customHtmls: CustomHtml[];
  standards: Standard[];
  loading: boolean;
  getTeamParentChain: (teamId: string) => string[];
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { dbUser, activeCompanyId, isGlobalAdmin, company } = useAuth();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [userTaskLevels, setUserTaskLevels] = useState<UserTaskLevel[]>([]);
  const [trainingActions, setTrainingActions] = useState<TrainingAction[]>([]);
  const [teamTargets, setTeamTargets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [forumSessions, setForumSessions] = useState<ForumSession[]>([]);
  const [masterGroups, setMasterGroups] = useState<MasterGroup[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [actionCategories, setActionCategories] = useState<ActionCategory[]>([]);
  const [customHtmls, setCustomHtmls] = useState<CustomHtml[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [loading, setLoading] = useState(true);

  const getForumLevel = (forum: Forum, teamsList: Team[]): number => {
    let currentTeamId = forum.teamId;
    let level = 0;
    const visited = new Set<string>();

    while (currentTeamId && !visited.has(currentTeamId)) {
      visited.add(currentTeamId);
      const team = teamsList.find(t => t.id === currentTeamId);
      if (team && team.parentTeamId) {
        level++;
        currentTeamId = team.parentTeamId;
      } else {
        break;
      }
    }
    return level;
  };

  const computedForums = useMemo(() => {
    return forums.map(f => ({
      ...f,
      level: getForumLevel(f, teams)
    }));
  }, [forums, teams]);

  useEffect(() => {
    const companyId = activeCompanyId || dbUser?.companyId;
    
    if (!companyId && !isGlobalAdmin) {
      setActivities([]);
      setTeams([]);
      setProcesses([]);
      setTasks([]);
      setCriteria([]);
      setUserTaskLevels([]);
      setTrainingActions([]);
      setTeamTargets([]);
      setUsers([]);
      setForums([]);
      setForumSessions([]);
      setMasterGroups([]);
      setIndicators([]);
      setIncidents([]);
      setActionPlans([]);
      setActionCategories([]);
      setCustomHtmls([]);
      setStandards([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const getQuery = (colName: string) => {
      const colRef = collection(db, colName);
      if (isGlobalAdmin && !activeCompanyId) return colRef;
      if (!companyId) return query(colRef, where('companyId', '==', 'invalid')); // Should not happen
      return query(colRef, where('companyId', '==', companyId));
    };

    const unsubActivities = onSnapshot(getQuery('activities'), (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activities'));

    const unsubTeams = onSnapshot(getQuery('teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teams'));

    const unsubProcesses = onSnapshot(getQuery('processes'), (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'processes'));

    const unsubTasks = onSnapshot(getQuery('tasks'), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    const unsubCriteria = onSnapshot(getQuery('criteria'), (snapshot) => {
      setCriteria(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Criterion)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'criteria'));

    const unsubLevels = onSnapshot(getQuery('userTaskLevels'), (snapshot) => {
      setUserTaskLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTaskLevel)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'userTaskLevels'));

    const unsubTraining = onSnapshot(getQuery('trainingActions'), (snapshot) => {
      setTrainingActions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAction)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'trainingActions'));

    const unsubTeamTargets = onSnapshot(getQuery('teamTargets'), (snapshot) => {
      setTeamTargets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teamTargets'));

    const unsubUsers = onSnapshot(getQuery('users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubForums = onSnapshot(getQuery('forums'), (snapshot) => {
      setForums(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Forum)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'forums'));

    const unsubMasterGroups = onSnapshot(getQuery('masterGroups'), (snapshot) => {
      setMasterGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MasterGroup)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'masterGroups'));

    const unsubIndicators = onSnapshot(getQuery('indicators'), (snapshot) => {
      setIndicators(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Indicator)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'indicators'));

    const unsubIncidents = onSnapshot(getQuery('incidents'), (snapshot) => {
      setIncidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incidents'));

    const unsubActionPlans = onSnapshot(getQuery('actionPlans'), (snapshot) => {
      setActionPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionPlan)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'actionPlans'));

    const unsubActionCategories = onSnapshot(getQuery('actionCategories'), (snapshot) => {
      setActionCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionCategory)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'actionCategories'));

    const unsubCustomHtmls = onSnapshot(getQuery('customHtmls'), (snapshot) => {
      setCustomHtmls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomHtml)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customHtmls'));

    const unsubStandards = onSnapshot(getQuery('standards'), (snapshot) => {
      setStandards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Standard)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'standards'));

    const unsubForumSessions = onSnapshot(getQuery('forumSessions'), (snapshot) => {
      setForumSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumSession)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'forumSessions');
      setLoading(false);
    });

    return () => {
      unsubActivities();
      unsubTeams();
      unsubProcesses();
      unsubTasks();
      unsubCriteria();
      unsubLevels();
      unsubTraining();
      unsubTeamTargets();
      unsubUsers();
      unsubForums();
      unsubMasterGroups();
      unsubIndicators();
      unsubIncidents();
      unsubActionPlans();
      unsubActionCategories();
      unsubCustomHtmls();
      unsubStandards();
      unsubForumSessions();
    };
  }, [activeCompanyId, dbUser?.companyId]);

  useEffect(() => {
    // Only run if everything is loaded and we have a logged-in user
    if (loading || !dbUser || !activeCompanyId || standards.length === 0) return;

    const companyId = activeCompanyId || dbUser.companyId;
    if (!companyId) return;

    const noticeDays = company?.settings?.standardReviewNoticeDays ?? 15;
    const now = new Date();
    // Use midnight of local day to compare dates correctly
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Helper to calculate next review date
    const calculateNextReview = (lastDateStr: string, months: number): string => {
      if (!lastDateStr) return '';
      const [year, month, day] = lastDateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setMonth(d.getMonth() + months);
      
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const checkAndCreateReviewActions = async () => {
      for (const std of standards) {
        if (std.reviewActionCreated) continue;

        const nextDateStr = std.nextReviewDate || (std.lastReviewDate ? calculateNextReview(std.lastReviewDate, std.validityMonths ?? 12) : '');
        if (!nextDateStr) continue;

        const [nyear, nmonth, nday] = nextDateStr.split('-').map(Number);
        const nextDate = new Date(nyear, nmonth - 1, nday);
        if (isNaN(nextDate.getTime())) continue;

        // Calculate days difference (ignoring time shift)
        const timeDiff = nextDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        // If the next review is within the notice days (even if overdue)
        if (daysDiff <= noticeDays) {
          try {
            console.log(`Standard ${std.name} is close to review date or overdue (days: ${daysDiff}). Creating review action.`);
            
            // 1. Mark standard as action-created FIRST in Firestore to prevent multiple trigger runs
            const stdRef = doc(db, 'standards', std.id);
            await updateDoc(stdRef, { reviewActionCreated: true });

            // 2. Create the action plan document (sin foro)
            const actionPayload = {
              title: `Revisar estándar: ${std.name}`,
              description: `El estándar "${std.name}" tiene su próxima revisión planificada para el ${nextDate.toLocaleDateString('es-ES')}. Por favor, realiza la revisión correspondiente y actualiza la fecha en el módulo de estándares.`,
              type: 'accion',
              status: 'pendiente',
              priority: 'media',
              targetDate: nextDateStr,
              companyId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'system',
              createdByName: 'Sistema',
              assignedTo: [std.responsibleId],
              assignedToNames: [std.responsibleName || 'Responsable'],
              originForumId: '',
              originForumName: '',
              incidentId: '',
              indicatorId: '',
              indicatorName: '',
              isEscalated: false,
              escalatedToForumId: '',
              escalationHistory: []
            };

            await addDoc(collection(db, 'actionPlans'), actionPayload);
            console.log(`Review action created successfully for Standard: ${std.name}`);
          } catch (err) {
            console.error(`Error creating review action for Standard ${std.id}:`, err);
          }
        }
      }
    };

    checkAndCreateReviewActions();
  }, [standards, company, dbUser, activeCompanyId, loading]);

  const getTeamParentChain = (teamId: string, teamsList: Team[]): string[] => {
    const chain: string[] = [];
    let currentId = teamId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const team = teamsList.find(t => t.id === currentId);
      if (team && team.parentTeamId) {
        chain.push(team.parentTeamId);
        currentId = team.parentTeamId;
      } else {
        break;
      }
    }
    return chain;
  };

  return (
    <AppDataContext.Provider value={{
      activities, teams, processes, tasks, criteria, userTaskLevels, trainingActions, teamTargets, users, forums: computedForums, forumSessions, masterGroups, indicators, incidents, actionPlans, actionCategories, customHtmls, standards, loading,
      getTeamParentChain: (id) => getTeamParentChain(id, teams)
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}
