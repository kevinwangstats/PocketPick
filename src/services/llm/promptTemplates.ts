export interface PromptPreset {
  id: string;
  label: string;
  prompt: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'analyze',
    label: 'ANALYZE DETAILS',
    prompt:
      'Analyze this photo carefully. Provide a concise title, short description, and key details or text visible in the image:',
  },
  {
    id: 'tags',
    label: 'SUGGEST TAGS',
    prompt:
      'Generate 8-12 searchable keywords, categories, and tags describing the content and style of this photo:',
  },
  {
    id: 'action_items',
    label: 'ACTION ITEMS',
    prompt:
      'Extract any actionable tasks, dates, checklist items, or next steps indicated in this photo:',
  },
  {
    id: 'translate',
    label: 'TRANSLATE',
    prompt: 'Identify any text written in this photo and accurately translate it into English:',
  },
];
