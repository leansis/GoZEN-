import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Clock, 
  User as UserIcon,
  Calendar,
  ChevronRight,
  TrendingUp,
  Search,
  X,
  ArrowUp
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ActionPlan, ActionType } from '../types';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EscalatedPdcas() {
  const { dbUser, activeCompanyId } = useAuth();
  const [actions, setActions] = useState<ActionPlan[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [subActions, setSubActions] = useState<any[]>([]);
  
  const companyId = dbUser?.companyId || activeCompanyId;

  useEffect(() => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'actionPlans'),
      where('companyId', '==', companyId),
      where('isEscalated', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionPlan));
      setActions(docs);
      setIsLoading(false);
    });

    // Also fetch all subactions for these actions
    const subQ = query(collection(db, 'subActions'));
    const unsubSub = onSnapshot(subQ, (snap) => {
      setSubActions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubSub();
    };
  }, [companyId]);

  const filteredActions = actions.filter(action => {
    if (onlyMine) return action.escalatedBy === dbUser?.uid;
    return true;
  });

  const actionPdcas = filteredActions.filter(a => a.type === 'accion' || !a.type);
  const incidentPdcas = filteredActions.filter(a => a.type === 'incidencia');

  const renderCard = (action: ActionPlan) => {
    const subCount = subActions.filter(s => s.actionId === action.id).length;
    return (
      <div 
        key={action.id}
        className="bg-[#C1B7CE] p-4 rounded-lg shadow-sm mb-4 relative hover:brightness-95 transition-all cursor-pointer"
      >
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-bold text-[#4F4F4F] text-lg leading-tight pr-8">{action.title}</h4>
          <ArrowUp size={20} className="text-white absolute right-4 top-4" />
        </div>
        <p className="text-sm text-[#707070] font-medium">
          {action.createdByName || 'Usuario'}
        </p>
        <p className="text-xs text-[#707070] font-medium">
          {action.escalatedAt ? format(new Date(action.escalatedAt), 'dd/MM/yyyy') : format(new Date(action.createdAt), 'dd/MM/yyyy')}
        </p>
        
        <div className="mt-3">
          <div className="w-8 h-8 rounded-full bg-[#A89CB8] border-2 border-white flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {subCount}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-[#2D8C8E] -mx-6 -mt-6 lg:-mx-10 lg:-mt-10 p-4 flex justify-between items-center shadow-md">
           <h1 className="text-white text-2xl font-bold ml-4">Pdcas Escalados</h1>
           <button onClick={() => window.history.back()} className="text-white hover:opacity-80 transition-opacity mr-4">
              <X size={32} />
           </button>
        </div>

        <div className="flex items-center gap-4 py-4">
           <span className="text-gray-700 font-bold">Escalados por mi</span>
           <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-500"></div>
           </label>
        </div>

        {isLoading ? (
           <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#2D8C8E] border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-14">
            <div className="space-y-6">
               <h2 className="bg-[#E0E4EB] py-2 text-center text-gray-700 font-bold tracking-widest uppercase text-sm rounded shadow-sm border border-gray-200">ACCIONES</h2>
               <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                  {actionPdcas.map(renderCard)}
                  {actionPdcas.length === 0 && (
                    <p className="text-center py-10 text-gray-400 italic">No hay acciones escaladas</p>
                  )}
               </div>
            </div>

            <div className="space-y-6">
               <h2 className="bg-[#E0E4EB] py-2 text-center text-gray-700 font-bold tracking-widest uppercase text-sm rounded shadow-sm border border-gray-200">INCIDENCIAS</h2>
               <div className="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                  {incidentPdcas.map(renderCard)}
                  {incidentPdcas.length === 0 && (
                    <p className="text-center py-10 text-gray-400 italic">No hay incidencias escaladas</p>
                  )}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
