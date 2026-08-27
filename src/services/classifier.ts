import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { config } from '../config/env.js';

export const ClassifierResultSchema = z.object({
  category: z.enum(['plan', 'exam', 'internship_log', 'other']),
  isActionable: z.boolean(),
  subject: z.string().default(''),
  date: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  cleanedText: z.string(),
  confirmationSummary: z.string(),
});

export type ClassifierResult = z.infer<typeof ClassifierResultSchema>;

const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const gemini = config.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: config.GEMINI_API_KEY }) : null;

function buildPrompt(rawMessage: string, now: DateTime): string {
  const currentIso = now.toISO();
  const currentFormatted = now.toFormat('EEEE, MMMM dd, yyyy HH:mm:ss');
  const timezone = config.TIMEZONE;

  return `You are Caduceus, a smart personal assistant bot for Fritz.
Your job is to classify unstructured text messages into one of three categories:
1. "plan": Any event, plan, reminder, social plan, date, personal errand, or meeting with a target date or timeframe (excluding academic exams or internship logs).
2. "exam": Academic tests, exams, quizzes, midterm/final exams, or certifications.
3. "internship_log": Day-to-day work notes, bug fixes, features built, tasks completed, or development updates (Fritz works at Banh Mi Kitchen Services Inc., building an LMS with quiz gating).
4. "other": Chit-chat, queries, questions, or random text that does not represent a plan, exam, or work log entry.

Current reference time: ${currentFormatted} (${timezone}) [ISO: ${currentIso}].

Rules:
- If a relative date is mentioned ("tomorrow", "next Friday", "in 3 days", "Sept 5"), resolve it to an absolute ISO-8601 date string relative to the current reference time in timezone ${timezone}.
- For exams, extract the subject name into "subject" (e.g. "Networks", "Database Systems").
- For plans, set "subject" to the event title.
- For internship logs, set "date" to the reference date if no specific past date is mentioned.
- Set "isActionable" to true for plans, exams, and internship logs. If the message is meaningless spam, greeting, or unsupported query, set "isActionable" to false and category to "other".
- Set "cleanedText" to a concise, clean formulation of the entry.
- Set "confirmationSummary" to a short 1-line human readable summary describing what was recorded.

Respond with ONLY a valid JSON object matching this schema:
{
  "category": "plan" | "exam" | "internship_log" | "other",
  "isActionable": boolean,
  "subject": string,
  "date": "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ssZZ" or null,
  "notes": string or null,
  "cleanedText": string,
  "confirmationSummary": string
}

Message to classify:
"""${rawMessage}"""`;
}

async function classifyWithGroq(rawMessage: string, now: DateTime): Promise<ClassifierResult> {
  const prompt = buildPrompt(rawMessage, now);
  const response = await groq.chat.completions.create({
    model: config.GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a precise classifier that outputs strictly valid JSON without any markdown formatting or explanations.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned empty response');
  }

  const parsed = JSON.parse(content);
  return ClassifierResultSchema.parse(parsed);
}

async function classifyWithGemini(rawMessage: string, now: DateTime): Promise<ClassifierResult> {
  if (!gemini || !config.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured for fallback');
  }

  const prompt = buildPrompt(rawMessage, now);
  const response = await gemini.models.generateContent({
    model: config.GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  const parsed = JSON.parse(text);
  return ClassifierResultSchema.parse(parsed);
}

export async function classifyMessage(rawMessage: string): Promise<ClassifierResult> {
  const now = DateTime.now().setZone(config.TIMEZONE);

  try {
    return await classifyWithGroq(rawMessage, now);
  } catch (groqError) {
    console.warn('⚠️ Groq classification failed, falling back to Gemini...', groqError);
    try {
      return await classifyWithGemini(rawMessage, now);
    } catch (geminiError) {
      console.error('❌ Both Groq and Gemini classification failed:', geminiError);
      throw new Error(`Classification error: Groq: ${(groqError as Error).message}, Gemini: ${(geminiError as Error).message}`);
    }
  }
}
