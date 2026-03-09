import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Meal, MealStore, FoodItem, MealTotals, LogMealInput } from './types';

const DATA_DIR = join(process.cwd(), 'data');
const MEALS_FILE = join(DATA_DIR, 'meals.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadMeals(): Meal[] {
  ensureDataDir();
  try {
    const data = readFileSync(MEALS_FILE, 'utf-8');
    const store: MealStore = JSON.parse(data);
    return store.meals || [];
  } catch {
    return [];
  }
}

function calculateTotals(items: FoodItem[]): MealTotals {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein_g: acc.protein_g + item.protein_g,
      carbs_g: acc.carbs_g + item.carbs_g,
      fat_g: acc.fat_g + item.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

export function saveMeal(input: LogMealInput): string {
  ensureDataDir();
  const meals = loadMeals();
  const id = uuidv4();
  const now = new Date();

  const newMeal: Meal = {
    id,
    timestamp: now.toISOString(),
    date: now.toLocaleDateString('en-CA'), // YYYY-MM-DD format
    description: input.description,
    items: input.items,
    totals: calculateTotals(input.items),
  };

  meals.push(newMeal);
  const store: MealStore = { meals };
  writeFileSync(MEALS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  return id;
}

function formatDateLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return `${formatReadableDate(dateStr)} (Today)`;

  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date(todayStr + 'T12:00:00');
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return `${formatReadableDate(dateStr)} (Yesterday)`;
  return formatReadableDate(dateStr);
}

function formatReadableDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatMealLogForPrompt(meals: Meal[]): string {
  if (meals.length === 0) {
    return '## Meal Log\nNo meals logged yet.';
  }

  const byDate: Record<string, Meal[]> = {};
  for (const meal of meals) {
    if (!byDate[meal.date]) byDate[meal.date] = [];
    byDate[meal.date].push(meal);
  }

  const today = new Date().toLocaleDateString('en-CA');
  const sortedDates = Object.keys(byDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14); // last 14 days of data

  let output = '## Meal Log (Recent History)\n\n';

  for (const date of sortedDates) {
    const dayMeals = byDate[date];
    const dayTotals = dayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.totals.calories,
        protein_g: acc.protein_g + meal.totals.protein_g,
        carbs_g: acc.carbs_g + meal.totals.carbs_g,
        fat_g: acc.fat_g + meal.totals.fat_g,
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    output += `### ${formatDateLabel(date, today)}\n`;
    output += `Daily Total: ${Math.round(dayTotals.calories)} kcal | Protein: ${Math.round(dayTotals.protein_g)}g | Carbs: ${Math.round(dayTotals.carbs_g)}g | Fat: ${Math.round(dayTotals.fat_g)}g\n\n`;

    for (const meal of dayMeals) {
      const time = new Date(meal.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      output += `- ${time} — ${meal.description}\n`;
      output += `  ${Math.round(meal.totals.calories)} kcal | P: ${Math.round(meal.totals.protein_g)}g | C: ${Math.round(meal.totals.carbs_g)}g | F: ${Math.round(meal.totals.fat_g)}g\n`;
      for (const item of meal.items) {
        output += `  • ${item.name} (${item.grams}g): ${Math.round(item.calories)} kcal | P: ${item.protein_g}g | C: ${item.carbs_g}g | F: ${item.fat_g}g\n`;
      }
      output += '\n';
    }
  }

  return output;
}
