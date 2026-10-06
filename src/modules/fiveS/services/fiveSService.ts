import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { handleFirestoreError, OperationType, cleanPayload } from '../../../lib/firestore-utils';
import { 
  FiveSProject, 
  FiveSTeamMember, 
  FiveSZone, 
  FiveSSubzone, 
  FiveSDedication,
  FiveSPlanningItem, 
  FiveSRedTag, 
  FiveSOrderItem, 
  FiveSCleaningTask, 
  FiveSVisualAction, 
  FiveSVisualStandard, 
  FiveSAudit, 
  FiveSAuditTemplate, 
  FiveSHistoryItem 
} from '../types/fiveSTypes';

export class FiveSService {
  // ================= PROJECTS =================
  static async getNextProjectCode(companyId: string): Promise<string> {
    try {
      const q = query(
        collection(db, 'fiveSProjects'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      let maxNum = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as FiveSProject;
        if (data.code) {
          const match = data.code.match(/5S-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (!isNaN(val) && val > maxNum) maxNum = val;
          }
        }
      });
      const nextNum = maxNum + 1;
      return `5S-${String(nextNum).padStart(3, '0')}`;
    } catch (err) {
      console.warn('Error computing next project code:', err);
      return `5S-${String(Date.now()).slice(-3)}`;
    }
  }

