export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isEmergencyAlert?: boolean;
  suggestedFollowUps?: string[];
}
