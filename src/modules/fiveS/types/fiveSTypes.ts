export type FiveSProjectStatus = 
  | 'DRAFT' 
  | 'PLANNED' 
  | 'IMPLEMENTING' 
  | 'STANDARDIZED' 
  | 'MAINTENANCE' 
  | 'CLOSED';

export const FIVE_S_PROJECT_STATUS_LABELS: Record<FiveSProjectStatus, string> = {
  DRAFT: 'Borrador',
  PLANNED: 'Planificado',
  IMPLEMENTING: 'En implantación',
  STANDARDIZED: 'Estandarizado',
  MAINTENANCE: 'En mantenimiento',
  CLOSED: 'Cerrado'
};

export type FiveSPhase = 'Seiri' | 'Seiton' | 'Seiso' | 'Seiketsu' | 'Shitsuke' | '1S' | '2S' | '3S' | '4S' | '5S';

export const FIVE_S_PHASE_LABELS: Record<FiveSPhase, { number: string; name: string; subtitle: string }> = {
  Seiri: { number: '1S', name: 'Seiri', subtitle: 'Clasificar / Despejar' },
  Seiton: { number: '2S', name: 'Seiton', subtitle: 'Ordenar / Disponer' },
  Seiso: { number: '3S', name: 'Seiso', subtitle: 'Limpiar / Inspeccionar' },
  Seiketsu: { number: '4S', name: 'Seiketsu', subtitle: 'Estandarizar' },
  Shitsuke: { number: '5S', name: 'Shitsuke', subtitle: 'Disciplina y Hábito' },
  '1S': { number: '1S', name: 'Seiri', subtitle: 'Clasificar / Despejar' },
  '2S': { number: '2S', name: 'Seiton', subtitle: 'Ordenar / Disponer' },
  '3S': { number: '3S', name: 'Seiso', subtitle: 'Limpiar / Inspeccionar' },
  '4S': { number: '4S', name: 'Seiketsu', subtitle: 'Estandarizar' },
  '5S': { number: '5S', name: 'Shitsuke', subtitle: 'Disciplina y Hábito' },
};

export type FiveSFunctionalRole = 
  | 'RESPONSIBLE' 
  | 'LEADER' 
  | 'MEMBER' 
  | 'AUDITOR' 
  | 'VIEWER';

export const FIVE_S_ROLE_LABELS: Record<FiveSFunctionalRole, string> = {
  RESPONSIBLE: 'Responsable 5S / Consultor',
  LEADER: 'Líder del grupo',
  MEMBER: 'Miembro',
  AUDITOR: 'Auditor',
  VIEWER: 'Visualizador'
};

export type FiveSZoneStatus = 
  | 'PLANNED'
  | 'NOT_STARTED' 
  | 'IN_PROGRESS' 
  | 'IMPLEMENTED' 
  | 'MAINTENANCE';

export const FIVE_S_ZONE_STATUS_LABELS: Record<FiveSZoneStatus, string> = {
  PLANNED: 'Planificada',
  NOT_STARTED: 'No iniciada',
  IN_PROGRESS: 'En implantación',
  IMPLEMENTED: 'Implantada',
  MAINTENANCE: 'En mantenimiento'
};

export const FIVE_S_ZONE_TYPES = [
  'Producción',
  'Almacén',
  'Mantenimiento',
  'Oficina',
  'Laboratorio',
  'Logística / Expediciones',
  'Zona común',
  'Exterior',
  'Otro'
] as const;

export type FiveSZoneType = typeof FIVE_S_ZONE_TYPES[number] | string;

export const FIVE_S_CRITICALITIES = ['Alta', 'Media', 'Baja'] as const;
export type FiveSCriticality = typeof FIVE_S_CRITICALITIES[number];
export type FiveSSubzoneCriticality = 'ALTA' | 'MEDIA' | 'BAJA' | FiveSCriticality | string;

export const FIVE_S_SHIFTS = ['Mañana', 'Tarde', 'Noche', 'Central', 'Rotativo', 'Flexible'] as const;

export interface FiveSZonePhoto {
  id: string;
  url: string;
  storagePath?: string;
  uploadedAt: string;
  uploadedBy: string;
  isPrimary?: boolean;
  name?: string;
}

