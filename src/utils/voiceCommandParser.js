


export function parseVoiceCommand(text) {
  const lower = text.toLowerCase().trim();

  // Check if command starts with "add"
  if (!lower.startsWith("add")) return null;

  // Extract quantity and keywords
  const match = lower.match(/add (\d+)?\s*(.*)/);
  const quantity = match?.[1] ? parseInt(match[1]) : 1;
  const keyword = match?.[2]?.trim() || "";

  return {
    action: 'add',
    quantity,
    keywords: keyword.split(' ')
  };
}