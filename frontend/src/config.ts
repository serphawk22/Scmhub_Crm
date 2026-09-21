let baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
  baseUrl = 'https://' + baseUrl;
}
// Remove trailing slash to prevent double-slash in URLs like //login
baseUrl = baseUrl.replace(/\/+$/, '');
export const API_BASE_URL = baseUrl;

// WhatsApp destination (digits only, no "+"). Configure via NEXT_PUBLIC_WHATSAPP_NUMBER.
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919502901416").replace(/\D/g, "");
export const WHATSAPP_DISPLAY = (process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY || "+91 9502901416");
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;
