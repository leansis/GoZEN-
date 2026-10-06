import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase';

export interface UploadResult {
  url: string;
  storagePath: string;
  fileName: string;
  fileType: string;
}

export async function uploadFiveSFile(
  file: File | Blob,
  companyId: string,
  projectId: string,
  subpath: string,
  preferredFileName?: string
): Promise<UploadResult> {
  const timestamp = Date.now();
  const originalName = file instanceof File ? file.name : 'upload';
  const extension = originalName.includes('.') ? originalName.split('.').pop() || 'dat' : 'jpg';
  const cleanBaseName = preferredFileName ? preferredFileName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'file';
  const finalFileName = `${cleanBaseName}_${timestamp}.${extension}`;
  
  const storagePath = `5s/${companyId}/${projectId}/${subpath}/${finalFileName}`;
  const fileType = file.type || (extension === 'pdf' ? 'application/pdf' : 'image/jpeg');

  try {
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file, { contentType: fileType });
    const url = await getDownloadURL(snapshot.ref);

    return {
      url,
      storagePath,
      fileName: originalName,
      fileType
    };
  } catch (error) {
    console.warn('Storage upload error, falling back to data URL:', error);
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    return {
      url: dataUrl,
      storagePath,
      fileName: originalName,
      fileType
    };
  }
}

export async function uploadZoneLayout(
  file: File,
  companyId: string,
  projectId: string,
  zoneId: string
): Promise<UploadResult> {
  return uploadFiveSFile(file, companyId, projectId, `zones/${zoneId}/layout`, 'layout');
}

export async function uploadZoneInitialPhoto(
  file: File,
  companyId: string,
  projectId: string,
  zoneId: string
): Promise<UploadResult> {
  return uploadFiveSFile(file, companyId, projectId, `zones/${zoneId}/initial_photos`, 'initial_photo');
}

export async function deleteFiveSStorageFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.warn('Storage file deletion error (non-fatal):', error);
  }
}

// Legacy helper for backward-compatibility
export async function uploadFiveSImage(
  file: File | Blob,
  companyId: string,
  projectId: string,
  category: string,
  customName?: string
): Promise<string> {
  const res = await uploadFiveSFile(file, companyId, projectId, category, customName);
  return res.url;
}

export class FiveSStorageService {
  static async uploadZoneImage(companyId: string, projectId: string, zoneId: string, file: File): Promise<string> {
    const res = await uploadFiveSFile(file, companyId, projectId, `zones/${zoneId}`, 'zone_image');
    return res.url;
  }

  static async uploadSubzoneImage(companyId: string, projectId: string, zoneId: string, subzoneId: string, file: File): Promise<string> {
    const res = await uploadFiveSFile(file, companyId, projectId, `zones/${zoneId}/subzones/${subzoneId}`, 'subzone_image');
    return res.url;
  }

  static async uploadLayout(companyId: string, projectId: string, zoneId: string, file: File): Promise<UploadResult> {
    return uploadZoneLayout(file, companyId, projectId, zoneId);
  }

  static async uploadFile(file: File | Blob, companyId: string, projectId: string, subpath: string, preferredFileName?: string): Promise<UploadResult> {
    return uploadFiveSFile(file, companyId, projectId, subpath, preferredFileName);
  }
}
