import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  isToday,
  parseISO
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Users, Play } from 'lucide-react';
import { ForumSession } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

interface ForumCalendarProps {
  sessions: ForumSession[];
  onVirtualSessionClick?: (session: ForumSession) => void;
  onReschedule?: (sessionId: string, newDateTime: string) => void;
  canReschedule?: (session: ForumSession) => boolean;
}

export default function ForumCalendar({ sessions, onVirtualSessionClick, onReschedule, canReschedule }: ForumCalendarProps) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getSessionsForDay = (day: Date) => {
    return sessions.filter(session => {
      const sessionDate = parseISO(session.scheduledAt);
      return isSameDay(sessionDate, day);
    }).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  };

  const handleDragStart = (e: React.DragEvent, session: ForumSession) => {
    if (canReschedule && !canReschedule(session)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('sessionId', session.id);
    e.dataTransfer.setData('currentDateTime', session.scheduledAt);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const sessionId = e.dataTransfer.getData('sessionId');
    const currentDateTime = e.dataTransfer.getData('currentDateTime');
    
    if (sessionId && onReschedule) {
      const time = currentDateTime.split('T')[1];
      const newDateTime = `${format(day, 'yyyy-MM-dd')}T${time}`;
      onReschedule(sessionId, newDateTime);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800 first-letter:uppercase">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex items-center bg-gray-50 rounded-xl p-1">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
            >
              Hoy
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-500"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-gray-500">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            Programada
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-500">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
            En curso
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-500">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            Finalizada
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-500 italic">
            <div className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-400" />
            Planificada (P)
          </div>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 bg-gray-50/50 border-b border-gray-50">
        {['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'].map((day) => (
          <div key={day} className="py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {day.substring(0, 3)}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full min-h-[600px] border-l border-t border-gray-50">
          {days.map((day, idx) => {
            const daySessions = getSessionsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div
                key={idx}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
                className={clsx(
                  "min-h-[120px] p-2 border-r border-b border-gray-50 transition-colors relative group",
                  !isCurrentMonth ? "bg-gray-50/30 text-gray-300" : "bg-white",
                  isTodayDate && "bg-blue-50/20"
                )}
              >
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className={clsx(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all",
                    isTodayDate ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "text-gray-500"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {daySessions.length > 0 && (
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
                      {daySessions.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-hidden">
                  {daySessions.map((session) => (
                    <motion.div
                      layoutId={session.id}
                      key={session.id}
                      draggable={!canReschedule || canReschedule(session)}
                      onDragStart={(e) => handleDragStart(e as any, session)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (session.id.startsWith('virtual-') && onVirtualSessionClick) {
                          onVirtualSessionClick(session);
                        } else {
                          navigate(`/forums/${session.id}`);
                        }
                      }}
                      className={clsx(
                        "group/session p-1.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
                        session.id.startsWith('virtual-') ? "border-dashed opacity-70" : "shadow-sm",
                        session.status === 'scheduled' ? "bg-blue-50/50 border-blue-100 text-blue-700 hover:bg-blue-50" :
                        session.status === 'in_progress' ? "bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100" :
                        session.status === 'completed' ? "bg-green-50 border-green-100 text-green-700 hover:bg-green-100" :
                        "bg-gray-50 border-gray-200 text-gray-600",
                        canReschedule && canReschedule(session) && "cursor-move"
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold truncate leading-tight">
                            {format(parseISO(session.scheduledAt), 'HH:mm')}
                            {session.id.startsWith('virtual-') && " (P)"}
                          </span>
                          {session.status === 'in_progress' && (
                            <div className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
                          )}
                        </div>
                        <h4 className="text-[10px] font-medium truncate leading-tight">
                          {session.forumName}
                        </h4>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
