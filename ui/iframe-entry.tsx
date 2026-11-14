/**
 * iframe 入口：负责与 Nexus 平台通信。
 * 1. 监听父窗口的 SYNC_STATE 消息并渲染游戏 UI
 * 2. 把 UI 产生的 ACT 消息回传给父窗口
 *
 * 只有 postMessage 一种通信方式：宿主负责鉴权与转发。
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  Action,
  ActionSpec,
  ActMessage,
  GameUIMetadata,
  RolePerspective,
  SyncStateMessage,
} from '@nexusgame/game-sdk';
import TemplateUI from './ui';

interface GameState {
  perspective: RolePerspective;
  actions: ActionSpec;
  readonly: boolean;
  metadata?: GameUIMetadata;
}

function isSyncStateMessage(data: unknown): data is SyncStateMessage {
  if (!data || typeof data !== 'object') return false;
  const message = data as { type?: unknown; payload?: unknown };
  return message.type === 'SYNC_STATE' && !!message.payload;
}

const IframeApp: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (isSyncStateMessage(event.data)) {
        setGameState(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAction = (action: Action) => {
    const message: ActMessage = { type: 'ACT', payload: action };
    window.parent.postMessage(message, '*');
  };

  if (!gameState) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          color: '#666',
        }}
      >
        等待游戏数据...
      </div>
    );
  }

  return (
    <TemplateUI
      perspective={gameState.perspective}
      actions={gameState.actions}
      onAction={handleAction}
      readonly={gameState.readonly}
      metadata={gameState.metadata}
    />
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<IframeApp />);
