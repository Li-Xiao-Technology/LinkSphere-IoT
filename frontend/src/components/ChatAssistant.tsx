import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, getChatHistory, sendChatMessage, clearChatHistory } from '../api';
import { Device, DeviceState, Scene } from '../types';
import { setDeviceState, getScenes, activateScene } from '../api';
import { useDeviceStore } from '../store/deviceStore';

type VoiceStatus = 'idle' | 'listening' | 'recognizing' | 'executed' | 'error' | 'unsupported';

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionStatic;
  webkitSpeechRecognition?: SpeechRecognitionStatic;
}

const STATUS_META: Record<VoiceStatus, { label: string; color: string; bg: string }> = {
  idle: { label: '待机', color: '#5B5B5B', bg: 'rgba(0, 0, 0, 0.04)' },
  listening: { label: '监听中', color: '#005FB8', bg: 'rgba(0, 95, 184, 0.1)' },
  recognizing: { label: '识别中', color: '#FF8C00', bg: 'rgba(255, 140, 0, 0.1)' },
  executed: { label: '已执行', color: '#107C10', bg: 'rgba(16, 124, 16, 0.1)' },
  error: { label: '识别错误', color: '#C42B1C', bg: 'rgba(196, 43, 28, 0.08)' },
  unsupported: { label: '不支持', color: '#C42B1C', bg: 'rgba(196, 43, 28, 0.08)' },
};