  static subscribeProjects(companyId: string, callback: (projects: FiveSProject[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSProjects'),
      where('companyId', '==', companyId)
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSProject));
      // Sort in memory by createdAt descending
      data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSProjects');
    });
  }

  static async getProject(projectId: string): Promise<FiveSProject | null> {
    try {
      const docSnap = await getDoc(doc(db, 'fiveSProjects', projectId));
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as FiveSProject;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `fiveSProjects/${projectId}`);
      return null;
    }
  }

  static async createProject(data: Omit<FiveSProject, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSProjects'), clean);
      
      // Log history
      await this.logHistory({
        projectId: docRef.id,
        companyId: data.companyId,
        type: 'project_updated',
        title: `Proyecto "${data.name}" Creado`,
        description: `Inicio del proyecto 5S [${data.code || '5S'}] en ${data.plantOrCenter}`,
        actorName: data.responsibleName || 'Sistema',
        timestamp: new Date().toISOString()
      });

      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSProjects');
      throw err;
    }
  }

  static async updateProject(projectId: string, data: Partial<FiveSProject>): Promise<void> {
    try {
      const clean = cleanPayload({
        ...data,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'fiveSProjects', projectId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSProjects/${projectId}`);
      throw err;
    }
  }

  static async deleteProject(projectId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSProjects', projectId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSProjects/${projectId}`);
      throw err;
    }
  }

  // ================= TEAMS =================
  static subscribeTeamMembers(projectId: string, companyId: string, callback: (members: FiveSTeamMember[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSTeams'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSTeamMember));
      // Sort leaders first, then active members, then inactive
      members.sort((a, b) => {
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return (a.name || a.userName || '').localeCompare(b.name || b.userName || '');
      });
      callback(members);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSTeams');
    });
  }

  static async addTeamMember(data: Omit<FiveSTeamMember, 'id'>): Promise<string> {
    try {
      // Duplicate check by projectId + userId (if userId provided)
      if (data.userId && data.projectId && data.companyId) {
        const q = query(
          collection(db, 'fiveSTeams'),
          where('companyId', '==', data.companyId),
          where('projectId', '==', data.projectId),
          where('userId', '==', data.userId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const existingDoc = snap.docs[0];
          const existingData = existingDoc.data() as FiveSTeamMember;
          
          if (existingData.isActive !== false && existingData.active !== false) {
            throw new Error('Este usuario ya pertenece al equipo 5S.');
          }

          // If previously removed, reactivate existing record instead of creating duplicate
          const nowStr = new Date().toISOString();
          const clean = cleanPayload({
            ...data,
            isActive: true,
            active: true,
            dateRemoved: null,
            inactiveAt: null,
            dateJoined: data.dateJoined || data.joinedAt || existingData.dateJoined || existingData.joinedAt || nowStr,
            joinedAt: data.joinedAt || data.dateJoined || existingData.joinedAt || existingData.dateJoined || nowStr,
            updatedBy: data.createdBy || 'user'
          });
          await updateDoc(doc(db, 'fiveSTeams', existingDoc.id), clean);
          return existingDoc.id;
        }
      }

      const nowStr = new Date().toISOString();
      const clean = cleanPayload({
        ...data,
        isActive: data.isActive !== false,
        active: data.active !== false,
        dateJoined: data.dateJoined || data.joinedAt || nowStr,
        joinedAt: data.joinedAt || data.dateJoined || nowStr
      });
      const docRef = await addDoc(collection(db, 'fiveSTeams'), clean);
      return docRef.id;
    } catch (err) {
      if ((err as Error)?.message?.includes('ya pertenece al equipo 5S')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.CREATE, 'fiveSTeams');
      throw err;
    }
  }

  static async updateTeamMember(memberId: string, data: Partial<FiveSTeamMember>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSTeams', memberId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSTeams/${memberId}`);
      throw err;
    }
  }

  static async setProjectLeader(
    projectId: string, 
    companyId: string, 
    newLeaderMemberId: string, 
    newLeaderName: string, 
    newLeaderUserId?: string
  ): Promise<void> {
    try {
      // 1. Update all existing members in this project to demote previous leader
      const q = query(
        collection(db, 'fiveSTeams'),
        where('companyId', '==', companyId),
        where('projectId', '==', projectId)
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const mem = d.data() as FiveSTeamMember;
        if (d.id === newLeaderMemberId) {
          await updateDoc(doc(db, 'fiveSTeams', d.id), {
            isLeader: true,
            role: 'LEADER',
            isActive: true,
            active: true
          });
        } else if (mem.isLeader) {
          await updateDoc(doc(db, 'fiveSTeams', d.id), {
            isLeader: false,
            role: mem.role === 'LEADER' ? 'MEMBER' : mem.role
          });
        }
      }

      // 2. Update project record
      await updateDoc(doc(db, 'fiveSProjects', projectId), {
        leaderId: newLeaderUserId || '',
        leaderName: newLeaderName,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSProjects/${projectId}`);
      throw err;
    }
  }

  static async deactivateTeamMember(memberId: string, updatedBy?: string): Promise<void> {
    try {
      const nowStr = new Date().toISOString();
      await updateDoc(doc(db, 'fiveSTeams', memberId), {
        isActive: false,
        active: false,
        inactiveAt: nowStr,
        dateRemoved: nowStr,
        removedBy: updatedBy || ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSTeams/${memberId}`);
      throw err;
    }
  }

  static async activateTeamMember(memberId: string, updatedBy?: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'fiveSTeams', memberId), {
        isActive: true,
        active: true,
        inactiveAt: null,
        dateRemoved: null,
        updatedBy: updatedBy || ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSTeams/${memberId}`);
      throw err;
    }
  }

  static async retireTeamMember(memberId: string, removedByName?: string): Promise<void> {
    return this.deactivateTeamMember(memberId, removedByName);
  }

  static async removeTeamMember(memberId: string, removedByName?: string): Promise<void> {
    // Soft retirement preserving historical record
    return this.deactivateTeamMember(memberId, removedByName);
  }

  // ================= ZONES & SUBZONES =================
  static async getNextZoneCode(projectId: string, companyId: string): Promise<string> {
    try {
      const q = query(
        collection(db, 'fiveSZones'),
        where('companyId', '==', companyId),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(q);
      let maxNum = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data() as FiveSZone;
        if (data.code) {
          const match = data.code.match(/Z-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (!isNaN(val) && val > maxNum) maxNum = val;
          }
        }
      });
      const nextNum = maxNum + 1;
      return `Z-${String(nextNum).padStart(2, '0')}`;
    } catch (err) {
      return `Z-01`;
    }
  }

  static subscribeZones(projectId: string, companyId: string, callback: (zones: FiveSZone[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSZones'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const zones = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSZone));
      zones.sort((a, b) => a.code.localeCompare(b.code));
      callback(zones);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSZones');
    });
  }

  static async addZone(data: Omit<FiveSZone, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSZones'), clean);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSZones');
      throw err;
    }
  }

  static async updateZone(zoneId: string, data: Partial<FiveSZone>): Promise<void> {
    try {
      const clean = cleanPayload({
        ...data,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'fiveSZones', zoneId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSZones/${zoneId}`);
      throw err;
    }
  }

  static async deleteZone(zoneId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSZones', zoneId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSZones/${zoneId}`);
      throw err;
    }
  }

  static async getNextSubzoneCode(zoneId: string, parentZoneCode: string, projectId: string, companyId: string): Promise<string> {
    try {
      const q = query(
        collection(db, 'fiveSSubzones'),
        where('companyId', '==', companyId),
        where('projectId', '==', projectId),
        where('zoneId', '==', zoneId)
      );
      const snapshot = await getDocs(q);
      const count = snapshot.docs.length + 1;
      const cleanPrefix = (parentZoneCode || 'Z-01').replace(/^Z-?/i, 'SZ-');
      return `${cleanPrefix}.${count}`;
    } catch (err) {
      const cleanPrefix = (parentZoneCode || 'Z-01').replace(/^Z-?/i, 'SZ-');
      return `${cleanPrefix}.1`;
    }
  }

  static subscribeSubzones(projectId: string, companyId: string, callback: (subzones: FiveSSubzone[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSSubzones'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const subzones = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSSubzone));
      subzones.sort((a, b) => a.code.localeCompare(b.code));
      callback(subzones);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSSubzones');
    });
  }

  static async addSubzone(data: Omit<FiveSSubzone, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSSubzones'), clean);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSSubzones');
      throw err;
    }
  }

  static async updateSubzone(subzoneId: string, data: Partial<FiveSSubzone>): Promise<void> {
    try {
      const clean = cleanPayload({
        ...data,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'fiveSSubzones', subzoneId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSSubzones/${subzoneId}`);
      throw err;
    }
  }

  static async deleteSubzone(subzoneId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSSubzones', subzoneId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSSubzones/${subzoneId}`);
      throw err;
    }
  }

  // ================= PLANNING & GANTT =================
  // ================= DEDICATIONS / AVAILABILITY =================
  static subscribeDedications(projectId: string, companyId: string, callback: (items: FiveSDedication[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSDedications'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSDedication));
      const dayOrder: Record<string, number> = {
        'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6, 'Domingo': 7
      };
      items.sort((a, b) => {
        const orderDiff = (dayOrder[a.dayOfWeek] || 99) - (dayOrder[b.dayOfWeek] || 99);
        if (orderDiff !== 0) return orderDiff;
        return a.startTime.localeCompare(b.startTime);
      });
      callback(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSDedications');
    });
  }

  static async addDedication(data: Omit<FiveSDedication, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const now = new Date().toISOString();
      const clean = cleanPayload({
        ...data,
        createdAt: now,
        updatedAt: now
      });
      const docRef = await addDoc(collection(db, 'fiveSDedications'), clean);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSDedications');
      throw err;
    }
  }

  static async updateDedication(dedicationId: string, data: Partial<FiveSDedication>): Promise<void> {
    try {
      const clean = cleanPayload({
        ...data,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'fiveSDedications', dedicationId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSDedications/${dedicationId}`);
      throw err;
    }
  }

  static async deleteDedication(dedicationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSDedications', dedicationId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSDedications/${dedicationId}`);
      throw err;
    }
  }

  // ================= PLANNING ACTIVITIES =================
  static subscribePlanning(projectId: string, companyId: string, callback: (items: FiveSPlanningItem[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSPlanningItems'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSPlanningItem));
      items.sort((a, b) => a.startDate.localeCompare(b.startDate));
      callback(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSPlanningItems');
    });
  }

  static async addPlanningItem(data: Omit<FiveSPlanningItem, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSPlanningItems'), clean);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSPlanningItems');
      throw err;
    }
  }

  static async updatePlanningItem(itemId: string, data: Partial<FiveSPlanningItem>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSPlanningItems', itemId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSPlanningItems/${itemId}`);
      throw err;
    }
  }

  static async deletePlanningItem(itemId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSPlanningItems', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSPlanningItems/${itemId}`);
      throw err;
    }
  }

  // ================= SEIRI - RED TAGS =================
  static subscribeRedTags(projectId: string, companyId: string, callback: (tags: FiveSRedTag[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSRedTags'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const tags = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSRedTag));
      tags.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      callback(tags);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSRedTags');
    });
  }

  static async addRedTag(data: Omit<FiveSRedTag, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSRedTags'), clean);

      await this.logHistory({
        projectId: data.projectId,
        companyId: data.companyId,
        type: 'red_tag',
        phase: '1S',
        title: `Tarjeta Roja [${data.tagNumber}]: ${data.itemDescription}`,
        description: `Zona: ${data.zoneName || data.zoneId}. Acción propuesta: ${data.actionProposed}`,
        actorName: data.createdByName || 'Operador',
        photoUrl: data.photoNokUrl,
        timestamp: new Date().toISOString(),
        entityId: docRef.id
      });

      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSRedTags');
      throw err;
    }
  }

  static async updateRedTag(tagId: string, data: Partial<FiveSRedTag>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSRedTags', tagId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSRedTags/${tagId}`);
      throw err;
    }
  }

  static async deleteRedTag(tagId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSRedTags', tagId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSRedTags/${tagId}`);
      throw err;
    }
  }

  // ================= SEITON - ORDER & LOCATION ITEMS =================
  static subscribeOrderItems(projectId: string, companyId: string, callback: (items: FiveSOrderItem[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSOrderItems'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSOrderItem));
      callback(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSOrderItems');
    });
  }

  static async addOrderItem(data: Omit<FiveSOrderItem, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSOrderItems'), clean);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSOrderItems');
      throw err;
    }
  }

  static async updateOrderItem(itemId: string, data: Partial<FiveSOrderItem>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSOrderItems', itemId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSOrderItems/${itemId}`);
      throw err;
    }
  }

  static async deleteOrderItem(itemId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSOrderItems', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSOrderItems/${itemId}`);
      throw err;
    }
  }

  // ================= SEISO - CLEANING & DIRT SOURCES =================
  static subscribeCleaningTasks(projectId: string, companyId: string, callback: (tasks: FiveSCleaningTask[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSCleaningTasks'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSCleaningTask));
      callback(tasks);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSCleaningTasks');
    });
  }

  static async addCleaningTask(data: Omit<FiveSCleaningTask, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSCleaningTasks'), clean);
      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSCleaningTasks');
      throw err;
    }
  }

  static async updateCleaningTask(taskId: string, data: Partial<FiveSCleaningTask>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSCleaningTasks', taskId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSCleaningTasks/${taskId}`);
      throw err;
    }
  }

  static async deleteCleaningTask(taskId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSCleaningTasks', taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSCleaningTasks/${taskId}`);
      throw err;
    }
  }

  // ================= VISUAL ACTIONS (NOK -> OK PDCA) =================
  static subscribeActions(projectId: string, companyId: string, callback: (actions: FiveSVisualAction[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSActions'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const actions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSVisualAction));
      actions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(actions);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSActions');
    });
  }

  static async addAction(data: Omit<FiveSVisualAction, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSActions'), clean);

      await this.logHistory({
        projectId: data.projectId,
        companyId: data.companyId,
        type: 'action_created',
        phase: data.phase,
        title: `Acción [${data.phase}]: ${data.title}`,
        description: `Responsable: ${data.assignedName || 'Sin asignar'}. Vencimiento: ${data.dueDate}`,
        actorName: data.createdByName || 'Usuario',
        photoUrl: data.photoNokUrl,
        timestamp: new Date().toISOString(),
        entityId: docRef.id
      });

      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSActions');
      throw err;
    }
  }

  static async updateAction(actionId: string, data: Partial<FiveSVisualAction>, actorName?: string): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSActions', actionId), clean);

      if (data.status === 'verified' || data.status === 'closed' || data.photoOkUrl) {
        await this.logHistory({
          projectId: data.projectId || '',
          companyId: data.companyId || '',
          type: 'action_resolved',
          phase: data.phase,
          title: `Acción Resuelta: ${data.title || 'Mejora implementada'}`,
          description: `Evidencia fotográfica OK verificada`,
          actorName: actorName || 'Responsable',
          photoUrl: data.photoOkUrl,
          timestamp: new Date().toISOString(),
          entityId: actionId
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSActions/${actionId}`);
      throw err;
    }
  }

  static async deleteAction(actionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSActions', actionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSActions/${actionId}`);
      throw err;
    }
  }

  // ================= SEIKETSU - VISUAL STANDARDS =================
  static subscribeStandards(projectId: string, companyId: string, callback: (standards: FiveSVisualStandard[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSStandards'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const standards = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSVisualStandard));
      standards.sort((a, b) => a.code.localeCompare(b.code));
      callback(standards);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSStandards');
    });
  }

  static async addStandard(data: Omit<FiveSVisualStandard, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSStandards'), clean);

      await this.logHistory({
        projectId: data.projectId,
        companyId: data.companyId,
        type: 'standard_approved',
        phase: data.phase,
        title: `Estándar [${data.code}]: ${data.title} (v${data.version})`,
        description: `Registrado en la zona ${data.zoneName || data.zoneId}`,
        actorName: data.approvedByName || 'Líder 5S',
        photoUrl: data.photoCorrectUrl,
        timestamp: new Date().toISOString(),
        entityId: docRef.id
      });

      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSStandards');
      throw err;
    }
  }

  static async updateStandard(standardId: string, data: Partial<FiveSVisualStandard>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSStandards', standardId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSStandards/${standardId}`);
      throw err;
    }
  }

  static async deleteStandard(standardId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSStandards', standardId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSStandards/${standardId}`);
      throw err;
    }
  }

  // ================= AUDIT TEMPLATES =================
  static subscribeAuditTemplates(companyId: string, callback: (templates: FiveSAuditTemplate[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSAuditTemplates'),
      where('companyId', '==', companyId)
    );
    return onSnapshot(q, (snapshot) => {
      const templates = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSAuditTemplate));
      callback(templates);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSAuditTemplates');
    });
  }

  static async seedDefaultAuditTemplateIfNone(companyId: string): Promise<void> {
    try {
      const q = query(collection(db, 'fiveSAuditTemplates'), where('companyId', '==', companyId));
      const snap = await getDocs(q);
      if (snap.empty) {
        const defaultTemplate: Omit<FiveSAuditTemplate, 'id'> = {
          companyId,
          title: 'Plantilla Estándar Auditoría 5S Industrial',
          description: 'Cuestionario integral de evaluación de las 5 fases 5S con criterios objetivos y puntuación del 0 al 5.',
          createdAt: new Date().toISOString(),
          questions: [
            // 1S Seiri
            { id: 'q-1s-1', phase: '1S', question: '¿Solo están presentes los materiales, herramientas y equipos necesarios en el puesto de trabajo?', criterion: 'Ausencia de objetos innecesarios o no identificados', weight: 1 },
            { id: 'q-1s-2', phase: '1S', question: '¿Se aplican tarjetas rojas a los elementos dudosos y se ubican en el área de cuarentena?', criterion: 'Control activo de tarjetas rojas y cuarentena', weight: 1 },
            { id: 'q-1s-3', phase: '1S', question: '¿Las cantidades de material en proceso están dentro de los límites autorizados?', criterion: 'Control estricto de WIP sin excesos ni acumulación', weight: 1 },
            // 2S Seiton
            { id: 'q-2s-1', phase: '2S', question: '¿Cada elemento tiene una ubicación claramente delimitada, rotulada y señalizada?', criterion: 'Marcaje en suelo, paneles de sombra y cartelería nítida', weight: 1 },
            { id: 'q-2s-2', phase: '2S', question: '¿Las herramientas y útiles se encuentran en su posición asignada y son fáciles de tomar/devolver en < 30 seg?', criterion: 'Principio ergonómico y panel sombra conforme', weight: 1 },
            { id: 'q-2s-3', phase: '2S', question: '¿Pasillos y salidas de emergencia están totalmente despejados y libres de obstáculos?', criterion: 'Vías de evacuación 100% libres', weight: 1 },
            // 3S Seiso
            { id: 'q-3s-1', phase: '3S', question: '¿El suelo, máquinas y bancos de trabajo están libres de polvo, virutas, aceite o restos?', criterion: 'Limpieza como método de inspección preventiva', weight: 1 },
            { id: 'q-3s-2', phase: '3S', question: '¿Se han identificado y controlado las fuentes de suciedad y fugas en el origen?', criterion: 'Causa raíz abordada y no acumulada', weight: 1 },
            { id: 'q-3s-3', phase: '3S', question: '¿Los útiles de limpieza están completos, en buen estado y en su soporte asignado?', criterion: 'Estación de limpieza 5S equipada y ordenada', weight: 1 },
            // 4S Seiketsu
            { id: 'q-4s-1', phase: '4S', question: '¿Existen estándares visuales visibles y actualizados (fotos OK/NOK) en la zona?', criterion: 'Ficha de estándar 5S plastificada o digital expuesta', weight: 1 },
            { id: 'q-4s-2', phase: '4S', question: '¿Las gamas de limpieza y responsabilidades periódicas están claramente asignadas?', criterion: 'Roles y rutinas de mantenimiento de orden asignados', weight: 1 },
            { id: 'q-4s-3', phase: '4S', question: '¿Se identifican con código de color los manómetros, niveles de aceite y sentidos de giro?', criterion: 'Gestión visual de parámetros operacionales', weight: 1 },
            // 5S Shitsuke
            { id: 'q-5s-1', phase: '5S', question: '¿Se realizan las auditorías periódicas de acuerdo con el calendario establecido?', criterion: 'Cumplimiento del plan de auditorías > 90%', weight: 1 },
            { id: 'q-5s-2', phase: '5S', question: '¿El equipo participa activamente y las desviaciones anteriores se corrigieron a tiempo?', criterion: 'Cierre eficaz de acciones PDCA derivadas', weight: 1 },
            { id: 'q-5s-3', phase: '5S', question: '¿Se mantiene el hábito 5S al finalizar el turno sin relajación de normas?', criterion: 'Disciplina consolidada y actitud proactiva de mejora', weight: 1 }
          ]
        };
        await addDoc(collection(db, 'fiveSAuditTemplates'), defaultTemplate);
      }
    } catch (e) {
      console.warn('Error checking/seeding audit template:', e);
    }
  }

  // ================= SHITSUKE - AUDITS =================
  static subscribeAudits(projectId: string, companyId: string, callback: (audits: FiveSAudit[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSAudits'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const audits = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSAudit));
      audits.sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || ''));
      callback(audits);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSAudits');
    });
  }

  static async addAudit(data: Omit<FiveSAudit, 'id'>): Promise<string> {
    try {
      const clean = cleanPayload(data);
      const docRef = await addDoc(collection(db, 'fiveSAudits'), clean);

      await this.logHistory({
        projectId: data.projectId,
        companyId: data.companyId,
        type: 'audit_completed',
        phase: '5S',
        title: `Auditoría 5S Realizada: ${data.title} (${data.score.toFixed(0)}%)`,
        description: `Auditor: ${data.auditorName}. Zona: ${data.zoneName || data.zoneId}. Hallazgos: ${data.findingsCount}`,
        actorName: data.auditorName,
        timestamp: new Date().toISOString(),
        entityId: docRef.id
      });

      // Update project score
      await this.updateProject(data.projectId, {
        currentScore: data.score,
        updatedAt: new Date().toISOString()
      });

      return docRef.id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'fiveSAudits');
      throw err;
    }
  }

  static async updateAudit(auditId: string, data: Partial<FiveSAudit>): Promise<void> {
    try {
      const clean = cleanPayload(data);
      await updateDoc(doc(db, 'fiveSAudits', auditId), clean);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiveSAudits/${auditId}`);
      throw err;
    }
  }

  static async deleteAudit(auditId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'fiveSAudits', auditId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiveSAudits/${auditId}`);
      throw err;
    }
  }

  // ================= HISTORY & TRACEABILITY =================
  static subscribeHistory(projectId: string, companyId: string, callback: (items: FiveSHistoryItem[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'fiveSHistory'),
      where('companyId', '==', companyId),
      where('projectId', '==', projectId)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FiveSHistoryItem));
      items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      callback(items);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'fiveSHistory');
    });
  }

  static async logHistory(item: Omit<FiveSHistoryItem, 'id'>): Promise<void> {
    try {
      const clean = cleanPayload(item);
      await addDoc(collection(db, 'fiveSHistory'), clean);
    } catch (err) {
      console.warn('Could not write fiveSHistory entry:', err);
    }
  }
}
