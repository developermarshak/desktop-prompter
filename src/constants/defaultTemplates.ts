import { PromptTemplate } from "../types";

export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "t1",
    name: "Chain of Thought",
    category: "technique",
    content: `Let's think step by step.
1. First, analyze the request.
2. Second, break down the problem into sub-components.
3. Third, solve each component.
4. Finally, synthesize the answer.

Request: {{request}}`,
  },
  {
    id: "t2",
    name: "Persona: Senior Engineer",
    category: "user",
    content: `Act as a world-class Senior Software Engineer. You value clean, maintainable code, adhere to SOLID principles, and prioritize performance.

Task: {{task}}`,
  },
  {
    id: "t3",
    name: "Few-Shot Learning",
    category: "technique",
    content: `Classify the sentiment of the text.

Text: "I loved the movie!"
Sentiment: Positive

Text: "The food was terrible."
Sentiment: Negative

Text: "{{text}}"
Sentiment:`,
  },
  {
    id: "t4",
    name: "Review & Critique",
    category: "technique",
    content: `Review the following content for errors, logical fallacies, and clarity improvements. Provide a bulleted list of constructive feedback.

Content:
"""
{{content}}
"""`,
  },
];