export function ChatAssistant() {
  const { devices: rawDevices } = useDeviceStore();
  const devices = Array.isArray(rawDevices) ? rawDevices : [];
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    loadHistory();
    loadScenes();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const win = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceStatus('unsupported');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!isMountedRef.current) return;
      setVoiceStatus('listening');
      setTranscript('');
      setInterim('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!isMountedRef.current) return;
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }
      if (finalText) {
        setTranscript(finalText);
        setInterim('');
        setVoiceStatus('recognizing');
        setInputValue(finalText);
        handleSend(finalText);
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!isMountedRef.current) return;
      console.error('Speech recognition error:', event.error);
      setVoiceStatus('error');
      setInputValue('');
    };

    recognition.onend = () => {
      if (!isMountedRef.current) return;
      setVoiceStatus((prev) => (prev === 'listening' || prev === 'recognizing' ? 'idle' : prev));
    };

    recognitionRef.current = recognition;

    return () => {
      isMountedRef.current = false;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadHistory() {
    const result = await getChatHistory();
    if (result) {
      setMessages(result.messages);
    }
  }

  async function loadScenes() {
    try {
      const data = await getScenes();
      setScenes(data);
    } catch (error) {
      console.error('Failed to load scenes:', error);
    }
  }

  async function handleSend(messageText?: string) {
    const text = messageText || inputValue.trim();
    if (!text || isTyping) return;

    setIsTyping(true);
    const result = await sendChatMessage(text);
    setInputValue('');
    
    if (result) {
      setMessages(result.messages);
    }
    setIsTyping(false);
  }

  async function handleClear() {
    if (window.confirm('确定清除聊天记录？')) {
      await clearChatHistory();
      setMessages([]);
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceStatus('unsupported');
      return;
    }
    if (voiceStatus === 'listening' || voiceStatus === 'recognizing') {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      setVoiceStatus('idle');
      return;
    }
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setVoiceStatus('error');
    }
  }, [voiceStatus]);

  const voiceMeta = STATUS_META[voiceStatus];
  const isListening = voiceStatus === 'listening' || voiceStatus === 'recognizing';
  const isUnsupported = voiceStatus === 'unsupported';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5-2 4-2 4 2 4 2" />
              <circle cx="9" cy="9" r="1" fill="#FFFFFF" />
              <circle cx="15" cy="9" r="1" fill="#FFFFFF" />
            </svg>
          </div>
          <div style={styles.headerInfo}>
            <h2 style={styles.title}>智能助手</h2>
            <p style={styles.subtitle}>有什么可以帮您的？</p>
          </div>
        </div>
        <button style={styles.clearButton} onClick={handleClear}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          清除
        </button>
      </div>

      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.welcomeMessage}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5-2 4-2 4 2 4 2" />
              <circle cx="9" cy="9" r="1" fill="#BDBDBD" />
              <circle cx="15" cy="9" r="1" fill="#BDBDBD" />
            </svg>
            <h3 style={styles.welcomeTitle}>欢迎使用智能助手</h3>
            <p style={styles.welcomeText}>您可以问我：</p>
            <div style={styles.suggestions}>
              <button style={styles.suggestionButton} onClick={() => { setInputValue('打开客厅灯'); }}>打开客厅灯</button>
              <button style={styles.suggestionButton} onClick={() => { setInputValue('调节空调温度'); }}>调节空调温度</button>
              <button style={styles.suggestionButton} onClick={() => { setInputValue('查看能耗'); }}>查看能耗</button>
              <button style={styles.suggestionButton} onClick={() => { setInputValue('设置定时任务'); }}>设置定时任务</button>
            </div>
            <div style={styles.voiceTip}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>点击输入框右侧麦克风按钮进行语音输入</span>
            </div>
          </div>
        ) : (
          <div style={styles.messages}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ ...styles.message, ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage) }}>
                <div style={styles.messageContent}>
                  {msg.content}
                </div>
                <div style={styles.messageTime}>
                  {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ ...styles.message, ...styles.assistantMessage }}>
                <div style={styles.typingIndicator}>
                  <div style={styles.typingDot}></div>
                  <div style={styles.typingDot}></div>
                  <div style={styles.typingDot}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {isListening && (
        <div style={styles.voiceOverlay}>
          <div style={{ ...styles.voiceStatusPill, color: voiceMeta.color, background: voiceMeta.bg }}>
            <span style={{ ...styles.voiceStatusDot, background: voiceMeta.color }} />
            {voiceMeta.label}
          </div>
          <div style={styles.voiceTranscript}>
            {transcript || interim || '正在聆听...'}
            {interim && <span style={styles.interimText}>{interim}</span>}
          </div>
        </div>
      )}

      <div style={styles.inputContainer}>
        <input
          style={styles.input}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入您的问题..."
          disabled={isTyping || isListening}
        />
        <button style={{ ...styles.micButton, ...(isListening ? styles.micButtonActive : {}), ...(isUnsupported ? styles.micButtonDisabled : {}) }} onClick={toggleListening} disabled={isUnsupported}>
          {isListening ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        <button style={styles.sendButton} onClick={() => handleSend()} disabled={!inputValue.trim() || isTyping || isListening}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#F3F3F3',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: '#005FB8',
    color: '#FFFFFF',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    opacity: 0.8,
    margin: '2px 0 0 0',
  },
  clearButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.15s ease',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  welcomeMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
  },
  welcomeTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: '16px 0 8px 0',
  },
  welcomeText: {
    fontSize: '14px',
    color: '#5B5B5B',
    margin: 0,
  },
  voiceTip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '20px',
    fontSize: '12px',
    color: '#8A8A8A',
  },
  suggestions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '20px',
    justifyContent: 'center',
  },
  suggestionButton: {
    padding: '8px 16px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: '1px solid rgba(0, 95, 184, 0.15)',
    borderRadius: '20px',
    color: '#005FB8',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.15s ease',
  },
  messages: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  message: {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  userMessage: {
    alignSelf: 'flex-end',
    background: '#005FB8',
    color: '#FFFFFF',
    borderRadius: '16px 16px 4px 16px',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    background: '#FFFFFF',
    color: '#1A1A1A',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '16px 16px 16px 4px',
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  messageTime: {
    fontSize: '11px',
    opacity: 0.6,
    textAlign: 'right',
  },
  typingIndicator: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
  },
  typingDot: {
    width: '6px',
    height: '6px',
    background: '#BDBDBD',
    borderRadius: '50%',
    animation: 'typing 1.4s infinite ease-in-out',
  },
  voiceOverlay: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    background: 'rgba(0, 95, 184, 0.08)',
    borderTop: '1px solid rgba(0, 95, 184, 0.1)',
  },
  voiceStatusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
  },
  voiceStatusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  voiceTranscript: {
    fontSize: '14px',
    color: '#005FB8',
    fontWeight: 500,
  },
  interimText: {
    color: '#8A8A8A',
  },
  inputContainer: {
    display: 'flex',
    gap: '10px',
    padding: '16px 20px',
    background: '#FFFFFF',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '24px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  micButton: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '50%',
    color: '#5B5B5B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  micButtonActive: {
    background: '#C42B1C',
    borderColor: '#C42B1C',
    color: '#FFFFFF',
  },
  micButtonDisabled: {
    background: '#F0F0F0',
    color: '#B0B0B0',
    cursor: 'not-allowed',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#005FB8',
    border: 'none',
    borderRadius: '50%',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
