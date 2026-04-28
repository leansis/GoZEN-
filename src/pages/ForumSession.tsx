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
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useAppData } from "../contexts/AppDataContext";
import { db } from "../firebase";
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
import { motion, AnimatePresence } from "motion/react";
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
    <div className="flex items-center w-full overflow-hidden rounded-xl border border-gray-100 bg-white mb-3">
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
              "relative flex-1 py-1.5 px-4 text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 min-w-0 transition-all duration-300",
              isCurrent
                ? "bg-blue-600 text-white z-10"
                : isCompleted
                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  : "bg-white text-gray-400 hover:bg-gray-50",
              !canClick && "cursor-default",
            )}
            style={{
              clipPath: isLast
                ? "polygon(10px 0%, 100% 0%, 100% 100%, 10px 100%, 0% 50%)"
                : idx === 0
                  ? "polygon(0% 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 0% 100%)"
                  : "polygon(0% 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 0% 100%, 10px 50%)",
              marginLeft: idx === 0 ? "0" : "-10px",
              paddingLeft: idx === 0 ? "12px" : "22px",
              flexBasis: isCurrent ? "20%" : "auto",
            }}
          >
            <span className="truncate">
              {isCompleted && (
                <Check size={10} className="inline mr-1 shrink-0" />
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
  const { dbUser, activeCompanyId } = useAuth();
  const { forums, users, indicators } = useAppData();

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
  const [error, setError] = useState<string | null>(null);
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      // Filter by forum association (origin or escalated)
      const forumActions = allActions.filter(
        (a) =>
          a.originForumId === forum.id || a.escalatedToForumId === forum.id,
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

    return () => {
      unsubscribeActions();
      unsubscribeSubActions();
      unsubscribeCategories();
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
    return actions.filter(
      (a) =>
        a.type === "incidencia" &&
        a.status !== "finalizada" &&
        a.status !== "cancelada",
    );
  }, [actions]);

  const effectiveSectionIndex =
    localSectionIndex ?? session?.currentSectionIndex ?? 0;

  const isFuture = useMemo(() => {
    if (!session) return false;
    const today = format(new Date(), "yyyy-MM-dd");
    const sessionDate = session.scheduledAt.split("T")[0];
    return sessionDate > today;
  }, [session]);

  useEffect(() => {
    if (forumIndicators.length > 0 && !selectedIndicatorId) {
      setSelectedIndicatorId(forumIndicators[0].id);
    }
  }, [forumIndicators]);

  const handleFinalizeAction = async () => {
    if (!editingAction?.id || !dbUser) return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, "actionPlans", editingAction.id), {
        status: "finalizada",
        updatedAt: new Date().toISOString(),
      });
      setEditingAction(null);
    } catch (err) {
      console.error("Error finalizing action:", err);
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
      !editingAction.targetDate
    )
      return;

    try {
      setIsSaving(true);
      const companyId = activeCompanyId || dbUser.companyId;
      const now = new Date().toISOString();

      const autoStatus = calculateAutomaticStatus(
        editingAction.targetDate,
        editingAction.status || "pendiente",
      );

      const actionPayload: any = {
        title: editingAction.title,
        description: editingAction.description || "",
        type: type,
        status: autoStatus,
        priority: editingAction.priority || "media",
        categoryId: editingAction.categoryId || "",
        categoryName:
          categories.find((c) => c.id === editingAction.categoryId)?.name || "",
        targetDate: editingAction.targetDate,
        dateChangeCount: editingAction.dateChangeCount || 0,
        notes: editingAction.notes || "",
        companyId: companyId,
        updatedAt: now,
        assignedTo: editingAction.assignedTo || [],
        assignedToNames: (editingAction.assignedTo || []).map(
          (uid) => users.find((u) => u.uid === uid)?.name || "Desconocido",
        ),
        isEscalated: isEscalated,
        escalatedToForumId: escalatedToForumId || "",
        originForumId: forum?.id || "",
        originForumName: forum?.name || "",
      };

      if (isEscalated && !editingAction.isEscalated) {
        actionPayload.escalatedBy = dbUser.uid;
        actionPayload.escalatedByName = dbUser.name;
        actionPayload.escalatedAt = now;
      }

      let actionId = editingAction.id;

      if (editingAction.id) {
        await updateDoc(
          doc(db, "actionPlans", editingAction.id),
          actionPayload,
        );
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

    const today = format(new Date(), "yyyy-MM-dd");
    const sessionDate = session.scheduledAt.split("T")[0];

    if (sessionDate > today) {
      // Preparation mode
      setIsPreparationMode(true);
      setLocalSectionIndex(1); // Jump to first real section
      return;
    }

    try {
      await updateDoc(doc(db, "forumSessions", session.id), {
        status: "in_progress",
        startedAt: new Date().toISOString(),
        currentSectionIndex: 0,
      });
      setLocalSectionIndex(0);
    } catch (err) {
      console.error("Error starting session:", err);
    }
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
    <div className="max-w-7xl mx-auto h-screen flex flex-col overflow-hidden bg-gray-50/20 px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 shrink-0 pt-2 pb-1">
        <div>
          <button
            onClick={() => navigate("/forums")}
            className="flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors text-[8px] font-black uppercase tracking-widest"
          >
            <ChevronLeft size={10} />
            Volver
          </button>
          <div className="flex items-center gap-1.5 mt-0">
            <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded-md flex items-center justify-center">
              <MessageSquare size={12} />
            </div>
            <h1 className="text-base font-black text-gray-800 uppercase tracking-tight">
              {forum.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.status === "in_progress" && (
            <div
              className={clsx(
                "flex items-center gap-2 px-3 py-1 rounded-lg border transition-all duration-300",
                isExceeded
                  ? "bg-red-50 border-red-200 text-red-600"
                  : isNearEnd
                    ? "bg-orange-50 border-orange-200 text-orange-600 animate-pulse"
                    : "bg-white border-gray-100 text-gray-700",
              )}
            >
              <Timer
                className={clsx(isExceeded ? "animate-spin-slow" : "")}
                size={14}
              />
              <div className="flex items-center gap-2">
                <span className="text-lg font-mono font-black tracking-tighter leading-none">
                  {formatTimer(elapsedSeconds)}
                </span>
                <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">
                  Meta: {forum.estimatedDuration}m
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {session.status === "scheduled" && !isPreparationMode && (
              <button
                onClick={handleStartSession}
                className={clsx(
                  "flex items-center gap-2 px-4 py-1.5 text-white rounded-lg font-black text-xs transition-all",
                  isFuture
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-green-600 hover:bg-green-700",
                )}
              >
                <Play size={14} fill="currentColor" />
                {isFuture ? "PREPARAR" : "INICIAR"}
              </button>
            )}

            {(session.status === "in_progress" || isPreparationMode) && (
              <div className="flex items-center gap-1.5">
                {effectiveSectionIndex > 0 && (
                  <button
                    onClick={() => handleStepChange(effectiveSectionIndex - 1)}
                    className="p-1 px-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}

                {effectiveSectionIndex < steps.length - 1 ? (
                  <button
                    onClick={() => handleStepChange(effectiveSectionIndex + 1)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg font-black text-xs hover:bg-blue-700 transition-all shadow-sm"
                  >
                    SIGUIENTE
                    <ChevronRight size={14} />
                  </button>
                ) : (
                  !isPreparationMode && (
                    <button
                      onClick={handleFinishSession}
                      disabled={isSaving}
                      className={clsx(
                        "flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white rounded-lg font-black text-xs hover:bg-red-700 transition-all shadow-sm",
                        isSaving && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {isSaving ? "OK" : "FINALIZAR"}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Diagram */}
      <div className="px-2 shrink-0">
        <ChevronDiagram
          steps={steps}
          currentStep={effectiveSectionIndex}
          onStepClick={handleStepChange}
          status={session.status}
          isPreparationMode={isPreparationMode}
        />
      </div>

      {effectiveSectionIndex === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 flex-1 min-h-0 px-2 pb-2">
          {/* Column 1: Asistentes */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div
              id="attendee-container"
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col h-full shadow-sm"
            >
              <div className="p-2.5 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="text-green-500" size={14} />
                  <h3 className="font-black text-gray-800 uppercase tracking-tight text-[11px]">
                    Asistentes
                  </h3>
                  <span className="bg-green-100 text-green-600 px-1 py-0.5 rounded-full text-[8px] font-black">
                    {attendeesList.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                >
                  <Plus size={12} />
                </button>
              </div>

              <Droppable id="attendee-container">
                <SortableContext
                  items={attendeesList.map((a) => a.uid)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto">
                    {attendeesList.map((a) => (
                      <SortableAttendee key={a.uid} id={a.uid} attendee={a} />
                    ))}
                    {attendeesList.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-50 m-4 rounded-2xl">
                        <UserCheck size={32} className="mb-2 opacity-50" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center">
                          Invita o arrastra
                        </p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </Droppable>
            </div>

            {/* Column 2: Ausentes */}
            <div
              id="absent-container"
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col h-full shadow-sm"
            >
              <div className="p-2.5 border-b border-gray-50 bg-white sticky top-0 z-10">
                <div className="flex items-center gap-1.5">
                  <UserX className="text-red-400" size={14} />
                  <h3 className="font-black text-gray-800 uppercase tracking-tight text-[11px]">
                    Ausentes
                  </h3>
                  <span className="bg-red-50 text-red-500 px-1 py-0.5 rounded-full text-[8px] font-black">
                    {absenteesList.length}
                  </span>
                </div>
              </div>

              <Droppable id="absent-container">
                <SortableContext
                  items={absenteesList.map((a) => a.uid)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto">
                    {absenteesList.map((a) => (
                      <SortableAttendee key={a.uid} id={a.uid} attendee={a} />
                    ))}
                    {absenteesList.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-200 border-2 border-dashed border-gray-100 m-4 rounded-2xl">
                        <UserX size={32} className="mb-2 opacity-30" />
                        <p className="text-xs font-bold uppercase tracking-widest text-center px-4">
                          Arrastra aquí
                        </p>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </Droppable>
            </div>
          </DndContext>

          {/* Column 3: Secciones */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col h-full shadow-sm">
            <div className="p-2 border-b border-gray-50 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-1.5">
                <Clock className="text-blue-500" size={12} />
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-[10px]">
                  Secciones
                </h3>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {steps.map((step, idx) => {
                    const isCurrent = idx === effectiveSectionIndex;
                    const isCompleted = idx < effectiveSectionIndex;
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => (isAdmin || idx <= effectiveSectionIndex) && handleStepChange(idx)}
                        className={clsx(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer group",
                          isCurrent
                            ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                            : isCompleted
                              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                              : "bg-white border-transparent text-gray-500",
                        )}
                      >
                        <div
                          className={clsx(
                            "w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[10px] transition-colors",
                            isCurrent
                              ? "bg-blue-600 text-white"
                              : isCompleted
                                ? "bg-emerald-500 text-white"
                                : "bg-gray-100 text-gray-400",
                          )}
                        >
                          {isCompleted ? <Check size={10} /> : idx === 0 ? "•" : idx}
                        </div>
                        <span className="font-bold text-[10px] uppercase tracking-wider flex-1">
                          {step}
                        </span>
                        {isCompleted && <span className="text-[8px] font-black uppercase text-emerald-500/60 opacity-0 group-hover:opacity-100 transition-opacity">OK</span>}
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex-1 min-h-0 px-2 pb-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={effectiveSectionIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="w-full h-full"
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
                    <div className="flex flex-col gap-1.5 h-full min-h-0 overflow-hidden">
                      {/* Top Indicators Panel */}
                      <div className="bg-white rounded-xl border border-gray-100 p-1 shrink-0 shadow-sm">
                        <div className="flex items-center justify-between mb-0.5 border-b border-gray-50 pb-0.5 px-1">
                          <div className="flex items-center gap-1">
                            <BarChart3 className="text-blue-600" size={10} />
                            <h4 className="font-black text-gray-800 uppercase tracking-widest text-[8px]">
                              Indicadores
                            </h4>
                          </div>
                          <div className="flex bg-gray-50 p-0.5 rounded-md border border-gray-100 gap-0.5 scale-75 origin-right">
                            <button
                              onClick={() => setSelectedTypology(null)}
                              className={clsx(
                                "px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all tracking-wider flex items-center gap-1",
                                selectedTypology === null
                                  ? "bg-white text-blue-600 border border-gray-100 shadow-sm"
                                  : "text-gray-400",
                              )}
                            >
                              TODOS
                              <span className="opacity-50 text-[7px]">({forumIndicators.length})</span>
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
                                    "px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all tracking-wider flex items-center gap-1",
                                    selectedTypology === type
                                      ? clsx(
                                          "bg-white border border-gray-100 shadow-sm",
                                          type === "calidad" && "text-amber-500",
                                          type === "personas" && "text-purple-500",
                                          type === "coste" && "text-emerald-500",
                                          type === "plazo" && "text-blue-500",
                                        )
                                      : "text-gray-400",
                                  )}
                                >
                                  {type}
                                  <span className="opacity-50 text-[7px]">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar-on-mobile">
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
                                  "flex-none w-24 px-1.5 py-0.5 rounded-lg border transition-all text-left relative overflow-hidden",
                                  isActive
                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                    : isViewed
                                      ? "bg-gray-50 border-gray-50 text-gray-400"
                                      : "bg-white border-gray-100 text-gray-600 hover:border-blue-200",
                                )}
                              >
                                <div className="flex items-center gap-0.5 mb-0.5">
                                  {indicator.typology === 'calidad' && <Award size={5} className={isActive ? "text-white" : "text-amber-500"} />}
                                  {indicator.typology === 'coste' && <Coins size={5} className={isActive ? "text-white" : "text-emerald-500"} />}
                                  {indicator.typology === 'plazo' && <Clock size={5} className={isActive ? "text-white" : "text-blue-500"} />}
                                  {indicator.typology === 'personas' && <Users size={5} className={isActive ? "text-white" : "text-purple-500"} />}
                                  <div className="text-[4px] font-black uppercase tracking-widest opacity-60">
                                    {indicator.typology || 'Ind'}
                                  </div>
                                </div>
                                <div className="font-bold text-[7px] truncate leading-tight">
                                  {indicator.name}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">
                        {/* Left Incidents Panel */}
                        <div className="w-48 bg-white rounded-xl border border-gray-100 flex flex-col overflow-hidden shrink-0 shadow-sm">
                          <div className="p-2 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle size={12} />
                              <h4 className="font-black uppercase tracking-tighter text-[9px]">
                                Incidencias
                              </h4>
                            </div>
                            <button
                              onClick={() => {
                                setEditingAction({
                                  assignedTo: [],
                                  assignedToNames: [],
                                  status: "pendiente",
                                  priority: "alta",
                                  targetDate: format(new Date(), "yyyy-MM-dd"),
                                  originForumId: forum.id,
                                  originForumName: forum.name,
                                });
                                setTempSubActions([]);
                                setType("incidencia");
                                setIsEscalated(false);
                              }}
                              className="w-5 h-5 rounded-md bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-gray-50/10 custom-scrollbar">
                            {forumIncidents.map((incident) => (
                              <div
                                key={incident.id}
                                onClick={() => {
                                  setEditingAction({ ...incident });
                                  setTempSubActions(
                                    subActions.filter(
                                      (s) => s.actionId === incident.id,
                                    ),
                                  );
                                  setType(incident.type || "incidencia");
                                  setIsEscalated(incident.isEscalated || false);
                                  setEscalatedToForumId(
                                    incident.escalatedToForumId || "",
                                  );
                                }}
                                className="bg-white p-2.5 rounded-xl border border-gray-100 transition-all cursor-pointer group shadow-sm hover:border-red-200"
                              >
                                <div className="flex justify-between items-start gap-1.5 mb-1">
                                  <h5 className="font-bold text-gray-800 text-[10px] leading-tight group-hover:text-red-600 transition-colors line-clamp-2">
                                    {incident.title}
                                  </h5>
                                  <div className={clsx("w-1.5 h-1.5 rounded-full shrink-0", incident.priority === "critica" ? "bg-red-600 animate-pulse" : "bg-red-400")} />
                                </div>
                                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-gray-400">
                                  <div className="flex items-center gap-1">
                                    <Calendar size={8} />
                                    {format(new Date(incident.targetDate), "dd MMM", { locale: es })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Central Content Panel */}
                        <div className="flex-1 bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col min-w-0 shadow-sm">
                          {selectedIndicator ? (
                            <>
                              <div className="px-2 py-1 border-b border-gray-50 flex justify-between items-center bg-white shrink-0 shadow-sm z-10">
                                <div>
                                  <h3 className="font-black text-gray-800 uppercase tracking-tighter text-[10px]">
                                    {selectedIndicator.name}
                                  </h3>
                                  {selectedIndicator.formula && (
                                    <p className="text-[7px] text-gray-400 font-medium">
                                      {selectedIndicator.formula}
                                    </p>
                                  )}
                                </div>
                                {selectedIndicator.link && (
                                  <a
                                    href={selectedIndicator.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition-all text-[7px] font-black border border-blue-100 flex items-center gap-1 shadow-sm"
                                  >
                                    C. MANDO
                                    <LayoutDashboard size={8} />
                                  </a>
                                )}
                              </div>
                              <div className="flex-1 bg-gray-50 relative min-h-0">
                                {selectedIndicator.link ? (
                                  <iframe src={selectedIndicator.link} className="w-full h-full border-none" title={selectedIndicator.name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-center p-6 bg-white">
                                    <div className="max-w-[180px] space-y-2">
                                      <div className="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center mx-auto text-blue-400">
                                        <BarChart3 size={24} />
                                      </div>
                                      <h4 className="font-bold text-gray-800 text-[11px]">Visualización pendiente</h4>
                                      <p className="text-[10px] text-gray-400">Sin enlace configurado.</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
                              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-200 mb-4 rotate-6">
                                <BarChart3 size={32} />
                              </div>
                              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Selecciona Indicador</h3>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (currentSection.id === "actions") {
                  const today = startOfDay(new Date());

                  let columns: {
                    value: string;
                    label: string;
                    color: string;
                  }[] = [];
                  const frequency = forum.frequency;
                  const isDaily =
                    frequency === "diaria" ||
                    (frequency === "periodic" &&
                      forum.recurrence?.repeatUnit === "day" &&
                      forum.recurrence?.repeatEvery === 1);

                  if (isDaily) {
                    columns = [
                      {
                        value: "overdue",
                        label: "Retrasadas",
                        color: "bg-red-500",
                      },
                      { value: "today", label: "Hoy", color: "bg-blue-600" },
                      { value: "day1", label: "Día+1", color: "bg-orange-500" },
                      { value: "day2", label: "Día+2", color: "bg-orange-400" },
                      {
                        value: "later",
                        label: "Posterior",
                        color: "bg-gray-400",
                      },
                    ];
                  } else {
                    // Weekly or anything else
                    columns = [
                      {
                        value: "overdue",
                        label: "Retrasadas",
                        color: "bg-red-500",
                      },
                      { value: "today", label: "Hoy", color: "bg-blue-600" },
                      {
                        value: "week1",
                        label: "Semana+1",
                        color: "bg-orange-500",
                      },
                      {
                        value: "week2",
                        label: "Semana+2",
                        color: "bg-orange-400",
                      },
                      {
                        value: "later",
                        label: "Posterior",
                        color: "bg-gray-400",
                      },
                    ];
                  }

                  const getColumn = (dateStr: string): string => {
                    if (!dateStr) return "later";
                    // Use parseISO for yyyy-MM-dd strings to avoid timezone shifts
                    const targetDate = startOfDay(parseISO(dateStr));

                    if (isBefore(targetDate, today)) return "overdue";
                    if (isSameDay(targetDate, today)) return "today";

                    if (isDaily) {
                      if (isSameDay(targetDate, addDays(today, 1)))
                        return "day1";
                      if (isSameDay(targetDate, addDays(today, 2)))
                        return "day2";
                    } else {
                      const week1End = addDays(today, 7);
                      const week2End = addDays(today, 14);
                      if (
                        isBefore(targetDate, week1End) ||
                        isSameDay(targetDate, week1End)
                      )
                        return "week1";
                      if (
                        isBefore(targetDate, week2End) ||
                        isSameDay(targetDate, week2End)
                      )
                        return "week2";
                    }
                    return "later";
                  };

                  return (
                    <div className="w-full h-full overflow-hidden flex flex-col gap-1.5 min-h-0">
                      <div className="flex items-center justify-between px-1 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <LayoutDashboard size={12} className="text-blue-600" />
                          <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-tighter">
                            Plan de Acción
                          </h3>
                        </div>
                        <button
                          onClick={() => {
                            setEditingAction({
                              assignedTo: [],
                              assignedToNames: [],
                              status: "pendiente",
                              priority: "media",
                              targetDate: format(new Date(), "yyyy-MM-dd"),
                              originForumId: forum.id,
                              originForumName: forum.name,
                            });
                            setTempSubActions([]);
                            setType("accion");
                            setIsEscalated(false);
                          }}
                          className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded-md hover:bg-blue-700 transition duration-200 text-[8px] font-black uppercase shadow-sm"
                        >
                          <Plus size={8} />
                          <span>Nueva Acción</span>
                        </button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar snap-x snap-mandatory flex-1 min-h-0">
                        {columns.map((col) => {
                          const colActions = actions.filter(
                            (a) =>
                              a.status !== "finalizada" &&
                              a.status !== "cancelada" &&
                              getColumn(a.targetDate) === col.value,
                          );
                          return (
                            <div
                              key={col.value}
                              className="flex-none w-[170px] bg-white rounded-xl border border-gray-100 flex flex-col snap-start overflow-hidden shadow-sm"
                            >
                              <div className="px-2 py-1 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                                <div className="flex items-center gap-1">
                                  <div className={clsx("w-1.5 h-1.5 rounded-full", col.color)} />
                                  <h4 className="font-black text-gray-800 uppercase tracking-tight text-[7px]">
                                    {col.label}
                                  </h4>
                                </div>
                                <span className="bg-gray-50 text-gray-500 text-[6px] font-black px-1 py-0.5 rounded-full border border-gray-100">
                                  {colActions.length}
                                </span>
                              </div>
                              <div className="flex-1 overflow-y-auto p-1 space-y-1 bg-gray-50/10 custom-scrollbar">
                                {colActions.map((action) => {
                                  const actionSubActions = subActions.filter((s) => s.actionId === action.id);
                                  const completedSubActions = actionSubActions.filter((s) => s.completed).length;
                                  
                                  return (
                                    <div
                                      key={action.id}
                                      onClick={() => {
                                        setEditingAction({ ...action });
                                        setTempSubActions(subActions.filter((s) => s.actionId === action.id));
                                        setType(action.type || "accion");
                                        setIsEscalated(action.isEscalated || false);
                                        setEscalatedToForumId(action.escalatedToForumId || "");
                                      }}
                                      className="bg-white p-2 rounded-lg border border-gray-50 hover:border-blue-200 transition-all cursor-pointer group shadow-sm"
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-start gap-1">
                                          <h5 className="font-bold text-gray-800 text-[9px] leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                            {action.title}
                                          </h5>
                                          {action.priority === "critica" && <div className="w-1 h-1 rounded-full bg-red-600 animate-pulse shrink-0" />}
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-gray-50">
                                          <div className="flex -space-x-1">
                                            {action.assignedToNames?.slice(0, 2).map((name, i) => (
                                              <div key={i} className="w-3.5 h-3.5 rounded-full bg-blue-50 border border-white flex items-center justify-center text-[5px] font-black text-blue-600 uppercase" title={name}>
                                                {name.charAt(0)}
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex items-center gap-1 text-[7px] font-bold text-gray-400">
                                            <Calendar size={7} />
                                            {action.targetDate.split("-").reverse().slice(0, 2).join("/")}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
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
                  <div className="max-w-xl mx-auto w-full bg-white rounded-2xl border border-gray-100 overflow-hidden p-6 text-center flex-1 flex flex-col justify-center shadow-sm">
                    <div className="space-y-3">
                      <div className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[8px] font-black uppercase tracking-widest mb-1 shadow-sm">
                        Punto {effectiveSectionIndex} de {steps.length - 1}
                      </div>

                      <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter leading-tight">
                        {steps[effectiveSectionIndex]}
                      </h3>

                      <div className="pt-4">
                        <div className="p-6 border-2 border-dashed border-gray-50 rounded-2xl flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-200">
                            <MessageSquare size={24} />
                          </div>
                          <p className="text-gray-400 italic text-xs font-medium max-w-[200px]">
                            Sección en desarrollo.
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
        onClose={() => {
          setEditingAction(null);
          setTempSubActions([]);
          setShowUserSelector(false);
          setUserSearchQuery("");
        }}
        title={editingAction?.id ? "Editar Acción" : "Nueva Acción"}
        maxWidth="max-w-5xl"
      >
        <form
          onSubmit={handleSaveAction}
          className="flex flex-col max-h-[85vh]"
        >
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Título de la Acción
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAction?.title || ""}
                    onChange={(e) =>
                      setEditingAction({
                        ...editingAction,
                        title: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    placeholder="¿Qué hay que hacer?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Foro (Origen)
                  </label>
                  <select
                    value={editingAction?.originForumId || ""}
                    disabled={!!forum}
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
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Descripción / Contexto
                  </label>
                  <textarea
                    value={editingAction?.description || ""}
                    onChange={(e) =>
                      setEditingAction({
                        ...editingAction,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium h-32 resize-none"
                    placeholder="Detalles adicionales..."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-widest text-[10px]">
                      Sub-acciones ({tempSubActions.length})
                    </label>
                    <button
                      type="button"
                      onClick={addTempSubAction}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-tighter bg-blue-50 px-3 py-1 rounded-full"
                    >
                      + Añadir Paso
                    </button>
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
                          onChange={(e) =>
                            handleSubActionChange(idx, "title", e.target.value)
                          }
                          className="flex-1 bg-transparent border-none text-sm font-medium focus:ring-0 placeholder:text-gray-300 h-8"
                          placeholder="Paso a seguir..."
                        />
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-gray-400" />
                            <input
                              type="date"
                              value={sub.currentProposedDate || ""}
                              onChange={(e) =>
                                handleSubActionChange(
                                  idx,
                                  "currentProposedDate",
                                  e.target.value,
                                )
                              }
                              className="bg-white/50 border-none rounded-lg px-2 py-1 text-[10px] text-gray-600 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTempSubAction(idx)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {tempSubActions.length === 0 && (
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
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px]">
                    Tipo de Acción
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType("accion")}
                      className={clsx(
                        "px-4 py-2 text-xs font-black rounded-xl border transition-all uppercase tracking-tighter text-center",
                        type === "accion"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-gray-100 text-gray-400 hover:border-blue-200",
                      )}
                    >
                      Acción
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("incidencia")}
                      className={clsx(
                        "px-4 py-2 text-xs font-black rounded-xl border transition-all uppercase tracking-tighter text-center",
                        type === "incidencia"
                          ? "bg-red-600 border-red-600 text-white"
                          : "bg-white border-gray-100 text-gray-400 hover:border-red-200",
                      )}
                    >
                      Incidencia
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Responsables
                  </label>
                  <div className="bg-gray-50 p-3 rounded-2xl flex flex-wrap gap-2 min-h-[50px] items-center">
                    {(editingAction?.assignedTo || []).map((uid) => {
                      const user = users.find((u) => u.uid === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-gray-100 text-[10px] font-bold text-blue-900"
                        >
                          {user?.name || "Cargando..."}
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
                        </span>
                      );
                    })}
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
                            .filter((u) =>
                              u.name
                                .toLowerCase()
                                .includes(userSearchQuery.toLowerCase()),
                            )
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
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                      Fecha Límite
                    </label>
                    <div className="relative">
                      <Calendar
                        size={14}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="date"
                        required
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
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                      Prioridad
                    </label>
                    <select
                      value={editingAction?.priority || "media"}
                      onChange={(e) =>
                        setEditingAction({
                          ...editingAction,
                          priority: e.target.value as ActionPriority,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium appearance-none"
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-widest text-[10px]">
                    Categoría (Opcional)
                  </label>
                  <select
                    value={editingAction?.categoryId || ""}
                    onChange={(e) =>
                      setEditingAction({
                        ...editingAction,
                        categoryId: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium appearance-none"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-orange-600" />
                      <span className="text-[10px] font-black text-orange-900 uppercase">
                        Escalar Acción
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEscalated(!isEscalated)}
                      className={clsx(
                        "w-10 h-5 rounded-full relative transition-all duration-300",
                        isEscalated ? "bg-orange-600" : "bg-gray-200",
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
                        La acción será notificada al foro superior seleccionado.
                      </p>
                      <select
                        required={isEscalated}
                        value={escalatedToForumId}
                        onChange={(e) => setEscalatedToForumId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-[10px] font-bold"
                      >
                        <option value="">Seleccionar foro superior...</option>
                        {forums
                          .filter((f) => f.id !== forum?.id)
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
            {editingAction?.id &&
              editingAction.status !== "finalizada" &&
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
            {editingAction?.id && editingAction.status !== "cancelada" && (
              <button
                type="button"
                onClick={handleCancelAction}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all font-black text-xs uppercase tracking-widest"
              >
                <XCircle size={16} />
                Cancelar Acción
              </button>
            )}
            <div className={clsx("flex gap-3", !editingAction?.id && "w-full")}>
              <button
                type="button"
                onClick={() => {
                  setEditingAction(null);
                  setTempSubActions([]);
                }}
                className={clsx(
                  "px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-100 rounded-2xl transition-all",
                  !editingAction?.id && "flex-1",
                )}
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={clsx(
                  "px-10 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-widest disabled:opacity-50",
                  !editingAction?.id && "flex-1",
                )}
              >
                {editingAction?.id ? "Guardar Cambios" : "Crear Acción"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
