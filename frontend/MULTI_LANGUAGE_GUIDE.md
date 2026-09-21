# 🌍 Multi-Language Implementation Guide

Your SerphHawk CRM now supports **4 languages** with a dropdown selector on the main dashboard!

## Supported Languages

✅ **English** (en)  
✅ **Spanish** (es) - Español  
✅ **German** (de) - Deutsch  
✅ **French** (fr) - Français  
✅ **Italian** (it) - Italiano  

## How to Use

### For Users:
1. **Open your dashboard** (Admin, Employee, Intern, or Sales Manager)
2. **Look at the top-right corner** - You'll see a language dropdown button with a 🌐 globe icon
3. **Click the dropdown** to select your preferred language
4. **Language preference is saved** - Your choice is stored in browser localStorage

### For Developers:
The multi-language system is built using:
- **React Context API** - Global language state management
- **JSON translation files** - One file per language in `/src/translations/`
- **Hook-based API** - Use `useLanguage()` hook in components

## File Structure

```
frontend/src/
├── context/
│   └── LanguageContext.tsx      # Language context provider & hook
├── components/
│   └── LanguageSelector.tsx     # Dropdown language selector
├── translations/
│   ├── en.json                  # English translations
│   ├── es.json                  # Spanish translations
│   ├── de.json                  # German translations
│   ├── fr.json                  # French translations
│   └── it.json                  # Italian translations
└── app/
    └── layout.tsx               # Added LanguageProvider wrapper
```

## How to Add Translations

### 1. Update Translation Files
Edit the JSON files in `/src/translations/` to add new terms:

**en.json:**
```json
{
  "dashboard": {
    "welcome": "Welcome to SerphHawk CRM",
    "new_feature": "New feature description"
  }
}
```

**es.json:**
```json
{
  "dashboard": {
    "welcome": "Bienvenido a SerphHawk CRM",
    "new_feature": "Descripción de nueva función"
  }
}
```

(Add the same structure to `de.json`, `fr.json`, and `it.json`)

### 2. Use in Components

```tsx
import { useLanguage } from "@/context/LanguageContext";

export function MyComponent() {
  const { t } = useLanguage();
  
  return (
    <div>
      <h1>{t("dashboard.welcome")}</h1>
      <p>{t("dashboard.new_feature")}</p>
    </div>
  );
}
```

### 3. Access Current Language

```tsx
const { language } = useLanguage();
console.log(language); // "en", "es", "de", "fr", or "it"
```

### 4. Change Language Programmatically

```tsx
const { setLanguage } = useLanguage();

// Set to Spanish
setLanguage("es");
```

## Translation Keys Currently Available

### `common`
- `dashboard` - Dashboard label
- `email_agent` - Email Agent label
- `clients` - Clients label
- `projects` - Projects label
- `invoices` - Invoices label
- `tasks` - Tasks label
- `logout` - Logout button
- `settings` - Settings label
- `language` - Language label
- `english`, `spanish`, `german`, `french`, `italian` - Language names

### `dashboard`
- `welcome` - Welcome message
- `overview` - Overview label
- `recent_activity` - Recent Activity label
- `total_clients` - Total Clients label
- `active_projects` - Active Projects label
- `emails_sent` - Emails Sent label
- `total_calls` - Total Calls label
- `view_more` - View More button
- `add_client` - Add Client button
- `send_email` - Send Email button
- `create_project` - Create Project button

### `navigation`
All sidebar menu items (home, admin, audit, calls, documents, employees, etc.)

## Storage

Language preference is stored in **browser localStorage** with the key: `language`

To clear: `localStorage.removeItem("language")`

## Notes

- **Default language**: English (en)
- **Missing translations**: If a key is not found, the key itself is displayed
- **Case-sensitive**: Keys are case-sensitive (e.g., `dashboard.welcome` ≠ `Dashboard.Welcome`)
- **Fallback**: The system falls back to English if a translation is missing in another language

## Next Steps

1. ✅ Test the language dropdown in your dashboard
2. 📝 Add more translation keys as you develop new features
3. 🌐 Consider adding more languages if needed
4. 🔄 Share language preferences across user profiles (optional database integration)

---

**Questions?** The translation system is simple and extendable. Just add keys to JSON files and use `t("key.name")` in your components!
