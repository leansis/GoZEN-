import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Play,
  CheckCircle2,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserCheck,
  UserX,
  Search,
  MessageSquare,
  AlertCircle,
  Headphones,
  Check,
  ChevronDown,
  Timer,
  Trash2,
  BarChart3,
  Award,
  Coins,
  Filter,
  Calendar,
  X,
  XCircle,
  Tag,
  AlertTriangle,
  History,
  RotateCcw,
  LayoutDashboard,
  List as ListIcon,
  ArrowUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../AuthContext";
import { useAppData } from "../contexts/AppDataContext";
import { 
  db, 
  handleDiagnosticError, 
  OperationType 
} from "../firebase";
import {
  updateDoc,
  doc,
  onSnapshot,
  addDoc,
  collection,
  query,
  where,
} from "firebase/firestore";
import {
  Forum,
  ForumSection,
  ForumSession as ForumSessionType,
  ForumAttendee,
  User,
  ActionPlan,
  SubAction,
  ActionType,
  ActionStatus,
  ActionPriority,
  ActionCategory,
  SubActionAudit,
  Incident
} from "../types";
import clsx from "clsx";
import {
  format,
  differenceInSeconds,
  addDays,
  isSameDay,
  isAfter,
  isBefore,
  startOfDay,
  addWeeks,
  subDays,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { calculateAutomaticStatus } from "../lib/action-utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Modal from "../components/Modal";

// --- Components ---

interface SortableAttendeeProps {
  id: string;
  attendee: ForumAttendee;
}

function Droppable(props: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: props.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex-1 overflow-y-auto p-4",
        props.id === "absent-container" && "bg-gray-50/10",
      )}
    >
      {props.children}
    </div>
  );
}

function SortableAttendee({ id, attendee }: SortableAttendeeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl mb-2 cursor-grab active:cursor-grabbing hover:border-blue-200 transition-all group",
        attendee.present ? "bg-white" : "bg-gray-50/50",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
            attendee.present
              ? "bg-blue-100 text-blue-600"
              : "bg-gray-200 text-gray-500",
          )}
        >
          {attendee.name.charAt(0)}
        </div>
        <div>
          <p
            className={clsx(
              "text-sm font-medium",
              attendee.present ? "text-gray-800" : "text-gray-400 italic",
            )}
          >
            {attendee.name}
            {attendee.isLeader && (
              <span className="ml-2 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                Líder
              </span>
            )}
          </p>
          {attendee.groupName && (
            <p className="text-[10px] text-gray-400">{attendee.groupName}</p>
          )}
        </div>
      </div>
      {attendee.present ? (
        <CheckCircle2 size={18} className="text-green-500" />
      ) : (
        <UserX size={18} className="text-gray-300" />
      )}
    </div>
  );
}

