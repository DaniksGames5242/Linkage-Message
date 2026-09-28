import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./cloudinary-config.js";

// Client-side ceiling before we even try the network request. Cloudinary's
// free plan also enforces its own per-file limits (≈10 MB images/raw files,
// ≈100 MB video).
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export const uploadsConfigured = !!CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME !== "YOUR_CLOUD_NAME";

function resourceTypeFor(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) return "video";
  return "raw";
}

// Uploads a File/Blob straight from the browser to Cloudinary via an
// unsigned upload preset (no backend, no secret key in client code) and
// returns the resulting public HTTPS URL. `onProgress(0..1)` reports upload
// progress; `signal` (AbortSignal) cancels it.
export function uploadToCloudinary(file, resourceType, onProgress, signal) {
  return new Promise((resolve, reject) => {
    if (!uploadsConfigured) {
      reject(new Error("Отправка файлов ещё не настроена: заполните public/cloudinary-config.js (см. README.md)"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      reject(new Error(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум ${MAX_UPLOAD_BYTES / 1024 / 1024} МБ.`));
      return;
    }
    const type = resourceType || resourceTypeFor(file);
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (_) {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.secure_url) {
        onProgress?.(1);
        resolve({ url: data.secure_url, bytes: data.bytes || file.size });
      } else {
        const msg = data?.error?.message || `Не удалось загрузить файл (код ${xhr.status})`;
        reject(new Error(/File size too large/i.test(msg) ? "Файл слишком большой для бесплатного тарифа Cloudinary" : msg));
      }
    };
    xhr.onerror = () => reject(new Error("Нет соединения с сервером загрузки"));
    xhr.onabort = () => reject(Object.assign(new Error("Загрузка отменена"), { name: "AbortError" }));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

// Large photos are re-encoded to ≤2560 px JPEG before upload (keeps them
// under the free-plan image limit and makes chats load faster). GIFs, PNGs
// with transparency needs and small files are sent as-is.
export async function prepareImageForUpload(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 2560;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (_) {
    return file;
  }
}
