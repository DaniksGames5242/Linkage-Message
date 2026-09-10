import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./cloudinary-config.js";

// Client-side ceiling before we even try the network request. Cloudinary's
// free unsigned-upload preset enforces its own (configurable) limit too.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function resourceTypeFor(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) return "video";
  return "raw";
}

// Uploads a File/Blob straight from the browser to Cloudinary via an
// unsigned upload preset (no backend, no secret key in client code) and
// returns the resulting public HTTPS URL.
export async function uploadToCloudinary(file, resourceType) {
  if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    throw new Error("Загрузка файлов не настроена: заполните public/cloudinary-config.js (см. README.md)");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум ${MAX_UPLOAD_BYTES / 1024 / 1024} МБ.`);
  }
  const type = resourceType || resourceTypeFor(file);
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${type}/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message || "Не удалось загрузить файл");
  }
  return { url: data.secure_url, bytes: data.bytes || file.size };
}
