import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface AvatarUploadResult {
  path: string;
  publicUrl: string;
}

export async function uploadAvatar(file: File, userId: string): Promise<AvatarUploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be less than 5MB');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { data: existingFiles } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(userId);

  if (existingFiles && existingFiles.length > 0) {
    const deletePromises = existingFiles.map(file =>
      supabase.storage.from(AVATAR_BUCKET).remove([`${userId}/${file.name}`])
    );
    await Promise.all(deletePromises);
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
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
    const filePaths = files.map(file => `${userId}/${file.name}`);
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
