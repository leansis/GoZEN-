import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Save,
  MessageSquare,
  AlertCircle,
  LogOut,
  Headphones,
  Check,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useAppData } from '../contexts/AppDataContext';
import { db } from '../firebase';
import { 
  updateDoc, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { Forum, ForumSession as ForumSessionType, ForumAttendee } from '../types';
import clsx from 'clsx';
import { format, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ForumSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { dbUser, activeCompanyId } = useAuth();
  const { forums } = useAppData();
  
  const [session, setSession] = useState<ForumSessionType | null>(null);
  const [forum, setForum] = useState<Forum | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = onSnapshot(doc(db, 'forumSessions', sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ForumSessionType;
        setSession({ ...data, id: docSnap.id });
        
        const forumDef = forums.find(f => f.id === data.forumId);
        if (forumDef) setForum(forumDef);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, forums]);

  useEffect(() => {
    if (session?.status === 'in_progress' && session.startedAt) {
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
  }, [session?.status, session?.startedAt]);

  const handleStartSession = async () => {
    if (!session) return;
    try {
      await updateDoc(doc(db, 'forumSessions', session.id), {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        currentAgendaStep: 0
      });
    } catch (err) {
      console.error("Error starting session:", err);
    }
  };

  const handleStepChange = async (newStep: number) => {
    if (!session || !forum) return;
    if (newStep < 0 || newStep >= forum.agenda.length) return;

    try {
      await updateDoc(doc(db, 'forumSessions', session.id), {
        currentAgendaStep: newStep
      });
    } catch (err) {
      console.error("Error changing step:", err);
    }
  };

  const handleToggleAttendance = async (uid: string) => {
    if (!session) return;
    try {
      const updatedAttendees = session.attendees.map(a => 
        a.uid === uid ? { ...a, present: !a.present } : a
      );
      await updateDoc(doc(db, 'forumSessions', session.id), {
        attendees: updatedAttendees
      });
    } catch (err) {
      console.error("Error toggling attendance:", err);
    }
  };

  const handleSaveResult = async (text: string) => {
    if (!session || !forum) return;
    setIsSaving(true);
    try {
      const currentItem = forum.agenda[session.currentAgendaStep];
      const updatedResults = { ...session.results, [currentItem.id]: text };
      await updateDoc(doc(db, 'forumSessions', session.id), {
        results: updatedResults
      });
    } catch (err) {
      console.error("Error saving result:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishSession = async () => {
    if (!session) return;
    if (!window.confirm('¿Finalizar esta sesión de foro?')) return;
    try {
      await updateDoc(doc(db, 'forumSessions', session.id), {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      navigate('/forums');
    } catch (err) {
      console.error("Error finishing session:", err);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando sesión...</div>;
  if (!session || !forum) return <div className="p-8 text-center text-red-500">Sesión no encontrada</div>;

  const currentStep = forum.agenda[session.currentAgendaStep];
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins} min, ${secs} seg`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header aligned with screenshots */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center p-2">
              <img src="/logo.png" alt="Focus" className="w-full h-full object-contain opacity-50" />
           </div>
           <div>
              <h1 className={clsx(
                "text-lg font-bold uppercase tracking-wide mb-1",
                session.status === 'scheduled' ? "text-green-600" : "text-gray-700"
              )}>
                FORO: {session.forumName} 
                {session.status === 'scheduled' && ` - Programado para ${format(new Date(session.scheduledAt), "dd/MM/yyyy HH:mm")}`}
                {session.status === 'in_progress' && ` del ${format(new Date(session.scheduledAt), "dd/MM/yyyy HH:mm")} - Iniciado el ${format(new Date(session.startedAt!), "dd/MM/yyyy HH:mm")}`}
              </h1>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <button className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors shadow-sm">
              <Headphones size={20} />
           </button>
        </div>
      </div>

      {session.status === 'in_progress' && (
        <div className="bg-white rounded-full border border-gray-100 p-2 flex items-center shadow-sm max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div className="flex-1 px-6 text-center">
            <p className="text-xl font-bold text-gray-800">
              {formatTime(elapsedSeconds)}
              <span className="text-sm font-normal text-gray-400 ml-2">(foro de {forum.estimatedDuration} minutos)</span>
            </p>
          </div>
          <div className="flex gap-2">
             <button className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors shadow-lg">
                <Users size={18} />
             </button>
             <button className="w-10 h-10 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 transition-colors shadow-lg">
                <MessageSquare size={18} />
             </button>
          </div>
        </div>
      )}

      {/* Main Agenda Carousel (Screenshot style) */}
      <div className="relative flex items-center justify-center gap-8 py-10">
         {session.status === 'in_progress' && (
           <button 
             onClick={() => handleStepChange(session.currentAgendaStep - 1)}
             disabled={session.currentAgendaStep === 0}
             className="w-16 h-12 rounded-2xl border-2 border-teal-500 flex items-center justify-center text-teal-600 hover:bg-teal-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-white"
           >
             <ChevronLeft size={32} />
           </button>
         )}

         <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 w-full max-w-2xl relative">
            <div className="flex flex-col items-start gap-4">
               {forum.agenda.map((item, idx) => {
                 const isCurrent = idx === session.currentAgendaStep;
                 const isPrev = idx < session.currentAgendaStep;
                 
                 return (
                   <div 
                     key={item.id}
                     className={clsx(
                       "flex items-center gap-6 transition-all duration-500 w-full rounded-full py-2 px-6",
                       isCurrent ? "border-2 border-orange-500 scale-105 shadow-md bg-white -ml-4" : "opacity-40 grayscale"
                     )}
                   >
                     <span className={clsx(
                       "text-4xl font-bold",
                       isCurrent ? "text-gray-600" : "text-gray-300"
                     )}>
                       {idx + 1}
                     </span>
                     <span className={clsx(
                       "text-lg font-medium",
                       isCurrent ? "text-gray-600" : "text-gray-400"
                     )}>
                       {item.title}
                     </span>
                   </div>
                 );
               })}
            </div>
            {/* "Apertura" tag from screenshot */}
            <div className="absolute left-[-60px] top-1/2 -translate-y-1/2 -rotate-90">
               <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">Apertura</span>
            </div>
         </div>

         {session.status === 'in_progress' ? (
           <button 
             onClick={() => handleStepChange(session.currentAgendaStep + 1)}
             disabled={session.currentAgendaStep === forum.agenda.length - 1}
             className="w-16 h-12 rounded-2xl border-2 border-teal-500 flex items-center justify-center text-teal-600 hover:bg-teal-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-white"
           >
             <ChevronRight size={32} />
           </button>
         ) : session.status === 'scheduled' ? (
            <button 
              onClick={handleStartSession}
              className="bg-teal-600 text-white px-16 py-4 rounded-3xl font-bold text-xl hover:bg-teal-700 transition-all shadow-xl shadow-teal-200"
            >
              INICIAR
            </button>
         ) : null}
      </div>

      {session.status === 'in_progress' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-6">
           <div className="flex justify-between items-center border-b border-gray-100 pb-4">
              <h2 className="text-3xl font-bold text-gray-800 uppercase tracking-tighter">Resultados</h2>
              <div className="flex gap-2">
                 <button className="p-2 border border-blue-100 text-blue-500 rounded-lg hover:bg-blue-50"><ChevronLeft size={20}/></button>
                 <button className="p-2 border border-blue-100 text-blue-500 rounded-lg hover:bg-blue-50"><ChevronRight size={20}/></button>
              </div>
           </div>

           <div className="space-y-4">
             <div className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg w-fit text-sm font-bold uppercase">
                General <ChevronDown size={14} className="ml-2"/>
             </div>
             <textarea 
               value={session.results[currentStep?.id] || ''}
               onChange={(e) => handleSaveResult(e.target.value)}
               className="w-full h-48 bg-black text-green-400 font-mono p-6 rounded-2xl focus:ring-0 outline-none resize-none shadow-inner"
               placeholder={"> Ingrese los resultados del punto: " + currentStep?.title}
             />
             <div className="flex justify-end gap-3 text-xs text-gray-400 italic">
                {isSaving ? "Guardando..." : "Cambios guardados automáticamente"}
             </div>
           </div>
        </div>
      )}

      {/* Info panels based on screenshot 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="space-y-4">
            <h3 className="bg-teal-500/80 text-white py-2 px-4 rounded font-bold text-center uppercase tracking-widest text-xs">Asistentes</h3>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
               {Object.entries(
                 session.attendees.reduce((acc, a) => {
                   const group = a.groupName || 'Equipo';
                   if (!acc[group]) acc[group] = [];
                   acc[group].push(a);
                   return acc;
                 }, {} as Record<string, ForumAttendee[]>)
               ).map(([groupName, groupAttendees]) => (
                 <div key={groupName} className="border-b last:border-0 border-gray-100">
                    <div className="bg-gray-50 px-4 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                       {groupName}
                    </div>
                    {groupAttendees.map(a => (
                      <button 
                       key={a.uid}
                       onClick={() => handleToggleAttendance(a.uid)}
                       className={clsx(
                         "w-full flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-sm",
                         a.present ? "text-gray-800 font-medium" : "text-gray-300 italic"
                       )}
                      >
                        <div className="flex items-center gap-2">
                           {a.isLeader && <span className="w-2 h-2 rounded-full bg-orange-500" title="Líder" />}
                           <span>{a.name}</span>
                           {a.isLeader && <span className="text-[8px] bg-orange-100 text-orange-600 px-1 rounded font-bold uppercase">Líder</span>}
                        </div>
                        {a.present && <Check size={16} className="text-teal-500" />}
                      </button>
                    ))}
                 </div>
               ))}
            </div>
         </div>

         <div className="space-y-4">
            <h3 className="bg-teal-500/80 text-white py-2 px-4 rounded font-bold text-center uppercase tracking-widest text-xs">Han estado ausentes</h3>
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8 text-center">
               <p className="text-gray-300 text-sm italic">
                 {session.attendees.filter(a => !a.present).length > 0 
                   ? session.attendees.filter(a => !a.present).map(a => a.name).join(', ')
                   : "No encontrados elementos"
                 }
               </p>
            </div>
         </div>

         <div className="space-y-4">
            <h3 className="bg-teal-500/80 text-white py-2 px-4 rounded font-bold text-center uppercase tracking-widest text-xs">Agenda</h3>
            <div className="space-y-4">
               {forum.agenda.map((item, idx) => (
                 <div key={item.id} className="border-b border-teal-500/30 pb-4 group">
                    <p className={clsx(
                      "text-teal-700 font-medium group-hover:text-teal-800 transition-colors",
                      idx === session.currentAgendaStep ? "text-xl underline underline-offset-8" : "text-lg opacity-60"
                    )}>
                      {item.title}
                    </p>
                 </div>
               ))}
            </div>
         </div>
      </div>

      <div className="flex justify-end pt-12">
         {session.status === 'in_progress' && (
           <button 
             onClick={handleFinishSession}
             className="flex items-center gap-2 bg-red-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg"
           >
             Finalizar Todo el Foro
           </button>
         )}
      </div>
    </div>
  );
}
