import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { config } from '../config/env.js';

const QueryScopeEnum = z.enum(['all', 'plans', 'exams', 'internship_log']);
const QueryFilterEnum = z.enum(['upcoming', 'all', 'this_week', 'overdue']);

export const ClassifierResultSchema = z.object({
  category: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      if (['plan', 'exam', 'internship_log', 'query', 'complete', 'delete', 'other'].includes(lower)) {
        return lower;
      }
    }
    return 'other';
  }, z.enum(['plan', 'exam', 'internship_log', 'query', 'complete', 'delete', 'other'])),

  isActionable: z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
    return true;
  }, z.boolean()),

  subject: z.preprocess((val) => (val == null ? '' : String(val)), z.string()),
  target_description: z.preprocess((val) => (val == null ? '' : String(val)), z.string()).default(''),
  date: z.preprocess((val) => (val == null || val === '' ? null : String(val)), z.string().nullable()),
  notes: z.preprocess((val) => (val == null || val === '' ? null : String(val)), z.string().nullable()),
  cleanedText: z.preprocess((val) => (val == null ? '' : String(val)), z.string()),
  confirmationSummary: z.preprocess((val) => (val == null ? '' : String(val)), z.string()),

  query_scope: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      if (['all', 'plans', 'exams', 'internship_log'].includes(lower)) {
        return lower;
      }
    }
    return 'all';
  }, QueryScopeEnum).default('all'),

  query_filter: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      if (['upcoming', 'all', 'this_week', 'overdue'].includes(lower)) {
        return lower;
      }
    }
    return 'upcoming';
  }, QueryFilterEnum).default('upcoming'),
});

export type ClassifierResult = z.infer<typeof ClassifierResultSchema>;

const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const gemini = config.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: config.GEMINI_API_KEY }) : null;

function buildPrompt(rawMessage: string, now: DateTime): string {
  const currentIso = now.toISO();
  const currentFormatted = now.toFormat('EEEE, MMMM dd, yyyy HH:mm:ss');
  const timezone = config.TIMEZONE;

  return `You are Caduceus, a smart personal assistant bot for Fritz.
Your job is to classify unstructured text messages into one of the following categories:
1. "plan": WRITE operation for a new event, plan, reminder, social plan, date, personal errand, or meeting with a target date or timeframe (excluding academic exams or internship logs).
2. "exam": WRITE operation for a new academic test, exam, quiz, midterm/final exam, or certification.
3. "internship_log": WRITE operation for day-to-day work notes, bug fixes, features built, tasks completed, or development updates (Fritz works at Banh Mi Kitchen Services Inc., building an LMS with quiz gating).
4. "query": READ operation asking to view, list, check, or retrieve stored items (e.g. "give me all the list of my todo", "what exams do I have", "what's on my plate this week", "show me what I logged for internship this week", "show all plans", "list my exams", "what do I need to do", etc.).
5. "complete": When the user says they have finished, completed, or are done with a previously recorded task, exam, or plan. Examples: "done with networks exam", "completed buying flowers", "finished the Rizal reflection", "marked networks exam as done".
6. "delete": When the user wants to cancel, remove, or delete a previously recorded task, exam, or plan. Examples: "cancel the 2x2 picture plan", "remove networks exam", "delete buying flowers", "cancel Rizal reflection".
7. "other": Chit-chat, greetings, random noise, or unsupported conversational queries.

Current reference time: ${currentFormatted} (${timezone}) [ISO: ${currentIso}].

Rules for "query":
- Trigger "query" whenever the message is asking about existing data rather than describing new data to record or modifying data.
- "query_scope":
  - "all": Generic questions about todos, tasks, agendas, upcoming items (e.g. "give me all the list of my todo", "what's on my plate", "show my tasks").
  - "plans": Specifically asking for plans or events (e.g. "list my plans", "what events do I have").
  - "exams": Specifically asking for exams or quizzes (e.g. "what exams do I have", "list upcoming exams").
  - "internship_log": Specifically asking for internship or work logs (e.g. "what did I log for internship", "show my work notes").
- "query_filter":
  - "upcoming": Default for general queries or future items.
  - "this_week": When asking about "this week", "next 7 days", or "coming days".
  - "overdue": When asking about overdue, missed, or past items.
  - "all": When explicitly asking for all items without time filters (e.g. "show all exams ever", "all logs").
- For "query", set isActionable to true, subject to query topic, and confirmationSummary to a concise summary.

Rules for "complete" and "delete":
- For "complete" and "delete", set "target_description" to a short identifying phrase of the item being completed or deleted (e.g., "networks exam", "buying flowers", "2x2 picture plan", "Rizal reflection").
- Set "isActionable" to true.
- Set "subject" to the item being referenced.
- Set "cleanedText" to a concise formulation of the action.
- Set "confirmationSummary" to a short 1-line human readable summary (e.g. "Marked Networks exam as complete", "Cancelled 2x2 picture plan").

Rules for "plan", "exam", "internship_log":
- If a relative date is mentioned ("tomorrow", "next Friday", "in 3 days", "Sept 5"), resolve it to an absolute ISO-8601 date string relative to the current reference time in timezone ${timezone}.
- For exams, extract the subject name into "subject" (e.g. "Networks", "Database Systems").
- For plans, set "subject" to the event title.
- For internship logs, set "date" to the reference date if no specific past date is mentioned.
- Set "isActionable" to true.
- Set "cleanedText" to a concise, clean formulation of the entry.
- Set "confirmationSummary" to a short 1-line human readable summary describing what was recorded.

Respond with ONLY a valid JSON object matching this schema:
{
  "category": "plan" | "exam" | "internship_log" | "query" | "complete" | "delete" | "other",
  "isActionable": boolean,
  "subject": string,
  "target_description": string,
  "date": "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ssZZ" or null,
  "notes": string or null,
  "cleanedText": string,
  "confirmationSummary": string,
  "query_scope": "all" | "plans" | "exams" | "internship_log",
  "query_filter": "upcoming" | "all" | "this_week" | "overdue"
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
