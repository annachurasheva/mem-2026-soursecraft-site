import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter'; // Стандартный парсер фронтматтера в Astro

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, 'src', 'content', 'posts');

const FALLBACK_AUTHOR_ID = 'wikipedia'; // ID, который мы добавили в authors.yaml

let fixedCount = 0;

if (!fs.existsSync(postsDir)) {
  console.error(`❌ Директория не найдена: ${postsDir}`);
  process.exit(1);
}

fs.readdirSync(postsDir).forEach(file => {
  if (!file.endsWith('.md') && !file.endsWith('.mdx')) return;

  const filePath = path.join(postsDir, file);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  try {
    const parsed = matter(fileContent);
    let needsUpdate = false;

    const author = parsed.data.author;
    const authorIds = parsed.data.authorIds;

    // 1. Если author - это строка с wikipedia
    const isWikipediaString = typeof author === 'string' && author.toLowerCase().includes('wikipedia');
    
    // 2. Если authorIds - это объект (именно та ошибка, что вы видели)
    const isWikipediaObject = typeof authorIds === 'object' && authorIds !== null && !Array.isArray(authorIds);
    
    // 3. Если authorIds - массив, но содержит строку "wikipedia" вместо чистого ID
    const isWikipediaArray = Array.isArray(authorIds) && authorIds.some(id => typeof id === 'string' && id.toLowerCase().includes('wikipedia'));

    if (isWikipediaString || isWikipediaObject || isWikipediaArray) {
      // Заменяем на корректный массив с одним валидным ID
      parsed.data.authorIds = [FALLBACK_AUTHOR_ID];
      
      // Очищаем старое поле author, чтобы не дублировать данные
      delete parsed.data.author; 
      needsUpdate = true;
    }

    if (needsUpdate) {
      // matter.stringify корректно форматирует YAML с отступами в 2 пробела
      const newContent = matter.stringify(parsed.content, parsed.data, { indent: 2 });
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Исправлено: ${file}`);
      fixedCount++;
    }
  } catch (err) {
    console.error(`❌ Ошибка чтения ${file}:`, err.message);
  }
});

console.log(`\n🎉 Готово! Обновлено файлов: ${fixedCount}`);