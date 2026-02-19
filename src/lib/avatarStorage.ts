import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

interface AvatarUploadResult {
  path: string;
  publicUrl: string;
}

async function readMagicBytes(file: File): Promise<string | null> {
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  return null;
}

async function stripExifAndConvert(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Failed to process image')); return; }
          resolve(blob);
        },
        outputType,
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for processing'));
    };

    img.src = objectUrl;
  });
}

export async function uploadAvatar(file: File, userId: string): Promise<AvatarUploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be less than 3MB');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Only JPEG and PNG images are allowed. SVG, GIF, and other formats are not supported.');
  }

  const detectedType = await readMagicBytes(file);
  if (!detectedType) {
    throw new Error('Invalid image file. Only JPEG and PNG images are allowed.');
  }
  if (detectedType !== file.type && !(detectedType === 'image/jpeg' && file.type === 'image/jpeg')) {
    throw new Error('File content does not match its type. Upload rejected.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (accessToken) {
    const formData = new FormData();
    formData.append('file', file);
    const validationRes = await fetch(
      `${SUPABASE_URL}/functions/v1/validate-avatar-upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Apikey: SUPABASE_ANON_KEY,
        },
        body: formData,
      }
    );
    const validation = await validationRes.json();
    if (!validation.valid) {
      throw new Error(validation.error || 'Server rejected the file. Only JPEG and PNG images under 3MB are allowed.');
    }
  }

  const stripped = await stripExifAndConvert(file);

  if (stripped.size > MAX_FILE_SIZE) {
    throw new Error('Processed image exceeds 3MB. Please use a smaller image.');
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const filePath = `${userId}/${fileName}`;

  const { data: existingFiles } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId);

  if (existingFiles && existingFiles.length > 0) {
    const deletePromises = existingFiles.map(f =>
      supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/${f.name}`])
    );
    await Promise.all(deletePromises);
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, stripped, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    });

  if (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl
  };
}

export async function deleteAvatar(userId: string): Promise<void> {
  const { data: files } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId);

  if (files && files.length > 0) {
    const filePaths = files.map(f => `${userId}/${f.name}`);
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(filePaths);

    if (error) {
      throw new Error(`Failed to delete avatar: ${error.message}`);
    }
  }
}

export function getAvatarUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null;

  if (avatarPath.startsWith('data:')) {
    return avatarPath;
  }

  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(avatarPath);

  return publicUrl;
}

export function isBase64Avatar(avatarUrl: string | null): boolean {
  return avatarUrl?.startsWith('data:') ?? false;
}
