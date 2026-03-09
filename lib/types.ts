export interface FoodItem {
  name: string;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Meal {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  description: string;
  items: FoodItem[];
  totals: MealTotals;
}

export interface MealStore {
  meals: Meal[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

export interface APIHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  history: APIHistoryMessage[];
  message: string;
  image?: string;
  imageMimeType?: string;
}

export interface ChatResponse {
  message: string;
  error?: string;
}

export interface LogMealInput {
  description: string;
  items: FoodItem[];
}
