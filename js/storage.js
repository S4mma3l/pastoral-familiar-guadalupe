// Image upload + compression utilities

const SUPABASE_STORAGE_URL = 'https://empcmythiraqbnfsiekf.supabase.co/storage/v1/object/public';

// Compress an image File to a Blob (max 1080px wide, JPEG 80%)
async function compressImage(file, maxWidth = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compress failed')), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Upload a file to Supabase Storage, returns the public URL
async function uploadImage(file, bucket, path) {
  const blob = await compressImage(file);
  const ext  = 'jpg';
  const key  = `${path}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(key, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;
  return `${SUPABASE_STORAGE_URL}/${bucket}/${data.path}`;
}

// Upload avatar for current user
async function uploadAvatar(file, userId) {
  return uploadImage(file, 'avatars', userId);
}

// Upload post image for current user
async function uploadPostImage(file, userId) {
  return uploadImage(file, 'post-images', userId);
}

// Show a file-picker and return the selected File
function pickImage(accept = 'image/*') {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}
