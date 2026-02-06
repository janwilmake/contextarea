/**
 * Generates a catchy title for an AI interaction using OpenAI's GPT-4.1 Mini
 * Silently falls back to a default title if any errors occur
 */
export async function generateTitleWithAI(
  contextContent: string,
  apiKey: string,
): Promise<{ title: string; description: string }> {
  // Default response in case of any errors
  const defaultResponse = {
    title: "AI Conversation",
    description: "Generated conversation summary",
  };

  // Guard against missing API key
  if (!apiKey) {
    console.warn("OpenAI API key is missing");
    return defaultResponse;
  }

  try {
    // Construct the title generation prompt
    const titlePrompt = `Generate a catchy, concise title (maximum 60 characters) that captures the essence of this complete AI interaction. Consider all components below to create a title that represents the full journey and value provided.
  
  Format your response as:
  
  \`\`\`json
  {
    "title": "Your Compelling Title Here",
    "description": "A one-sentence explanation of why this title works (for my reference)"
  }
  \`\`\`${contextContent}`;

    // Make the API request to OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini-2025-08-07",
        messages: [{ role: "user", content: titlePrompt }],
      }),
    });
    console.log({ titlegenerationstatus: response.status });
    // If request failed, log warning and return default
    if (!response.ok) {
      const errorData: any = await response.json().catch(() => null);

      console.warn(
        `OpenAI API error: ${
          errorData.error?.message || errorData || response.statusText
        }`,
      );
      return defaultResponse;
    }

    // Parse the response
    const data: any = await response.json();
    const aiResponse = data.choices[0].message.content;
    // Extract JSON from the first code block
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e: any) {
        console.warn(`Invalid JSON in AI response: ${e.message}`);
        return defaultResponse;
      }
    }

    // Try to find any code block if json-specific one isn't found
    const codeBlockMatch = aiResponse.match(
      /```(?:\w*\s*)?\s*([\s\S]*?)\s*```/,
    );

    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        console.warn(`Invalid JSON in AI response: ${e.message}`);
        return defaultResponse;
      }
    }

    try {
      const parse: { title: string; description: string } =
        JSON.parse(aiResponse);

      if (parse.title && parse.description) {
        return parse;
      } else {
        return defaultResponse;
      }
    } catch (e: any) {
      console.warn(`Invalid JSON in AI response: ${e.message}`);
      return defaultResponse;
    }
  } catch (error) {
    console.warn("Error generating title:", error);
    return defaultResponse;
  }
}
