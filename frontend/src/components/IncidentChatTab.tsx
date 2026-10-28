import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  Volume2,
  AlertCircle,
  Sparkles,
  Info,
  RefreshCw,
  CornerDownLeft,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { incidentsApi } from '../api/services';
import type { IncidentDetail } from '../types';
import type { UseSpeechReturn } from '../hooks/useSpeech';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contextSummary?: string;
  timestamp: string;
  isError?: boolean;
}

interface IncidentChatTabProps {
  incident: IncidentDetail;
  hasStoredAnalysis: boolean;
  onRunAnalysis: () => void;
  speech: UseSpeechReturn;
}

export const IncidentChatTab: React.FC<IncidentChatTabProps> = ({
  incident,
  hasStoredAnalysis,
  onRunAnalysis,
  speech,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [modelName, setModelName] = useState<string>('gpt-4o-mini');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentIncidentIdRef = useRef<number>(incident.id);

  // Suggested questions based on detection source
  const suggestedQuestions = React.useMemo(() => {
    if (incident.detectionSource === 'ml' || incident.metricName === 'anomaly_score') {
      return [
        'Why did the anomaly detector flag this?',
        'Which signals changed the most?',
        'Could this be a false alarm?',
        'What should I check first?',
      ];
    } else if (incident.detectionSource === 'rule') {
      return [
        'What rule triggered this incident?',
        'Which container or service was affected?',
        'Was there an automatic recovery?',
        'What logs should I inspect first?',
      ];
    } else {
      return [
        'Which threshold was breached?',
        'How long did the breach last?',
        'Did related metrics also fluctuate?',
        'What is the recommended next step?',
      ];
    }
  }, [incident.detectionSource, incident.metricName]);

  // Check chat status on mount
  useEffect(() => {
    let isMounted = true;
    incidentsApi
      .getChatStatus()
      .then((status) => {
        if (isMounted) {
          setIsConfigured(status.configured);
          if (status.model) setModelName(status.model);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setIsConfigured(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Reset chat history when incident changes
  useEffect(() => {
    if (currentIncidentIdRef.current !== incident.id) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setMessages([]);
      setInput('');
      setErrorBanner(null);
      speech.stop();
      currentIncidentIdRef.current = incident.id;
    }
  }, [incident.id, speech]);

  // Cleanup in-flight requests and speech on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      speech.stop();
    };
  }, [speech]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : input;
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    speech.stop();
    setErrorBanner(null);

    const userMsgId = 'user-' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build untrusted history (exclude errors, pass role and content)
      const historyPayload = messages
        .filter((m) => !m.isError)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await incidentsApi.chatWithAi(
        incident.id,
        { message: trimmed, history: historyPayload },
        controller.signal
      );

      // Verify incident hasn't changed during request
      if (currentIncidentIdRef.current !== incident.id) return;

      const assistantMsg: ChatMessage = {
        id: 'assistant-' + Date.now(),
        role: 'assistant',
        content: res.answer,
        contextSummary: res.contextSummary,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return; // Request was aborted cleanly
      }

      const status = err.response?.status;
      const serverDetail = err.response?.data?.detail;
      let errMsg = 'Failed to get answer. Please check connection and try again.';

      if (serverDetail && typeof serverDetail === 'string') {
        errMsg = serverDetail;
      } else if (status === 429) {
        errMsg = 'Rate limit reached: Please wait a moment before sending another question.';
      } else if (status === 503) {
        errMsg = 'AI chat is temporarily unavailable or not configured.';
      }

      const errorMsg: ChatMessage = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: errMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSpeak = (text: string) => {
    speech.stop();
    // Split into clean sentence units
    const cleanSentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    speech.speak(cleanSentences);
  };

  // State: AI Chat Not Configured
  if (isConfigured === false) {
    return (
      <Card style={{ padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '460px', margin: '0 auto' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-status-critical)',
            }}
          >
            <AlertCircle size={24} />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#ffffff', fontWeight: 600 }}>
            Ask AI is Not Configured
          </h3>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            The interactive incident chat assistant requires an active <code style={{ color: 'var(--color-primary)' }}>OPENAI_API_KEY</code> in the server environment. Please configure the key to ask natural language questions about this incident.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
      {/* Notice banner if no stored RCA exists yet */}
      {!hasStoredAnalysis && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#93c5fd' }}>
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>
              Root-cause analysis has not been run yet for this incident. Run the diagnostic pipeline for richer context.
            </span>
          </div>
          <Button variant="secondary" size="sm" icon={<Sparkles size={12} />} onClick={onRunAnalysis}>
            Run RCA First
          </Button>
        </div>
      )}

      {/* Main Chat Conversation Card */}
      <Card style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '620px' }}>
        {/* Chat Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={16} color="var(--color-primary)" />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
              Incident Investigation Assistant
            </span>
            <Badge variant="info" size="sm">
              {modelName}
            </Badge>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Anchored to Incident #{incident.id}
          </span>
        </div>

        {/* Messages Scroll Area */}
        <div
          aria-live="polite"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Empty state: Show suggested question chips */}
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '480px', padding: '24px 0' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(6,182,212,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                  color: 'var(--color-primary)',
                }}
              >
                <Sparkles size={22} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9375rem', fontWeight: 600, color: '#ffffff' }}>
                Ask AI about Incident #{incident.id}
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Ask questions in plain English to understand the telemetry, timeline, and signals. The assistant uses only this incident's data.
              </p>

              {/* Suggested Questions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      color: 'var(--color-text-secondary)',
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(6,182,212,0.06)';
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                  >
                    <span>{q}</span>
                    <CornerDownLeft size={12} style={{ color: 'var(--color-text-muted)', opacity: 0.7 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Messages */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '82%',
                    borderRadius: 'var(--radius-lg)',
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    backgroundColor: isUser
                      ? 'var(--color-primary-subtle)'
                      : msg.isError
                      ? 'rgba(239,68,68,0.1)'
                      : '#0a0d18',
                    border: isUser
                      ? '1px solid var(--color-border-focused)'
                      : msg.isError
                      ? '1px solid rgba(239,68,68,0.3)'
                      : '1px solid var(--color-border-subtle)',
                    color: msg.isError ? '#fca5a5' : '#ffffff',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>

                {/* Footer metadata for assistant response */}
                {!isUser && !msg.isError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '4px',
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {msg.contextSummary && <span>based on: {msg.contextSummary}</span>}
                    <button
                      onClick={() => handleSpeak(msg.content)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Speak answer aloud"
                    >
                      <Volume2 size={12} /> Speak
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking / Loading indicator */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontSize: '0.8125rem' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Thinking against incident telemetry...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this incident (e.g. 'What changed first?')..."
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                backgroundColor: '#050811',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: '#ffffff',
                fontSize: '0.8125rem',
                padding: '8px 12px',
                lineHeight: 1.5,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
              }}
            />

            <Button
              variant="primary"
              size="sm"
              icon={<Send size={14} />}
              onClick={() => handleSendMessage()}
              disabled={isLoading || !input.trim()}
              style={{ height: '38px', minWidth: '42px', padding: '0 12px' }}
              aria-label="Send message"
            >
              Send
            </Button>
          </div>

          {/* Counter and helper notice */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '6px',
              fontSize: '0.6875rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <span>Enter sends, Shift+Enter for newline</span>
            <span>{input.length}/500</span>
          </div>
        </div>

        {/* Footer Attribution */}
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderTop: '1px solid rgba(255,255,255,0.03)',
            fontSize: '0.6875rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          Powered by OpenAI. AI answers are advisory and based on this incident's data only.
        </div>
      </Card>
    </div>
  );
};