const ChevronDiagram = ({
  steps,
  currentStep,
  onStepClick,
  status,
  isPreparationMode,
}: {
  steps: string[];
  currentStep: number;
  onStepClick: (idx: number) => void;
  status: string;
  isPreparationMode: boolean;
}) => {
  return (
    <div className="flex items-center w-full overflow-hidden rounded-xl border border-gray-100 bg-white mb-8">
      {steps.map((step, idx) => {
        const isCurrent = idx === currentStep;
        const isCompleted = idx < currentStep;
        const isLast = idx === steps.length - 1;
        const canClick = status === "in_progress" || isPreparationMode;

        return (
          <button
            key={idx}
            onClick={() => canClick && onStepClick(idx)}
            disabled={!canClick}
            className={clsx(
              "relative flex-1 py-4 px-6 text-[10px] md:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 min-w-0 transition-all duration-300",
              isCurrent
                ? "bg-blue-600 text-white z-10"
                : isCompleted
                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  : "bg-white text-gray-400 hover:bg-gray-50",
              !canClick && "cursor-default",
            )}
            style={{
              clipPath: isLast
                ? "polygon(20px 0%, 100% 0%, 100% 100%, 20px 100%, 0% 50%)"
                : idx === 0
                  ? "polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%)"
                  : "polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%, 20px 50%)",
              marginLeft: idx === 0 ? "0" : "-20px",
              paddingLeft: idx === 0 ? "24px" : "44px",
              flexBasis: isCurrent ? "20%" : "auto",
            }}
          >
            <span className="truncate">
              {isCompleted && (
                <Check size={14} className="inline mr-1 shrink-0" />
              )}
              {step}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default function ForumSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { dbUser, company, activeCompanyId } = useAuth();
  const { forums, users, indicators, getTeamParentChain } = useAppData();

  const [session, setSession] = useState<ForumSessionType | null>(null);
  const [forum, setForum] = useState<Forum | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [isPreparationMode, setIsPreparationMode] = useState(false);
  const [localSectionIndex, setLocalSectionIndex] = useState<number | null>(
    null,
  );
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [subActions, setSubActions] = useState<SubAction[]>([]);
  const [categories, setCategories] = useState<ActionCategory[]>([]);

  // Action editing state
  const [editingAction, setEditingAction] =
    useState<Partial<ActionPlan> | null>(null);
  const [tempSubActions, setTempSubActions] = useState<Partial<SubAction>[]>(
    [],
  );
  const [type, setType] = useState<ActionType>("accion");
  const [isEscalated, setIsEscalated] = useState(false);
  const [escalatedToForumId, setEscalatedToForumId] = useState("");
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showIncidentSelector, setShowIncidentSelector] = useState(false);
  const [incidentSearchQuery, setIncidentSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [backToActionId, setBackToActionId] = useState<string | null>(null);
  const isAdmin = dbUser?.role === "admin";

  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(
    null,
  );
  const [selectedTypology, setSelectedTypology] = useState<
    "calidad" | "coste" | "plazo" | "personas" | null
  >(null);
  const [viewedIndicatorIds, setViewedIndicatorIds] = useState<Set<string>>(
    new Set(),
  );

  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (editingAction) {
      setType(editingAction.type || 'accion');
      setIsEscalated(false); // Reset to false when opening
      setEscalatedToForumId(editingAction.escalatedToForumId || '');
    } else {
      setShowIncidentSelector(false);
      setIncidentSearchQuery("");
      setShowUserSelector(false);
      setUserSearchQuery("");
    }
  }, [editingAction]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!sessionId) return;

    let retryCount = 0;
    const maxRetries = 10;

    const unsubscribe = onSnapshot(
      doc(db, "forumSessions", sessionId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ForumSessionType;
          setSession({ ...data, id: docSnap.id });

          if (localSectionIndex === null) {
            setLocalSectionIndex(data.currentSectionIndex || 0);
          }

          const forumDef = forums.find((f) => f.id === data.forumId);
          if (forumDef) setForum(forumDef);
          setLoading(false);
        } else {
          // If it doesn't exist yet, we might be navigating to a newly created session
          // Wait a bit and it should appear. We only stop loading if we've tried several times.
          if (retryCount >= maxRetries) {
            setLoading(false);
          } else {
            retryCount++;
          }
        }
      },
    );

    return () => unsubscribe();
  }, [sessionId, forums]);

  useEffect(() => {
    const companyId = activeCompanyId || dbUser?.companyId;
    if (!companyId || !forum) return;

    const qActions = query(
      collection(db, "actionPlans"),
      where("companyId", "==", companyId),
    );

    const unsubscribeActions = onSnapshot(qActions, (snap) => {
      const allActions = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ActionPlan,
      );
      // Filter by forum association (origin, escalated to, or escalated from)
      const forumActions = allActions.filter(
        (a) =>
          (a.originForumId || (a as any).forumId) === forum.id || 
          a.escalatedToForumId === forum.id ||
          a.escalationHistory?.some((h: any) => h.fromForumId === forum.id),
      );
      setActions(
        forumActions.map((a) => ({
          ...a,
          status: calculateAutomaticStatus(a.targetDate, a.status),
        })),
      );
    });

    const qSubActions = query(
      collection(db, "subActions"),
      where("companyId", "==", companyId),
    );
    const unsubscribeSubActions = onSnapshot(qSubActions, (snap) => {
      setSubActions(
        snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SubAction),
      );
    });

    const qCategories = query(
      collection(db, "actionCategories"),
      where("companyId", "==", companyId),
    );
    const unsubscribeCategories = onSnapshot(qCategories, (snap) => {
      setCategories(
        snap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as ActionCategory,
        ),
      );
    });

    const qIncidents = query(
      collection(db, "incidents"),
      where("companyId", "==", companyId),
    );
    const unsubscribeIncidents = onSnapshot(qIncidents, (snap) => {
      setIncidents(
        snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Incident),
      );
    }, (err) => {
      handleDiagnosticError(err, OperationType.LIST, 'incidents');
    });

    return () => {
      unsubscribeActions();
      unsubscribeSubActions();
      unsubscribeCategories();
      unsubscribeIncidents();
    };
  }, [forum, activeCompanyId, dbUser]);

  useEffect(() => {
    if (
      session?.status === "in_progress" &&
      session.startedAt &&
      !isPreparationMode
    ) {
      const start = new Date(session.startedAt);

      const updateTimer = () => {
        const now = new Date();
        setElapsedSeconds(differenceInSeconds(now, start));
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.status, session?.startedAt, isPreparationMode]);

  const steps = useMemo(() => {
    if (!forum) return [];
    return [
      "INICIO",
      ...forum.sections.map((s) =>
        s.id === "actions" ? "Plan de acción" : s.title,
      ),
    ];
  }, [forum]);

  const forumIndicators = useMemo(() => {
    if (!forum) return [];
    return indicators.filter((i) => i.scopeIds?.includes(forum.id));
  }, [indicators, forum]);

  // Auto-select first indicator when filtering
  useEffect(() => {
    if (selectedTypology) {
      const filtered = forumIndicators.filter(
        (i) => i.typology === selectedTypology,
      );
      if (
        filtered.length > 0 &&
        (!selectedIndicatorId ||
          !filtered.find((i) => i.id === selectedIndicatorId))
      ) {
        setSelectedIndicatorId(filtered[0].id);
      }
    }
  }, [selectedTypology, forumIndicators, selectedIndicatorId]);

  const forumIncidents = useMemo(() => {
    return incidents.filter((i) => 
      (i.forumId === forum?.id || 
       i.escalatedToForumId === forum?.id || 
       i.escalationHistory?.some((h: any) => h.fromForumId === forum?.id)) && 
      (i.status === 'abierta' || !i.status)
    );
  }, [incidents, forum]);

  const effectiveSectionIndex =
    localSectionIndex ?? session?.currentSectionIndex ?? 0;

  const { isFuture, isToday } = useMemo(() => {
    if (!session) return { isFuture: false, isToday: false };
    const today = format(new Date(), "yyyy-MM-dd");
    const sessionDate = session.scheduledAt.split("T")[0];
    return {
      isFuture: sessionDate > today,
      isToday: sessionDate === today
    };
  }, [session]);

  useEffect(() => {
    if (forumIndicators.length > 0 && !selectedIndicatorId) {
      setSelectedIndicatorId(forumIndicators[0].id);
    }
  }, [forumIndicators]);

  const handleDropOnColumn = async (e: React.DragEvent, columnValue: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;

    try {
      const { type, id } = JSON.parse(data);
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");

      if (type === 'incidencia') {
        const incident = incidents.find(i => i.id === id);
        if (!incident) return;

        if (columnValue === 'escalados') {
          // Escalate as incident, not action
          setEditingAction({
            id: incident.id,
            title: incident.title,
            description: incident.description,
            originForumId: incident.forumId,
            originForumName: incident.forumName,
            isEscalated: incident.isEscalated || false,
            escalatedToForumId: incident.escalatedToForumId || "",
            escalationHistory: incident.escalationHistory || [],
            createdAt: incident.createdAt,
            status: incident.status || 'abierta'
          } as any);
          setType('incidencia');
          setIsEscalated(true);
          setEscalatedToForumId(incident.escalatedToForumId || "");
          return;
        }

        if (columnValue === 'hoy' || columnValue === 'proximas' || columnValue === 'atrasadas' || columnValue === 'sin_fecha') {
          const targetDate = columnValue === 'hoy' ? todayStr : 
                             columnValue === 'atrasadas' ? format(addDays(now, -1), "yyyy-MM-dd") :
                             columnValue === 'proximas' ? format(addDays(now, 7), "yyyy-MM-dd") :
                             "";
          
          try {
            const status = calculateAutomaticStatus(targetDate, 'pendiente');
            const actionPayload = {
              title: incident.title,
              description: incident.description || '',
              status: status,
              priority: 'media',
              targetDate: targetDate,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: dbUser?.id || '',
              createdByName: dbUser?.name || '',
              assignedTo: [],
              assignedToNames: [],
              originForumId: incident.forumId || forum?.id || "",
              originForumName: incident.forumName || forum?.name || "",
              forumId: forum?.id || "",
              companyId: forum?.companyId || incident.companyId || dbUser?.companyId || '',
              incidentId: incident.id,
              type: 'incidencia',
              isEscalated: incident.isEscalated || false,
              escalatedToForumId: incident.escalatedToForumId || "",
              escalationHistory: incident.escalationHistory || []
            };

            const actionRef = await addDoc(collection(db, 'actionPlans'), actionPayload);
            
            await updateDoc(doc(db, "incidents", incident.id), {
              status: 'en_accion',
              actionId: actionRef.id
            });

            // Open modal for the newly created action
            setEditingAction({ id: actionRef.id, ...actionPayload } as any);
            setTempSubActions([]);
            setType('accion');
            setIsEscalated(false);
            setEscalatedToForumId("");
          } catch (err) {
            handleDiagnosticError(err, OperationType.WRITE, 'actionPlans/incidents');
            console.error("Error creating action from drop:", err);
          }
          return;
        }
      } else if (type === 'accion') {
        const action = actions.find(a => a.id === id);
        if (!action) return;

        if (columnValue === 'escalados') {
          setEditingAction({ ...action });
          setTempSubActions(subActions.filter(s => s.actionId === action.id));
          setType(action.type || 'accion');
          setIsEscalated(true);
          setEscalatedToForumId(action.escalatedToForumId || "");
          return;
        }

        if (columnValue === 'proximas') {
          setEditingAction({ ...action });
          setTempSubActions(subActions.filter(s => s.actionId === action.id));
          setType(action.type || 'accion');
          setIsEscalated(false);
          setEscalatedToForumId(action.escalatedToForumId || "");
          return;
        }

        if (columnValue === 'hoy') {
           await updateDoc(doc(db, "actionPlans", id), {
             targetDate: todayStr,
             priority: action.priority || 'media',
             updatedAt: now.toISOString(),
             status: calculateAutomaticStatus(todayStr, action.status)
           });
        }
      }
    } catch (error) {
      console.error("Drop error:", error);
    }
  };

  const checkAndResolveIncident = async (incidentId: string, currentActionId?: string, isCompleting?: boolean) => {
    if (!incidentId) return;
    
    // Get all actions linked to this incident
    const linkedActions = (actions as ActionPlan[]).filter(a => a.incidentId === incidentId);
    
    // Check if all actions are 'finalizada'
    const allDone = linkedActions.every(a => {
      if (a.id === currentActionId) return isCompleting;
      return a.status === 'finalizada';
    });

    if (allDone && linkedActions.length > 0) {
      await updateDoc(doc(db, 'incidents', incidentId), {
        status: 'resuelta'
      });
    }
  };

  const handleCloseModal = async () => {
    if (editingAction?.id && forum?.id) {
       // Mark as read for the current forum if they were notified
       if ((editingAction as any).viewedUpdates?.[forum.id] === false) {
          const ref = doc(db, type === 'incidencia' ? 'incidents' : 'actionPlans', editingAction.id);
          await updateDoc(ref, {
             [`viewedUpdates.${forum.id}`]: true
          });
       }
    }
    if (type === 'incidencia' && backToActionId) {
      const prevAction = actions.find(a => a.id === backToActionId);
      if (prevAction) {
        setEditingAction(prevAction as any);
        setType('accion');
        setBackToActionId(null);
        return;
      }
    }
    setEditingAction(null);
    setTempSubActions([]);
    setShowUserSelector(false);
    setUserSearchQuery("");
    setBackToActionId(null);
  };

  const handleFinalizeAction = async () => {
    if (!editingAction?.id || !dbUser) return;
    try {
      setIsSaving(true);
      const isIncident = type === "incidencia" || "indicatorId" in editingAction;
      const collectionName = isIncident ? "incidents" : "actionPlans";
      const newStatus = isIncident ? "resuelta" : "finalizada";

      const updatePayload: any = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      if (!isIncident) {
        updatePayload.priority = (editingAction as any).priority || "media";
      }

      await updateDoc(doc(db, collectionName, editingAction.id), updatePayload);
      
      const originalAction = (isIncident ? forumIncidents : actions).find(a => a.id === editingAction.id);
      if (!isIncident && (originalAction as any)?.incidentId) {
        await checkAndResolveIncident((originalAction as any).incidentId, originalAction.id, true);
      }

      setEditingAction(null);
    } catch (err) {
      console.error("Error finalizing:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAction = async () => {
    if (!editingAction?.id || !dbUser) return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, "actionPlans", editingAction.id), {
        status: "cancelada",
        priority: (editingAction as any).priority || "media",
        updatedAt: new Date().toISOString(),
      });
      setEditingAction(null);
    } catch (err) {
      console.error("Error canceling action:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !dbUser ||
      !activeCompanyId ||
      !editingAction ||
      !editingAction.title ||
      (type !== "incidencia" && !editingAction.targetDate)
    )
      return;

    try {
      setIsSaving(true);
      const companyId = activeCompanyId || dbUser.companyId;
      const now = new Date().toISOString();

      if (type === "incidencia") {
        const incidentPayload: any = {
          title: editingAction.title,
          description: editingAction.description || "",
          forumId: forum?.id || "",
          forumName: forum?.name || "",
          indicatorId: selectedIndicatorId || "",
          indicatorName: indicators.find(i => i.id === selectedIndicatorId)?.name || "",
          companyId: companyId,
          createdAt: editingAction.createdAt || now,
          createdBy: editingAction.createdBy || dbUser.uid,
          createdByName: editingAction.createdByName || dbUser.name,
          isEscalated: isEscalated,
          escalatedToForumId: escalatedToForumId || '',
          status: 'abierta',
          viewedUpdates: editingAction.viewedUpdates || {},
          modifiedFields: editingAction.modifiedFields || []
        };

        const isNewlyEscalated = isEscalated && !editingAction.isEscalated;
        const escalationChanged = isEscalated && (editingAction.escalatedToForumId !== escalatedToForumId);

        if (isNewlyEscalated || escalationChanged) {
          incidentPayload.escalatedBy = dbUser.uid;
          incidentPayload.escalatedByName = dbUser.name;
          incidentPayload.escalatedAt = now;
          
          const fromForumName = forum?.name || 'Origen';
          const toForumName = forums.find(f => f.id === escalatedToForumId)?.name || 'Foro superior';
          
          const historyEntry: any = {
            fromForumId: forum?.id || '',
            fromForumName: fromForumName,
            toForumId: escalatedToForumId,
            toForumName: toForumName,
            at: now,
            by: dbUser.uid,
            byName: dbUser.name,
            note: `Escalado de ${fromForumName} a ${toForumName}`
          };
          
          incidentPayload.escalationHistory = [...(editingAction.escalationHistory || []), historyEntry];
          
          // Clear notification markers if re-escalating
          incidentPayload.viewedUpdates = {};
          incidentPayload.modifiedFields = [];
        }

        // Notification Track for incidents
        if (editingAction.id) {
          const original = incidents.find(i => i.id === editingAction.id);
          const ownerId = original?.isEscalated && original.escalatedToForumId 
            ? original.escalatedToForumId 
            : (original?.forumId);
            
          if (original && forum?.id === ownerId) {
            const modifiedKeys: string[] = [];
            if (original.title !== incidentPayload.title) modifiedKeys.push('title');
            if (original.description !== incidentPayload.description) modifiedKeys.push('description');
            if (original.status !== incidentPayload.status) modifiedKeys.push('status');
            
            if (modifiedKeys.length > 0) {
              const updateObj: Record<string, boolean> = { ...(original.viewedUpdates || {}) };
              
              // Notify origin
              const originId = original.forumId;
              if (originId && originId !== forum?.id) updateObj[originId] = false;
              
              // Notify history
              original.escalationHistory?.forEach((h: any) => {
                if (h.fromForumId && h.fromForumId !== forum?.id) {
                  updateObj[h.fromForumId] = false;
                }
              });

              incidentPayload.viewedUpdates = updateObj;
              incidentPayload.modifiedFields = modifiedKeys;
            }
          }
        }

        if (editingAction.id) {
          await updateDoc(doc(db, "incidents", editingAction.id), incidentPayload);
        } else {
          await addDoc(collection(db, "incidents"), incidentPayload);
        }
        
        if (backToActionId) {
          const prevAction = actions.find(a => a.id === backToActionId);
          if (prevAction) {
            setEditingAction(prevAction as any);
            setType('accion');
            setBackToActionId(null);
            setIsSaving(false);
            return;
          }
        }

        setEditingAction(null);
        setType("accion"); // Reset to default
        setIsSaving(false);
        return;
      }

      const autoStatus = calculateAutomaticStatus(
        editingAction.targetDate,
        editingAction.status || "pendiente",
      );

      const actionPayload: any = {
        title: editingAction.title,
        description: editingAction.description || "",
        type: type,
        status: autoStatus,
        priority: (editingAction as any).priority || "media",
        categoryId: editingAction.categoryId || "",
        categoryName:
          categories.find((c) => c.id === editingAction.categoryId)?.name || "",
        targetDate: editingAction.targetDate,
        dateChangeCount: editingAction.dateChangeCount || 0,
        notes: editingAction.notes || "",
        customFields: editingAction.customFields || {},
        companyId: companyId,
        updatedAt: now,
        assignedTo: editingAction.assignedTo || [],
        assignedToNames: (editingAction.assignedTo || []).map(
          (uid) => users.find((u) => u.uid === uid)?.name || "Desconocido",
        ),
        isEscalated: isEscalated,
        escalatedToForumId: escalatedToForumId || "",
        originForumId: editingAction.originForumId || forum?.id || "",
        originForumName: editingAction.originForumName || forum?.name || "",
        incidentId: editingAction.incidentId || "",
        viewedUpdates: editingAction.viewedUpdates || {},
        modifiedFields: editingAction.modifiedFields || []
      };

      const isNewlyEscalated = isEscalated && !editingAction.isEscalated;
      const escalationChanged = isEscalated && (editingAction.escalatedToForumId !== escalatedToForumId);

      if (isNewlyEscalated || escalationChanged) {
        actionPayload.escalatedBy = dbUser.uid;
        actionPayload.escalatedByName = dbUser.name;
        actionPayload.escalatedAt = now;

        // Add to history
        const fromForumName = forum?.name || 'Origen';
        const toForumName = forums.find(f => f.id === escalatedToForumId)?.name || 'Foro superior';
        
        const historyEntry: any = {
          fromForumId: forum?.id || '',
          fromForumName: fromForumName,
          toForumId: escalatedToForumId,
          toForumName: toForumName,
          at: now,
          by: dbUser.uid,
          byName: dbUser.name,
          note: `Escalado de ${fromForumName} a ${toForumName}`
        };
        
        actionPayload.escalationHistory = [...(editingAction.escalationHistory || []), historyEntry];
        
        // (1) Una acción escalada pierde el responsable y fecha originales
        actionPayload.assignedTo = [];
        actionPayload.assignedToNames = [];
        actionPayload.targetDate = "";
        actionPayload.status = "pendiente";
        
        // Clear notification markers if re-escalating
        actionPayload.viewedUpdates = {};
        actionPayload.modifiedFields = [];
      }

      // Notification Track for actions
      if (editingAction.id) {
        const original = actions.find(a => a.id === editingAction.id);
        const ownerId = original?.isEscalated && original.escalatedToForumId 
          ? original.escalatedToForumId 
          : (original?.originForumId || (original as any)?.forumId);

        if (original && forum?.id === ownerId) {
          const modifiedKeys: string[] = [];
          if (original.title !== actionPayload.title) modifiedKeys.push('title');
          if (original.description !== actionPayload.description) modifiedKeys.push('description');
          if (original.status !== actionPayload.status) modifiedKeys.push('status');
          if (JSON.stringify(original.assignedTo) !== JSON.stringify(actionPayload.assignedTo)) modifiedKeys.push('assignedTo');
          if (original.targetDate !== actionPayload.targetDate) modifiedKeys.push('targetDate');
          if (original.notes !== actionPayload.notes) modifiedKeys.push('notes');
          if (JSON.stringify(original.customFields) !== JSON.stringify(actionPayload.customFields)) modifiedKeys.push('customFields');
          
          if (modifiedKeys.length > 0) {
            const updateObj: Record<string, boolean> = { ...(original.viewedUpdates || {}) };
            
            // Notify origin
            const originId = original.originForumId || (original as any).forumId;
            if (originId && originId !== forum?.id) updateObj[originId] = false;
            
            // Notify history
            original.escalationHistory?.forEach((h: any) => {
              if (h.fromForumId && h.fromForumId !== forum?.id) {
                updateObj[h.fromForumId] = false;
              }
            });

            actionPayload.viewedUpdates = updateObj;
            actionPayload.modifiedFields = modifiedKeys;
          }
        }
      }

      let actionId = editingAction.id;
      const splitMode = company?.settings?.actionPlanMultipleAssigneeMode === 'split';
      const assignees = actionPayload.assignedTo || [];

      if (splitMode && assignees.length > 1 && type === 'accion') {
        // Handle Splitting logic
        const firstUid = assignees[0];
        const firstActionPayload = {
          ...actionPayload,
          assignedTo: [firstUid],
          assignedToNames: [users.find(u => u.uid === firstUid)?.name || 'Desconocido']
        };

        if (editingAction.id) {
          // Update the original document for the first assignee
          await updateDoc(doc(db, 'actionPlans', editingAction.id), firstActionPayload);
          actionId = editingAction.id;

          // Auto-resolve incident if applicable
          const originalAction = actions.find(a => a.id === editingAction.id);
          if (firstActionPayload.status === 'finalizada' && originalAction?.incidentId) {
            await checkAndResolveIncident(originalAction.incidentId, editingAction.id, true);
          }
        } else {
          // Create the first document
          const newAction = {
            ...firstActionPayload,
            createdBy: dbUser.uid,
            createdByName: dbUser.name,
            createdAt: now
          };
          const docRef = await addDoc(collection(db, 'actionPlans'), newAction);
          actionId = docRef.id;
        }

        // Link incident to the first action only
        if (actionId && editingAction.incidentId && !editingAction.id) {
          await updateDoc(doc(db, "incidents", editingAction.incidentId), {
            status: 'en_accion',
            actionId: actionId
          });
        }

        // Handle Subactions for the first action
        for (const sub of tempSubActions) {
          if (sub.id) {
            await updateDoc(doc(db, 'subActions', sub.id), {
              title: sub.title || '',
              completed: !!sub.completed,
              currentProposedDate: sub.currentProposedDate || ''
            });
          } else {
            await addDoc(collection(db, 'subActions'), {
              title: sub.title || '',
              actionId: actionId,
              companyId: companyId,
              completed: !!sub.completed,
              currentProposedDate: sub.currentProposedDate || ''
            });
          }
        }

        // Create separate actions for the rest of assignees
        for (let i = 1; i < assignees.length; i++) {
          const uid = assignees[i];
          const splitPayload = {
            ...actionPayload,
            assignedTo: [uid],
            assignedToNames: [users.find(u => u.uid === uid)?.name || 'Desconocido'],
            createdBy: dbUser.uid,
            createdByName: dbUser.name,
            createdAt: now,
            updatedAt: now
          };
          const docRef = await addDoc(collection(db, 'actionPlans'), splitPayload);
          const newActionId = docRef.id;

          // Duplicate subactions for the split action
          for (const sub of tempSubActions) {
            await addDoc(collection(db, 'subActions'), {
              title: sub.title || '',
              actionId: newActionId,
              companyId: companyId,
              completed: !!sub.completed,
              currentProposedDate: sub.currentProposedDate || ''
            });
          }
        }
      } else {
        // Standard non-split logic
        if (editingAction.id) {
          await updateDoc(
            doc(db, "actionPlans", editingAction.id),
            actionPayload,
          );

          // Auto-resolve incident if applicable
          const originalAction = actions.find(a => a.id === editingAction.id);
          if (actionPayload.status === 'finalizada' && originalAction?.incidentId) {
            await checkAndResolveIncident(originalAction.incidentId, editingAction.id, true);
          }
        } else {
          const newAction = {
            ...actionPayload,
            createdBy: dbUser.uid,
            createdByName: dbUser.name,
            createdAt: now,
          };
          const docRef = await addDoc(collection(db, "actionPlans"), newAction);
          actionId = docRef.id;
        }

        // If this action was created from an incident, update the incident
        if (actionId && editingAction.incidentId && !editingAction.id) {
          await updateDoc(doc(db, "incidents", editingAction.incidentId), {
            status: 'en_accion',
            actionId: actionId
          });
        }

        if (actionId) {
          for (const sub of tempSubActions) {
            if (sub.id) {
              await updateDoc(doc(db, "subActions", sub.id), {
                title: sub.title || "",
                completed: !!sub.completed,
                currentProposedDate: sub.currentProposedDate || "",
              });
            } else {
              await addDoc(collection(db, "subActions"), {
                title: sub.title || "",
                actionId: actionId,
                companyId: companyId,
                completed: !!sub.completed,
                currentProposedDate: sub.currentProposedDate || "",
              });
            }
          }
        }
      }

      setEditingAction(null);
      setTempSubActions([]);
      setIsSaving(false);
    } catch (err: any) {
      console.error("Error saving action:", err);
      setError("Error al guardar la acción.");
      setIsSaving(false);
    }
  };

  const addTempSubAction = () => {
    setTempSubActions([
      ...tempSubActions,
      { title: "", completed: false, currentProposedDate: "" },
    ]);
  };

  const removeTempSubAction = (index: number) => {
    setTempSubActions(tempSubActions.filter((_, i) => i !== index));
  };

  const handleSubActionChange = (
    index: number,
    field: keyof SubAction,
    value: any,
  ) => {
    const newSubs = [...tempSubActions];
    newSubs[index] = { ...newSubs[index], [field]: value };
    setTempSubActions(newSubs);
  };

  const STATUS_OPTIONS: {
    value: ActionStatus;
    label: string;
    color: string;
    bg: string;
  }[] = [
    {
      value: "pendiente",
      label: "Pendiente",
      color: "text-gray-600",
      bg: "bg-gray-100",
    },
    {
      value: "en_progreso",
      label: "En Curso",
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      value: "retrasada",
      label: "Retrasada",
      color: "text-red-600",
      bg: "bg-red-100",
    },
    {
      value: "finalizada",
      label: "Finalizada",
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      value: "bloqueada",
      label: "Bloqueada",
      color: "text-red-600",
      bg: "bg-red-100",
    },
    {
      value: "cancelada",
      label: "Cancelada",
      color: "text-gray-400",
      bg: "bg-gray-200",
    },
  ];

  const PRIORITY_OPTIONS: {
    value: ActionPriority;
    label: string;
    color: string;
  }[] = [
    { value: "baja", label: "Baja", color: "text-blue-600" },
    { value: "media", label: "Media", color: "text-orange-600" },
    { value: "alta", label: "Alta", color: "text-red-400" },
    { value: "critica", label: "Crítica", color: "text-red-700" },
  ];

  const handleStartSession = async () => {
    if (!session) return;

    try {
      await updateDoc(doc(db, "forumSessions", session.id), {
        status: "in_progress",
        startedAt: new Date().toISOString(),
        currentSectionIndex: 0,
      });
      setIsPreparationMode(false);
      setLocalSectionIndex(0);
    } catch (err) {
      console.error("Error starting session:", err);
    }
  };

  const handlePrepareSession = () => {
    setIsPreparationMode(true);
    setLocalSectionIndex(1); // Jump to first real section
  };

  const handleStepChange = async (newStep: number) => {
    if (!session || !forum) return;
    if (newStep < 0 || newStep >= steps.length) return;

    setLocalSectionIndex(newStep);

    if (isPreparationMode || session.status !== "in_progress") return;

    try {
      await updateDoc(doc(db, "forumSessions", session.id), {
        currentSectionIndex: newStep,
      });
    } catch (err) {
      console.error("Error changing step:", err);
    }
  };

  const handleFinishSession = async () => {
    if (!session) return;

    // We can use a simpler check or a custom modal, but for now let's try removing confirm
    // to see if that was blocking it in the preview environment.
    try {
      setIsSaving(true);
      const now = new Date();
      const completedAt = now.toISOString();
      const start = session.startedAt ? new Date(session.startedAt) : now;
      const durationSeconds = differenceInSeconds(now, start);

      await updateDoc(doc(db, "forumSessions", session.id), {
        status: "completed",
        completedAt,
        durationSeconds,
        currentSectionIndex: steps.length - 1, // Ensure it's at the end
      });

      // Give a small delay for Firestore to sync if needed
      setTimeout(() => {
        navigate("/forums");
        setIsSaving(false);
      }, 500);
    } catch (err) {
      console.error("Error finishing session:", err);
      setIsSaving(false);
      alert(
        "Hubo un error al finalizar la sesión. Por favor, intenta de nuevo.",
      );
    }
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || !session || isPreparationMode) return;

    const activeId = active.id;
    const overId = over.id;

    // Check if the drop target is the container or an item within a container
    const isOverAttendee =
      overId === "attendee-container" ||
      attendeesList.some((a) => a.uid === overId);
    const isOverAbsent =
      overId === "absent-container" ||
      absenteesList.some((a) => a.uid === overId);

    if (!isOverAttendee && !isOverAbsent) return;

    let updatedAttendees = [...session.attendees];
    const index = updatedAttendees.findIndex((a) => a.uid === activeId);

    if (index !== -1) {
      if (isOverAttendee) {
        updatedAttendees[index].present = true;
      } else if (isOverAbsent) {
        updatedAttendees[index].present = false;
      }

      try {
        await updateDoc(doc(db, "forumSessions", session.id), {
          attendees: updatedAttendees,
        });
      } catch (err) {
        console.error("Error updating attendance:", err);
      }
    }
  };

  const addExternalAttendee = async (user: User) => {
    if (!session || isPreparationMode) return;
    const exists = session.attendees.some((a) => a.uid === user.uid);
    if (exists) {
      setShowAddMember(false);
      return;
    }

    const newAttendee: ForumAttendee = {
      uid: user.uid,
      name: user.name,
      present: true,
    };

    try {
      await updateDoc(doc(db, "forumSessions", session.id), {
        attendees: [...session.attendees, newAttendee],
      });
      setShowAddMember(false);
    } catch (err) {
      console.error("Error adding attendee:", err);
    }
  };

  if (loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Preparando la reunión...</p>
        </div>
      </div>
    );

  if (!session || !forum)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-3xl border border-gray-100 max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Error de conexión
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            No hemos podido encontrar los datos de esta sesión. Por favor,
            vuelve a intentarlo.
          </p>
          <button
            onClick={() => navigate("/forums")}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold"
          >
            Volver a Foros
          </button>
        </div>
      </div>
    );

  const attendeesList = session.attendees.filter((a) => a.present);
  const absenteesList = session.attendees.filter((a) => !a.present);

  const estimatedSeconds = forum.estimatedDuration * 60;
  const isNearEnd =
    elapsedSeconds > estimatedSeconds * 0.9 &&
    elapsedSeconds <= estimatedSeconds;
  const isExceeded = elapsedSeconds > estimatedSeconds;

  const formatTimer = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours > 0 ? String(hours).padStart(2, "0") + ":" : ""}${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <button
            onClick={() => navigate("/forums")}
            className="flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-colors text-sm font-bold uppercase tracking-wider mb-2"
          >
            <ChevronLeft size={16} />
            Volver a sesiones
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
              {forum.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session.status === "in_progress" && (
            <div
              className={clsx(
                "flex items-center gap-4 px-6 py-3 rounded-2xl border transition-all duration-300",
                isExceeded
                  ? "bg-red-50 border-red-200 text-red-600"
                  : isNearEnd
                    ? "bg-orange-50 border-orange-200 text-orange-600 animate-pulse"
                    : "bg-white border-gray-100 text-gray-700",
              )}
            >
              <Timer
                className={clsx(isExceeded ? "animate-spin-slow" : "")}
                size={24}
              />
              <div className="flex flex-col">
                <span className="text-2xl font-mono font-black tracking-tighter">
                  {formatTimer(elapsedSeconds)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                  Objetivo: {forum.estimatedDuration} min
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 shrink-0">
            {session.status === "scheduled" && !isPreparationMode && (
              <div className="flex items-center gap-3">
                {(isFuture || isToday) && (
                  <button
                    onClick={handlePrepareSession}
                    className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    <Play size={24} fill="currentColor" />
                    PREPARAR
                  </button>
                )}
                {isToday && (
                  <button
                    onClick={handleStartSession}
                    className="flex items-center gap-3 px-8 py-4 bg-green-600 text-white rounded-2xl font-black text-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                  >
                    <Play size={24} fill="currentColor" />
                    INICIAR
                  </button>
                )}
              </div>
            )}

            {(session.status === "in_progress" || isPreparationMode) && (
              <div className="flex items-center gap-3">
                {isPreparationMode && isToday && (
                  <button
                    onClick={handleStartSession}
                    className="flex items-center gap-3 px-6 py-4 bg-green-600 text-white rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-200 mr-4"
                  >
                    <Play size={20} fill="currentColor" />
                    INICIAR REUNIÓN
                  </button>
                )}
                {effectiveSectionIndex > 0 && (
                  <button
                    onClick={() => handleStepChange(effectiveSectionIndex - 1)}
                    className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}

                {effectiveSectionIndex < steps.length - 1 ? (
                  <button
                    onClick={() => handleStepChange(effectiveSectionIndex + 1)}
                    className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all"
                  >
                    SIGUIENTE
                    <ChevronRight size={24} />
                  </button>
                ) : (
                  !isPreparationMode && (
                    <button
                      onClick={handleFinishSession}
                      disabled={isSaving}
                      className={clsx(
                        "flex items-center gap-2 px-8 py-4 bg-red-600 text-white rounded-2xl font-black text-xl hover:bg-red-700 transition-all",
                        isSaving && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      {isSaving ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 size={24} />
                      )}
                      {isSaving ? "GUARDANDO..." : "FINALIZAR"}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Diagram */}
      <ChevronDiagram
        steps={steps}
        currentStep={effectiveSectionIndex}
        onStepClick={handleStepChange}
        status={session.status}
        isPreparationMode={isPreparationMode}
      />

      {effectiveSectionIndex === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Column 1: Asistentes */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div
              id="attendee-container"
              className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col h-[600px]"
            >
              <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <UserCheck className="text-green-500" size={20} />
                  <h3 className="font-black text-gray-800 uppercase tracking-tight text-base">
                    Asistentes
                  </h3>
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {attendeesList.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>

              <Droppable id="attendee-container">
                <SortableContext
                  items={attendeesList.map((a) => a.uid)}
                  strategy={verticalListSortingStrategy}
                >
                  {attendeesList.map((a) => (
                    <SortableAttendee key={a.uid} id={a.uid} attendee={a} />
                  ))}
                  {attendeesList.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-50 rounded-2xl">
                      <UserCheck size={32} className="mb-2 opacity-50" />
                      <p className="text-xs font-bold uppercase tracking-widest text-center">
                        Invita o arrastra
                        <br />
                        desde ausentes
                      </p>
                    </div>
                  )}
                </SortableContext>
              </Droppable>
            </div>

            {/* Column 2: Ausentes */}
            <div
              id="absent-container"
              className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col h-[600px]"
            >
              <div className="p-5 border-b border-gray-50 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <UserX className="text-red-400" size={20} />
                  <h3 className="font-black text-gray-800 uppercase tracking-tight text-base">
                    Ausentes
                  </h3>
                  <span className="bg-red-50 text-red-500 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {absenteesList.length}
                  </span>
                </div>
              </div>

              <Droppable id="absent-container">
                <SortableContext
                  items={absenteesList.map((a) => a.uid)}
                  strategy={verticalListSortingStrategy}
                >
                  {absenteesList.map((a) => (
                    <SortableAttendee key={a.uid} id={a.uid} attendee={a} />
                  ))}
                  {absenteesList.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-200 border-2 border-dashed border-gray-100 rounded-2xl">
                      <UserX size={32} className="mb-2 opacity-30" />
                      <p className="text-xs font-bold uppercase tracking-widest text-center px-4">
                        Arrastra aquí a quienes no han venido
                      </p>
                    </div>
                  )}
                </SortableContext>
              </Droppable>
            </div>
          </DndContext>

          {/* Column 3: Secciones */}
          <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col h-[600px]">
            <div className="p-5 border-b border-gray-50 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Clock className="text-blue-500" size={20} />
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-base">
                  Secciones
                </h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {steps.map((step, idx) => {
                    const isCurrent = idx === effectiveSectionIndex;
                    const isCompleted = idx < effectiveSectionIndex;
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => (isAdmin || idx <= effectiveSectionIndex) && handleStepChange(idx)}
                        className={clsx(
                          "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer group",
                          isCurrent
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : isCompleted
                              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                              : "bg-white border-transparent text-gray-500",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs transition-colors",
                            isCurrent
                              ? "bg-blue-600 text-white"
                              : isCompleted
                                ? "bg-emerald-500 text-white"
                                : "bg-gray-100 text-gray-400",
                          )}
                        >
                          {isCompleted ? <Check size={12} /> : idx === 0 ? "•" : idx}
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wider flex-1">
                          {step}
                        </span>
                        {isCompleted && <span className="text-[9px] font-black uppercase text-emerald-500/60 opacity-0 group-hover:opacity-100 transition-opacity">Realizado</span>}
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex-1 min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={effectiveSectionIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full"
            >
              {/* Step Content */}
              {(() => {
                const currentSection =
                  forum.sections[effectiveSectionIndex - 1];
                if (!currentSection) return null;

                if (currentSection.id === "indicators") {
                  const filteredIndicators = selectedTypology
                    ? forumIndicators.filter(
                        (i) => i.typology === selectedTypology,
                      )
                    : forumIndicators;

                  const selectedIndicator = forumIndicators.find(
                    (i) => i.id === selectedIndicatorId,
                  );
                  return (
                    <div className="flex flex-col gap-4 min-h-[700px]">
                      {/* Top Indicators Panel */}
                      <div className="bg-white rounded-3xl border border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-2">
                          <div className="flex items-center gap-3">
                            <BarChart3 className="text-blue-600" size={18} />
                            <h4 className="font-black text-gray-800 uppercase tracking-tighter text-sm">
                              Indicadores
                            </h4>
                          </div>

                          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 gap-1">
                            <button
                              onClick={() => setSelectedTypology(null)}
                              className={clsx(
                                "px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all tracking-wider flex items-center gap-1.5",
                                selectedTypology === null
                                  ? "bg-white text-blue-600 border border-gray-100"
                                  : "text-gray-400",
                              )}
                            >
                              TODOS
                              <span className="opacity-50 text-[8px]">({forumIndicators.length})</span>
                            </button>
                            {(
                              ["calidad", "personas", "coste", "plazo"] as const
                            ).map((type) => {
                              const count = forumIndicators.filter(i => i.typology === type).length;
                              return (
                                <button
                                  key={type}
                                  onClick={() => setSelectedTypology(type)}
                                  className={clsx(
                                    "px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all tracking-wider flex items-center gap-1.5",
                                    selectedTypology === type
                                      ? clsx(
                                          "bg-white border border-gray-100",
                                          type === "calidad" && "text-amber-500",
                                          type === "personas" && "text-purple-500",
                                          type === "coste" && "text-emerald-500",
                                          type === "plazo" && "text-blue-500",
                                        )
                                      : "text-gray-400",
                                  )}
                                >
                                  {type === "calidad" && <Award size={10} />}
                                  {type === "personas" && <Users size={10} />}
                                  {type === "coste" && <Coins size={10} />}
                                  {type === "plazo" && <Clock size={10} />}
                                  {type}
                                  <span className="opacity-50 text-[8px]">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar no-scrollbar-on-mobile">
                          {filteredIndicators.map((indicator) => {
                            const isViewed = viewedIndicatorIds.has(indicator.id);
                            const isActive = selectedIndicatorId === indicator.id;
                            
                            return (
                              <button
                                key={indicator.id}
                                onClick={() => {
                                  setSelectedIndicatorId(indicator.id);
                                  setViewedIndicatorIds(prev => new Set(prev).add(indicator.id));
                                }}
                                className={clsx(
                                  "flex-none w-48 p-3 rounded-2xl border transition-all text-left relative overflow-hidden",
                                  isActive
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : isViewed
                                      ? "bg-gray-50 border-gray-100 text-gray-400"
                                      : "bg-white border-gray-100 text-gray-600",
                                )}
                              >
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  {indicator.typology === 'calidad' && <Award size={10} className={isActive ? "text-white" : "text-amber-500"} />}
                                  {indicator.typology === 'coste' && <Coins size={10} className={isActive ? "text-white" : "text-emerald-500"} />}
                                  {indicator.typology === 'plazo' && <Clock size={10} className={isActive ? "text-white" : "text-blue-500"} />}
                                  {indicator.typology === 'personas' && <Users size={10} className={isActive ? "text-white" : "text-purple-500"} />}
                                  <div className="text-[7px] font-black uppercase tracking-widest opacity-70">
                                    {indicator.typology || 'Indicador'}
                                  </div>
                                  {isViewed && !isActive && <Check size={10} className="ml-auto text-emerald-500" />}
                                </div>
                                <div className="font-bold text-xs truncate leading-tight">
                                  {indicator.name}
                                </div>
                                {indicator.description && (
                                  <div
                                    className={clsx(
                                      "text-[9px] mt-1 truncate opacity-60",
                                      isActive
                                        ? "text-white"
                                        : "text-gray-400",
                                    )}
                                  >
                                    {indicator.description}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          {filteredIndicators.length === 0 && (
                            <p className="text-xs text-gray-400 italic py-2 px-4">
                              {forumIndicators.length === 0
                                ? "No hay indicadores asociados."
                                : "No hay indicadores de esta tipología."}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-1 gap-4 h-[600px]">
                        {/* Left Incidents Panel */}
                        <div className="w-64 md:w-80 bg-white rounded-3xl border border-gray-100 flex flex-col overflow-hidden">
                          <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-2 text-red-600">
                              <AlertTriangle size={18} />
                              <h4 className="font-black uppercase tracking-tighter text-sm">
                                Incidencias
                              </h4>
                            </div>
                            <button
                              onClick={() => {
                                setEditingAction({
                                  assignedTo: [],
                                  assignedToNames: [],
                                  status: "pendiente",
                                  customFields: {},
                                  targetDate: format(new Date(), "yyyy-MM-dd"),
                                  originForumId: forum.id,
                                  originForumName: forum.name,
                                });
                                setTempSubActions([]);
                                setType("incidencia");
                                setIsEscalated(false);
                              }}
                              className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
                              title="Nueva Incidencia"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/20 text-left">
                            {forumIncidents.map((incident) => (
                              <div
                                key={incident.id}
                                onClick={() => {
                                  // We cast to any or Partial<ActionPlan> carefully as editingAction state expects that
                                  setEditingAction({ 
                                    id: incident.id,
                                    title: incident.title,
                                    description: incident.description,
                                    originForumId: incident.forumId,
                                    originForumName: incident.forumName,
                                    companyId: incident.companyId,
                                    createdAt: incident.createdAt
                                  } as any);
                                  setTempSubActions([]);
                                  setType("incidencia");
                                  setIsEscalated(false);
                                  setEscalatedToForumId("");
                                }}
                                className="bg-white p-3 rounded-2xl border border-gray-100 transition-all cursor-pointer group"
                              >
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <h5 className="font-bold text-gray-800 text-[11px] leading-tight group-hover:text-red-600 transition-colors">
                                    {incident.title}
                                  </h5>
                                  <div className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
                                </div>
                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                                  <div className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {(() => {
                                      const d = new Date(incident.createdAt);
                                      return !isNaN(d.getTime()) ? format(d, "dd MMM", { locale: es }) : 'N/A';
                                    })()}
                                  </div>
                                  <div className="flex -space-x-1.5">
                                    <div 
                                      className="w-5 h-5 rounded-full bg-orange-50 border border-white flex items-center justify-center text-[7px] font-black text-orange-600"
                                      title={incident.createdByName}
                                    >
                                      {incident.createdByName?.charAt(0) || '?'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {forumIncidents.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 opacity-40">
                                <CheckCircle2 size={32} className="mb-2" />
                                <p className="text-[10px] font-black uppercase tracking-widest">
                                  Sin incidencias activas
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Central Content Panel */}
                        <div className="flex-1 bg-white rounded-3xl border border-gray-100 overflow-hidden flex flex-col">
                          {selectedIndicator ? (
                            <>
                              <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-white z-10">
                                <div className="text-left">
                                  <h3 className="font-black text-gray-800 uppercase tracking-tighter text-sm">
                                    {selectedIndicator.name}
                                  </h3>
                                  {selectedIndicator.formula && (
                                    <p className="text-[9px] text-gray-400 font-medium">
                                      Fórmula: {selectedIndicator.formula}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedIndicator.link && (
                                    <a
                                      href={selectedIndicator.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-[9px] font-black border border-blue-100"
                                    >
                                      ABRIR CUADRO MANDO{" "}
                                      <LayoutDashboard size={12} />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 w-full bg-gray-50 relative">
                                {selectedIndicator.link ? (
                                  <iframe
                                    src={selectedIndicator.link}
                                    className="w-full h-full border-none"
                                    title={selectedIndicator.name}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-center p-12">
                                    <div className="max-w-xs space-y-4">
                                      <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 flex items-center justify-center mx-auto text-blue-400">
                                        <BarChart3 size={32} />
                                      </div>
                                      <h4 className="font-bold text-gray-800 text-sm">
                                        Visualización no disponible
                                      </h4>
                                      <p className="text-xs text-gray-400">
                                        Este indicador no tiene un enlace de
                                        visualización configurado.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-300 mb-6 rotate-12">
                                <BarChart3 size={40} />
                              </div>
                              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2">
                                Selecciona un indicador
                              </h3>
                              <p className="text-gray-400 max-w-sm text-sm">
                                Usa el panel superior para navegar por los
                                indicadores del foro.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (currentSection.id === "actions") {
                  const DATE_COLUMNS = [
                    { value: 'incidencias', label: 'Incidencias', color: 'text-red-600', bg: 'bg-red-50', icon: <AlertTriangle size={12} /> },
                    { value: 'atrasadas', label: 'Retrasadas', color: 'text-blue-600', bg: 'bg-blue-50', icon: <div className="relative"><Clock size={12} /><span className="absolute -top-1 -right-1 text-[8px] font-bold">-</span></div> },
                    { value: 'hoy', label: 'Hoy', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock size={12} /> },
                    { value: 'proximas', label: 'Próximas', color: 'text-blue-600', bg: 'bg-blue-50', icon: <div className="relative"><Clock size={12} /><span className="absolute -top-1 -right-1 text-[8px] font-bold">+</span></div> },
                    { value: 'escalados', label: 'Escalados', color: 'text-blue-900', bg: 'bg-blue-100', icon: <ArrowUp size={12} /> },
                  ];

                  const getActionDateCategory = (dateStr: string): string => {
                    if (!dateStr) return 'proximas';
                    const targetDate = startOfDay(parseISO(dateStr));
                    const today = startOfDay(new Date());

                    if (isBefore(targetDate, today)) return 'atrasadas';
                    if (isSameDay(targetDate, today)) return 'hoy';
                    return 'proximas';
                  };

                  return (
                    <div className="w-full h-full overflow-hidden flex flex-col gap-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <LayoutDashboard
                            size={20}
                            className="text-blue-600"
                          />
                          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
                            Plan de Acción: {forum.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingAction({
                                assignedTo: [],
                                assignedToNames: [],
                                status: "pendiente",
                                targetDate: format(new Date(), "yyyy-MM-dd"),
                                originForumId: forum.id,
                                originForumName: forum.name,
                                customFields: {}
                              });
                              setTempSubActions([]);
                              setType("accion");
                              setIsEscalated(false);
                            }}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition duration-200 text-xs font-bold"
                          >
                            <Plus size={16} />
                            <span>Nueva Acción</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory min-h-[600px] flex-1">
                        {DATE_COLUMNS.map((col) => {
                          const colItems = col.value === 'incidencias' 
                            ? forumIncidents.filter(i => {
                                if (!i) return false;
                                return i.forumId === forum.id && !i.isEscalated && i.status !== 'en_accion';
                              })
                            : col.value === 'escalados'
                               ? [
                                  ...actions.filter(a => {
                                    if (!a) return false;
                                    const ownerId = a.isEscalated && a.escalatedToForumId ? a.escalatedToForumId : (a.escalationHistory?.length ? a.escalationHistory[a.escalationHistory.length - 1].toForumId : (a.originForumId || (a as any).forumId));
                                    const isOwner = ownerId === forum.id;
                                    
                                    // Should it be in "Escalados" for this forum?
                                    // 1. We are NOT the owner but we are the origin or in history (we sent it away)
                                    const isOrigin = (a.originForumId || (a as any).forumId) === forum.id;
                                    const isInHistory = a.escalationHistory?.some((h: any) => h.fromForumId === forum.id);
                                    if (!isOwner && (isOrigin || isInHistory)) return true;
                                    
                                    // 2. We ARE the owner and it is currently escalated but has no date (incoming)
                                    if (isOwner && a.isEscalated && !a.targetDate) return true;
                                    
                                    return false;
                                  }),
                                  ...forumIncidents.filter(i => {
                                    if (!i) return false;
                                    const ownerId = i.isEscalated && i.escalatedToForumId ? i.escalatedToForumId : (i.escalationHistory?.length ? i.escalationHistory[i.escalationHistory.length - 1].toForumId : i.forumId);
                                    const isOwner = ownerId === forum.id;

                                    // 1. We are NOT the owner but we are the origin or in history
                                    const isOrigin = i.forumId === forum.id;
                                    const isInHistory = i.escalationHistory?.some((h: any) => h.fromForumId === forum.id);
                                    if (!isOwner && (isOrigin || isInHistory)) return true;

                                    // 2. We ARE the owner and it is currently escalated and not yet converted to action
                                    if (isOwner && i.isEscalated && i.status !== 'en_accion') return true;

                                    return false;
                                  })
                                ]
                              : actions.filter(a => {
                                  if (!a) return false;
                                  
                                  const ownerId = a.isEscalated && a.escalatedToForumId ? a.escalatedToForumId : (a.escalationHistory?.length ? a.escalationHistory[a.escalationHistory.length - 1].toForumId : (a.originForumId || (a as any).forumId));
                                  const isOwner = ownerId === forum.id;
                                  
                                  // In date columns, we ONLY show it if we are the current owner
                                  // AND (it's not escalated OR it has a date if it is escalated)
                                  if (!isOwner) return false;
                                  
                                  // If we are owner, and it's escalated, it MUST have a date to show in date columns
                                  // (otherwise it stays in "Escalados")
                                  if (a.isEscalated && !a.targetDate) return false;

                                  return a.status !== 'finalizada' && 
                                         getActionDateCategory(a.targetDate) === col.value;
                                });

                          return (
                            <div
                              key={col.value}
                              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.value); }}
                              onDragLeave={() => setDragOverColumn(null)}
                              onDrop={(e) => handleDropOnColumn(e, col.value)}
                              className={clsx(
                                "flex-none w-[85vw] sm:w-[250px] lg:flex-1 lg:min-w-0 rounded-2xl border flex flex-col snap-start overflow-hidden transition-all duration-200",
                                dragOverColumn === col.value 
                                  ? "bg-blue-50/50 border-blue-400 border-2" 
                                  : "bg-white border-gray-100"
                              )}
                            >
                              <div className={clsx("p-3 border-b flex items-center justify-between sticky top-0 z-10", col.bg)}>
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <span className={col.color}>{col.icon}</span>
                                  <h4 className={clsx("font-black uppercase tracking-tighter text-[10px] truncate", col.color)}>
                                    {col.label}
                                  </h4>
                                </div>
                                <span className="bg-white/50 text-gray-500 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-gray-100">
                                  {colItems.length}
                                </span>
                              </div>
                              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-gray-50/30">
                                {colItems.map((item: any) => {
                                  if (!item) return null;
                                  const isIncident = 'indicatorId' in item;
                                  const action = item as ActionPlan;
                                  const incident = item as Incident;

                                  const itemOwnerId = item.isEscalated && item.escalatedToForumId ? item.escalatedToForumId : (item.escalationHistory?.length ? item.escalationHistory[item.escalationHistory.length - 1].toForumId : (item.originForumId || (item as any).forumId));
                                  const isItemOwner = itemOwnerId === forum?.id;

                                  // Direction indicators
                                  const isComingFromBelow = isItemOwner && (item.originForumId || (item as any).forumId) !== forum?.id;
                                  const isGoingToAbove = !isItemOwner;

                                  if (isIncident) {
                                    return (
                                      <div
                                        key={incident.id}
                                        draggable={!isGoingToAbove}
                                        onDragStart={(e) => {
                                          if (isGoingToAbove) return;
                                          e.dataTransfer.setData("application/json", JSON.stringify({ type: 'incidencia', id: incident.id }));
                                          setDragOverId(incident.id || null);
                                        }}
                                        onDragEnd={() => setDragOverId(null)}
                                        onClick={() => {
                                          setEditingAction({ ...incident } as any);
                                          setTempSubActions([]);
                                          setType("incidencia");
                                          setIsEscalated(false);
                                          setEscalatedToForumId(incident.escalatedToForumId || "");
                                        }}
                                        className={clsx(
                                          "bg-white rounded-xl border border-red-100 transition-all group shadow-sm active:scale-95 relative overflow-hidden",
                                          isGoingToAbove ? "cursor-pointer shadow-none" : "hover:border-red-300 cursor-pointer"
                                        )}
      >
                                        {incident.viewedUpdates?.[forum?.id || ''] === false && (
                                          <motion.div 
                                            animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute top-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md z-30"
                                            title="Actualizado"
                                          />
                                        )}
                                        <div className={clsx(
                                          "p-2.5 transition-all duration-200",
                                          isGoingToAbove && "opacity-50 grayscale-[0.5]"
                                        )}>
                                          <div className="flex justify-between items-start gap-1 mb-1.5">
                                          <div className="flex gap-1 items-start">
                                            {isComingFromBelow && (
                                              <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0 transform rotate-180" />
                                            )}
                                            {isGoingToAbove && (
                                              <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                            )}
                                            <h5 className="font-bold text-gray-800 text-[10px] leading-tight group-hover:text-red-600 transition-colors line-clamp-2">
                                              {incident.title}
                                            </h5>
                                          </div>
                                          <div className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                          <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-gray-400">
                                            <Clock size={9} />
                                            {(() => {
                                              const d = new Date(incident.createdAt);
                                              return !isNaN(d.getTime()) ? format(d, "dd MMM", { locale: es }) : 'N/A';
                                            })()}
                                          </div>
                                          <span className="text-[7px] font-black text-red-600 bg-red-50 px-1 py-0.5 rounded uppercase">Incid.</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                  }

                                  const actionSubActions = subActions.filter(s => s.actionId === action.id);
                                  const completedSubActions = actionSubActions.filter(s => s.completed).length;
                                  const progress = actionSubActions.length > 0 ? Math.round((completedSubActions / actionSubActions.length) * 100) : null;
                                  const linkedIncident = incidents.find(inc => inc.id === action.incidentId);

                                  return (
                                    <div
                                      key={action.id}
                                      draggable={!isGoingToAbove}
                                      onDragStart={(e) => {
                                        if (isGoingToAbove) return;
                                        e.dataTransfer.setData("application/json", JSON.stringify({ type: 'accion', id: action.id }));
                                        setDragOverId(action.id);
                                      }}
                                      onDragEnd={() => setDragOverId(null)}
                                      onClick={() => {
                                        setEditingAction({ ...action });
                                        setTempSubActions(subActions.filter(s => s.actionId === action.id));
                                        setType(action.type || "accion");
                                        setIsEscalated(false);
                                        setEscalatedToForumId(action.escalatedToForumId || "");
                                      }}
                                      className={clsx(
                                        "bg-white rounded-xl border border-gray-100 transition-all group shadow-sm active:scale-95 relative overflow-hidden",
                                        isGoingToAbove ? "cursor-pointer shadow-none" : "hover:border-blue-200 cursor-pointer"
                                      )}
                                    >
                                      {action.viewedUpdates?.[forum?.id || ''] === false && (
                                        <motion.div 
                                          animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }}
                                          transition={{ duration: 1.5, repeat: Infinity }}
                                          className="absolute top-1.5 right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md z-30"
                                          title="Actualizado"
                                        />
                                      )}
                                      <div className={clsx(
                                        "p-2.5 transition-all duration-200 flex flex-col gap-2",
                                        isGoingToAbove && "opacity-50 grayscale-[0.5]"
                                      )}>
                                        <div className="flex justify-between items-start gap-1">
                                          <div className="flex gap-1 items-start">
                                            {isComingFromBelow && (
                                              <ArrowUp className="w-3.5 h-3.5 text-blue-500 shrink-0 transform rotate-180" />
                                            )}
                                            {isGoingToAbove && (
                                              <ArrowUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                            )}
                                            <h5 className="font-bold text-gray-800 text-[10px] leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                              {action.title}
                                              {action.incidentId && (
                                                <AlertCircle size={10} className="inline-block ml-1 text-red-500" />
                                              )}
                                            </h5>
                                          </div>
                                          {isGoingToAbove && action.escalatedToForumId && (
                                            <div className="px-1.5 py-0.5 bg-orange-50 rounded border border-orange-100 flex items-center gap-1 mt-1">
                                              <span className="text-[7px] font-black text-orange-700 uppercase">Destino: {forums.find(f => f.id === action.escalatedToForumId)?.name || 'Foro Superior'}</span>
                                            </div>
                                          )}
                                        </div>

                                        {linkedIncident && (
                                          <div className="p-2 bg-red-50/50 rounded-lg border border-red-100 flex flex-col gap-1">
                                             <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-red-600 uppercase">Origen: Incidencia</span>
                                             </div>
                                             <p className="text-[10px] text-red-800 line-clamp-1 font-medium italic opacity-70">"{linkedIncident.title}"</p>
                                          </div>
                                        )}

                                        {progress !== null && (
                                          <div>
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="text-[8px] font-bold text-gray-400">Progreso</span>
                                              <span className="text-[8px] font-bold text-blue-600">{progress}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                                            </div>
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2 border-t border-gray-50 pt-2 shrink-0">
                                          <div className="flex -space-x-2">
                                            {action.assignedToNames?.slice(0, 2).map((name, i) => (
                                              <div key={i} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-blue-600" title={name}>
                                                {name.charAt(0)}
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                            <Calendar size={10} />
                                            {(() => {
                                              const d = new Date(action.targetDate);
                                              return !isNaN(d.getTime()) ? format(d, "dd MMM", { locale: es }) : 'N/A';
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {colItems.length === 0 && (
                                  <div className="flex flex-col items-center justify-center py-10 opacity-20 text-center">
                                    <CheckCircle2 size={32} className="text-gray-400" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Al día</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }


                // Default view for other sections
                return (
                  <div className="max-w-4xl mx-auto w-full bg-white rounded-[40px] border border-gray-100 overflow-hidden p-12 md:p-20 text-center">
                    <div className="space-y-8">
                      <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2">
                        Punto {effectiveSectionIndex} de {steps.length - 1}
                      </div>

                      <h3 className="text-5xl font-black text-gray-800 uppercase tracking-tighter leading-tight">
                        {steps[effectiveSectionIndex]}
                      </h3>

                      <div className="pt-12">
                        <div className="p-16 border-2 border-dashed border-gray-50 rounded-[48px] flex flex-col items-center gap-6">
                          <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center text-gray-200">
                            <MessageSquare size={48} />
                          </div>
                          <p className="text-gray-400 italic text-xl font-medium max-w-md">
                            Este espacio se completará con las herramientas
                            específicas para: <br />
                            <strong className="text-gray-600 not-italic uppercase tracking-tight">
                              {steps[effectiveSectionIndex]}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="Añadir Asistente Extraordinario"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
            {users
              .filter(
                (u) =>
                  (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase())) &&
                  !session.attendees.some((a) => a.uid === u.uid),
              )
              .slice(0, 10)
              .map((u) => (
                <button
                  key={u.uid}
                  onClick={() => addExternalAttendee(u)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    {u.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <Plus size={18} className="ml-auto text-blue-400" />
                </button>
              ))}
            {userSearch &&
              users.filter(
                (u) =>
                  (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase())) &&
                  !session.attendees.some((a) => a.uid === u.uid),
              ).length === 0 && (
                <p className="text-center py-8 text-gray-400 text-sm italic">
                  No se encontraron más usuarios
                </p>
              )}
            {!userSearch && (
              <p className="text-center py-8 text-gray-300 text-xs font-bold uppercase tracking-widest">
                Busca un usuario para añadirlo
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Action Modal Copy from ActionPlan.tsx for consistency */}
      <Modal
        isOpen={!!editingAction}
        onClose={handleCloseModal}
        title={
          <div className="flex items-center gap-6">
            <span>{editingAction?.id ? (type === 'incidencia' ? 'Editar Incidencia' : 'Editar Acción') : (type === 'incidencia' ? 'Nueva Incidencia' : 'Nueva Acción')}</span>
            {!editingAction?.id && (
              <div className="flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 h-[32px] w-[200px]">
                <button
                  type="button"
                  onClick={() => setType('accion')}
                  className={clsx(
                    "flex-1 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all",
                    type === 'accion' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Acción
                </button>
                <button
                  type="button"
                  onClick={() => setType('incidencia')}
                  className={clsx(
                    "flex-1 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all",
                    type === 'incidencia' ? "bg-white text-orange-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  Incidencia
                </button>
              </div>
            )}
          </div>
        }
        maxWidth="max-w-5xl"
      >
        {(() => {
          if (!editingAction) return null;
          
          const ownerId = (editingAction as any)?.isEscalated && (editingAction as any)?.escalatedToForumId 
            ? (editingAction as any).escalatedToForumId 
            : ((editingAction as any)?.escalationHistory?.length 
                ? (editingAction as any).escalationHistory[(editingAction as any).escalationHistory.length - 1].toForumId 
                : ((editingAction as any)?.originForumId || (editingAction as any)?.forumId));
          
          const isReadOnly = isAdmin ? false : (ownerId !== forum?.id);
          return (
            <form
              onSubmit={(e) => {
                if (isReadOnly) {
                  e.preventDefault();
                  setEditingAction(null);
                  return;
                }
                handleSaveAction(e);
              }}
              className="flex flex-col max-h-[85vh]"
            >
              <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                {isReadOnly && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      <ArrowUp size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase tracking-tight">Modo Lectura</p>
                      <p className="text-[10px] text-blue-600 font-medium">Esta acción ha sido escalada y no puede modificarse en este foro.</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  <div className="lg:col-span-3 space-y-6">
                    {(() => {
                        const renderLabel = (text: string, fieldName: string) => {
                            const isModified = editingAction?.modifiedFields?.includes(fieldName);
                            // Show mark if this forum has an unread update for this field
                            const showMark = isModified && (editingAction as any)?.viewedUpdates?.[forum?.id || ''] === false;
                            
                            return (
                                <div className="flex items-center gap-2 mb-2">
                                <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                                    {text}
                                </label>
                                {showMark && (
                                    <motion.div 
                                    animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                                    />
                                )}
                                </div>
                            );
                        };
                        return (
                            <>
                            <div>
                              {renderLabel(type === 'incidencia' ? 'Título de la Incidencia' : 'Título de la Acción', 'title')}
                              <input
                                type="text"
                                required
                        readOnly={isReadOnly}
                        value={editingAction?.title || ""}
                        onChange={(e) =>
                          setEditingAction({
                            ...editingAction,
                            title: e.target.value,
                          })
                        }
                        className={clsx(
                          "w-full px-4 py-3 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium",
                          isReadOnly ? "bg-gray-100 cursor-default" : "bg-gray-50"
                        )}
                        placeholder={type === 'incidencia' ? '¿Qué ha pasado?' : "¿Qué hay que hacer?"}
                      />
                    </div>
                                 {type === 'accion' && (
                  <div className="relative space-y-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                      Incidencia vinculada
                    </label>
                    <div className={clsx(
                      "w-full px-4 py-3 bg-gray-50 border-none rounded-2xl flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 transition-all",
                      isReadOnly ? "cursor-default opacity-60" : "hover:bg-gray-100 transition-colors"
                    )}
                    onClick={() => !isReadOnly && setShowIncidentSelector(!showIncidentSelector)}
                    >
                      <span className={clsx("text-sm font-medium", !editingAction?.incidentId && "text-gray-400 text-xs italic")}>
                        {editingAction?.incidentId 
                          ? incidents.find(i => i.id === editingAction.incidentId)?.title || "Incidencia no encontrada"
                          : "Ninguna"
                        }
                      </span>
                      {!isReadOnly && <Search size={16} className="text-gray-400" />}
                    </div>

                    {showIncidentSelector && !isReadOnly && (
                      <>
                        <div 
                          className="fixed inset-0 z-20" 
                          onClick={() => setShowIncidentSelector(false)}
                        />
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-3xl shadow-2xl z-30 flex flex-col max-h-80 overflow-hidden animate-in fade-in slide-in-from-top-2">
                          <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Buscar incidencia..."
                                value={incidentSearchQuery}
                                onChange={(e) => setIncidentSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-100 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                              />
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAction({ ...editingAction, incidentId: "" });
                                setShowIncidentSelector(false);
                                setIncidentSearchQuery("");
                              }}
                              className="w-full text-left px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-gray-400 hover:bg-gray-50 rounded-xl transition-colors flex items-center gap-2"
                            >
                              <X size={12} />
                              Ninguna
                            </button>
                            {incidents
                              .filter(i => 
                                (i.forumId === forum?.id || 
                                i.escalatedToForumId === forum?.id || 
                                i.escalationHistory?.some((h: any) => h.fromForumId === forum?.id)) &&
                                i.title.toLowerCase().includes(incidentSearchQuery.toLowerCase())
                              )
                              .map((i) => (
                                <button
                                  key={i.id}
                                  type="button"
                                  onClick={() => {
                                    setEditingAction({ ...editingAction, incidentId: i.id });
                                    setShowIncidentSelector(false);
                                    setIncidentSearchQuery("");
                                  }}
                                  className={clsx(
                                    "w-full text-left px-4 py-2.5 rounded-2xl transition-all group",
                                    editingAction?.incidentId === i.id 
                                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                                      : "text-gray-700 hover:bg-blue-50"
                                  )}
                                >
                                  <div className="text-[11px] font-black uppercase tracking-tight truncate leading-tight">{i.title}</div>
                                  <div className={clsx(
                                    "text-[9px] font-bold uppercase tracking-widest mt-0.5",
                                    editingAction?.incidentId === i.id ? "text-blue-100" : "text-gray-400"
                                  )}>
                                    Estado: {i.status || 'abierta'}
                                  </div>
                                </button>
                              ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {type === 'accion' && editingAction?.incidentId && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-red-600" size={20} />
                      <div>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Esta acción proviene de una incidencia</p>
                        <p className="text-sm font-bold text-red-800">{incidents.find(i => i.id === editingAction.incidentId)?.title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const inc = incidents.find(i => i.id === editingAction.incidentId);
                        if (inc) {
                          if (editingAction.id) {
                            setBackToActionId(editingAction.id);
                          }
                          setEditingAction(inc as any);
                          setType('incidencia');
                        }
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shrink-0"
                    >
                      Ver Incidencia
                    </button>
                  </div>
                )}

                {type === 'incidencia' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                        Fecha de Creación
                      </label>
                    </div>
                    <input
                      type="date"
                      required
                      readOnly={isReadOnly}
                      value={(() => {
                        if (!editingAction?.createdAt) return new Date().toISOString().split('T')[0];
                        const d = new Date(editingAction.createdAt);
                        return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                      })()}
                      onChange={(e) => {
                        if (editingAction) {
                          const d = new Date(e.target.value);
                          if (!isNaN(d.getTime())) {
                            setEditingAction({ ...editingAction, createdAt: d.toISOString() });
                          }
                        }
                      }}
                      className={clsx(
                        "w-full px-4 py-3 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium",
                        isReadOnly ? "bg-gray-100 cursor-default" : "bg-gray-50"
                      )}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Foro (Origen)
                  </label>
                  <select
                    value={editingAction?.originForumId || ""}
                    disabled={!!forum || isReadOnly}
                    onChange={(e) =>
                      setEditingAction({
                        ...editingAction,
                        originForumId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium disabled:opacity-60"
                  >
                    <option value="">Seleccionar foro...</option>
                    {forums.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.teamName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                      Descripción / Contexto
                    </label>
                    {editingAction?.originForumId === forum?.id && editingAction?.modifiedFields?.includes('description') && (editingAction as any)?.viewedUpdates?.[forum?.id || ''] === false && (
                      <motion.div 
                         animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                         transition={{ duration: 1.5, repeat: Infinity }}
                         className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                      />
                    )}
                  </div>
                  <textarea
                    value={editingAction?.description || ""}
                    readOnly={isReadOnly}
                    onChange={(e) =>
                      setEditingAction({
                        ...editingAction,
                        description: e.target.value,
                      })
                    }
                    className={clsx(
                      "w-full px-4 py-3 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium h-32 resize-none",
                      isReadOnly ? "bg-gray-100 cursor-default" : "bg-gray-50"
                    )}
                    placeholder="Detalles adicionales..."
                  />
                </div>

                {type !== "incidencia" && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                        Sub-acciones ({tempSubActions?.length || 0})
                      </label>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={addTempSubAction}
                          className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-tighter bg-blue-50 px-3 py-1 rounded-full"
                        >
                          + Añadir Paso
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {tempSubActions.map((sub, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group transition-all hover:bg-white border border-transparent hover:border-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={sub.completed}
                            disabled={isReadOnly}
                            onChange={(e) =>
                              handleSubActionChange(
                                idx,
                                "completed",
                                e.target.checked,
                              )
                            }
                            className="w-4 h-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={sub.title || ""}
                            readOnly={isReadOnly}
                            onChange={(e) =>
                              handleSubActionChange(idx, "title", e.target.value)
                            }
                            className={clsx(
                              "flex-1 bg-transparent border-none text-sm font-medium focus:ring-0 placeholder:text-gray-300 h-8",
                              isReadOnly && "cursor-default"
                            )}
                            placeholder="Paso a seguir..."
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-gray-400" />
                              <input
                                type="date"
                                value={sub.currentProposedDate || ""}
                                disabled={isReadOnly}
                                onChange={(e) =>
                                  handleSubActionChange(
                                    idx,
                                    "currentProposedDate",
                                    e.target.value,
                                  )
                                }
                                className={clsx(
                                  "bg-white/50 border-none rounded-lg px-2 py-1 text-[10px] text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none",
                                  isReadOnly && "opacity-50 cursor-not-allowed"
                                )}
                              />
                            </div>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => removeTempSubAction(idx)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {(tempSubActions?.length || 0) === 0 && (
                        <div className="p-8 border-2 border-dashed border-gray-100 rounded-2xl text-center opacity-40">
                          <CheckCircle2
                            size={32}
                            className="mx-auto text-gray-400 mb-2"
                          />
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                            Sin pasos definidos
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                            </>
                        );
                    })()}
              </div>

              <div className="lg:col-span-2 space-y-6">
                {type !== "incidencia" ? (
                  <>
                    <div className="relative">
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                        Responsables
                      </label>
                      {editingAction?.originForumId === forum?.id && editingAction?.modifiedFields?.includes('assignedTo') && (editingAction as any)?.viewedUpdates?.[forum?.id || ''] === false && (
                        <motion.div 
                           animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                           transition={{ duration: 1.5, repeat: Infinity }}
                           className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                        />
                      )}
                    </div>
                  <div className="bg-gray-50 p-3 rounded-2xl flex flex-wrap gap-2 min-h-[50px] items-center">
                    {(editingAction?.assignedTo || []).map((uid) => {
                      const user = users.find((u) => u.uid === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-gray-100 text-[10px] font-bold text-blue-900"
                        >
                          {user?.name || "Cargando..."}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                const newAssigned = (
                                  editingAction?.assignedTo || []
                                ).filter((id) => id !== uid);
                                setEditingAction({
                                  ...editingAction,
                                  assignedTo: newAssigned,
                                });
                              }}
                              className="hover:text-blue-900"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setShowUserSelector(!showUserSelector)}
                        className="flex-1 text-left px-2 text-xs text-gray-400 font-medium min-w-[120px]"
                      >
                        {!editingAction?.assignedTo ||
                        editingAction.assignedTo.length === 0
                          ? "Seleccionar personas..."
                          : "Añadir más..."}
                      </button>
                    )}
                  </div>

                  {showUserSelector && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowUserSelector(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl z-30 flex flex-col max-h-80">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <Search
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Buscar por nombre..."
                              value={userSearchQuery}
                              onChange={(e) =>
                                setUserSearchQuery(e.target.value)
                              }
                              className="w-full pl-8 pr-4 py-2 bg-gray-50 border-none rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-1">
                          {users
                            .filter((u) => {
                              const matchesSearch = u.name
                                .toLowerCase()
                                .includes(userSearchQuery.toLowerCase());
                              
                              // Filter by attendees if in a session
                              if (session?.attendees) {
                                return matchesSearch && session.attendees.some(att => att.uid === u.uid);
                              }
                              
                              return matchesSearch;
                            })
                            .slice(0, 15)
                            .map((u) => {
                              const isSelected =
                                editingAction?.assignedTo?.includes(u.uid);
                              return (
                                <button
                                  key={u.uid}
                                  type="button"
                                  onClick={() => {
                                    const current =
                                      editingAction?.assignedTo || [];
                                    if (isSelected) {
                                      setEditingAction({
                                        ...editingAction,
                                        assignedTo: current.filter(
                                          (uid) => uid !== u.uid,
                                        ),
                                      });
                                    } else {
                                      setEditingAction({
                                        ...editingAction,
                                        assignedTo: [...current, u.uid],
                                      });
                                    }
                                  }}
                                  className={clsx(
                                    "w-full text-left px-4 py-2 rounded-lg text-xs font-medium transition-colors mb-0.5",
                                    isSelected
                                      ? "bg-blue-50 text-blue-700"
                                      : "hover:bg-gray-50 text-gray-600",
                                  )}
                                >
                                  {u.name}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                          Fecha Límite
                        </label>
                        {editingAction?.originForumId === forum?.id && editingAction?.modifiedFields?.includes('targetDate') && (editingAction as any)?.viewedUpdates?.[forum?.id || ''] === false && (
                          <motion.div 
                             animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                             transition={{ duration: 1.5, repeat: Infinity }}
                             className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                          />
                        )}
                      </div>
                      <div className="relative">
                        <Calendar
                          size={14}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="date"
                          required
                          disabled={isReadOnly}
                          value={editingAction?.targetDate || ""}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            const newStatus = calculateAutomaticStatus(
                              newDate,
                              editingAction?.status || "pendiente",
                            );
                            setEditingAction({
                              ...editingAction,
                              targetDate: newDate,
                              status: newStatus,
                            });
                          }}
                          className={clsx(
                            "w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium",
                            isReadOnly && "opacity-50 cursor-not-allowed"
                          )}
                        />
                      </div>
                    </div>
                    {type === "accion" && (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                          Prioridad
                        </label>
                        <select
                          value={(editingAction as any)?.priority || "media"}
                          disabled={isReadOnly}
                          onChange={(e) =>
                            setEditingAction({
                              ...editingAction,
                              priority: e.target.value as any,
                            })
                          }
                          className={clsx(
                            "w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium appearance-none",
                            isReadOnly && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                          <option value="critica">Crítica</option>
                        </select>
                      </div>
                    )}
                    {type === "accion" && categories.filter(c => c.active).map(cat => (
                      <div key={cat.id}>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                          {cat.name}
                        </label>
                        <select
                          value={editingAction?.customFields?.[cat.id] || ""}
                          disabled={isReadOnly}
                          onChange={(e) => {
                            setEditingAction({
                              ...editingAction,
                              customFields: {
                                ...(editingAction.customFields || {}),
                                [cat.id]: e.target.value
                              }
                            });
                          }}
                          className={clsx(
                            "w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium appearance-none",
                            isReadOnly && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <option value="">Seleccionar...</option>
                          {cat.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                      Indicador del que se genera
                    </label>
                    <select
                      value={(editingAction as any)?.indicatorId || ""}
                      disabled={isReadOnly}
                      onChange={(e) => editingAction && setEditingAction({ ...editingAction, indicatorId: e.target.value } as any)}
                      className={clsx(
                        "w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium",
                        isReadOnly && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <option value="">Seleccionar indicador...</option>
                      {indicators.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Archivos / Adjuntos
                  </label>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer group">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-gray-400 group-hover:text-blue-500 transition-colors">
                      <Plus size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-900 uppercase">
                        Añadir evidencias
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                        PDF, PNG, JPG, DOC (Máx 10MB)
                      </p>
                    </div>
                  </div>
                </div>

                {editingAction?.escalationHistory && editingAction.escalationHistory.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-gray-400" />
                      <span className="text-[10px] font-black text-gray-700 uppercase">Historial de Escalados</span>
                    </div>
                    <div className="space-y-3">
                      {editingAction.escalationHistory.map((h: any, i: number) => (
                        <div key={i} className="flex flex-col gap-1 border-l-2 border-blue-200 pl-3 py-1">
                           <p className="text-[10px] font-bold text-gray-600">De <span className="text-blue-600">{h.fromForumName}</span> a <span className="text-indigo-600">{h.toForumName}</span></p>
                           <div className="flex justify-between items-center text-[8px] font-black uppercase text-gray-400">
                              <span>{h.byName}</span>
                              <span>{(() => {
                                if (!h.at) return 'N/A';
                                const d = new Date(h.at);
                                return !isNaN(d.getTime()) ? format(d, 'dd MMM HH:mm', { locale: es }) : 'N/A';
                              })()}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-orange-600" />
                      <span className="text-[10px] font-black text-orange-900 uppercase">
                        {type === 'incidencia' ? 'Escalar Incidencia' : 'Escalar Acción'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setIsEscalated(!isEscalated)}
                      className={clsx(
                        "w-10 h-5 rounded-full relative transition-all duration-300",
                        isEscalated ? "bg-orange-600" : "bg-gray-200",
                        isReadOnly && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div
                        className={clsx(
                          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
                          isEscalated ? "left-6" : "left-1",
                        )}
                      />
                    </button>
                  </div>
                  {isEscalated && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <p className="text-[10px] text-orange-700 leading-tight">
                        {isReadOnly ? "Esta acción ha sido escalada al siguiente foro." : "Este elemento será notificado al foro superior seleccionado."}
                      </p>
                      <select
                        required={isEscalated}
                        disabled={isReadOnly}
                        value={isReadOnly ? (editingAction as any).escalatedToForumId : escalatedToForumId}
                        onChange={(e) => setEscalatedToForumId(e.target.value)}
                        className={clsx(
                          "w-full px-3 py-2 bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-[10px] font-bold",
                          isReadOnly && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <option value="">Seleccionar foro superior...</option>
                        {forums
                          .filter((f) => {
                            if (f.id === forum?.id || !forum) return false;
                            
                            const parentTeamChain = getTeamParentChain(forum.teamId);
                            const targetTeamIndex = parentTeamChain.indexOf(f.teamId);
                            const maxLevels = Number(company?.settings?.maxEscalationLevels || 1);
                            
                            return targetTeamIndex !== -1 && (targetTeamIndex + 1) <= maxLevels;
                          })
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 p-2">
            {!isReadOnly &&
              editingAction?.id &&
              (editingAction as any).status !== "finalizada" &&
              (editingAction as any).status !== "resuelta" &&
              editingAction.status !== "cancelada" && (
                <button
                  type="button"
                  onClick={handleFinalizeAction}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all font-black text-xs uppercase tracking-widest ml-auto"
                >
                  <CheckCircle2 size={16} />
                  Finalizar
                </button>
              )}
            {!isReadOnly && editingAction?.id && editingAction.status !== "cancelada" && (
              <button
                type="button"
                onClick={handleCancelAction}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all font-black text-xs uppercase tracking-widest"
              >
                <XCircle size={16} />
                Cancelar Acción
              </button>
            )}
            <div className={clsx("flex gap-3", (!editingAction?.id || isReadOnly) && "w-full")}>
              <button
                type="button"
                onClick={handleCloseModal}
                className={clsx(
                  "px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-100 rounded-2xl transition-all",
                  (!editingAction?.id || isReadOnly) && "flex-1",
                )}
              >
                Cerrar
              </button>
              {!isReadOnly && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className={clsx(
                    "px-10 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50",
                    !editingAction?.id && "flex-1",
                  )}
                >
                  {editingAction?.id ? "Guardar Cambios" : (type === 'incidencia' ? "Crear Incidencia" : "Crear Acción")}
                </button>
              )}
            </div>
          </div>
        </form>
        );
      })()}
    </Modal>
    </div>
  );
}
