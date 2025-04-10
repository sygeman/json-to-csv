import { parse } from "json2csv";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

// Функция для преобразования вложенного объекта в плоский
const flattenObject = (
  obj: JsonObject | null | undefined,
  prefix = ""
): Record<string, string | number | boolean | null> => {
  if (!obj) {
    return {};
  }
  return Object.keys(obj).reduce(
    (acc: Record<string, string | number | boolean | null>, key: string) => {
      const pre = prefix.length ? prefix + "__" : "";
      const value = obj[key];

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        Object.assign(acc, flattenObject(value as JsonObject, pre + key));
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "object") {
          value.forEach((item, index) => {
            Object.assign(
              acc,
              flattenObject(item as JsonObject, `${pre}${key}__${index}`)
            );
          });
        } else {
          acc[pre + key] = JSON.stringify(value);
        }
      } else {
        acc[pre + key] = value;
      }

      return acc;
    },
    {}
  );
};

// Функция для разворачивания массива объектов в плоскую структуру
const expandArrayObjects = (
  data: JsonObject[] | null | undefined,
  onProgress?: (progress: number) => void
): JsonObject[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  const result: JsonObject[] = [];
  const totalItems = data.length;
  let processedItems = 0;

  data.forEach((item) => {
    const flattened = flattenObject(item);
    const arrays: { [key: string]: JsonObject[] } = {};

    Object.keys(flattened).forEach((key) => {
      const match = key.match(/^(.*?)__\d+__/);
      if (match) {
        const arrayKey = match[1];
        if (!arrays[arrayKey]) {
          arrays[arrayKey] = [];
        }
      }
    });

    if (Object.keys(arrays).length === 0) {
      result.push(flattened);
    } else {
      Object.keys(arrays).forEach((arrayKey) => {
        const arrayItems = Object.keys(flattened)
          .filter((key) => key.startsWith(arrayKey + "__"))
          .reduce((acc: JsonObject[], key) => {
            const match = key.match(new RegExp(`^${arrayKey}__(\\d+)__(.*)$`));
            if (match) {
              const index = parseInt(match[1]);
              const field = match[2];
              if (!acc[index]) {
                acc[index] = {};
              }
              acc[index][field] = flattened[key];
            }
            return acc;
          }, []);

        arrayItems.forEach((arrayItem) => {
          const row = { ...flattened };
          Object.keys(row).forEach((key) => {
            if (key.startsWith(arrayKey + "__")) {
              delete row[key];
            }
          });
          Object.assign(row, arrayItem);
          result.push(row);
        });
      });
    }

    processedItems++;
    if (onProgress) {
      onProgress((processedItems / totalItems) * 100);
    }
  });

  return result;
};

self.onmessage = (e) => {
  try {
    const { jsonData } = e.data;
    const data = Array.isArray(jsonData) ? jsonData : [jsonData];

    const expandedData = expandArrayObjects(
      data as JsonObject[],
      (progress) => {
        self.postMessage({ type: "progress", progress, stage: "processing" });
      }
    );

    // Отправляем сообщение о начале создания файла
    self.postMessage({ type: "progress", progress: 0, stage: "creating" });

    // Создаем CSV
    const csv = parse(expandedData);

    // Отправляем прогресс создания файла
    self.postMessage({ type: "progress", progress: 50, stage: "creating" });

    // Создаем Blob
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Отправляем финальный прогресс
    self.postMessage({ type: "progress", progress: 100, stage: "creating" });

    // Отправляем результат
    self.postMessage({
      type: "complete",
      success: true,
      blob: blob,
      fileName: e.data.fileName,
    });
  } catch (error) {
    self.postMessage({
      type: "complete",
      success: false,
      error: error instanceof Error ? error.message : "Неизвестная ошибка",
    });
  }
};
