import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Team, Process, Task, Criterion, UserTaskLevel, TrainingAction, Activity } from '../types';

export function useAppData() {
  const { dbUser, activeCompanyId, isAdmin, isSupervisor } = useAuth();
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [userTaskLevels, setUserTaskLevels] = useState<UserTaskLevel[]>([]);
  const [trainingActions, setTrainingActions] = useState<TrainingAction[]>([]);
  const [teamTargets, setTeamTargets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const companyId = activeCompanyId || dbUser?.companyId;
    
    if (!companyId) {
      setLoading(false);
      return;
    }

    const getQuery = (colName: string) => query(collection(db, colName), where('companyId', '==', companyId));

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
      setLoading(false); // Set loading false after the last one, or use a better coordination
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
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
    };
  }, [activeCompanyId, dbUser?.companyId]);

  return {
    activities,
    teams,
    processes,
    tasks,
    criteria,
    userTaskLevels,
    trainingActions,
    teamTargets,
    users,
    loading
  };
}
