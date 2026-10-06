import { useMemo } from 'react';
import { useAuth } from '../../../AuthContext';
import { FiveSProject, FiveSTeamMember, FiveSRole } from '../types/fiveSTypes';

export function useFiveSPermissions(project: FiveSProject | null, members: FiveSTeamMember[] = []) {
  const { dbUser, isGlobalAdmin, isAdmin: isCompanyAdmin } = useAuth();

  return useMemo(() => {
    if (!dbUser) {
      return {
        role: 'viewer' as FiveSRole,
        canAdmin: false,
        canManageProject: false,
        canManageTeam: false,
        canCreateAction: false,
        canValidateAction: false,
        canAudit: false,
        canCreateStandard: false,
        canExport: false,
      };
    }

    const currentUserId = dbUser.uid || dbUser.id;
    const currentUserEmail = dbUser.email?.toLowerCase().trim();

    // Check if system administrator
    const isSystemAdmin = isGlobalAdmin || isCompanyAdmin || dbUser.role === 'admin' || dbUser.role === 'lean_promotor';

    // Check membership in this project
    const memberRecord = members.find(m => 
      m.userId === currentUserId || 
      (m.userEmail && m.userEmail.toLowerCase().trim() === currentUserEmail)
    );

    const isProjectResponsible = project?.responsibleId === currentUserId || project?.responsibleId === currentUserEmail;
    const isProjectLeader = project?.leaderId === currentUserId || project?.leaderId === currentUserEmail;

    let computedRole: FiveSRole = 'viewer';

    const roleUpper = (memberRecord?.role || '').toUpperCase();
    if (isSystemAdmin) {
      computedRole = 'admin';
    } else if (isProjectResponsible) {
      computedRole = 'responsible';
    } else if (isProjectLeader || roleUpper === 'LEADER') {
      computedRole = 'leader';
    } else if (roleUpper === 'AUDITOR') {
      computedRole = 'auditor';
    } else if (roleUpper === 'MEMBER') {
      computedRole = 'member';
    } else if (roleUpper === 'RESPONSIBLE') {
      computedRole = 'responsible';
    }

    const canAdmin = computedRole === 'admin';
    const canManageProject = canAdmin || computedRole === 'responsible';
    const canManageTeam = canManageProject || computedRole === 'leader';
    const canCreateAction = true; // All authenticated members can log opportunities / Safari 5S NOK
    const canValidateAction = canManageTeam || isProjectLeader;
    const canAudit = canManageProject || computedRole === 'auditor' || computedRole === 'leader';
    const canCreateStandard = canManageTeam || computedRole === 'responsible';
    const canExport = true;
    const canManagePlanning = canManageTeam || canManageProject || canAdmin;
    const canManageZones = canManageTeam || canManageProject || canAdmin;

    return {
      role: computedRole,
      canAdmin,
      canManageProject,
      canManageTeam,
      canManagePlanning,
      canManageZones,
      canCreateAction,
      canValidateAction,
      canAudit,
      canCreateStandard,
      canExport,
    };
  }, [dbUser, isGlobalAdmin, isCompanyAdmin, project, members]);
}