export interface FiveSZoneLayout {
  url: string;
  storagePath?: string;
  fileName?: string;
  fileType?: string; // image | pdf
  uploadedAt: string;
}

export interface FiveSProject {
  id: string;
  companyId: string;
  code: string; // e.g. 5S-001
  name: string;
  plantOrCenter: string;
  areaDepartment?: string;
  responsible5S?: string;
  responsibleId?: string;
  responsibleName?: string;
  startDate: string;
  targetDate: string;
  description: string;
  objectives: string;
  status: FiveSProjectStatus;
  currentPhase: FiveSPhase;
  groupName?: string;
  leaderId?: string;
  leaderName?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  // Non-intrusive backward-compatibility fields:
  targetDurationWeeksPerZone?: number; // Duración orientativa por zona/subzona (default 3)
  targetScore?: number;
  currentScore?: number;
  imageUrl?: string;
}

export interface FiveSTeamMember {
  id: string;
  projectId: string;
  companyId: string;
  userId?: string;
  name: string;
  department?: string;
  jobTitle?: string;
  email: string;
  phone?: string;
  shift?: string;
  availability?: string;
  role: FiveSFunctionalRole;
  isLeader?: boolean;
  joinedAt: string;
  dateJoined?: string; // Fecha de incorporación al equipo 5S
  dateRemoved?: string; // Fecha de retirada
  removedBy?: string; // Retirado por
  inactiveAt?: string;
  isActive: boolean;
  active?: boolean;
  updatedBy?: string;
  createdBy?: string;
  // Non-intrusive compatibility:
  userName?: string;
  userEmail?: string;
  dedicationHoursPerWeek?: number;
  responsibilities?: string;
}

export interface FiveSZone {
  id: string;
  companyId: string;
  projectId: string;
  code: string; // e.g. Z-01
  name: string;
  responsibleName?: string;
  responsibleId?: string;
  description?: string;
  boundaries?: string; // Ubicación / límites físicos
  surface?: number; // Superficie (m²)
  workersCount?: number; // Número de trabajadores
  shifts?: string; // Turnos de trabajo
  order?: number; // Orden / secuencia
  status: FiveSZoneStatus | string;
  progress?: number; // 0%
  layout?: FiveSZoneLayout;
  initialPhotos?: FiveSZonePhoto[];
  createdAt: string;
  updatedAt: string;
  // Non-intrusive compatibility:
  zoneType?: FiveSZoneType;
  imageUrl?: string;
  layoutUrl?: string;
  photoUrl?: string;
  location?: string;
  score?: number;
}

export interface FiveSSubzone {
  id: string;
  companyId: string;
  projectId: string;
  zoneId: string;
  code: string; // e.g. SZ-01.1
  name: string;
  layoutLocation?: string; // Ubicación dentro de la zona / layout
  responsibleName?: string;
  responsibleId?: string;
  plannedDate?: string; // Fecha prevista de intervención
  progress?: number; // Avance (%) (0-100, default 0)
  description?: string;
  status: FiveSZoneStatus | string;
  referencePhotoUrl?: string; // Fotografía inicial / referencia
  photoUrl?: string;
  imageUrl?: string;
  photo?: {
    url: string;
    storagePath?: string;
    uploadedAt?: string;
  };
  order?: number;
  createdAt: string;
  updatedAt: string;
  // Non-intrusive compatibility:
  workstationType?: string;
  criticality?: FiveSCriticality | FiveSSubzoneCriticality | string;
}

// Backward compatibility types for other existing modules (Planning, RedTags, Actions, Standards, Audits):
export type FiveSRole = FiveSFunctionalRole | 'admin' | 'responsible' | 'leader' | 'member' | 'auditor' | 'viewer';
export type FiveSTrafficStatus = 'green' | 'yellow' | 'red' | 'gray';

export type FiveSDayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export interface FiveSDedication {
  id: string;
  companyId: string;
  projectId: string;
  dayOfWeek: FiveSDayOfWeek;
  startTime: string; // HH:mm (e.g. "10:00")
  endTime: string;   // HH:mm (e.g. "12:00")
  sessionDurationHours: number; // calculated automatically (e.g. 2.0)
  weeklySessionsCount: number;  // default 1
  participantIds: string[];     // active team member userIds
  participantNames?: string[];  // snapshot for display
  hoursPerParticipantWeekly: number; // e.g. 2.0
  totalTeamHoursWeekly: number;      // e.g. 8.0 (2.0 * 4 participants)
  createdAt: string;
  updatedAt: string;
}

