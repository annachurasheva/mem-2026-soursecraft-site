# Отчёт: CI/CD сборка Astro-статики (Retypeset)

Репозиторий: `t145/astro-theme-retypeset`
Дата: по завершении задачи в issue #1
Статус: **готово к использованию**

---

## 1. Что сделано

### 1.1. Создан файл `.sourcecraft/ci.yaml`

В корне репозитория создан конфигурационный файл CI/CD SourceCraft. Он описывает workflow `build-retypeset`, который:

1. **Проверяет «лок-файл»** (кубик `check-lock`):
   - если в корне репозитория есть `pnpm-lock.yaml` — сборка **разрешена**;
   - если lock-файла нет — сборка **пропускается** (кубик сборки не выполняется).
   - Разрешение передаётся следующему кубику через переменную `BUILD_ALLOWED` (механизм `$SOURCECRAFT_ENV`).

2. **Устанавливает зависимости и собирает сайт** (кубик `install-and-build`):
   - Docker-образ: `node:24.5.0` (точная версия);
   - активация менеджера пакетов: `corepack prepare pnpm@10.33.0 --activate` — та же версия, что указана в `packageManager` файла `package.json`;
   - установка: `pnpm install --frozen-lockfile` (строго по lock-файлу; **патч** из `patches/@qwik.dev__partytown@0.11.2.patch` применяется автоматически через блок `pnpm.patchedDependencies` в `package.json`);
   - сборка: `pnpm build` (включает `astro check`, `astro build`, `pnpm apply-lqip` — генерация LQIP-заглушек для изображений);
   - установка → патч → сборка выполняются **в одном кубике**, чтобы изменения в `node_modules` не терялись между шагами.

3. **Сохраняет результат как артефакт**: папка `dist/` выгружается из кубика `install-and-build`.

### 1.2. Автозапуск

Workflow запускается автоматически (`on.push`) при изменениях в ветке `master`, затрагивающих код или контент:

- `package.json`
- `pnpm-lock.yaml`
- `patches/**`
- `scripts/**`
- `src/**`
- `public/**`
- `astro.config.ts`

Изменения других файлов (например, только `README.md` или `reports/**`) автозапуск **не** вызывают.

---

## 2. Как пользоваться

### 2.1. Подгрузить статьи-пробники (контент для проверки сборки)

Статьи в теме Retypeset лежат в папке:

```
src/content/posts/
```

1. Добавьте файл статьи (Markdown `.md` или MDX `.mdx`) в `src/content/posts/`.
   - Пример формата уже есть: `src/content/posts/Universal Post.md`.
   - Можно также положить файлы в подпапки, например `src/content/posts/examples/` — они подхватятся автоматически.
2. Изображения для статей кладите в `src/content/posts/_images/` (или указывайте относительные пути).
3. Закоммитьте изменения в ветку `master`.

> Примечание: изменения в `src/**` попадают в фильтр автозапуска — workflow запустится сам после коммита.

### 2.2. Запустить сборку вручную (опционально)

Если нужно запустить без изменений в коде:

1. Откройте репозиторий `astro-theme-retypeset` на портале SourceCraft.
2. Перейдите в раздел **Автоматизации → CI/CD**.
3. Нажмите **Новый запуск**:
   - ветка конфигурации: `master`;
   - workflow: `build-retypeset`;
   - ветка запуска: `master`.
4. Нажмите **Запустить**.

### 2.3. Проверить выполнение

1. В секции **CI/CD** откройте запущенный workflow.
2. Кубики задания `build-task`:
   - `check-lock` — проверка lock-файла;
   - `install-and-build` — установка и сборка (выполняется, только если lock-файл найден).
3. Убедитесь, что оба кубика завершились со статусом **success**.

### 2.4. Забрать артефакт `dist/`

После успешного завершения:

1. В карточке кубика `install-and-build` (правый нижний угол) нажмите кнопку скачивания артефакта.
2. Скачанный архив содержит собранную статику — папку `dist/`.
3. Артефакты хранятся **14 дней**; затем удаляются. Повторная сборка — новый запуск workflow.

> Альтернативно артефакт можно получить через REST API:
> `GET https://api.sourcecraft.tech/repos/{org}/{repo}/cicd/artifacts/{run}/{workflow}/{task}/{cube}`
> (подробнее: https://sourcecraft.dev/portal/docs/ru/api-ref/CICD/GetCubeArtifacts.html)

---

## 3. Важные ограничения

- **«Конец сессии» — это нормально**: контейнер CI/CD живёт только во время запуска и уничтожается после него. Единственное, что остаётся, — артефакты и логи.
- **В репозиторий результаты сборки не записываются**: `dist/` только выгружается как артефакт.
- **Сборка строго по lock-файлу**: `pnpm install --frozen-lockfile` упадёт с ошибкой, если `pnpm-lock.yaml` рассинхронизирован с `package.json` (например, после ручного добавления зависимости без обновления lock-файла). В этом случае обновите lock-файл и закоммитьте его.

---

## 4. Полезные ссылки

- Концепция CI/CD: https://sourcecraft.dev/portal/docs/ru/sourcecraft/concepts/ci-cd.html
- Настройка CI/CD: https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/ci-cd.html
- Ручной запуск workflow: https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/run-workflow-manually.html
- Передача переменных между кубиками: https://sourcecraft.dev/portal/docs/ru/sourcecraft/ci-cd-ref/env-vars-between-cubes.html
- Получение артефактов через API: https://sourcecraft.dev/portal/docs/ru/api-ref/CICD/GetCubeArtifacts.html