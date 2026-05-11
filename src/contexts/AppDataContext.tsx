import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Team, Process, Task, Criterion, UserTaskLevel, TrainingAction, Activity, Forum, ForumSession, MasterGroup, Indicator, Incident, ActionPlan, ActionCategory } from '../types';

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
  loading: boolean;
  getTeamParentChain: (teamId: string) => string[];
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { dbUser, activeCompanyId, isGlobalAdmin } = useAuth();
  
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
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
      unsubForumSessions();
    };
  }, [activeCompanyId, dbUser?.companyId]);

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
      activities, teams, processes, tasks, criteria, userTaskLevels, trainingActions, teamTargets, users, forums: computedForums, forumSessions, masterGroups, indicators, incidents, actionPlans, actionCategories, loading,
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
