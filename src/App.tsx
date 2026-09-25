/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChatMessageItem from './components/ChatMessageItem';
import ChatInput from './components/ChatInput';
import { ChatMessage } from './types';
import { HeartPulse, AlertCircle } from 'lucide-react';

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `¡Hola! Soy **CardioBot**, tu asistente virtual especializado en salud cardiovascular y cardiología.

Puedo responder **todas tus preguntas sobre cardiología**:
• **Síntomas y alertas:** dolor torácico, palpitaciones, disnea, mareos o edemas.
• **Presión arterial:** valores normales, crisis, hipertensión y mediciones correctas.
• **Ritmo cardíaco y ECG:** taquicardias, extrasístoles, fibrilación auricular y estudios.
• **Colesterol y arterias:** placas de ateroma, triglicéridos, prevención de infartos y estatinas.
• **Insuficiencia cardíaca y válvulas:** causas, signos de alerta y tratamientos.
• **Estilo de vida y ejercicio:** dieta DASH/mediterránea, ejercicio seguro y factores de riesgo.

¿Qué duda o consulta sobre tu corazón o cardiología deseas resolver?`,
  timestamp: 'Ahora',
  suggestedFollowUps: [
    '¿Qué valores de presión arterial son normales?',
    '¿Por qué dan palpitaciones o un salto en el pecho?',
    '¿Cómo saber si un dolor de pecho es peligroso?',
    '¿Qué significa tener el colesterol LDL alto?',
    '¿Qué detecta un electrocardiograma (ECG)?',
    '¿Cuáles son los síntomas de insuficiencia cardíaca?',
  ],
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('cardiobot_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure welcome message has suggested follow ups if it was saved before
          if (parsed[0]?.id === 'welcome-msg' && !parsed[0]?.suggestedFollowUps) {
            parsed[0].suggestedFollowUps = INITIAL_WELCOME_MESSAGE.suggestedFollowUps;
          }
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('cardiobot_chat_history', JSON.stringify(messages));
  }, [messages]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, isLoading]);

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;
    setNetworkError(null);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: timeStr,
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, assistantPlaceholder]);

    try {
      const apiMessages = newHistory.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.content,
      }));

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error(`Error (${response.status})`);
      }

      if (!response.body) {
        throw new Error('Sin flujo de datos');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                accumulatedText += data.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: accumulatedText }
                      : msg
                  )
                );
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (err) {
              // chunk segment
            }
          }
        }
      }

      if (!accumulatedText) {
        throw new Error('No se pudo obtener respuesta.');
      }
    } catch (err: any) {
      console.error('Error in chat stream:', err);

      // Fallback to standard endpoint
      try {
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newHistory.map((m) => ({
              role: m.role === 'user' ? 'user' : 'model',
              content: m.content,
            })),
          }),
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          if (data.text) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: data.text } : msg
              )
            );
            return;
          }
        }
      } catch (fallbackErr) {
        console.error('Fallback endpoint also failed:', fallbackErr);
      }

      setNetworkError('Hubo una dificultad de conexión con el servicio.');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: 'Disculpa, no pude procesar tu mensaje en este momento. Por favor inténtalo de nuevo.',
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    if (window.confirm('¿Deseas reiniciar la conversación?')) {
      setMessages([INITIAL_WELCOME_MESSAGE]);
      localStorage.removeItem('cardiobot_chat_history');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900">
      {/* Minimal Header */}
      <Header onResetChat={handleResetChat} />

      {/* Messages */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {networkError && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{networkError}</span>
              </div>
              <button
                type="button"
                onClick={() => setNetworkError(null)}
                className="text-amber-800 hover:text-amber-950 font-bold px-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="space-y-3">
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              />
            ))}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-2 px-3">
                <HeartPulse className="w-4 h-4 text-rose-600 animate-pulse" />
                <span>Escribiendo...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Pure Chat Input */}
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
