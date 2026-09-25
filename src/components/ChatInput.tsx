import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const RECOMMENDED_QUESTIONS = [
  '¿Qué valores de presión arterial son normales?',
  '¿Por qué dan palpitaciones o un salto en el pecho?',
  '¿Cómo saber si un dolor de pecho es peligroso?',
  '¿Qué significa tener el colesterol LDL alto?',
  '¿Qué detecta un electrocardiograma (ECG)?',
  '¿Cuáles son los síntomas de insuficiencia cardíaca?',
  '¿Qué alimentos y hábitos ayudan a bajar la presión?',
  '¿Cómo diferenciar angina de pecho de ansiedad o reflujo?',
];

export default function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="w-full bg-white border-t border-slate-200 p-3 sm:p-4">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Recommended questions bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-medium text-slate-500 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-rose-500" />
            Recomendadas:
          </span>
          {RECOMMENDED_QUESTIONS.map((question, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => onSendMessage(question)}
              className="text-xs bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 hover:border-rose-200 rounded-full px-2.5 py-1 whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-300 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-100 rounded-2xl p-2 transition-all">
          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            rows={1}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta sobre tu corazón, presión o síntomas..."
            className="w-full bg-transparent border-0 resize-none px-2 py-1.5 text-sm text-slate-900 focus:outline-hidden placeholder:text-slate-500 max-h-32"
          />

          <button
            type="button"
            id="send-message-btn"
            disabled={!text.trim() || isLoading}
            onClick={handleSend}
            className={`p-2.5 rounded-xl transition-all shrink-0 ${
              !text.trim() || isLoading
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
            title="Enviar mensaje"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
