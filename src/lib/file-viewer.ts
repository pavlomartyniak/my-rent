import { router } from 'expo-router';

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|gif)$/i;

/** Чи це зображення: за типом файлу, а якщо його невідомо, за розширенням назви */
export const isImageFile = (name: string, mime?: string | null) => (mime ? mime.startsWith('image/') : IMAGE_EXT.test(name));

/** Відкриває файл, що вже лежить на пристрої, у переглядачі всередині застосунку */
export function openFileViewer(file: { uri: string; name: string; mime?: string | null }) {
  router.push({ pathname: '/file', params: { uri: file.uri, name: file.name, mime: file.mime ?? '' } });
}
