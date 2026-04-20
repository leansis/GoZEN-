import React, { useState, useRef } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Activity, Process, Task, Criterion, User, Team, Role } from '../../types';
import { Upload, Download, Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

type ImportType = 'criteria' | 'users_teams' | 'structure' | 'team_hierarchy';

interface ImportResult {
  success: boolean;
  message: string;
  count?: number;
}

export default function MasterData() {
  const { activeCompanyId, dbUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentImportType, setCurrentImportType] = useState<ImportType | null>(null);

  const companyId = activeCompanyId || dbUser?.companyId || '';

  const handleFileSelect = (type: ImportType) => {
    setCurrentImportType(type);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentImportType) return;

    setLoading(true);
    setResult(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('El archivo está vacío.');
      }

      if (currentImportType === 'criteria') {
        await importCriteria(jsonData);
      } else if (currentImportType === 'users_teams') {
        await importUsersTeams(jsonData);
      } else if (currentImportType === 'structure') {
        await importStructure(jsonData);
      } else if (currentImportType === 'team_hierarchy') {
        await importTeamHierarchy(jsonData);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      setResult({ success: false, message: 'Error al procesar el archivo: ' + (error.message || 'Error desconocido') });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const commitBatches = async (operations: (() => void)[]) => {
    const batchSize = 400;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = writeBatch(db);
      // This is a conceptual pattern, we'll actually need to pass the batch to the operations
    }
  };

  const importTeamHierarchy = async (data: any[]) => {
    const q = query(collection(db, 'teams'), where('companyId', '==', companyId));
    const snapshot = await getDocs(q);
    const existingTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
    
    let currentBatch = writeBatch(db);
    let opCount = 0;
    let count = 0;

    for (const row of data) {
      const teamName = row['Equipo']?.toString().trim();
      const parentName = row['Equipo Padre']?.toString().trim();

      if (!teamName) continue;

      const team = existingTeams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
      if (!team) continue;

      const parent = parentName ? existingTeams.find(t => t.name.toLowerCase() === parentName.toLowerCase()) : null;
      
      const updateData: any = {
        parentTeamId: parent ? parent.id : null
      };

      currentBatch.update(doc(db, 'teams', team.id), updateData);
      opCount++;
      count++;

      if (opCount >= 450) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) await currentBatch.commit();
    setResult({ success: true, message: `Se han actualizado las jerarquías de ${count} equipos.` });
  };

  const importCriteria = async (data: any[]) => {
    const criteriaMap = new Map<string, Criterion>();

    data.forEach(row => {
      const critName = row['Criterio']?.toString().trim();
      const levelStr = row['Nivel']?.toString().trim();
      const subcrit = row['Subcriterio']?.toString().trim();

      if (!critName || !levelStr || !subcrit) return;

      const levelNum = parseInt(levelStr.replace(/\D/g, ''));
      if (isNaN(levelNum)) return;

      if (!criteriaMap.has(critName)) {
        criteriaMap.set(critName, {
          id: '',
          name: critName,
          levels: [
            { level: 1, items: [] },
            { level: 2, items: [] },
            { level: 3, items: [] },
            { level: 4, items: [] },
          ],
          companyId
        });
      }

      const crit = criteriaMap.get(critName)!;
      const levelObj = crit.levels.find(l => l.level === levelNum);
      if (levelObj) {
        levelObj.items.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
          description: subcrit
        });
      }
    });

    let count = 0;
    const batch = writeBatch(db);
    for (const [name, criterion] of criteriaMap.entries()) {
      const docRef = doc(collection(db, 'criteria'));
      batch.set(docRef, { ...criterion, id: docRef.id });
      count++;
    }

    await batch.commit();
    setResult({ success: true, message: `Se han importado ${count} criterios correctamente.`, count });
  };

  const importUsersTeams = async (data: any[]) => {
    const teamsToCreate = new Map<string, { id: string, parentName?: string }>();
    const usersToCreate: any[] = [];
    
    // Normalize and collect
    data.forEach(row => {
      const teamName = row['Equipo']?.toString().trim();
      const parentName = row['Equipo Padre']?.toString().trim();
      const email = row['Email Usuario']?.toString().trim().toLowerCase();
      const name = row['Nombre Usuario']?.toString().trim();
      const roleStr = row['Rol']?.toString().trim().toLowerCase();

      if (teamName && teamName.toLowerCase() !== 'sin equipo' && !teamsToCreate.has(teamName)) {
        teamsToCreate.set(teamName, { id: doc(collection(db, 'teams')).id, parentName });
      }

      if (email && name) {
        let role: Role = 'user';
        if (roleStr.includes('admin')) role = 'admin';
        else if (roleStr.includes('promotor')) role = 'lean_promotor';
        else if (roleStr.includes('supervisor')) role = 'supervisor';

        usersToCreate.push({
          uid: email,
          name,
          email,
          role,
          status: 'active',
          companyId,
          teamName // temp field
        });
      }
    });

    // Create chunks and commit
    const allTeams = Array.from(teamsToCreate.entries());
    let currentBatch = writeBatch(db);
    let opCount = 0;

    // Step 1: Create teams
    for (const [name, info] of allTeams) {
      const teamData: any = {
        id: info.id,
        name,
        members: [],
        processIds: [],
        supervisorId: '',
        companyId
      };
      
      // Handle parent relationship
      if (info.parentName) {
        const parent = teamsToCreate.get(info.parentName);
        if (parent) {
          teamData.parentTeamId = parent.id;
        }
      }

      currentBatch.set(doc(db, 'teams', info.id), teamData);
      opCount++;
      if (opCount >= 450) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }

    // Step 2: Create users and build membership
    const teamMemberships = new Map<string, any[]>();

    for (const userData of usersToCreate) {
      const { teamName, ...userDoc } = userData;
      currentBatch.set(doc(db, 'users', userDoc.uid), userDoc);
      opCount++;

      if (teamName && teamsToCreate.has(teamName)) {
        const teamId = teamsToCreate.get(teamName)!.id;
        if (!teamMemberships.has(teamId)) teamMemberships.set(teamId, []);
        teamMemberships.get(teamId)!.push({ uid: userDoc.uid, name: userDoc.name });
      }

      if (opCount >= 450) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }

    // Step 3: Update teams with members
    for (const [teamId, members] of teamMemberships.entries()) {
      currentBatch.update(doc(db, 'teams', teamId), { members });
      opCount++;
      if (opCount >= 450) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) await currentBatch.commit();

    setResult({ 
      success: true, 
      message: `Se han importado ${usersToCreate.length} usuarios y ${teamsToCreate.size} equipos con sus respectivas jerarquías y membresías.` 
    });
  };

  const importStructure = async (data: any[]) => {
    const activitiesMap = new Map<string, { id: string, doc: any }>();
    const processesMap = new Map<string, { id: string, doc: any }>();
    const tasksMap = new Map<string, { id: string, doc: any }>();

    // Fetch criteria for mapping
    const qCrit = query(collection(db, 'criteria'), where('companyId', '==', companyId));
    const critSnap = await getDocs(qCrit);
    const criteria = critSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Criterion));

    // Pass 1: Activities
    data.forEach(row => {
      const actName = row['Actividad']?.toString().trim();
      if (actName && !activitiesMap.has(actName)) {
        const ref = doc(collection(db, 'activities'));
        activitiesMap.set(actName, {
          id: ref.id,
          doc: { name: actName, companyId, order: activitiesMap.size, id: ref.id }
        });
      }
    });

    // Pass 2: Processes
    data.forEach(row => {
      const actName = row['Actividad']?.toString().trim();
      const procName = row['Proceso']?.toString().trim();
      if (actName && procName && activitiesMap.has(actName)) {
        const procKey = `${actName}|${procName}`;
        if (!processesMap.has(procKey)) {
          const ref = doc(collection(db, 'processes'));
          processesMap.set(procKey, {
            id: ref.id,
            doc: { 
              id: ref.id,
              name: procName, 
              description: procName, 
              activityId: activitiesMap.get(actName)!.id, 
              companyId, 
              order: processesMap.size 
            }
          });
        }
      }
    });

    // Pass 3: Tasks
    data.forEach(row => {
      const actName = row['Actividad']?.toString().trim();
      const procName = row['Proceso']?.toString().trim();
      const taskName = row['Tarea']?.toString().trim();
      const critName = row['Criterio']?.toString().trim();
      const procKey = `${actName}|${procName}`;

      if (actName && procName && taskName && processesMap.has(procKey)) {
        const taskKey = `${procKey}|${taskName}`;
        if (!tasksMap.has(taskKey)) {
          const ref = doc(collection(db, 'tasks'));
          const criterion = critName ? criteria.find(c => c.name.toLowerCase() === critName.toLowerCase()) : null;

          tasksMap.set(taskKey, {
            id: ref.id,
            doc: { 
              id: ref.id,
              name: taskName, 
              processId: processesMap.get(procKey)!.id, 
              criteriaId: criterion ? criterion.id : '', 
              attachments: [], 
              companyId, 
              order: tasksMap.size 
            }
          });
        }
      }
    });

    // Commits
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitIfNeeded = async () => {
      if (opCount >= 450) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    for (const item of activitiesMap.values()) {
      currentBatch.set(doc(db, 'activities', item.id), item.doc);
      opCount++; await commitIfNeeded();
    }
    for (const item of processesMap.values()) {
      currentBatch.set(doc(db, 'processes', item.id), item.doc);
      opCount++; await commitIfNeeded();
    }
    for (const item of tasksMap.values()) {
      currentBatch.set(doc(db, 'tasks', item.id), item.doc);
      opCount++; await commitIfNeeded();
    }

    if (opCount > 0) await currentBatch.commit();

    setResult({ 
      success: true, 
      message: `Estructura importada: ${activitiesMap.size} actividades, ${processesMap.size} procesos y ${tasksMap.size} tareas.` 
    });
  };

  const exportData = async (type: ImportType) => {
    setLoading(true);
    try {
      let data: any[] = [];
      let fileName = '';

      if (type === 'criteria') {
        const q = query(collection(db, 'criteria'), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => {
          const crit = doc.data() as Criterion;
          crit.levels.forEach(level => {
            level.items.forEach(item => {
              data.push({
                'Criterio': crit.name,
                'Nivel': `Nivel ${level.level}`,
                'Subcriterio': item.description
              });
            });
          });
        });
        fileName = 'Criterios_Master';
      } else if (type === 'users_teams') {
        const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
        const uSnap = await getDocs(qUsers);
        const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId));
        const tSnap = await getDocs(qTeams);
        
        const teams = tSnap.docs.map(d => d.data() as Team);
        
        uSnap.docs.forEach(doc => {
          const user = doc.data() as User;
          const userTeams = teams.filter(t => t.members.some(m => m.uid === user.uid));
          
          if (userTeams.length > 0) {
            userTeams.forEach(t => {
              data.push({
                'Equipo': t.name,
                'ID Usuario': user.uid,
                'Email Usuario': user.email,
                'Nombre Usuario': user.name,
                'Rol': user.role
              });
            });
          } else {
            data.push({
              'Equipo': 'Sin Equipo',
              'ID Usuario': user.uid,
              'Email Usuario': user.email,
              'Nombre Usuario': user.name,
              'Rol': user.role
            });
          }
        });
        fileName = 'Usuarios_Equipos_Master';
      } else if (type === 'structure') {
        const qAct = query(collection(db, 'activities'), where('companyId', '==', companyId));
        const qProc = query(collection(db, 'processes'), where('companyId', '==', companyId));
        const qTask = query(collection(db, 'tasks'), where('companyId', '==', companyId));
        const qCrit = query(collection(db, 'criteria'), where('companyId', '==', companyId));
        
        const [aSnap, pSnap, tSnap, cSnap] = await Promise.all([
          getDocs(qAct), 
          getDocs(qProc), 
          getDocs(qTask),
          getDocs(qCrit)
        ]);
        
        const acts = aSnap.docs.map(d => d.data() as Activity);
        const procs = pSnap.docs.map(d => d.data() as Process);
        const tasks = tSnap.docs.map(d => d.data() as Task);
        const criteria = cSnap.docs.map(d => d.data() as Criterion);
        
        acts.forEach(a => {
          const actProcs = procs.filter(p => p.activityId === a.id);
          if (actProcs.length === 0) {
            data.push({ 'Actividad': a.name, 'Proceso': '', 'Tarea': '', 'Criterio': '' });
          } else {
            actProcs.forEach(p => {
              const procTasks = tasks.filter(t => t.processId === p.id);
              if (procTasks.length === 0) {
                data.push({ 'Actividad': a.name, 'Proceso': p.name, 'Tarea': '', 'Criterio': '' });
              } else {
                procTasks.forEach(t => {
                  const criterion = criteria.find(c => c.id === t.criteriaId);
                  data.push({ 
                    'Actividad': a.name, 
                    'Proceso': p.name, 
                    'Tarea': t.name,
                    'Criterio': criterion ? criterion.name : ''
                  });
                });
              }
            });
          }
        });
        fileName = 'Estructura_Master';
      } else if (type === 'team_hierarchy') {
        const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId));
        const tSnap = await getDocs(qTeams);
        const teams = tSnap.docs.map(d => d.data() as Team);
        
        teams.forEach(t => {
          const parent = t.parentTeamId ? teams.find(p => p.id === t.parentTeamId) : null;
          data.push({
            'Equipo': t.name,
            'Equipo Padre': parent ? parent.name : ''
          });
        });
        fileName = 'Jerarquia_Equipos_Master';
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (error: any) {
      console.error('Export error:', error);
      alert('Error al exportar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-600" />
          Datos Maestros
        </h1>
        <p className="text-gray-500 mt-1">
          Importación y exportación masiva de la configuración del sistema.
        </p>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="font-medium text-gray-700">Procesando datos...</p>
          </div>
        </div>
      )}

      {result && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${result.success ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
          {result.success ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <div>
            <p className="font-semibold">{result.success ? 'Operación completada' : 'Error en la operación'}</p>
            <p className="text-sm">{result.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Criteria Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
          <h3 className="font-bold text-gray-800 mb-2">Criterios</h3>
          <p className="text-xs text-gray-500 mb-4 h-12">
            Configuración de niveles evaluativos y sus descripciones detalladas.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleFileSelect('criteria')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => exportData('criteria')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Users & Teams Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
          <h3 className="font-bold text-gray-800 mb-2">Usuarios y Equipos</h3>
          <p className="text-xs text-gray-500 mb-4 h-12">
            Carga masiva de usuarios y creación de sus respectivos equipos de trabajo.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleFileSelect('users_teams')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => exportData('users_teams')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Structure Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
          <h3 className="font-bold text-gray-800 mb-2">Estructura Ops</h3>
          <p className="text-xs text-gray-500 mb-4 h-12">
            Jerarquía de Actividades, Procesos y Tareas para el mapa de procesos.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleFileSelect('structure')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => exportData('structure')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Team Hierarchy Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 transition-colors">
          <h3 className="font-bold text-gray-800 mb-2">Jerarquía Equipos</h3>
          <p className="text-xs text-gray-500 mb-4 h-12">
            Define la relación de subordinación entre diferentes equipos.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => handleFileSelect('team_hierarchy')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button
              onClick={() => exportData('team_hierarchy')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".xlsx, .xls, .csv"
      />

      <div className="mt-12 bg-blue-50 border border-blue-100 p-6 rounded-xl">
        <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Notas importantes para la importación
        </h4>
        <ul className="text-sm text-blue-700 space-y-2 list-disc pl-5">
          <li>Los archivos deben estar en formato Excel (.xlsx) o CSV.</li>
          <li>Asegúrate de que los nombres de las columnas coincidan exactamente con lo solicitado.</li>
          <li><strong>Criterios:</strong> Columnas [Criterio, Nivel, Subcriterio].</li>
          <li><strong>Usuarios/Equipos:</strong> Columnas [Equipo, ID Usuario, Email Usuario, Nombre Usuario, Rol].</li>
          <li><strong>Estructura:</strong> Columnas [Actividad, Proceso, Tarea, Criterio].</li>
          <li><strong>Jerarquía Equipos:</strong> Columnas [Equipo, Equipo Padre].</li>
        </ul>
      </div>
    </div>
  );
}
