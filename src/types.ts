export type Role = 'admin' | 'supervisor' | 'user' | 'lean_promotor';
export type Status = 'active' | 'inactive';

export interface CompanySettings {
  forumVirtualHorizonMonths: number;
}

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  settings?: CompanySettings;
}

export interface User {
  uid: string;
  id?: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  photoURL?: string;
  companyId?: string;
}

export interface TeamMember {
  uid: string;
  name: string;
}

export interface MasterGroup {
  id: string;
  name: string;
  companyId: string;
  createdAt: string;
}

export interface TeamGroup {
  id: string;
  masterGroupId?: string;
  name: string;
  leaderId: string;
  leaderName: string;
  members: TeamMember[];
}

export interface Team {
  id: string;
  name: string;
  supervisorId: string;
  supervisorName?: string;
  members: TeamMember[];
  processIds: string[];
  parentTeamId?: string;
  companyId: string;
  groups?: TeamGroup[];
  hasGroups?: boolean;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  order?: number;
  companyId: string;
}

export interface Process {
  id: string;
  name: string;
  description: string;
  activityId?: string;
  order?: number;
  companyId: string;
}

export interface Attachment {
  name: string;
  url: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  activityId?: string;
  processId: string;
  criteriaId: string;
  attachments: Attachment[];
  companyId: string;
  order?: number;
}

export interface CriterionItem {
  id: string;
  description: string;
}

export interface CriterionLevel {
  level: number;
  description?: string;
  items: CriterionItem[];
}

export interface Criterion {
  id: string;
  name: string;
  levels: CriterionLevel[];
  companyId: string;
}

export interface UserTaskLevel {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  currentLevel: number;
  targetLevel: number;
  plannedLevel: number;
  completedItems: string[];
  selfLevel?: number;
  selfCompletedItems?: string[];
  teamId?: string;
  companyId: string;
}

export interface TeamTarget {
  id: string;
  teamId: string;
  processId: string;
  taskId: string;
  targetCounts: Record<number, number>;
  companyId: string;
}

export type TrainingActionStatus = 'planificada' | 'retrasada' | 'completada' | 'verificada';

export interface TrainingAction {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  targetLevel: number;
  trainerId: string;
  trainerName?: string;
  plannedDate: string;
  endDate?: string;
  status: TrainingActionStatus;
  verifierId?: string;
  verifierName?: string;
  verificationDate?: string;
  description?: string;
  companyId: string;
}

export type ActionStatus = 'pendiente' | 'en_progreso' | 'finalizada' | 'bloqueada' | 'cancelada' | 'retrasada';
export type ActionPriority = 'baja' | 'media' | 'alta' | 'critica';
export type ActionType = 'accion' | 'incidencia';

export interface ActionPlan {
  id: string;
  title: string;
  description: string;
  type: ActionType;
  categoryId?: string;
  categoryName?: string;
  createdBy: string;
  createdByName: string;
  assignedTo: string[]; // List of user IDs
  assignedToNames: string[];
  status: ActionStatus;
  priority: ActionPriority;
  targetDate: string; // Projected end date
  dateChangeCount?: number;
  notes?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  
  // Escalation fields
  isEscalated?: boolean;
  escalatedToForumId?: string; // Optional target forum
  escalatedBy?: string;
  escalatedByName?: string;
  escalatedAt?: string;
  originForumId?: string; // Forum where it was created
  originForumName?: string; // Name of the forum where it was created
}

export interface SubActionAudit {
  date: string; // The proposed completion date
  setAt: string; // When it was set
  setBy: string; // Who set it
}

export interface SubAction {
  id: string;
  actionId: string;
  title: string;
  completed: boolean;
  currentProposedDate: string;
  dateHistory: SubActionAudit[];
  companyId: string;
}

export interface ActionCategory {
  id: string;
  name: string;
  companyId: string;
  createdAt: string;
}

export type ForumFrequency = 'diaria' | 'semanal' | 'mensual' | 'adhoc' | 'periodic';
export type ForumSessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface ForumSection {
  id: string;
  title: string;
  duration?: number; // Estimated duration in minutes
  order: number;
}

export interface ForumRecurrence {
  repeatEvery: number;
  repeatUnit: 'day' | 'week' | 'month';
  daysOfWeek: number[]; // 1-7 (Mon-Sun)
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
}

export interface Forum {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  teamName?: string;
  companyId: string;
  frequency: ForumFrequency;
  recurrence?: ForumRecurrence;
  skippedDates?: string[];
  estimatedDuration: number; // Total minutes
  sections: ForumSection[];
  createdBy: string;
  createdAt: string;
}

export interface ForumAttendee {
  uid: string;
  name: string;
  present: boolean;
  groupId?: string;
  groupName?: string;
  isLeader?: boolean;
}

export interface ForumSession {
  id: string;
  forumId: string;
  forumName: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  status: ForumSessionStatus;
  attendees: ForumAttendee[];
  currentSectionIndex: number; // Index of the section item
  results: Record<string, string>; // item.id -> notes/results
  durationSeconds?: number;
  companyId: string;
  createdBy: string;
}

export interface Indicator {
  id: string;
  name: string;
  description?: string;
  formula?: string;
  scopeIds: string[];
  scopeNames: string[];
  link?: string;
  typology?: 'calidad' | 'coste' | 'plazo' | 'personas';
  companyId: string;
  createdAt: string;
  updatedAt: string;
}
