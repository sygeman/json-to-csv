"use client";

import { useState } from "react";
import { parse } from "json2csv";

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
      const csv = parse(jsonData);

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
