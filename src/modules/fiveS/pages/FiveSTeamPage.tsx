import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  Clock, 
  Shield, 
  Mail, 
  Phone, 
  Briefcase,
  Building,
  Calendar,
  Trash2, 
  Edit3, 
  Check, 
  Award, 
  Crown,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  ChevronDown,
  ChevronRight,
  UserMinus,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { useAppData } from '../../../contexts/AppDataContext';
import { useFiveSProject } from '../hooks/useFiveSProject';
import { useFiveSPermissions } from '../hooks/useFiveSPermissions';
import { FiveSHeader } from '../components/FiveSHeader';
import { 
  FiveSTeamMember, 
  FiveSFunctionalRole, 
  FIVE_S_ROLE_LABELS,
  FIVE_S_SHIFTS 
} from '../types/fiveSTypes';
import { FiveSService } from '../services/fiveSService';
import Modal from '../../../components/Modal';
import ConfirmModal from '../../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function FiveSTeamPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeCompanyId, dbUser } = useAuth();
  const { users } = useAppData();
  const { project, members, zones, subzones, loading } = useFiveSProject(projectId);
  const permissions = useFiveSPermissions(project, members);

  // Group name editing
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');

  // Collapsible former members section
  const [isFormerMembersOpen, setIsFormerMembersOpen] = useState(false);

  // Add/Edit member modal
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FiveSTeamMember | null>(null);

  // Form states
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedGozenUserId, setSelectedGozenUserId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberDepartment, setMemberDepartment] = useState('');
  const [memberJobTitle, setMemberJobTitle] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberShift, setMemberShift] = useState<string>('Mañana');
  const [memberAvailability, setMemberAvailability] = useState('4'); // hours/week
  const [memberRole, setMemberRole] = useState<FiveSFunctionalRole>('MEMBER');
  const [memberJoinedAt, setMemberJoinedAt] = useState(todayStr);
  const [memberIsLeader, setMemberIsLeader] = useState(false);
  const [memberIsActive, setMemberIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Retire / remove modal
  const [memberToRetire, setMemberToRetire] = useState<FiveSTeamMember | null>(null);
  const [memberToReactivate, setMemberToReactivate] = useState<FiveSTeamMember | null>(null);

  // Strict company users filtering
  const companyUsers = useMemo(() => {
    if (!activeCompanyId) return [];
    return users.filter(u => {
      const uCompanyId = u.companyId || (u as any).company_id;
      const uCompanyIds = (u as any).companyIds;
      return uCompanyId === activeCompanyId || (Array.isArray(uCompanyIds) && uCompanyIds.includes(activeCompanyId));
    });
  }, [users, activeCompanyId]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 font-medium">Cargando equipo de trabajo 5S...</p>
      </div>
    );
  }

  if (!project) return null;

  // Active vs Former Members
  const activeMembers = members.filter(m => m.isActive !== false && m.active !== false);
  const formerMembers = members.filter(m => m.isActive === false || m.active === false);

  const currentLeader = activeMembers.find(m => m.isLeader) || 
    activeMembers.find(m => m.role === 'LEADER');

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setSelectedGozenUserId('');
    setMemberName('');
    setMemberEmail('');
    setMemberDepartment(project.areaDepartment || '');
    setMemberJobTitle('');
    setMemberPhone('');
    setMemberShift('Mañana');
    setMemberAvailability('4');
    setMemberRole('MEMBER');
    setMemberJoinedAt(todayStr);
    setMemberIsLeader(false);
    setMemberIsActive(true);
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (m: FiveSTeamMember) => {
    setEditingMember(m);
    setSelectedGozenUserId(m.userId || '');
    setMemberName(m.name || m.userName || '');
    setMemberEmail(m.email || m.userEmail || '');
    setMemberDepartment(m.department || '');
    setMemberJobTitle(m.jobTitle || '');
    setMemberPhone(m.phone || '');
    setMemberShift(m.shift || 'Mañana');
    setMemberAvailability(String(m.dedicationHoursPerWeek || m.availability || '4'));
    setMemberRole(m.role || 'MEMBER');
    setMemberJoinedAt(m.dateJoined ? m.dateJoined.split('T')[0] : (m.joinedAt ? m.joinedAt.split('T')[0] : todayStr));
    setMemberIsLeader(Boolean(m.isLeader));
    setMemberIsActive(m.isActive !== false && m.active !== false);
    setIsMemberModalOpen(true);
  };

  const handleSelectGozenUser = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = e.target.value;
    setSelectedGozenUserId(uid);
    if (!uid) return;

    // Check if this user is already in activeMembers
    const alreadyActive = activeMembers.find(m => m.userId === uid);
    if (alreadyActive) {
      toast.error('Este usuario ya pertenece al equipo 5S.');
      setSelectedGozenUserId('');
      return;
    }

    const found = companyUsers.find(u => u.uid === uid || u.id === uid);
    if (found) {
      setMemberName(found.name || '');
      setMemberEmail(found.email || '');
      if (found.department) setMemberDepartment(found.department);
      if (found.jobTitle || found.role) setMemberJobTitle(found.jobTitle || found.role || '');
      if (found.phone) setMemberPhone(found.phone);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !project.id || !memberName.trim()) return;

    // Validate future date
    if (memberJoinedAt > todayStr) {
      toast.error('La fecha de incorporación al equipo 5S no puede ser futura.');
      return;
    }

    // Duplicate check for userId when creating new member
    if (!editingMember && selectedGozenUserId) {
      const alreadyInTeam = activeMembers.find(m => m.userId === selectedGozenUserId);
      if (alreadyInTeam) {
        toast.error('Este usuario ya pertenece al equipo 5S.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const hoursNum = parseFloat(memberAvailability) || 0;

      if (editingMember) {
        // If this member was marked as leader, promote through setProjectLeader
        if (memberIsLeader && !editingMember.isLeader) {
          await FiveSService.setProjectLeader(
            project.id,
            activeCompanyId,
            editingMember.id,
            memberName.trim(),
            selectedGozenUserId || editingMember.userId || undefined
          );
        }

        await FiveSService.updateTeamMember(editingMember.id, {
          name: memberName.trim(),
          userName: memberName.trim(),
          email: memberEmail.trim().toLowerCase(),
          userEmail: memberEmail.trim().toLowerCase(),
          department: memberDepartment.trim() || undefined,
          jobTitle: memberJobTitle.trim() || undefined,
          phone: memberPhone.trim() || undefined,
          shift: memberShift,
          availability: `${hoursNum} h/sem`,
          dedicationHoursPerWeek: hoursNum,
          role: memberIsLeader ? 'LEADER' : memberRole,
          isLeader: memberIsLeader,
          isActive: memberIsActive,
          active: memberIsActive,
          dateJoined: memberJoinedAt,
          joinedAt: memberJoinedAt,
          userId: selectedGozenUserId || editingMember.userId || undefined,
          updatedBy: dbUser?.name || dbUser?.uid || 'user'
        });

        toast.success('Miembro actualizado');
      } else {
        // Adding or reactivating
        const newId = await FiveSService.addTeamMember({
          projectId: project.id,
          companyId: activeCompanyId,
          userId: selectedGozenUserId || undefined,
          name: memberName.trim(),
          userName: memberName.trim(),
          email: memberEmail.trim().toLowerCase(),
          userEmail: memberEmail.trim().toLowerCase(),
          department: memberDepartment.trim() || undefined,
          jobTitle: memberJobTitle.trim() || undefined,
          phone: memberPhone.trim() || undefined,
          shift: memberShift,
          availability: `${hoursNum} h/sem`,
          dedicationHoursPerWeek: hoursNum,
          role: memberIsLeader ? 'LEADER' : memberRole,
          isLeader: memberIsLeader,
          joinedAt: memberJoinedAt,
          dateJoined: memberJoinedAt,
          isActive: true,
          active: true,
          createdBy: dbUser?.name || dbUser?.uid || 'user'
        });

        if (memberIsLeader) {
          await FiveSService.setProjectLeader(
            project.id,
            activeCompanyId,
            newId,
            memberName.trim(),
            selectedGozenUserId || undefined
          );
        }

        toast.success('Miembro incorporado al equipo 5S');
      }

      setIsMemberModalOpen(false);
    } catch (err: any) {
      console.error('Error saving team member:', err);
      toast.error(err.message || 'Error al guardar miembro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetLeader = async (member: FiveSTeamMember) => {
    if (!activeCompanyId || !project.id) return;
    try {
      await FiveSService.setProjectLeader(
        project.id,
        activeCompanyId,
        member.id,
        member.name || member.userName || '',
        member.userId
      );
      toast.success(`"${member.name || member.userName}" es ahora el Líder del grupo`);
    } catch (err: any) {
      toast.error('Error al cambiar líder: ' + err.message);
    }
  };

  const handleConfirmRetire = async () => {
    if (!memberToRetire) return;
    try {
      await FiveSService.retireTeamMember(
        memberToRetire.id, 
        dbUser?.name || dbUser?.email || dbUser?.uid || 'Usuario'
      );
      toast.success(`"${memberToRetire.name || memberToRetire.userName}" ha sido retirado del equipo 5S (pasa a Miembros Anteriores).`);
      setMemberToRetire(null);
    } catch (err: any) {
      toast.error('Error al retirar miembro: ' + err.message);
    }
  };

  const handleConfirmReactivate = async () => {
    if (!memberToReactivate) return;
    try {
      await FiveSService.activateTeamMember(
        memberToReactivate.id, 
        dbUser?.name || dbUser?.email || dbUser?.uid || 'Usuario'
      );
      toast.success(`"${memberToReactivate.name || memberToReactivate.userName}" ha sido reincorporado al equipo 5S.`);
      setMemberToReactivate(null);
    } catch (err: any) {
      toast.error('Error al reincorporar miembro: ' + err.message);
    }
  };

  const handleSaveGroupName = async () => {
    if (!groupNameInput.trim()) return;
    try {
      await FiveSService.updateProject(project.id, {
        groupName: groupNameInput.trim()
      });
      setIsEditingGroupName(false);
      toast.success('Nombre del grupo actualizado');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const totalDedicationHours = activeMembers
    .reduce((sum, m) => sum + (m.dedicationHoursPerWeek || 0), 0);

  const fallbackRoleStyle = { label: 'Miembro', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

  const roleBadgeStyles: Record<string, { label: string; bg: string; text: string; border: string }> = {
    RESPONSIBLE: { label: 'Responsable 5S / Consultor', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    LEADER: { label: 'Líder del grupo', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    MEMBER: { label: 'Miembro', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    AUDITOR: { label: 'Auditor', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    VIEWER: { label: 'Visualizador', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    // Lowercase & legacy roles support
    responsible: { label: 'Responsable 5S / Consultor', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    leader: { label: 'Líder del grupo', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
    member: { label: 'Miembro', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    auditor: { label: 'Auditor', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    viewer: { label: 'Visualizador', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    admin: { label: 'Administrador', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FiveSHeader project={project} zones={zones} subzones={subzones} />

      {/* Group Header & Leader Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                Grupo de Trabajo 5S
              </span>
              <span className="text-xs text-gray-400">• Proyecto: {project.code || '5S-001'}</span>
            </div>

            {isEditingGroupName ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="Nombre del grupo (ej: Equipo Kaizen 5S - Línea 1)"
                  className="px-3 py-1.5 text-base font-bold border border-blue-400 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-80"
                  autoFocus
                />
                <button
                  onClick={handleSaveGroupName}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-700"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setIsEditingGroupName(false)}
                  className="text-gray-500 px-2 py-1.5 text-xs hover:text-gray-800"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  {project.groupName || `Grupo de Trabajo - ${project.name}`}
                </h2>
                <button
                  onClick={() => {
                    setGroupNameInput(project.groupName || `Grupo de Trabajo - ${project.name}`);
                    setIsEditingGroupName(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition"
                  title="Editar nombre del grupo"
                >
                  <Edit3 size={15} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Planta: <strong>{project.plantOrCenter}</strong> • Área: <strong>{project.areaDepartment || 'General'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-medium">Dedicación Activa</span>
              <span className="text-lg font-black text-gray-900">{totalDedicationHours} h/semana</span>
            </div>

            <button
              onClick={handleOpenAddMember}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition shrink-0"
            >
              <UserPlus size={16} />
              <span>Añadir Miembro</span>
            </button>
          </div>
        </div>

        {/* Highlighted Leader Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Crown size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-md">
                  Líder del grupo
                </span>
                <span className="text-xs text-amber-800 font-semibold">Responsable principal de la implantación operativa</span>
              </div>
              <h3 className="text-lg font-black text-gray-900 mt-0.5">
                {currentLeader ? (currentLeader.name || currentLeader.userName) : (project.leaderName || 'Sin líder asignado')}
              </h3>
              {currentLeader && (
                <p className="text-xs text-gray-600 flex items-center gap-3 mt-0.5">
                  {currentLeader.email && (
                    <span className="flex items-center gap-1"><Mail size={12} /> {currentLeader.email}</span>
                  )}
                  {currentLeader.shift && (
                    <span>• Turno: <strong>{currentLeader.shift}</strong></span>
                  )}
                  {currentLeader.phone && (
                    <span>• Tel: {currentLeader.phone}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {!currentLeader && (
            <p className="text-xs text-amber-800 italic">
              Asigna a un miembro activo como líder del grupo para liderar los safaris y la resolución de tarjetas rojas.
            </p>
          )}
        </div>
      </div>

      {/* Roles & Competencies Matrix Guide */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5">
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Shield size={14} className="text-blue-600" /> Roles Funcionales dentro del Proyecto 5S
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <strong className="text-amber-800 block mb-0.5">Líder del grupo:</strong>
            <span className="text-gray-500 text-[11px]">Un único líder principal. Coordina la zona, dinamiza al equipo y valida mejoras.</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <strong className="text-indigo-800 block mb-0.5">Responsable 5S:</strong>
            <span className="text-gray-500 text-[11px]">Facilitador / Consultor metodológico, diseña auditorías y apoya la implantación.</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <strong className="text-slate-800 block mb-0.5">Miembro:</strong>
            <span className="text-gray-500 text-[11px]">Operario de puesto. Aplica orden y limpieza, reporta anomalías y ejecuta acciones.</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <strong className="text-purple-800 block mb-0.5">Auditor:</strong>
            <span className="text-gray-500 text-[11px]">Inspecciona con los checklists periódicos y evalúa objetivamente las 5S.</span>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
            <strong className="text-emerald-800 block mb-0.5">Visualizador:</strong>
            <span className="text-gray-500 text-[11px]">Consulta métricas, paneles y estado general sin permisos de edición.</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: MIEMBROS ACTIVOS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h3 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            MIEMBROS ACTIVOS ({activeMembers.length})
          </h3>
          <span className="text-xs text-gray-400">
            Integrantes operativos con dedicación semanal en el proyecto
          </span>
        </div>

        {activeMembers.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-200 shadow-xs max-w-lg mx-auto">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={28} />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">No hay miembros activos en el equipo</h4>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              Incorpora al primer integrante de la empresa para arrancar con el equipo de trabajo.
            </p>
            <button
              onClick={handleOpenAddMember}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition"
            >
              <UserPlus size={15} /> Añadir Miembro Activo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeMembers.map((member) => {
              const roleKey = member.role ? String(member.role) : 'MEMBER';
              const roleStyle = roleBadgeStyles[roleKey] || fallbackRoleStyle;
              const isThisLeader = member.isLeader || (member.role as string) === 'LEADER' || (member.role as string) === 'leader';
              const joinDate = member.dateJoined || member.joinedAt || '';

              return (
                <div
                  key={member.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between relative group ${
                    isThisLeader 
                      ? 'border-amber-300 ring-2 ring-amber-100 shadow-sm' 
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl font-black flex items-center justify-center text-sm border shrink-0 ${
                          isThisLeader 
                            ? 'bg-amber-100 text-amber-800 border-amber-300' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {(member.name || member.userName || '5S').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-gray-900 text-sm">{member.name || member.userName}</h4>
                            {isThisLeader && (
                              <span title="Líder del grupo">
                                <Crown size={14} className="text-amber-500 fill-amber-500" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500">
                            {member.jobTitle || 'Puesto no especificado'} 
                            {member.department && ` • ${member.department}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditMember(member)}
                          className="text-gray-300 hover:text-blue-600 p-1 rounded-lg transition"
                          title="Editar datos del integrante"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setMemberToRetire(member)}
                          className="text-gray-300 hover:text-red-600 p-1 rounded-lg transition"
                          title="Retirar del equipo 5S (mantener histórico)"
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Badges and Role */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                        {isThisLeader ? 'Líder del grupo' : roleStyle.label}
                      </span>

                      <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Check size={11} /> Activo
                      </span>

                      {member.shift && (
                        <span className="text-[11px] font-medium bg-gray-50 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-md">
                          Turno: {member.shift}
                        </span>
                      )}
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1 text-xs text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100 mb-3">
                      {member.email && (
                        <p className="flex items-center gap-2 truncate">
                          <Mail size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </p>
                      )}
                      {member.phone && (
                        <p className="flex items-center gap-2">
                          <Phone size={13} className="text-gray-400 shrink-0" />
                          <span>{member.phone}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2 text-gray-500">
                        <Clock size={13} className="text-blue-500 shrink-0" />
                        <span>Dedicación: <strong>{member.dedicationHoursPerWeek || member.availability || 0} h/semana</strong></span>
                      </p>
                      {joinDate && (
                        <p className="flex items-center gap-2 text-gray-400 text-[11px]">
                          <Calendar size={12} className="shrink-0" />
                          <span>Incorporado: {joinDate.split('T')[0]}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Actions */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {!isThisLeader && (
                        <button
                          onClick={() => handleSetLeader(member)}
                          className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                        >
                          <Crown size={12} /> Designar Líder
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setMemberToRetire(member)}
                      className="text-[11px] text-red-600 hover:text-red-800 transition font-medium"
                    >
                      Retirar del equipo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: MIEMBROS ANTERIORES (Colapsable) */}
      <div className="bg-gray-50/70 border border-gray-200 rounded-2xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsFormerMembersOpen(!isFormerMembersOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-100/60 transition"
        >
          <div className="flex items-center gap-2.5">
            <RotateCcw size={16} className="text-gray-500" />
            <h4 className="text-sm font-bold text-gray-800 tracking-tight">
              MIEMBROS ANTERIORES ({formerMembers.length})
            </h4>
            <span className="text-xs text-gray-500 hidden sm:inline">
              — Historial de integrantes que formaron parte de este proyecto 5S
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
            <span>{isFormerMembersOpen ? 'Ocultar' : 'Mostrar'}</span>
            {isFormerMembersOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </button>

        {isFormerMembersOpen && (
          <div className="p-5 border-t border-gray-200 bg-white">
            {formerMembers.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">
                No hay miembros anteriores registrados en este proyecto 5S.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Nombre</th>
                      <th className="py-2.5 px-3">Rol que tenía</th>
                      <th className="py-2.5 px-3">Fecha incorporación 5S</th>
                      <th className="py-2.5 px-3">Fecha retirada</th>
                      <th className="py-2.5 px-3">Retirado por</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {formerMembers.map((fm) => {
                      const roleKey = fm.role ? String(fm.role) : 'MEMBER';
                      const roleStyle = roleBadgeStyles[roleKey] || fallbackRoleStyle;
                      const joinStr = fm.dateJoined || fm.joinedAt ? (fm.dateJoined || fm.joinedAt).split('T')[0] : '—';
                      const removeStr = fm.dateRemoved || fm.inactiveAt ? (fm.dateRemoved || fm.inactiveAt).split('T')[0] : '—';

                      return (
                        <tr key={fm.id} className="hover:bg-gray-50/60 transition">
                          <td className="py-3 px-3 font-semibold text-gray-900">
                            {fm.name || fm.userName}
                            {fm.email && <span className="block text-[11px] font-normal text-gray-400">{fm.email}</span>}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                              {roleStyle.label}
                            </span>
                          </td>
                          <td className="py-3 px-3">{joinStr}</td>
                          <td className="py-3 px-3 text-red-600 font-medium">{removeStr}</td>
                          <td className="py-3 px-3 text-gray-400">{fm.removedBy || '—'}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setMemberToReactivate(fm)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                            >
                              <RotateCcw size={12} />
                              Reincorporar al equipo
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Add/Edit Member */}
      <Modal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title={editingMember ? 'Editar Integrante del Equipo 5S' : 'Añadir Integrante al Equipo 5S'}
      >
        <form onSubmit={handleSaveMember} className="space-y-4">
          {/* Quick select from existing GoZEN company users */}
          {!editingMember && companyUsers.length > 0 && (
            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
              <label className="block text-xs font-bold text-blue-900 mb-1">
                Seleccionar de Usuarios Registrados en GoZEN (Empresa Activa)
              </label>
              <select
                value={selectedGozenUserId}
                onChange={handleSelectGozenUser}
                className="w-full px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
              >
                <option value="">-- Introducir datos manualmente o elegir usuario --</option>
                {companyUsers.map(u => {
                  const isAlreadyActive = activeMembers.some(m => m.userId === (u.uid || u.id));
                  return (
                    <option 
                      key={u.uid || u.id} 
                      value={u.uid || u.id}
                      disabled={isAlreadyActive}
                    >
                      {u.name} • {u.email} {u.department ? `(${u.department})` : ''} {isAlreadyActive ? '[Ya pertenece al equipo]' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-blue-700/80 mt-1">
                Al seleccionar un usuario, sus datos se autocompletarán. Usuarios ya activos están protegidos contra duplicados.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Ej: Laura Martínez"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="laura@empresa.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Departamento</label>
              <input
                type="text"
                value={memberDepartment}
                onChange={(e) => setMemberDepartment(e.target.value)}
                placeholder="Ej: Producción, Calidad"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Puesto de Trabajo</label>
              <input
                type="text"
                value={memberJobTitle}
                onChange={(e) => setMemberJobTitle(e.target.value)}
                placeholder="Ej: Operario de Prensa"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={memberPhone}
                onChange={(e) => setMemberPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Turno de Trabajo *</label>
              <select
                value={memberShift}
                onChange={(e) => setMemberShift(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {FIVE_S_SHIFTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Dedicación (h/semana) *</label>
              <input
                type="number"
                min={0.5}
                max={40}
                step={0.5}
                required
                value={memberAvailability}
                onChange={(e) => setMemberAvailability(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Rol en Proyecto 5S *</label>
              <select
                value={memberRole}
                onChange={(e) => {
                  const r = e.target.value as FiveSFunctionalRole;
                  setMemberRole(r);
                  if (r === 'LEADER') {
                    setMemberIsLeader(true);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="MEMBER">Miembro</option>
                <option value="LEADER">Líder del grupo</option>
                <option value="RESPONSIBLE">Responsable 5S / Consultor</option>
                <option value="AUDITOR">Auditor</option>
                <option value="VIEWER">Visualizador</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Fecha de incorporación al equipo 5S *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={memberJoinedAt}
                onChange={(e) => setMemberJoinedAt(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                Inicio de participación en este proyecto (no permite fechas futuras).
              </span>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={memberIsLeader}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setMemberIsLeader(checked);
                    if (checked) setMemberRole('LEADER');
                  }}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <span className="flex items-center gap-1 text-amber-900">
                  <Crown size={14} className="text-amber-500" />
                  Designar como Líder principal del grupo
                </span>
              </label>

              {editingMember && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={memberIsActive}
                    onChange={(e) => setMemberIsActive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Integrante activo</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsMemberModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl shadow-sm transition"
            >
              {isSubmitting ? 'Guardando...' : (editingMember ? 'Actualizar Miembro' : 'Incorporar Miembro')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Retire Member Confirmation (Soft retirement into historical) */}
      <ConfirmModal
        isOpen={Boolean(memberToRetire)}
        onCancel={() => setMemberToRetire(null)}
        onConfirm={handleConfirmRetire}
        title="Retirar Integrante del Equipo 5S"
        message={`¿Estás seguro de que deseas retirar a "${memberToRetire?.name || memberToRetire?.userName}" del equipo activo? Pasará a la sección de "Miembros Anteriores" preservando su histórico y fecha de retirada.`}
      />

      {/* Reactivate Member Confirmation */}
      <ConfirmModal
        isOpen={Boolean(memberToReactivate)}
        onCancel={() => setMemberToReactivate(null)}
        onConfirm={handleConfirmReactivate}
        title="Reincorporar Integrante al Equipo 5S"
        message={`¿Deseas reincorporar a "${memberToReactivate?.name || memberToReactivate?.userName}" como miembro activo del equipo 5S?`}
      />
    </div>
  );
}
