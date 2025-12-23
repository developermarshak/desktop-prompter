import { Chat, GoogleGenAI } from '@google/genai';

const MODEL_NAME = 'gemini-2.0-flash';

const getApiKey = (): string | undefined => {
  // Vite inlines env variables that start with VITE_
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GOOGLE_API_KEY ||
    undefined
  );
};

const buildClient = () => {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn(
      'Missing Gemini API key. Set VITE_GEMINI_API_KEY to enable the chat assistant.'
    );
    return null;
  }

  return new GoogleGenAI({ apiKey });
};

export const createChatSession = (): Chat | null => {
  const client = buildClient();
  if (!client) return null;

  try {
    return client.chats.create({ model: MODEL_NAME });
  } catch (error) {
    console.error('Failed to create Gemini chat session', error);
    return null;
  }
};

export const sendMessageStream = async (
  chat: Chat | null,
  message: string
): Promise<AsyncGenerator<{ text: string }>> => {
  if (!chat) {
    return (async function* () {
      yield {
        text: 'Gemini is not configured. Set VITE_GEMINI_API_KEY to enable chat.',
      };
    })();
  }

  try {
    const response = await chat.sendMessageStream({ message });

    // Normalize the SDK chunk into the `{ text }` shape the UI expects.
    return (async function* () {
      for await (const chunk of response) {
        const text =
          (chunk as any)?.text ??
          (chunk as any)?.candidates?.[0]?.content?.parts
            ?.map((part: any) => part?.text ?? '')
            .join('') ??
          '';
        yield { text };
      }
    })();
  } catch (error) {
    console.error('Gemini sendMessageStream failed', error);
    return (async function* () {
      yield {
        text: "I'm having trouble connecting to Gemini right now.",
      };
    })();
  }
};
