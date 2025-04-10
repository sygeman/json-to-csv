import { NextResponse } from "next/server";
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
const expandArrayObjects = (data: JsonObject[]): JsonObject[] => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  const result: JsonObject[] = [];

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
      return;
    }

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

export async function POST(request: Request) {
  try {
    const { jsonData, fileName } = await request.json();

    if (!jsonData) {
      return NextResponse.json(
        { error: "Отсутствуют данные для конвертации" },
        { status: 400 }
      );
    }

    const data = Array.isArray(jsonData) ? jsonData : [jsonData];
    const expandedData = expandArrayObjects(data as JsonObject[]);

    if (!expandedData || expandedData.length === 0) {
      return NextResponse.json(
        { error: "Не удалось преобразовать данные" },
        { status: 400 }
      );
    }

    const csv = parse(expandedData);

    // Добавляем BOM в начало файла
    const BOM = "\uFEFF";
    const csvWithBOM = BOM + csv;

    return new NextResponse(csvWithBOM, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          fileName.replace(".json", "")
        )}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Ошибка при конвертации: " +
          (error instanceof Error ? error.message : "Неизвестная ошибка"),
      },
      { status: 500 }
    );
  }
}
