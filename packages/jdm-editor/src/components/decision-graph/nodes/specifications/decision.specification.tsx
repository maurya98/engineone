import { ArrowRightOutlined, SyncOutlined } from '@ant-design/icons';
import { Form, Select, Switch } from 'antd';
import { GitBranchIcon } from 'lucide-react';
import React from 'react';

import { useDecisionGraphActions, useDecisionGraphState } from '../../context/dg-store.context';
import { GraphNode } from '../graph-node';
import { NodeColor } from './colors';
import type { NodeSpecification } from './specification-types';
import { NodeKind } from './specification-types';

export type NodeDecisionData = {
  key: string;
  passThrough?: boolean;
  inputField?: string | null;
  outputPath?: string | null;
  executionMode?: 'single' | 'loop';
};

export const decisionSpecification: NodeSpecification<NodeDecisionData> = {
  type: NodeKind.Decision,
  icon: <GitBranchIcon size='1em' />,
  displayName: 'Decision',
  documentationUrl: 'https://docs.gorules.io/developers/jdm/node-types',
  shortDescription: 'Sub-decision reference',
  color: NodeColor.Blue,
  generateNode: ({ index }) => ({
    name: `decision${index}`,
    content: {
      key: '',
      passThrough: true,
      inputField: null,
      outputPath: null,
      executionMode: 'single',
    },
  }),
  renderNode: ({ id, data, selected, specification }) => {
    const graphActions = useDecisionGraphActions();
    const { passThrough, executionMode, key } = useDecisionGraphState(({ decisionGraph }) => {
      const content = (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeDecisionData;
      return {
        passThrough: content?.passThrough ?? true,
        executionMode: content?.executionMode ?? 'single',
        key: content?.key ?? '',
      };
    });

    return (
      <GraphNode
        id={id}
        specification={specification}
        name={data.name}
        isSelected={selected}
        helper={[executionMode === 'loop' && <SyncOutlined />, passThrough && <ArrowRightOutlined />]}
        details={key ? <span style={{ fontSize: 12, color: 'var(--grl-color-text-secondary)' }}>{key}</span> : undefined}
      />
    );
  },
  renderSettings: ({ id }) => {
    const graphActions = useDecisionGraphActions();
    const { content, decisionKeys = [], disabled } = useDecisionGraphState(
      ({ decisionGraph, decisionKeys, disabled }) => ({
        content: (decisionGraph?.nodes ?? []).find((node) => node.id === id)?.content as NodeDecisionData,
        decisionKeys: decisionKeys ?? [],
        disabled,
      }),
    );

    const key = content?.key ?? '';
    const passThrough = content?.passThrough ?? true;
    const inputField = content?.inputField ?? '';
    const outputPath = content?.outputPath ?? '';
    const executionMode = content?.executionMode ?? 'single';

    const updateNode = (data: Partial<NodeDecisionData>) => {
      graphActions.updateNode(id, (draft) => {
        Object.assign(draft.content, data);
        return draft;
      });
    };

    const keyOptions = React.useMemo(() => {
      const list = (decisionKeys ?? []).map((k) => ({ label: k, value: k }));
      if (key && !decisionKeys.includes(key)) {
        return [{ label: key, value: key }, ...list];
      }
      return list;
    }, [decisionKeys, key]);

    return (
      <div className='settings-form'>
        <Form.Item label='Key' required tooltip='Path to the referenced decision (e.g. pricing/calculate-discount)'>
          <Select
            showSearch
            allowClear
            placeholder='Select decision…'
            size='small'
            disabled={disabled}
            value={key || undefined}
            options={keyOptions}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes((input ?? '').toLowerCase())}
            onChange={(val) => updateNode({ key: val ?? '' })}
            dropdownStyle={{ maxHeight: 280 }}
            notFoundContent={decisionKeys.length === 0 ? 'No JSON files in repo' : null}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label='Passthrough'>
          <Switch
            size='small'
            checked={passThrough}
            onChange={(checked) => updateNode({ passThrough: checked })}
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label='Input field'>
          <input
            className='ant-input ant-input-sm'
            style={{ width: '100%' }}
            value={inputField}
            onChange={(e) => updateNode({ inputField: e.target.value?.trim() || null })}
            placeholder='Optional'
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label='Output path'>
          <input
            className='ant-input ant-input-sm'
            style={{ width: '100%' }}
            value={outputPath}
            onChange={(e) => updateNode({ outputPath: e.target.value?.trim() || null })}
            placeholder='Optional'
            disabled={disabled}
          />
        </Form.Item>
        <Form.Item label='Execution mode'>
          <Select
            size='small'
            disabled={disabled}
            value={executionMode}
            onChange={(val) => updateNode({ executionMode: val ?? 'single' })}
            options={[
              { label: 'Single', value: 'single' },
              { label: 'Loop', value: 'loop' },
            ]}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </div>
    );
  },
};
