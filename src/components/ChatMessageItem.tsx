import Markdown from 'react-markdown';
import { Heart, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectPrompt?: (prompt: string) => void;
}

export default function ChatMessageItem({ message, onSelectPrompt }: ChatMessageItemProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div
      id={`message-${message.id}`}
      className={`flex w-full my-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`flex gap-2.5 max-w-[85%] sm:max-w-2xl ${
          isAssistant ? 'flex-row' : 'flex-row-reverse'
        }`}
      >
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isAssistant ? (
            <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Heart className="w-4 h-4 fill-white/20" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center shadow-xs">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Message Bubble & Content */}
        <div className="flex flex-col space-y-1.5 min-w-0">
          <div
            className={`flex items-center gap-1.5 text-[11px] text-slate-500 ${
              isAssistant ? 'justify-start' : 'justify-end'
            }`}
          >
            <span className="font-semibold text-slate-700">
              {isAssistant ? 'CardioBot' : 'Tú'}
            </span>
            <span>•</span>
            <span>{message.timestamp}</span>
          </div>

          <div
            className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
              isAssistant
                ? 'bg-white border border-slate-200 text-slate-800 shadow-2xs'
                : 'bg-slate-900 text-white'
            }`}
          >
            {isAssistant ? (
              <div className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-slate-900">
                <Markdown>{message.content}</Markdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {/* Optional recommended questions for the message */}
          {isAssistant && message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && onSelectPrompt && (
            <div className="pt-1 flex flex-col gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-rose-500" />
                Preguntas recomendadas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.suggestedFollowUps.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectPrompt(prompt)}
                    className="text-xs text-left bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-full px-3 py-1.5 transition-colors shadow-2xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
