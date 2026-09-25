# Отчёт: CI/CD сборка Astro-статики (Retypeset)

Репозиторий: `t145/astro-theme-retypeset`
Дата: **25 сентября 2026**
Статус: **работает — сборка успешна, артефакт `dist/` получен**

---

## 1. Прямая просьба пользователя

«Нужно настроить в SourceCraft CI/CD-сборку Astro-статики из шаблона Retypeset:

- сборка должна выполняться чётко и без лишней логики;
- всё необходимое (шаблон автора, его lock-файл, патч) уже лежит в репозитории;
- после сборки забрать папку `dist/` как артефакт;
- никаких дополнительных проверок и «кнопок» не добавлять».

## 2. Что сделано

### 2.1. Создан файл `.sourcecraft/ci.yaml`

В корне репозитория создан конфигурационный файл CI/CD SourceCraft с workflow `build-retypeset`.

Workflow выполняет одно задание `build-task` с одним кубиком `install-and-build`:

1. Docker-образ: `node:24.5.0` (точная версия).
2. Активация менеджера пакетов: `corepack prepare pnpm@10.33.0 --activate` — версия из поля `packageManager` файла `package.json`.
3. Установка зависимостей: `pnpm install --frozen-lockfile` — строго по lock-файлу автора.
   Патч `patches/@qwik.dev__partytown@0.11.2.patch` применяется автоматически через блок `pnpm.patchedDependencies` в `package.json`.
4. Сборка: `pnpm build` (`astro check` → `astro build` → `apply-lqip`).
5. Артефакт: папка `dist/` сохраняется из кубика `install-and-build`.

Установка → патч → сборка выполняются в одном кубике, чтобы изменения в `node_modules` не терялись между шагами.

### 2.2. Автозапуск

Workflow запускается автоматически (`on.push`) при изменениях в ветке `master`, затрагивающих код или контент:

- `package.json`
- `pnpm-lock.yaml`
- `patches/**`
- `scripts/**`
- `src/**`
- `public/**`
- `astro.config.ts`

Изменения других файлов (например, `README.md` или `reports/**`) автозапуск не вызывают.

---

## 3. Успешное завершение теста

**Запуск № 9 — SUCCESS.**

- Workflow: `build-retypeset`
- Задание: `build-task`
- Кубик: `install-and-build` — **success**
- Артефакт: `dist/` — **создан** (статус `AS_SUCCESS`)
- Результат: статика собрана на шаблонных данных, артефакт скачан пользователем.

---

## 4. Как пользоваться

### 4.1. Подгрузить статьи (контент для сборки)

Статьи в теме Retypeset лежат в папке:

```
src/content/posts/
```

1. Добавьте файл статьи (Markdown `.md` или MDX `.mdx`) в `src/content/posts/`.
   - Пример формата: `src/content/posts/Universal Post.md`.
2. Изображения для статей кладите в `src/content/posts/_images/` (или указывайте относительные пути).
3. Закоммитьте изменения в ветку `master` — workflow запустится автоматически (путь `src/**` входит в фильтр автозапуска).

> Важно: frontmatter статей должен быть корректным YAML (списки в `tags:` — с одинаковым отступом в 2 пробела), иначе сборка остановится на этапе `astro check`.

### 4.2. Запустить сборку вручную (опционально)

1. Репозиторий `astro-theme-retypeset` → раздел **Автоматизации → CI/CD**.
2. Нажмите **Новый запуск**:
   - ветка конфигурации: `master`;
   - workflow: `build-retypeset`;
   - ветка запуска: `master`.
3. Нажмите **Запустить**.

### 4.3. Забрать артефакт `dist/`

После успешного завершения:

1. В карточке кубика `install-and-build` (правый нижний угол) нажмите кнопку скачивания артефакта.
2. Скачанный архив содержит собранную статику — папку `dist/`.
3. Артефакты хранятся **14 дней**; затем удаляются. Повторная сборка — новый запуск workflow.

> Альтернативно артефакт можно получить через REST API:
> `GET https://api.sourcecraft.tech/repos/{org}/{repo}/cicd/artifacts/{run}/{workflow}/{task}/{cube}`
> (подробнее: https://sourcecraft.dev/portal/docs/ru/api-ref/CICD/GetCubeArtifacts.html)

---

## 5. Важные ограничения

- **«Конец сессии» — это нормально**: контейнер CI/CD живёт только во время запуска и уничтожается после него. Остаются только артефакты и логи.
- **В репозиторий результаты сборки не записываются**: `dist/` только выгружается как артефакт.
- **Сборка строго по lock-файлу**: `pnpm install --frozen-lockfile` упадёт с ошибкой, если `pnpm-lock.yaml` рассинхронизирован с `package.json`. В этом случае обновите lock-файл и закоммитьте его.

---

## 6. Полезные ссылки

- Концепция CI/CD: https://sourcecraft.dev/portal/docs/ru/sourcecraft/concepts/ci-cd.html
- Настройка CI/CD: https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/ci-cd.html
- Ручной запуск workflow: https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/run-workflow-manually.html
- Получение артефактов через API: https://sourcecraft.dev/portal/docs/ru/api-ref/CICD/GetCubeArtifacts.html