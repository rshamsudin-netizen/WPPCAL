import Anthropic from '@anthropic-ai/sdk';
import { loadMeals, saveMeal, formatMealLogForPrompt } from '@/lib/storage';
import type { ChatRequest, LogMealInput } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const LOG_MEAL_TOOL: Anthropic.Tool = {
  name: 'log_meal',
  description:
    'Log a confirmed meal entry with nutritional information. Only call this AFTER the user has confirmed all food items and portions have been determined.',
  input_schema: {
    type: 'object' as const,
    properties: {
      description: {
        type: 'string',
        description: 'A brief, human-readable description of the full meal (e.g., "Grilled chicken with rice and salad")',
      },
      items: {
        type: 'array',
        description: 'Each individual food item with its nutritional breakdown',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Food item name' },
            grams: { type: 'number', description: 'Weight in grams' },
            calories: { type: 'number', description: 'Total calories (kcal) for this portion' },
            protein_g: { type: 'number', description: 'Protein in grams' },
            carbs_g: { type: 'number', description: 'Carbohydrates in grams' },
            fat_g: { type: 'number', description: 'Fat in grams' },
          },
          required: ['name', 'grams', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
        },
      },
    },
    required: ['description', 'items'],
  },
};

function buildSystemPrompt(today: string, mealLog: string): string {
  return `You are a friendly, concise calorie tracking assistant in a WhatsApp-like chat interface. Help users track their daily food intake through natural conversation.

## Your Personality
- Friendly and encouraging, never judgmental
- Concise — like texting a knowledgeable friend
- Use emojis sparingly and naturally

## When a User Sends a Photo of Food
1. **Identify** all visible food items carefully
2. **Confirm each item one at a time** — keep it conversational:
   - "Looks like grilled chicken breast! Is that right? 🍗"
   - After confirmation, move to the next item
   - If the user corrects you ("No, it's turkey"), update your understanding
3. **Ask about portions** once all items are confirmed:
   - "Do you know the weight in grams? If not, I'll estimate from the photo."
   - If user provides grams: use their number
   - If user says they don't know: estimate visually and be transparent ("Estimating around 180g based on the plate — looks like a standard serving")
4. **Log the meal** by calling the log_meal tool once everything is settled
5. **Follow up** with a brief summary:
   - "Logged! That's ~520 kcal (Protein: 45g | Carbs: 38g | Fat: 14g). You're at 1,240 kcal today."

## If You Cannot Identify Food
- Describe what you see: "I see something dark and saucy — can you tell me what this is?"
- Ask for clarification before proceeding

## When a User Asks Questions
Answer naturally from the meal log. Examples:
- "What are my calories today?" → Sum today's logged meals
- "What did I eat this week?" → List meals from the last 7 days
- "How many calories do I have left?" → Assume 2,000 kcal daily goal unless user specifies otherwise, then calculate remaining
- "Can I still eat [food]?" → Estimate the food's calories and check against their remaining budget
- "What are my macros today?" → Show protein, carbs, fat breakdown

## Rules
- Call log_meal only ONCE per meal, after full confirmation
- Be transparent about estimates ("I'm estimating about 200g here")
- Slightly overestimate rather than underestimate calorie counts
- Keep responses short — this is a chat interface, not a report

## Context
Today's date: ${today}

${mealLog}`;
}

function buildClaudeMessages(
  history: { role: string; content: string }[],
  currentMessage: string,
  imageBase64?: string,
  imageMimeType?: string
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history (text only)
  for (const msg of history) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  // Add current message, with optional image
  if (imageBase64 && imageMimeType) {
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
    type ValidMimeType = (typeof validMimeTypes)[number];
    const mimeType: ValidMimeType = validMimeTypes.includes(imageMimeType as ValidMimeType)
      ? (imageMimeType as ValidMimeType)
      : 'image/jpeg';

    messages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: currentMessage.trim() || 'What food is this? Please help me track it.',
        },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: currentMessage,
    });
  }

  return messages;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();
    const { history, message, image, imageMimeType } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not set. Please add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const today = new Date().toLocaleDateString('en-CA');
    const meals = loadMeals();
    const mealLog = formatMealLogForPrompt(meals);
    const systemPrompt = buildSystemPrompt(today, mealLog);

    const claudeMessages = buildClaudeMessages(history, message, image, imageMimeType);

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [LOG_MEAL_TOOL],
      messages: claudeMessages,
    });

    // Handle tool use — loop until Claude is done with tool calls
    while (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (!toolUseBlock || toolUseBlock.name !== 'log_meal') break;

      const mealInput = toolUseBlock.input as LogMealInput;
      const mealId = saveMeal(mealInput);

      // Append assistant's tool_use response
      claudeMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Provide the tool result
      claudeMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify({
              success: true,
              meal_id: mealId,
              message: 'Meal logged successfully.',
            }),
          },
        ],
      });

      // Continue the conversation
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: [LOG_MEAL_TOOL],
        messages: claudeMessages,
      });
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const responseText = textBlock?.text ?? 'I encountered an issue. Please try again.';

    return Response.json({ message: responseText });
  } catch (error) {
    console.error('Chat API error:', error);
    const message =
      error instanceof Error ? error.message : 'Something went wrong. Please try again.';
    return Response.json({ error: message }, { status: 500 });
  }
}
