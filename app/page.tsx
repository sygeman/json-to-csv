"use client";

import { useState, useRef } from "react";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

export default function Home() {
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<"processing" | "creating">("processing");
  const workerRef = useRef<Worker | null>(null);

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
      setIsConverting(true);
      setProgress(0);
      setStage("processing");
      const jsonData = JSON.parse(jsonInput);

      // Создаем воркер, если его еще нет
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("./worker.ts", import.meta.url));
      }

      // Обрабатываем сообщения от воркера
      workerRef.current.onmessage = (e) => {
        const {
          type,
          success,
          blob,
          error,
          progress,
          stage: newStage,
        } = e.data;

        if (type === "progress") {
          setProgress(progress);
          if (newStage) {
            setStage(newStage);
          }
          return;
        }

        if (type === "complete" && success) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.setAttribute("download", `${fileName.replace(".json", "")}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setError("");
          setIsConverting(false);
        } else if (type === "complete") {
          setError("Ошибка при конвертации: " + error);
          setIsConverting(false);
        }
      };

      // Отправляем данные воркеру
      workerRef.current.postMessage({ jsonData, fileName });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка при конвертации: " + errorMessage);
      setIsConverting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-800">
            Конвертер JSON в CSV
          </h1>
          <p className="text-gray-600">
            Загрузите ваш JSON файл и получите CSV
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <label className="w-full max-w-md">
              <span className="sr-only">Выберите JSON файл</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={isConverting}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-500 file:text-white
                  hover:file:bg-blue-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  cursor-pointer"
              />
            </label>
            {fileName && (
              <span className="text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
                Выбран файл: {fileName}
              </span>
            )}
          </div>

          <button
            onClick={handleConvert}
            disabled={!jsonInput || isConverting}
            className={`w-full max-w-md mx-auto py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
              !jsonInput || isConverting
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg transform hover:-translate-y-0.5"
            }`}
          >
            {isConverting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>
                  {stage === "processing"
                    ? `Обработка данных... ${Math.round(progress)}%`
                    : `Создание файла... ${Math.round(progress)}%`}
                </span>
              </>
            ) : (
              <span>Конвертировать в CSV</span>
            )}
          </button>

          {isConverting && (
            <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {error && (
            <div className="w-full max-w-md mx-auto p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
