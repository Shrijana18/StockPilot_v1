# Multi-Language Support (i18n)

StockPilot now supports multiple languages for seamless user experience across India.

## Supported Languages

- **English** (en) - Default
- **Hindi** (hi) - हिंदी
- **Marathi** (mr) - मराठी
- **Telugu** (te) - తెలుగు
- **Kannada** (kn) - ಕನ್ನಡ
- **Tamil** (ta) - தமிழ்

## How to Use

### 1. In React Components

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.welcomeBack')}</p>
    </div>
  );
}
```

### 2. With Variables/Interpolation

```jsx
const { t } = useTranslation();
const name = "John";

// In translation file: "welcome": "Welcome, {{name}}!"
<p>{t('common.welcome', { name })}</p>
```

### 3. Pluralization

```jsx
// In translation file:
// "items": "{{count}} item",
// "items_plural": "{{count}} items"

<p>{t('common.items', { count: 5 })}</p>
```

### 4. Language Switcher Component

```jsx
import LanguageSwitcher from './components/common/LanguageSwitcher';

// Use anywhere in your app
<LanguageSwitcher />
```

## Adding New Translations

1. Add the key to all language files in `src/i18n/locales/`
2. Use the same key structure across all languages
3. Keep translations contextually accurate

## Translation File Structure

```
src/i18n/locales/
├── en.json (English)
├── hi.json (Hindi)
├── mr.json (Marathi)
├── te.json (Telugu)
├── kn.json (Kannada)
└── ta.json (Tamil)
```

## Best Practices

1. **Use namespaced keys**: `section.subsection.key` format
2. **Keep keys descriptive**: `analytics.totalRevenue` not `tr`
3. **Don't translate dynamic content**: Product names, user data, etc.
4. **Test all languages**: Ensure UI doesn't break with longer translations
5. **Maintain consistency**: Use same terminology across sections

## Language Detection

The app automatically detects user language from:
1. LocalStorage (user preference)
2. Browser settings
3. Falls back to English

## Notes

- Language preference is saved in localStorage
- All functions and logic work the same regardless of language
- Numbers, dates, and currency are formatted according to locale
- RTL (Right-to-Left) support can be added if needed

