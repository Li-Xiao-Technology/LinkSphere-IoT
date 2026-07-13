import { useState, useEffect } from 'react';
import { AutomationRule, TriggerType, RuleCondition, SceneAction, DeviceCondition, LogicOperator } from '../types';
import { getRules, createRule, deleteRule, toggleRule, testRule } from '../api';
import { showConfirm } from '../utils/confirm';
import { useDeviceStore } from '../store/deviceStore';
import { RuleExecutionHistory } from './RuleExecutionHistory';

interface ActionRow {
  deviceId: string;
  parameters: Record<string, unknown>;
}

const OPERATORS: { value: RuleCondition['operator']; label: string }[] = [
  { value: '>', label: '> 大于' },
  { value: '<', label: '< 小于' },
  { value: '==', label: '== 等于' },
  { value: '>=', label: '>= 大于等于' },
  { value: '<=', label: '<= 小于等于' },
  { value: '!=', label: '!= 不等于' },
  { value: 'changes', label: 'changes 变化' },
];

const PROPERTY_OPTIONS = [
  { value: 'power', label: '电源状态' },
  { value: 'brightness', label: '亮度' },
  { value: 'temperature', label: '温度' },
  { value: 'humidity', label: '湿度' },
  { value: 'mode', label: '模式' },
  { value: 'value', label: '数值' },
];

