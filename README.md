# Linkage Message

Простой веб-мессенджер в реальном времени: HTML/CSS/JS + Firebase (Auth + Firestore), деплой на Vercel.

Никакого бэкенда/сборки не требуется — это статический сайт, лежащий в `public/`.

## 1. Настройка Firebase

1. Зайдите на https://console.firebase.google.com и создайте новый проект (бесплатный план Spark достаточен).
2. В проекте откройте **Build → Authentication → Get started** и включите провайдер **Anonymous**.
3. Откройте **Build → Firestore Database → Create database** (режим Production).
4. В **Firestore → Rules** вставьте содержимое файла [`firestore.rules`](./firestore.rules) из этого репозитория и нажмите Publish.
5. В **Project settings → General → Your apps** нажмите "Add app" → Web (`</>`), зарегистрируйте приложение (имя любое, Hosting не подключать).
6. Скопируйте объект `firebaseConfig`, который вам покажут, и вставьте его значения в файл [`public/firebase-config.js`](./public/firebase-config.js) вместо `YOUR_API_KEY` и т.д.

Эти ключи публичные по дизайну Firebase (используются в клиентском JS), безопасность обеспечивают Firestore Security Rules из шага 4, а не секретность ключей.

## 2. Локальная проверка

Файлы полностью статические, достаточно любого HTTP-сервера:

```bash
npx serve public
# или
python3 -m http.server 8000 --directory public
```

Откройте `http://localhost:3000` (или `:8000`), введите ник и войдите.

## 3. Деплой на Vercel

1. Запушьте этот репозиторий в свой GitHub.
2. На https://vercel.com нажмите **New Project → Import Git Repository** и выберите репозиторий.
3. Vercel определит статический проект. В настройках убедитесь, что **Output Directory** = `public` (уже прописано в `vercel.json`, менять не нужно). Framework Preset можно оставить "Other".
4. Нажмите **Deploy**.

После деплоя мессенджер будет доступен по адресу вида `https://<project>.vercel.app` — сообщения синхронизируются в реальном времени между всеми, кто открыл ссылку.

## Как это работает

- **Вход**: пользователь вводит ник → анонимная авторизация Firebase (`signInAnonymously`) + ник сохраняется как `displayName`.
- **Комнаты**: коллекция Firestore `rooms`, список обновляется в реальном времени (`onSnapshot`), любой авторизованный пользователь может создать комнату.
- **Сообщения**: подколлекция `rooms/{roomId}/messages`, тоже через `onSnapshot` — новые сообщения появляются у всех участников мгновенно, без перезагрузки.
- **Файлы**:
  - `public/index.html` — разметка
  - `public/style.css` — тёмная тема, адаптивная вёрстка (мобильный вид со сдвижным сайдбаром)
  - `public/app.js` — вся логика (Firebase modular SDK через CDN, ES-модуль)
  - `public/firebase-config.js` — сюда вставляются ваши ключи проекта
  - `firestore.rules` — правила безопасности Firestore
  - `vercel.json` — указывает Vercel, что раздавать нужно папку `public`

## Возможные доработки

- Приватные/защищённые паролем комнаты
- Индикатор "печатает…" и статус "онлайн" (через Firestore/RTDB presence)
- Загрузка изображений (Firebase Storage)
- Push-уведомления (Firebase Cloud Messaging)
