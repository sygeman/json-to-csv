"use client";

import { useState } from "react";
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
        // Для массивов объектов разворачиваем их в отдельные строки
        if (value.length > 0 && typeof value[0] === "object") {
          value.forEach((item, index) => {
            Object.assign(
              acc,
              flattenObject(item as JsonObject, `${pre}${key}__${index}`)
            );
          });
        } else {
          // Для простых массивов сохраняем как JSON строку
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
  data: JsonObject[] | null | undefined
): JsonObject[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  const result: JsonObject[] = [];

  data.forEach((item) => {
    const flattened = flattenObject(item);
    const arrays: { [key: string]: JsonObject[] } = {};

    // Собираем все массивы объектов
    Object.keys(flattened).forEach((key) => {
      const match = key.match(/^(.*?)__\d+__/);
      if (match) {
        const arrayKey = match[1];
        if (!arrays[arrayKey]) {
          arrays[arrayKey] = [];
        }
      }
    });

    // Если нет массивов объектов, просто добавляем плоский объект
    if (Object.keys(arrays).length === 0) {
      result.push(flattened);
      return;
    }

    // Создаем строки для каждого элемента массива
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
  });

  return result;
};

export default function Home() {
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Проверяем, что файл содержит валидный JSON
        JSON.parse(text);
        setJsonInput(text);
        setError("");
      } catch {
        setError("Ошибка: файл не содержит валидный JSON");
        setJsonInput("");
      }
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    try {
      const jsonData = JSON.parse(jsonInput);

      // Преобразуем вложенную структуру в плоскую
      const data = Array.isArray(jsonData) ? jsonData : [jsonData];
      const expandedData = expandArrayObjects(data as JsonObject[]);

      const csv = parse(expandedData);

      // Создаем blob и ссылку для скачивания
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `${fileName.replace(".json", "")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setError("");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка при конвертации: " + errorMessage);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">JSON в CSV Конвертер</h1>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="block">
              <span className="sr-only">Выберите JSON файл</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </label>
            {fileName && (
              <span className="text-sm text-gray-600">
                Выбран файл: {fileName}
              </span>
            )}
          </div>

          <button
            onClick={handleConvert}
            disabled={!jsonInput}
            className={`w-full py-2 px-4 rounded-lg transition-colors ${
              jsonInput
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            Конвертировать в CSV
          </button>

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
