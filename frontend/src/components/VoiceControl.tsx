import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, DeviceState, Scene } from '../types';
import { setDeviceState, getScenes, activateScene } from '../api';
import { useDeviceStore } from '../store/deviceStore';

type VoiceStatus = 'idle' | 'listening' | 'recognizing' | 'executed' | 'error' | 'unsupported';

interface FeedbackEntry {
  type: 'success' | 'error' | 'info';
  message: string;
}

// Web Speech API 类型声明
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

export function VoiceControl() {
  const { devices: rawDevices } = useDeviceStore();
  const devices = Array.isArray(rawDevices) ? rawDevices : [];
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<FeedbackEntry | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const win = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setStatus('unsupported');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!isMountedRef.current) return;
      setStatus('listening');
      setTranscript('');
      setInterim('');
      setFeedback(null);
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
        setStatus('recognizing');
        // eslint-disable-next-line react-hooks/exhaustive-deps
        executeCommand(finalText.trim());
      } else {
        setInterim(interimText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!isMountedRef.current) return;
      console.error('Speech recognition error:', event.error);
      setStatus('error');
      setFeedback({ type: 'error', message: `识别失败：${event.error}` });
    };

    recognition.onend = () => {
      if (!isMountedRef.current) return;
      setStatus((prev) => (prev === 'listening' || prev === 'recognizing' ? 'idle' : prev));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadScenes();
  }, []);

  async function loadScenes() {
    try {
      const data = await getScenes();
      setScenes(data);
    } catch (error) {
      console.error('Failed to load scenes:', error);
    }
  }

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatus('unsupported');
      return;
    }
    if (status === 'listening' || status === 'recognizing') {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      setStatus('idle');
      return;
    }
    try {
      recognition.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setStatus('error');
      setFeedback({ type: 'error', message: '启动语音识别失败，请稍后再试' });
    }
  }, [status]);

  async function executeCommand(command: string) {
    if (!command) {
      setFeedback({ type: 'info', message: '未识别到有效指令' });
      setStatus('idle');
      return;
    }

    // 1. 打开/关闭 [设备名]
    const powerMatch = command.match(/^(打开|开启|关闭|关掉|关)(.+)$/);
    if (powerMatch) {
      const action = powerMatch[1];
      const deviceName = powerMatch[2].trim();
      const device = findDeviceByName(deviceName);
      if (!device) {
        setFeedback({ type: 'error', message: `未找到设备：${deviceName}` });
        setStatus('idle');
        return;
      }
      const power = action === '打开' || action === '开启';
      try {
        await setDeviceState(device.id, { power });
        setStatus('executed');
        setFeedback({
          type: 'success',
          message: `已${power ? '打开' : '关闭'}${device.name}`,
        });
      } catch (error) {
        console.error('Failed to set device state:', error);
        setFeedback({ type: 'error', message: `执行失败：${device.name}` });
        setStatus('error');
      }
      return;
    }

    // 2. 设置 [设备名] 亮度/温度 为 [值]
    const settingMatch = command.match(/^(设置|把)?(.+?)(的)?(亮度|温度|模式|色温|湿度)为?(.+)$/);
    if (settingMatch) {
      const deviceName = settingMatch[2].trim();
      const property = settingMatch[4];
      const valueStr = settingMatch[5].trim();
      const device = findDeviceByName(deviceName);
      if (!device) {
        setFeedback({ type: 'error', message: `未找到设备：${deviceName}` });
        setStatus('idle');
        return;
      }
      const state = buildStateUpdate(property, valueStr);
      if (!state) {
        setFeedback({ type: 'error', message: `无法解析参数：${valueStr}` });
        setStatus('idle');
        return;
      }
      try {
        await setDeviceState(device.id, state);
        setStatus('executed');
        setFeedback({
          type: 'success',
          message: `已将${device.name}的${property}设置为${valueStr}`,
        });
      } catch (error) {
        console.error('Failed to set device state:', error);
        setFeedback({ type: 'error', message: `执行失败：${device.name}` });
        setStatus('error');
      }
      return;
    }

    // 3. 执行 [场景名]
    const sceneMatch = command.match(/^(执行|启动|运行|播放)?(.+)(场景|模式)$/);
    if (sceneMatch) {
      const sceneName = sceneMatch[2].trim();
      const scene = scenes.find((s) => s.name.includes(sceneName) || sceneName.includes(s.name));
      if (!scene) {
        setFeedback({ type: 'error', message: `未找到场景：${sceneName}` });
        setStatus('idle');
        return;
      }
      try {
        await activateScene(scene.id);
        setStatus('executed');
        setFeedback({
          type: 'success',
          message: `已执行场景：${scene.name}`,
        });
      } catch (error) {
        console.error('Failed to activate scene:', error);
        setFeedback({ type: 'error', message: `执行场景失败：${scene.name}` });
        setStatus('error');
      }
      return;
    }

    setFeedback({ type: 'info', message: `无法识别指令："${command}"` });
    setStatus('idle');
  }

  function findDeviceByName(name: string): Device | undefined {
    const trimmed = name.trim();
    return devices.find((d) => d.name === trimmed || d.name.includes(trimmed) || trimmed.includes(d.name));
  }

  function buildStateUpdate(property: string, valueStr: string): Partial<DeviceState> | null {
    const num = parseInt(valueStr, 10);
    if (property === '亮度') {
      if (isNaN(num)) return null;
      return { brightness: Math.max(0, Math.min(100, num)) };
    }
    if (property === '温度') {
      if (isNaN(num)) return null;
      return { temperature: num };
    }
    if (property === '湿度') {
      if (isNaN(num)) return null;
      return { humidity: num };
    }
    if (property === '模式') {
      return { mode: valueStr };
    }
    if (property === '色温') {
      if (isNaN(num)) return null;
      return { color: `temp:${num}` };
    }
    return null;
  }

  const meta = STATUS_META[status];
  const isListening = status === 'listening' || status === 'recognizing';
  const isUnsupported = status === 'unsupported';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>语音控制</h2>
          <p style={styles.subtitle}>使用语音命令控制您的设备，让生活更便捷</p>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.micSection}>
          <button
            style={{
              ...styles.micButton,
              ...(isListening ? styles.micButtonActive : {}),
              ...(isUnsupported ? styles.micButtonDisabled : {}),
            }}
            onClick={toggleListening}
            disabled={isUnsupported}
          >
            {isListening ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <div style={{ ...styles.statusPill, color: meta.color, background: meta.bg }}>
            <span style={{ ...styles.statusDot, background: meta.color }} />
            {meta.label}
          </div>

          <p style={styles.micHint}>
            {isUnsupported
              ? '当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器'
              : isListening
              ? '正在聆听... 点击按钮停止'
              : '点击麦克风按钮开始语音控制'}
          </p>
        </div>

        <div style={styles.transcriptBox}>
          <div style={styles.transcriptLabel}>识别结果</div>
          <div style={styles.transcriptText}>
            {transcript || interim || <span style={styles.transcriptPlaceholder}>等待语音输入...</span>}
            {interim && <span style={styles.interimText}>{interim}</span>}
          </div>
        </div>

        {feedback && (
          <div
            style={{
              ...styles.feedbackBox,
              ...(feedback.type === 'success'
                ? styles.feedbackSuccess
                : feedback.type === 'error'
                ? styles.feedbackError
                : styles.feedbackInfo),
            }}
          >
            <span style={styles.feedbackIcon}>
              {feedback.type === 'success' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : feedback.type === 'error' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </span>
            <span>{feedback.message}</span>
          </div>
        )}

        <div style={styles.commandsSection}>
          <div style={styles.commandsTitle}>支持的语音指令</div>
          <div style={styles.commandsGrid}>
            <div style={styles.commandCard}>
              <div style={styles.commandIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </div>
              <div style={styles.commandText}>
                <div style={styles.commandLabel}>设备开关</div>
                <div style={styles.commandExample}>打开客厅灯 / 关闭空调</div>
              </div>
            </div>

            <div style={styles.commandCard}>
              <div style={styles.commandIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                </svg>
              </div>
              <div style={styles.commandText}>
                <div style={styles.commandLabel}>参数设置</div>
                <div style={styles.commandExample}>设置卧室灯亮度为 50</div>
              </div>
            </div>

            <div style={styles.commandCard}>
              <div style={styles.commandIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div style={styles.commandText}>
                <div style={styles.commandLabel}>场景执行</div>
                <div style={styles.commandExample}>执行回家模式场景</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  header: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#5B5B5B',
    marginTop: '4px',
    margin: 0,
  },
  panel: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  micSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  micButton: {
    width: '88px',
    height: '88px',
    borderRadius: '50%',
    border: 'none',
    background: '#005FB8',
    color: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 20px rgba(0, 95, 184, 0.35)',
    transition: 'all 0.2s ease',
  },
  micButtonActive: {
    background: '#C42B1C',
    boxShadow: '0 6px 20px rgba(196, 43, 28, 0.35)',
    animation: 'spin 2s linear infinite',
  },
  micButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  statusPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 600,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  micHint: {
    fontSize: '13px',
    color: '#5B5B5B',
    margin: 0,
    textAlign: 'center',
  },
  transcriptBox: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(0, 0, 0, 0.03)',
    borderRadius: '8px',
  },
  transcriptLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#8A8A8A',
    textTransform: 'uppercase',
    marginBottom: '6px',
    letterSpacing: '0.05em',
  },
  transcriptText: {
    fontSize: '15px',
    color: '#1A1A1A',
    minHeight: '24px',
    fontWeight: 500,
  },
  transcriptPlaceholder: {
    color: '#B0B0B0',
    fontWeight: 400,
  },
  interimText: {
    color: '#8A8A8A',
  },
  feedbackBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
  },
  feedbackSuccess: {
    background: 'rgba(16, 124, 16, 0.08)',
    color: '#107C10',
  },
  feedbackError: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
  },
  feedbackInfo: {
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
  },
  feedbackIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  commandsSection: {
    width: '100%',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  commandsTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#8A8A8A',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  commandsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '10px',
  },
  commandCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '8px',
  },
  commandIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    background: 'rgba(0, 95, 184, 0.08)',
    color: '#005FB8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commandText: {
    flex: 1,
    minWidth: 0,
  },
  commandLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1A1A1A',
    marginBottom: '2px',
  },
  commandExample: {
    fontSize: '11px',
    color: '#8A8A8A',
    fontFamily: 'monospace',
  },
};
