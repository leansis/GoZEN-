import { useState, useEffect } from 'react';
import { useAuth } from '../../../AuthContext';
import { FiveSService } from '../services/fiveSService';
import { 
  FiveSProject, 
  FiveSTeamMember, 
  FiveSZone, 
  FiveSSubzone, 
  FiveSDedication,
  FiveSPlanningItem, 
  FiveSRedTag, 
  FiveSOrderItem, 
  FiveSCleaningTask, 
  FiveSVisualAction, 
  FiveSVisualStandard, 
  FiveSAudit, 
  FiveSHistoryItem 
} from '../types/fiveSTypes';

export function useFiveSProject(projectId: string | undefined) {
  const { activeCompanyId } = useAuth();
  const [project, setProject] = useState<FiveSProject | null>(null);
  const [members, setMembers] = useState<FiveSTeamMember[]>([]);
  const [zones, setZones] = useState<FiveSZone[]>([]);
  const [subzones, setSubzones] = useState<FiveSSubzone[]>([]);
  const [dedications, setDedications] = useState<FiveSDedication[]>([]);
  const [planningItems, setPlanningItems] = useState<FiveSPlanningItem[]>([]);
  const [redTags, setRedTags] = useState<FiveSRedTag[]>([]);
  const [orderItems, setOrderItems] = useState<FiveSOrderItem[]>([]);
  const [cleaningTasks, setCleaningTasks] = useState<FiveSCleaningTask[]>([]);
  const [actions, setActions] = useState<FiveSVisualAction[]>([]);
  const [standards, setStandards] = useState<FiveSVisualStandard[]>([]);
  const [audits, setAudits] = useState<FiveSAudit[]>([]);
  const [history, setHistory] = useState<FiveSHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Initial fetch of project doc
    FiveSService.getProject(projectId).then(p => {
      setProject(p);
      setLoading(false);
    });

    // Real-time subscriptions
    const unsubTeam = FiveSService.subscribeTeamMembers(projectId, activeCompanyId, setMembers);
    const unsubZones = FiveSService.subscribeZones(projectId, activeCompanyId, setZones);
    const unsubSubzones = FiveSService.subscribeSubzones(projectId, activeCompanyId, setSubzones);
    const unsubDedications = FiveSService.subscribeDedications(projectId, activeCompanyId, setDedications);
    const unsubPlanning = FiveSService.subscribePlanning(projectId, activeCompanyId, setPlanningItems);
    const unsubRedTags = FiveSService.subscribeRedTags(projectId, activeCompanyId, setRedTags);
    const unsubOrders = FiveSService.subscribeOrderItems(projectId, activeCompanyId, setOrderItems);
    const unsubCleaning = FiveSService.subscribeCleaningTasks(projectId, activeCompanyId, setCleaningTasks);
    const unsubActions = FiveSService.subscribeActions(projectId, activeCompanyId, setActions);
    const unsubStandards = FiveSService.subscribeStandards(projectId, activeCompanyId, setStandards);
    const unsubAudits = FiveSService.subscribeAudits(projectId, activeCompanyId, setAudits);
    const unsubHistory = FiveSService.subscribeHistory(projectId, activeCompanyId, setHistory);

    return () => {
      unsubTeam();
      unsubZones();
      unsubSubzones();
      unsubDedications();
      unsubPlanning();
      unsubRedTags();
      unsubOrders();
      unsubCleaning();
      unsubActions();
      unsubStandards();
      unsubAudits();
      unsubHistory();
    };
  }, [projectId, activeCompanyId]);

  return {
    project,
    setProject,
    members,
    zones,
    subzones,
    dedications,
    planningItems,
    redTags,
    orderItems,
    cleaningTasks,
    actions,
    standards,
    audits,
    history,
    loading
  };
}