const PRESET_CRONS: { label: string; value: string }[] = [
  { label: '每天 08:00', value: '0 8 * * *' },
  { label: '每天 22:00', value: '0 22 * * *' },
  { label: '工作日 08:00', value: '0 8 * * 1-5' },
  { label: '周末 09:00', value: '0 9 * * 0,6' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每 30 分钟', value: '*/30 * * * *' },
];

const TRIGGER_META: Record<TriggerType, { label: string; color: string; bg: string }> = {
  device_state: { label: '设备状态', color: '#005FB8', bg: 'rgba(0, 95, 184, 0.08)' },
  time: { label: '定时触发', color: '#107C10', bg: 'rgba(16, 124, 16, 0.08)' },
  manual: { label: '手动触发', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' },
};

function describeCondition(rule: AutomationRule): string {
  const cond = rule.triggerCondition;
  switch (rule.triggerType) {
    case 'device_state': {
      // 多设备联动条件
      if (cond.conditions && cond.conditions.length > 0) {
        const logic = cond.logic || 'AND';
        const conditionStrs = cond.conditions.map(c => {
          const prop = PROPERTY_OPTIONS.find((p) => p.value === c.property)?.label ?? c.property;
          const op = OPERATORS.find((o) => o.value === c.operator)?.label ?? c.operator;
          return `${c.deviceId}.${prop} ${op} ${String(c.value ?? '')}`;
        });
        return `${cond.conditions.length}个设备 ${logic === 'AND' ? '同时满足' : '满足任一'}`;
      }
      // 单设备条件（向后兼容）
      const device = rule.actions[0]?.deviceId;
      const prop = PROPERTY_OPTIONS.find((p) => p.value === cond.property)?.label ?? cond.property;
      return `${device ?? '设备'}.${prop ?? '?'} ${cond.operator ?? '?'} ${String(cond.value ?? '')}`;
    }
    case 'time':
      return cond.cronExpression ?? '未配置';
    case 'manual':
      return '手动点击执行';
    default:
      return '';
  }
}

export function RuleManager() {
  const { devices } = useDeviceStore();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showParamFormForAction, setShowParamFormForAction] = useState<number | null>(null);
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamType, setNewParamType] = useState<'bool' | 'number' | 'string'>('bool');
  const [viewingHistoryRule, setViewingHistoryRule] = useState<{ id: string; name: string } | null>(null);

  const [form, setForm] = useState<{
    name: string;
    triggerType: TriggerType;
    condition: RuleCondition;
    useMultiDevice: boolean; // 是否使用多设备联动
    logic: LogicOperator; // AND/OR
    multiConditions: DeviceCondition[]; // 多设备条件列表
    actions: ActionRow[];
  }>({
    name: '',
    triggerType: 'device_state',
    condition: { deviceId: '', property: 'brightness', operator: '>', value: 80 },
    useMultiDevice: false,
    logic: 'AND',
    multiConditions: [],
    actions: [{ deviceId: '', parameters: { power: false } }],
  });

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await getRules();
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      name: '',
      triggerType: 'device_state',
      condition: { deviceId: '', property: 'brightness', operator: '>', value: 80 },
      useMultiDevice: false,
      logic: 'AND',
      multiConditions: [],
      actions: [{ deviceId: '', parameters: { power: false } }],
    });
    setFormError('');
  }

  async function handleCreate() {
    setFormError('');
    if (!form.name) {
      setFormError('请输入规则名称');
      return;
    }

    // 验证多设备联动条件
    if (form.useMultiDevice && form.triggerType === 'device_state') {
      if (form.multiConditions.length === 0) {
        setFormError('请至少添加一个设备联动条件');
        return;
      }
      const hasEmpty = form.multiConditions.some(c => !c.deviceId || !c.property);
      if (hasEmpty) {
        setFormError('请完善所有设备联动条件（选择设备和属性）');
        return;
      }
    } else if (form.triggerType === 'device_state' && !form.condition.deviceId) {
      setFormError('请选择触发条件的设备');
      return;
    }

    if (form.actions.length === 0 || !form.actions[0].deviceId) {
      setFormError('请至少添加一个执行动作并选择设备');
      return;
    }

    setSubmitting(true);
    try {
      const actions: SceneAction[] = form.actions
        .filter((a) => a.deviceId)
        .map((a) => ({
          deviceId: a.deviceId,
          action: 'setState',
          parameters: a.parameters,
        }));

      // 构建触发条件
      let triggerCondition: RuleCondition;
      if (form.useMultiDevice && form.triggerType === 'device_state') {
        triggerCondition = {
          conditions: form.multiConditions,
          logic: form.logic,
        };
      } else {
        triggerCondition = { ...form.condition };
      }

      await createRule({
        name: form.name,
        enabled: true,
        triggerType: form.triggerType,
        triggerCondition,
        actions,
      });
      setIsCreating(false);
      resetForm();
      loadRules();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '创建失败，请检查网络或稍后重试';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    try {
      await toggleRule(id);
      loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await testRule(id);
    } catch (error) {
      console.error('Failed to test rule:', error);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!showConfirm('确定要删除这条自动化规则吗？')) return;
    try {
      await deleteRule(id);
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  function updateCondition(field: keyof RuleCondition, value: unknown) {
    setForm((prev) => ({
      ...prev,
      condition: { ...prev.condition, [field]: value },
    }));
  }

  function addAction() {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { deviceId: '', parameters: { power: true } }],
    }));
  }

  function updateAction(index: number, field: string, value: unknown) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    }));
  }

  function removeAction(index: number) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  }

  function updateActionParam(index: number, key: string, value: unknown) {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) =>
        i === index ? { ...a, parameters: { ...a.parameters, [key]: value } } : a
      ),
    }));
  }

  // 多设备条件管理函数
  function addMultiCondition() {
    setForm((prev) => ({
      ...prev,
      multiConditions: [
        ...prev.multiConditions,
        { deviceId: '', property: 'power', operator: '==', value: true },
      ],
    }));
  }

  function updateMultiCondition(index: number, field: keyof DeviceCondition, value: unknown) {
    setForm((prev) => ({
      ...prev,
      multiConditions: prev.multiConditions.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  }

  function removeMultiCondition(index: number) {
    setForm((prev) => ({
      ...prev,
      multiConditions: prev.multiConditions.filter((_, i) => i !== index),
    }));
  }

  function getRulePreview(): string {
    const parts: string[] = [];

    switch (form.triggerType) {
      case 'device_state': {
        if (form.useMultiDevice && form.multiConditions.length > 0) {
          parts.push(`当以下 ${form.multiConditions.length} 个设备条件满足（${form.logic} 逻辑）：`);
          form.multiConditions.forEach((cond, i) => {
            const device = devices.find((d) => d.id === cond.deviceId);
            const prop = PROPERTY_OPTIONS.find((p) => p.value === cond.property)?.label;
            const op = OPERATORS.find((o) => o.value === cond.operator)?.label;
            parts.push(`  ${i + 1}. ${device?.name || '[设备]'}.${prop || '属性'} ${op || '等于'} ${String(cond.value ?? '')}`);
          });
        } else {
          const device = devices.find((d) => d.id === form.condition.deviceId);
          const prop = PROPERTY_OPTIONS.find((p) => p.value === form.condition.property)?.label;
          parts.push(`当 ${device?.name || '[选择设备]'} 的 ${prop || '属性'} ${form.condition.operator || '等于'} ${form.condition.value ?? ''} 时`);
        }
        break;
      }
      case 'time':
        parts.push(`在 ${form.condition.cronExpression || '[设置时间]'} 触发`);
        break;
      case 'manual':
        parts.push('手动点击执行时');
        break;
    }

    const validActions = form.actions.filter((a) => a.deviceId);
    if (validActions.length > 0) {
      parts.push(`→ 执行 ${validActions.length} 个动作：`);
      validActions.forEach((a, i) => {
        const device = devices.find((d) => d.id === a.deviceId);
        const params = Object.entries(a.parameters)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(', ');
        parts.push(`  ${i + 1}. ${device?.name || '[设备]'} (${params || '无参数'})`);
      });
    }

    return parts.join('\n');
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>自动化规则</h2>
          <p style={styles.subtitle}>设置条件触发器，让设备按规则自动协同工作</p>
        </div>
        <button
          style={styles.addButton}
          onClick={() => { resetForm(); setIsCreating(true); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>新建规则</span>
        </button>
      </div>

      {isCreating && (
        <div style={styles.modalOverlay} className="anim-fade-in" onClick={() => setIsCreating(false)}>
          <div style={styles.modalContent} className="anim-scale-in" onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>创建自动化规则</h3>
              <button style={styles.closeButton} onClick={() => setIsCreating(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>规则名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                style={styles.formInput}
                placeholder="例如：温度过高时关闭暖气"
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>触发类型</label>
              <div style={styles.triggerGrid}>
                {(['device_state', 'time', 'manual'] as TriggerType[]).map((t) => (
                  <button
                    key={t}
                    style={{
                      ...styles.triggerButton,
                      ...(form.triggerType === t ? styles.triggerButtonActive : {}),
                    }}
                    onClick={() => setForm((prev) => ({ ...prev, triggerType: t }))}
                  >
                    {TRIGGER_META[t].label}
                  </button>
                ))}
              </div>
            </div>

            {form.triggerType === 'device_state' && (
              <div style={styles.formGroup}>
                <div style={styles.multiDeviceToggle}>
                  <label style={styles.formLabel}>联动模式</label>
                  <div style={styles.toggleButtons}>
                    <button
                      style={{
                        ...styles.toggleButton,
                        ...(!form.useMultiDevice ? styles.toggleButtonActive : {}),
                      }}
                      onClick={() => setForm((prev) => ({ ...prev, useMultiDevice: false }))}
                    >
                      单设备触发
                    </button>
                    <button
                      style={{
                        ...styles.toggleButton,
                        ...(form.useMultiDevice ? styles.toggleButtonActive : {}),
                      }}
                      onClick={() => setForm((prev) => ({ ...prev, useMultiDevice: true }))}
                    >
                      多设备联动
                    </button>
                  </div>
                </div>

                {!form.useMultiDevice && (
                  <>
                    <label style={styles.formLabel}>触发条件</label>
                    <div style={styles.conditionRow}>
                      <select
                        value={form.condition.deviceId}
                        onChange={(e) => updateCondition('deviceId', e.target.value)}
                        style={styles.formSelect}
                      >
                        <option value="">选择设备</option>
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <select
                        value={form.condition.property}
                        onChange={(e) => updateCondition('property', e.target.value)}
                        style={styles.formSelect}
                      >
                        {PROPERTY_OPTIONS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      <select
                        value={form.condition.operator}
                        onChange={(e) => updateCondition('operator', e.target.value)}
                        style={styles.formSelect}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={String(form.condition.value ?? '')}
                        onChange={(e) => updateCondition('value', e.target.value)}
                        style={{ ...styles.formInput, flex: 1 }}
                        placeholder="阈值"
                      />
                    </div>
                  </>
                )}

                {form.useMultiDevice && (
                  <>
                    <div style={styles.logicSelector}>
                      <label style={styles.formLabel}>逻辑关系</label>
                      <div style={styles.toggleButtons}>
                        <button
                          style={{
                            ...styles.logicButton,
                            ...(form.logic === 'AND' ? styles.logicButtonActive : {}),
                          }}
                          onClick={() => setForm((prev) => ({ ...prev, logic: 'AND' }))}
                        >
                          AND（全部满足）
                        </button>
                        <button
                          style={{
                            ...styles.logicButton,
                            ...(form.logic === 'OR' ? styles.logicButtonActive : {}),
                          }}
                          onClick={() => setForm((prev) => ({ ...prev, logic: 'OR' }))}
                        >
                          OR（满足任一）
                        </button>
                      </div>
                    </div>

                    <div style={styles.multiConditionHeader}>
                      <label style={styles.formLabel}>联动条件 ({form.multiConditions.length})</label>
                      <button style={styles.addConditionButton} onClick={addMultiCondition}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        添加条件
                      </button>
                    </div>

                    <div style={styles.multiConditionList}>
                      {form.multiConditions.map((cond, index) => (
                        <div key={index} style={styles.multiConditionItem}>
                          <div style={styles.conditionNumber}>{index + 1}</div>
                          <select
                            value={cond.deviceId}
                            onChange={(e) => updateMultiCondition(index, 'deviceId', e.target.value)}
                            style={styles.formSelect}
                          >
                            <option value="">选择设备</option>
                            {devices.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <select
                            value={cond.property}
                            onChange={(e) => updateMultiCondition(index, 'property', e.target.value)}
                            style={styles.formSelect}
                          >
                            {PROPERTY_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                          <select
                            value={cond.operator}
                            onChange={(e) => updateMultiCondition(index, 'operator', e.target.value)}
                            style={styles.formSelect}
                          >
                            {OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={String(cond.value ?? '')}
                            onChange={(e) => updateMultiCondition(index, 'value', e.target.value)}
                            style={{ ...styles.formInput, flex: 1 }}
                            placeholder="阈值"
                          />
                          <button style={styles.removeConditionButton} onClick={() => removeMultiCondition(index)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {form.multiConditions.length === 0 && (
                        <div style={styles.emptyConditionHint}>
                          点击"添加条件"开始配置多设备联动
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {form.triggerType === 'time' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>定时表达式</label>
                <div style={styles.presetGrid}>
                  {PRESET_CRONS.map((preset) => (
                    <button
                      key={preset.value}
                      style={{
                        ...styles.presetButton,
                        ...(form.condition.cronExpression === preset.value ? styles.presetButtonActive : {}),
                      }}
                      onClick={() => updateCondition('cronExpression', preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={form.condition.cronExpression ?? ''}
                  onChange={(e) => updateCondition('cronExpression', e.target.value)}
                  style={{ ...styles.formInput, marginTop: '8px', fontFamily: 'monospace' }}
                  placeholder="Cron 表达式：分 时 日 月 周"
                />
                <p style={styles.cronHint}>格式：minute hour day month weekday（例：0 8 * * * = 每天 8:00）</p>
              </div>
            )}

            {form.triggerType === 'manual' && (
              <div style={styles.formGroup}>
                <div style={styles.manualHint}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>手动规则仅在点击"测试执行"按钮时触发</span>
                </div>
              </div>
            )}

            <div style={styles.formGroup}>
              <div style={styles.actionHeader}>
                <label style={styles.formLabel}>执行动作</label>
                <button style={styles.addActionButton} onClick={addAction}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  添加动作
                </button>
              </div>

              <div style={styles.actionList}>
                {form.actions.map((action, index) => (
                  <div key={index} style={styles.actionRow}>
                    <select
                      value={action.deviceId}
                      onChange={(e) => updateAction(index, 'deviceId', e.target.value)}
                      style={styles.formSelect}
                    >
                      <option value="">选择设备</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <div style={styles.actionParams}>
                      {Object.entries(action.parameters).map(([key, value]) => (
                        <div key={key} style={styles.paramItem}>
                          <span style={styles.paramKey}>{key}</span>
                          {typeof value === 'boolean' ? (
                            <button
                              type="button"
                              style={{
                                ...styles.paramToggle,
                                background: value ? '#107C10' : 'rgba(0,0,0,0.12)',
                              }}
                              onClick={() => updateActionParam(index, key, !value)}
                            >
                              <div
                                style={{
                                  ...styles.paramToggleKnob,
                                  transform: value ? 'translateX(16px)' : 'translateX(0)',
                                }}
                              />
                            </button>
                          ) : typeof value === 'number' ? (
                            <input
                              type="number"
                              value={value as number}
                              onChange={(e) => updateActionParam(index, key, parseFloat(e.target.value) || 0)}
                              style={styles.paramInput}
                            />
                          ) : (
                            <input
                              type="text"
                              value={String(value)}
                              onChange={(e) => updateActionParam(index, key, e.target.value)}
                              style={styles.paramInput}
                            />
                          )}
                          <button
                            type="button"
                            style={styles.paramRemove}
                            onClick={() => {
                              const newParams = { ...action.parameters };
                              delete newParams[key];
                              updateAction(index, 'parameters', newParams);
                            }}
                            title="删除参数"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {showParamFormForAction === index ? (
                        <div style={styles.paramForm}>
                          <input
                            type="text"
                            placeholder="参数名 (如 power)"
                            value={newParamKey}
                            onChange={(e) => setNewParamKey(e.target.value)}
                            style={{ ...styles.paramInput, marginBottom: '6px' }}
                            autoFocus
                          />
                          <select
                            value={newParamType}
                            onChange={(e) => setNewParamType(e.target.value as 'bool' | 'number' | 'string')}
                            style={{ ...styles.formSelect, marginBottom: '6px', fontSize: '13px' }}
                          >
                            <option value="bool">布尔值 (true/false)</option>
                            <option value="number">数字</option>
                            <option value="string">文本</option>
                          </select>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              style={{ ...styles.addParamButton, flex: 1 }}
                              onClick={() => {
                                if (!newParamKey.trim()) return;
                                let defaultValue: unknown = false;
                                if (newParamType === 'number') defaultValue = 0;
                                else if (newParamType === 'string') defaultValue = '';
                                updateActionParam(index, newParamKey.trim(), defaultValue);
                                setNewParamKey('');
                                setNewParamType('bool');
                                setShowParamFormForAction(null);
                              }}
                            >
                              确认
                            </button>
                            <button
                              type="button"
                              style={{ ...styles.addParamButton, background: 'rgba(0,0,0,0.06)', color: '#4A4A4A', flex: 1 }}
                              onClick={() => {
                                setNewParamKey('');
                                setNewParamType('bool');
                                setShowParamFormForAction(null);
                              }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          style={styles.addParamButton}
                          onClick={() => setShowParamFormForAction(index)}
                        >
                          + 添加参数
                        </button>
                      )}
                    </div>
                    <button style={styles.removeButton} onClick={() => removeAction(index)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.previewSection}>
              <div style={styles.previewHeader}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span style={styles.previewTitle}>规则预览</span>
              </div>
              <pre style={styles.previewContent}>{getRulePreview()}</pre>
            </div>

            {formError && (
              <div style={styles.formError}>{formError}</div>
            )}

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setIsCreating(false)}>取消</button>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(!form.name || submitting || !form.actions[0]?.deviceId || (form.triggerType === 'device_state' && !form.condition.deviceId)
                    ? styles.confirmButtonDisabled
                    : {}),
                }}
                onClick={handleCreate}
                disabled={!form.name || submitting || !form.actions[0]?.deviceId || (form.triggerType === 'device_state' && !form.condition.deviceId)}
              >
                {submitting ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : null}
                创建规则
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingState}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div style={styles.loadingText}>加载规则中...</div>
        </div>
      ) : rules.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#B0B0B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div style={styles.emptyTitle}>暂无自动化规则</div>
          <div style={styles.emptyDesc}>创建规则以实现智能场景自动触发</div>
        </div>
      ) : (
        <div style={styles.ruleGrid}>
          {rules.map((rule) => {
                const meta = TRIGGER_META[rule.triggerType];
                return (
                  <div key={rule.id} style={styles.ruleCard} className="anim-slide-up">
                    <div style={styles.ruleHeader}>
                      <div style={styles.ruleIconWrap}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#005FB8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                      </div>
                      <div style={styles.ruleInfo}>
                        <h3 style={styles.ruleName}>{rule.name}</h3>
                        <div style={styles.ruleMeta}>
                          <span style={{ ...styles.triggerPill, color: meta.color, background: meta.bg }}>
                            {meta.label}
                          </span>
                          <span style={styles.ruleCondition}>{describeCondition(rule)}</span>
                        </div>
                      </div>
                      <button
                        style={{
                          ...styles.toggleSwitch,
                          background: rule.enabled ? '#107C10' : 'rgba(0, 0, 0, 0.15)',
                        }}
                        onClick={() => handleToggle(rule.id)}
                        disabled={togglingId === rule.id}
                      >
                        <div
                          style={{
                            ...styles.toggleKnob,
                            transform: rule.enabled ? 'translateX(18px)' : 'translateX(0)',
                          }}
                        />
                      </button>
                    </div>

                    <div style={styles.ruleActions}>
                      <div style={styles.ruleActionMeta}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B5B5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 11 12 14 22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        <span>执行 {(rule.actions?.length ?? 0)} 个动作</span>
                      </div>
                      <div style={styles.ruleActionButtons}>
                        <button
                          style={{ ...styles.testButton, ...(testingId === rule.id ? styles.testButtonLoading : {}) }}
                          onClick={() => handleTest(rule.id)}
                          disabled={testingId === rule.id}
                        >
                          {testingId === rule.id ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                          <span>{testingId === rule.id ? '执行中' : '测试执行'}</span>
                        </button>
                        <button
                          style={{ ...styles.iconActionButton, color: '#005FB8' }}
                          onClick={() => setViewingHistoryRule({ id: rule.id, name: rule.name })}
                          title="执行历史"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                        </button>
                        <button
                          style={{ ...styles.iconActionButton, color: '#C42B1C' }}
                          onClick={() => handleDelete(rule.id)}
                          title="删除规则"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {viewingHistoryRule && (
                <div style={styles.historyView}>
                  <button
                    style={styles.backButton}
                    onClick={() => setViewingHistoryRule(null)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    <span>返回规则列表</span>
                  </button>
                  <RuleExecutionHistory ruleId={viewingHistoryRule.id} ruleName={viewingHistoryRule.name} />
                </div>
              )}
        </div>
      )}
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
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
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    background: '#005FB8',
    border: 'none',
    color: '#FFFFFF',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
    userSelect: 'none',
    transition: 'transform 0.1s ease, box-shadow 0.15s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '12px',
    padding: '24px',
    width: '620px',
    maxWidth: '92vw',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.18), 0 0 8px rgba(0, 0, 0, 0.08)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    fontSize: '17px',
    fontWeight: 600,
    color: '#1A1A1A',
    margin: 0,
  },
  closeButton: {
    width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none',
    color: '#5B5B5B', cursor: 'pointer', borderRadius: '6px',
  },
  formGroup: { marginBottom: '16px' },
  formLabel: {
    display: 'block',
    fontSize: '13px', fontWeight: 600,
    color: '#1A1A1A', marginBottom: '6px',
  },
  formInput: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    outline: 'none',
  },
  formSelect: {
    padding: '9px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '13px',
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '120px',
  },
  triggerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  triggerButton: {
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
  },
  triggerButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  conditionRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
  },
  presetButton: {
    padding: '8px 10px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
  },
  presetButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  cronHint: {
    fontSize: '11px', color: '#8A8A8A', margin: '6px 0 0 0',
  },
  manualHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 12px',
    background: 'rgba(139, 92, 246, 0.08)',
    color: '#8B5CF6',
    borderRadius: '6px',
    fontSize: '12px',
  },
  actionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  addActionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  actionList: {
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  actionRow: {
    display: 'flex', gap: '8px', alignItems: 'flex-start',
  },
  actionParams: {
    display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0,
  },
  paramItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 8px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  paramKey: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#5B5B5B',
    minWidth: '60px',
  },
  paramInput: {
    flex: 1,
    padding: '5px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    background: '#FFFFFF',
    outline: 'none',
  },
  paramToggle: {
    position: 'relative',
    width: '32px', height: '18px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.2s',
  },
  paramToggleKnob: {
    position: 'absolute',
    top: '2px', left: '2px',
    width: '14px', height: '14px',
    borderRadius: '50%',
    background: '#FFFFFF',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.2s',
  },
  paramRemove: {
    width: '20px', height: '20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: '#8A8A8A',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '16px',
    lineHeight: 1,
  },
  addParamButton: {
    padding: '4px 8px',
    background: 'rgba(0, 95, 184, 0.06)',
    border: '1px dashed rgba(0, 95, 184, 0.3)',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    alignSelf: 'flex-start',
    userSelect: 'none',
    transition: 'transform 0.1s ease, background 0.15s',
  },
  paramForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px',
    background: 'rgba(0, 95, 184, 0.04)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 95, 184, 0.12)',
    alignSelf: 'stretch',
  },
  previewSection: {
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(0, 95, 184, 0.04)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 95, 184, 0.12)',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  previewTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#005FB8',
  },
  previewContent: {
    margin: 0,
    padding: '8px 10px',
    fontSize: '12px',
    lineHeight: 1.7,
    color: '#1A1A1A',
    background: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '6px',
    whiteSpace: 'pre-wrap',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  modalFooter: {
    display: 'flex', gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '24px', paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  cancelButton: {
    padding: '9px 20px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#1A1A1A',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
  },
  confirmButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    background: '#005FB8',
    border: 'none', color: '#FFFFFF',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0, 95, 184, 0.28)',
  },
  confirmButtonDisabled: {
    background: '#B0B0B0',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  formError: {
    background: 'rgba(196, 43, 28, 0.08)',
    color: '#C42B1C',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '12px',
    border: '1px solid rgba(196, 43, 28, 0.15)',
  },
  // 多设备联动样式
  multiDeviceToggle: {
    marginBottom: '12px',
  },
  toggleButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
  },
  toggleButton: {
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    flex: 1,
  },
  toggleButtonActive: {
    background: '#005FB8',
    color: '#FFFFFF',
    borderColor: '#005FB8',
  },
  logicSelector: {
    marginBottom: '12px',
  },
  logicButton: {
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.6)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: '#5B5B5B',
    cursor: 'pointer',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    flex: 1,
  },
  logicButtonActive: {
    background: '#107C10',
    color: '#FFFFFF',
    borderColor: '#107C10',
  },
  multiConditionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  addConditionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none',
    color: '#005FB8',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  multiConditionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  multiConditionItem: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  conditionNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'rgba(0, 95, 184, 0.12)',
    color: '#005FB8',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeConditionButton: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(196, 43, 28, 0.08)',
    border: 'none',
    color: '#C42B1C',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  emptyConditionHint: {
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.02)',
    borderRadius: '6px',
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: '12px',
  },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
  },
  loadingText: {
    marginTop: '12px', fontSize: '13px', color: '#5B5B5B',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '12px',
  },
  emptyIcon: { marginBottom: '16px' },
  emptyTitle: {
    fontSize: '15px', fontWeight: 600,
    color: '#5B5B5B', marginBottom: '4px',
  },
  emptyDesc: { fontSize: '13px', color: '#8A8A8A' },
  ruleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '14px',
  },
  ruleCard: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px) saturate(125%)',
    WebkitBackdropFilter: 'blur(40px) saturate(125%)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  ruleHeader: {
    display: 'flex', gap: '12px', alignItems: 'flex-start',
  },
  ruleIconWrap: {
    width: '44px', height: '44px',
    borderRadius: '8px',
    background: 'rgba(0, 95, 184, 0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  ruleInfo: { flex: 1, minWidth: 0 },
  ruleName: {
    fontSize: '15px', fontWeight: 600,
    color: '#1A1A1A', margin: 0,
    letterSpacing: '-0.01em',
  },
  ruleMeta: {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginTop: '6px', flexWrap: 'wrap',
  },
  triggerPill: {
    padding: '2px 8px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 600,
  },
  ruleCondition: {
    fontSize: '12px', color: '#5B5B5B',
    fontFamily: 'monospace',
  },
  toggleSwitch: {
    position: 'relative',
    width: '40px', height: '20px',
    borderRadius: '999px', border: 'none',
    cursor: 'pointer', padding: 0, flexShrink: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px', left: '3px',
    width: '14px', height: '14px',
    borderRadius: '50%', background: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  ruleActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  ruleActionMeta: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '12px', color: '#5B5B5B', fontWeight: 500,
  },
  ruleActionButtons: {
    display: 'flex', gap: '6px', alignItems: 'center',
  },
  testButton: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 10px',
    background: 'rgba(0, 95, 184, 0.08)',
    border: 'none', color: '#005FB8',
    borderRadius: '6px', cursor: 'pointer',
    fontSize: '12px', fontWeight: 500,
  },
  testButtonLoading: {
    background: 'rgba(0, 95, 184, 0.04)',
    cursor: 'wait',
  },
  iconActionButton: {
    width: '32px', height: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none', color: '#5B5B5B',
    borderRadius: '6px', cursor: 'pointer',
  },
  historyView: {
    gridColumn: '1 / -1',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    color: '#005FB8',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '16px',
    alignSelf: 'flex-start',
  },
};
