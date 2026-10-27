/** All wording for the "How to get free AI" screen lives here so it is easy to edit. No quota numbers on purpose. */

export interface GuideSection {
  id: 'a' | 'b' | 'c';
  title: string;
  tag: string;
  intro: string;
  steps: string[];
}

export const GUIDE_TITLE = 'How to get free AI';

export const GUIDE_INTRO =
  'You do not need to pay to use this app. There are three ways, from easiest to most technical. Free offers change, can be slow, and sometimes are not available, so keep copy and paste as your backup.';

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'a',
    title: 'Option A: free keys from a few websites',
    tag: 'Easiest, phone only',
    intro: 'A key is a long password that lets this app talk to an AI service. Free tiers have limits, so use more than one provider and let the app switch between them.',
    steps: [
      'Open Google AI Studio in your phone browser, sign in, and create an API key for Gemini. Copy it.',
      'In Settings, under My AI providers, tap Add provider, choose Gemini, paste the key, then tap Test key.',
      'Do the same for Groq (GroqCloud console, API Keys) and OpenRouter (Keys page). For OpenRouter, pick a model that ends in :free using Fetch available models.',
      'Put them in the order you want. In Fallback mode the app tries the first one and moves to the next when one is busy or out of free use. Spread load mode takes turns between them to stretch each free allowance.',
      'Keep "Last resort: manual copy and paste" on, so you can still study when every free service is busy.',
    ],
  },
  {
    id: 'b',
    title: 'Option B: one address for many free services',
    tag: 'Advanced, needs a computer on the same Wi-Fi',
    intro: 'FreeLLMAPI is a separate open source program (MIT licence) that you run yourself. It puts many free AI services behind one address. Its own page says it is for personal experiments only. Phones only reach it while on the same network.',
    steps: [
      'On a computer or Raspberry Pi, get FreeLLMAPI from github.com/tashfeenahmed/freellmapi and run it as its page explains (Docker one-liner, or npm run dev with Node 20 or newer).',
      'Open its dashboard in the computer browser on port 3001, add your free provider keys there, and copy the one key it gives you (it starts with freellmapi-).',
      'Find the computer address on your Wi-Fi, for example 192.168.1.20.',
      'In this app, add a Custom provider. Tap the FreeLLMAPI preset, replace the address with http://<computer address>:3001/v1, paste the key, and keep the model as auto.',
      'Tap Test key. The answer label will show which service really answered.',
      'The address starts with http://, which is not encrypted. Use it only on a Wi-Fi you trust. The same Custom option also works with Ollama or LM Studio running on your own computer.',
    ],
  },
  {
    id: 'c',
    title: 'Option C: copy and paste (always works)',
    tag: 'Free, no key',
    intro: 'The app writes a prompt for you. You paste it into the ChatGPT or Claude app you already use, then paste the reply back. Nothing needs a key or a server.',
    steps: [
      'In Settings choose Manual (copy and paste).',
      'When the app shows a prompt, tap Copy, open your chat app, paste it and send.',
      'Copy the answer and paste it back into the app.',
    ],
  },
];

export const GUIDE_HONESTY = [
  'Limits and model lists change without notice. Check each provider page for the current free allowance.',
  'Free tiers can be slow, busy or switched off.',
  'This guide and the provider connections were written without testing against the live services, so a step may need adjusting. If something fails, the app shows what went wrong and you can fall back to copy and paste.',
  'AI answers can be wrong. Check facts against your textbook.',
];
