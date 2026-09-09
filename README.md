# Linkage Message

Веб-мессенджер: вход по email и паролю, профиль с юзернеймом и аватаром, поиск и добавление контактов по email/юзернейму, личные чаты в реальном времени, настройки профиля/приватности/уведомлений.

Стек: HTML/CSS/JS (без сборки) + Firebase (Email/Password Auth + Firestore), деплой — статический хостинг на Vercel.

Полностью бесплатно: работает на бесплатном тарифе Firebase **Spark**, без привязки карты — в отличие от Phone Auth, авторизация по email не требует тарифа Blaze.

Группы и каналы — следующий шаг, в этой версии их нет.

## 1. Настройка Firebase

1. https://console.firebase.google.com → создать проект.
2. **Build → Authentication → Get started → Sign-in method** → включите провайдер **Email/Password** (только первый переключатель "Email/Password", "Email link" не нужен).
3. **Build → Firestore Database → Create database** (режим Production, любой регион).
4. Вкладка **Rules** в Firestore → вставьте содержимое [`firestore.rules`](./firestore.rules) → **Publish**.
5. **Project settings → General → Your apps** → `</>` Web → зарегистрируйте приложение (Hosting не подключать) → скопируйте `firebaseConfig` в [`public/firebase-config.js`](./public/firebase-config.js).
6. **Authentication → Settings → Authorized domains** → добавьте домен, на котором будет открываться сайт (например `<project>.vercel.app`); `localhost` там уже есть по умолчанию.

Карту привязывать не нужно, тариф Spark остаётся бесплатным.

### Составной индекс Firestore

Список чатов сортируется по времени последнего сообщения (`orderBy lastMessageAt`) при фильтре по участнику (`array-contains`) — Firestore для такого запроса требует составной индекс. При первом открытии списка чатов в консоли браузера появится ошибка со ссылкой вида `https://console.firebase.google.com/.../firestore/indexes?create_composite=...` — просто перейдите по ней и нажмите «Create index» (создастся за 1-2 минуты, потом ошибка исчезнет сама).

## 2. Локальная проверка

```bash
npx serve public
# или
python3 -m http.server 8000 --directory public
```

## 3. Деплой на Vercel

1. Запушьте репозиторий в GitHub.
2. https://vercel.com → **New Project → Import Git Repository**.
3. Output Directory уже прописан в `vercel.json` как `public`, Framework Preset — "Other".
4. **Deploy**.
5. Не забудьте добавить `<project>.vercel.app` в Authorized domains (шаг 6 выше), иначе вход будет падать с ошибкой домена.

## Как это работает

**Вход и регистрация — отдельная страница `/login`:**
1. Пользователь выбирает вкладку «Вход» или «Регистрация», вводит email и пароль (минимум 6 символов) → `signInWithEmailAndPassword` / `createUserWithEmailAndPassword` (Firebase Auth).
2. Если профиля ещё нет (`users/{uid}` в Firestore отсутствует, т.е. это новая регистрация) — экран создания профиля: юзернейм (проверка уникальности в реальном времени), имя, аватар (эмодзи на цветном фоне, необязательно).
3. После успешного входа — редирект на `/` (сам мессенджер).

`/` (главная, `public/index.html` + `app.js`) сама ничего не знает про вход: если пользователь не авторизован или профиль не создан — редирект на `/login`. `/login` (`public/login.html` + `login.js`), в свою очередь, если пользователь уже авторизован и профиль есть — сразу редиректит на `/`. Оба редиректа — обычные `window.location.href`, роутера/SPA-навигации нет.

**Контакты:**
- Поиск по email или юзернейму (`@username`) в верхней части сайдбара.
- Найденного пользователя можно добавить в контакты и/или сразу написать (это тоже добавляет в контакты).
- Вкладка «Контакты» — список сохранённых контактов.

**Чаты:**
- Только личные (1:1), без групп/каналов.
- ID чата — детерминированная комбинация двух uid, коллекция `chats/{chatId}/messages`.
- Список чатов и сообщения обновляются в реальном времени через `onSnapshot`.

**Настройки (иконка профиля в сайдбаре):**
- *Профиль* — имя, юзернейм (со сменой через транзакцию, освобождает старый), статус/о себе, аватар.
- *Приватность* — кто видит email, кто видит время последнего захода, разрешён ли поиск по email. Проверяется на уровне клиента (см. ограничения ниже).
- *Уведомления* — звук, системные уведомления браузера (Notification API, работают пока вкладка открыта — без push/service worker), показывать ли превью текста.

## Структура данных Firestore

- `users/{uid}` — профиль: `email`, `username`, `displayName`, `avatarColor`, `avatarEmoji`, `bio`, `privacy`, `notifications`, `lastSeenAt`
- `usernames/{username}` → `{ uid }` — индекс уникальности юзернеймов
- `emails/{normalizedEmail}` → `{ uid }` — индекс для поиска по email
- `users/{uid}/contacts/{contactUid}` — личный список контактов
- `chats/{chatId}` — `participants`, `lastMessage`, `lastMessageAt`, `lastMessageSenderId`
- `chats/{chatId}/messages/{messageId}` — `text`, `senderId`, `createdAt`

## Файлы

- `public/login.html` + `public/login.js` — страница `/login`: email+пароль → создание профиля
- `public/index.html` + `public/app.js` — страница `/` (сам мессенджер): чаты, контакты, настройки
- `public/style.css` — тёмная тема, адаптивная вёрстка, общая для обеих страниц
- `public/firebase.js` — инициализация Firebase
- `public/auth.js` — email-авторизация, создание профиля, выход
- `public/contacts.js` — поиск и список контактов
- `public/chats.js` — чаты и сообщения
- `public/settings.js` — обновление профиля/приватности/уведомлений
- `public/utils.js` — общие хелперы (аватары, форматирование, валидация)
- `firestore.rules` — правила безопасности

## Известные ограничения

- Настройки приватности («кто видит email/последний визит/поиск по email») проверяются на клиенте — это ограничивает UI, но не является полноценной серверной защитой; для этого нужны Cloud Functions с более сложными правилами.
- Статус «в сети» — эвристика по `lastSeenAt` (обновляется раз в ~45 сек и при возврате на вкладку), а не настоящий realtime presence.
- Уведомления браузера работают только пока вкладка/приложение открыты в браузере — это не push-уведомления (для них нужен Firebase Cloud Messaging + Service Worker).
- Сброс забытого пароля (`sendPasswordResetEmail`) пока не реализован в UI.
- Групповые чаты и каналы не реализованы — следующий этап.