export type FiveSPlanningStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'pending' | 'in_progress' | 'completed' | 'delayed';

export interface FiveSPlanningItem {
  id: string;
  projectId: string;
  companyId: string;
  // Core Phase 2 Planning fields:
  zoneId?: string;
  zoneName?: string;
  zoneCode?: string;
  subzoneId?: string;
  subzoneName?: string;
  subzoneCode?: string;
  activity?: string; // Nombre de la actividad
  title: string;    // Nombre descriptivo / resumen de la actividad
  phase: string;    // '1S' | '2S' | '3S' | '4S' | '5S' | 'Seiri' | 'Seiton' | 'Seiso' | 'Seiketsu' | 'Shitsuke'
  sPhase?: FiveSPhase;
  responsibleId?: string;
  responsibleName?: string;
  assignedTo?: string;
  assignedName?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  durationDays: number; // Días naturales calculados automáticamente
  progress: number; // 0–100 %
  status: FiveSPlanningStatus;
  plannedHours?: number; // Dedicación planificada en horas
  actualHours?: number;  // Horas realizadas (default 0)
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

// ================= 1S SEIRI: SAFARI & HALLAZGOS =================
export const FIVE_S_FINDING_TYPES = [
  'Objeto innecesario',
  'Exceso de material',
  'Riesgo de seguridad',
  'Riesgo de calidad',
  'Riesgo medioambiental',
  'Desperdicio',
  'Otro'
] as const;

export type FiveSFindingType = typeof FIVE_S_FINDING_TYPES[number];

export interface FiveSFinding {
  id: string;
  findingNumber: string; // e.g. H-001, H-002...
  companyId: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  zoneId: string;
  zoneName: string;
  subzoneId?: string;
  subzoneName?: string;
  photoUrl: string;
  storagePath?: string;
  description: string;
  type: FiveSFindingType;
  otherDescription?: string; // Cuando type === 'Otro'
  userId: string;
  userName: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  // Relación con Tarjeta Roja
  redTagId?: string;
  hasRedTag?: boolean;
  redTagNumber?: string;
}

// ================= 1S SEIRI: TARJETAS ROJAS =================
export const FIVE_S_RED_TAG_DECISIONS = [
  'Eliminar',
  'Reubicar',
  'Reparar',
  'Almacenar',
  'Mantener'
] as const;

export type FiveSRedTagDecision = typeof FIVE_S_RED_TAG_DECISIONS[number];

export type RedTagCategory = 'material' | 'tool' | 'equipment' | 'document' | 'other';
export type RedTagReason = 'unnecessary' | 'defective' | 'excess' | 'obsolete' | 'unknown' | string;
export type RedTagAction = 'discard' | 'relocate' | 'return' | 'repair' | 'holding_area' | string;
export type RedTagStatus = 'active' | 'in_quarantine' | 'resolved' | 'cancelled';

export interface FiveSRedTag {
  id: string;
  tagNumber: string; // e.g. TR-001, TR-002...
  companyId: string;
  projectId: string;
  findingId: string; // Relación obligatoria con Hallazgo origen
  findingNumber?: string;
  zoneId: string;
  zoneName?: string;
  subzoneId?: string;
  subzoneName?: string;
  photoUrl: string;
  photoNokUrl?: string; // Compatibilidad con vistas previas
  storagePath?: string;
  description: string;
  reason: string; // Motivo explicativo de por qué se emite la tarjeta
  decision: FiveSRedTagDecision;
  responsibleId: string; // Miembro activo del equipo 5S del proyecto
  responsibleName: string;
  dueDate: string; // Fecha límite obligatoria (YYYY-MM-DD)
  date?: string;
  itemDescription?: string; // Compatibilidad con campos previos
  category?: RedTagCategory;
  quantity?: number;
  estimatedValue?: number;
  actionProposed?: RedTagAction;
  quarantineLocation?: string;
  quarantineLimitDate?: string;
  status?: RedTagStatus;
  photoOkUrl?: string;
  actionId?: string; // Referencia técnica para futura fase PDCA
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  resolvedAt?: string;
}

export interface FiveSOrderItem {
  id: string;
  projectId: string;
  companyId: string;
  zoneId: string;
  subzoneId?: string;
  itemName: string;
  assignedLocation: string;
  identificationType: 'shadow_board' | 'floor_marking' | 'label' | 'color_code' | 'cartel';
  minStock?: number;
  maxStock?: number;
  photoUrl?: string;
  status: FiveSTrafficStatus;
  notes?: string;
  createdAt: string;
}

export interface FiveSCleaningTask {
  id: string;
  projectId: string;
  companyId: string;
  zoneId: string;
  subzoneId?: string;
  title: string;
  type: 'dirt_source' | 'cleaning_standard' | 'inspection_point';
  sourceCause?: string;
  frequency: 'shift' | 'daily' | 'weekly' | 'monthly';
  responsibleName: string;
  standardMethod: string;
  cleaningTool?: string;
  photoNokUrl?: string;
  photoOkUrl?: string;
  status: 'active' | 'eliminated' | 'controlled';
  createdAt: string;
}

export type ActionPriority = 'low' | 'medium' | 'high' | 'critical';
export type ActionStatus = 'open' | 'in_progress' | 'implemented' | 'verified' | 'closed';
export type ActionSource = 'safari' | 'red_tag' | 'audit' | 'routine' | 'suggestion';

export interface FiveSVisualAction {
  id: string;
  projectId: string;
  companyId: string;
  zoneId: string;
  zoneName?: string;
  subzoneId?: string;
  subzoneName?: string;
  phase: string;
  title: string;
  description: string;
  rootCause?: string;
  priority: ActionPriority;
  status: ActionStatus;
  assignedTo?: string;
  assignedName?: string;
  dueDate: string;
  completedDate?: string;
  photoNokUrl: string;
  photoOkUrl?: string;
  source: ActionSource;
  sourceRefId?: string;
  standardCreatedId?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export interface FiveSVisualStandard {
  id: string;
  projectId: string;
  companyId: string;
  zoneId: string;
  zoneName?: string;
  subzoneId?: string;
  subzoneName?: string;
  code: string;
  title: string;
  phase: string;
  description: string;
  version: number;
  status: 'draft' | 'approved' | 'superseded';
  approvedBy?: string;
  approvedByName?: string;
  approvedDate?: string;
  photoCorrectUrl: string;
  photoIncorrectUrl?: string;
  keyPoints: string[];
  checkFrequency: 'daily' | 'weekly' | 'per_shift' | 'monthly';
  createdAt: string;
  updatedAt: string;
}

export interface FiveSAuditQuestion {
  id: string;
  phase: string;
  question: string;
  criterion: string;
  weight: number;
}

export interface FiveSAuditTemplate {
  id: string;
  companyId: string;
  title: string;
  description: string;
  questions: FiveSAuditQuestion[];
  createdAt: string;
}

export interface FiveSAuditResponse {
  questionId: string;
  phase: string;
  question: string;
  criterion: string;
  score: number;
  isCompliant: boolean;
  comment?: string;
  photoUrl?: string;
  actionCreatedId?: string;
}

export interface FiveSAudit {
  id: string;
  projectId: string;
  companyId: string;
  zoneId: string;
  zoneName?: string;
  subzoneId?: string;
  subzoneName?: string;
  templateId?: string;
  title: string;
  auditorId: string;
  auditorName: string;
  scheduledDate: string;
  executedDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  score: number;
  phaseScores: Record<string, number>;
  findingsCount: number;
  observations?: string;
  responses: FiveSAuditResponse[];
  createdAt: string;
}

export interface FiveSHistoryItem {
  id: string;
  projectId: string;
  companyId: string;
  type: 'safari' | 'red_tag' | 'action_created' | 'action_resolved' | 'standard_approved' | 'audit_completed' | 'project_updated';
  title: string;
  description: string;
  actorName: string;
  timestamp: string;
  entityId?: string;
  photoUrl?: string;
  phase?: string;
}
