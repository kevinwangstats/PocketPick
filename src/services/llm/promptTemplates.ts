export interface PromptPreset {
  id: string;
  label: string;
  prompt: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'summarize',
    label: 'SUMMARIZE',
    prompt: 'Provide a concise, high-contrast 2-3 sentence summary of the following text:',
  },
  {
    id: 'action_items',
    label: 'ACTION ITEMS',
    prompt: 'Extract all actionable tasks, checklist items, and next steps as bullet points:',
  },
  {
    id: 'clean_ocr',
    label: 'CLEAN OCR',
    prompt:
      'Clean up typos, formatting errors, and noise in this OCR transcription while preserving original meaning:',
  },
  {
    id: 'translate',
    label: 'TRANSLATE',
    prompt: 'Translate the following text accurately into English:',
  },
];
