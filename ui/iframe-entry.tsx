/**
 * iframe 入口：负责与 Nexus 平台通信。
 * 1. 监听父窗口的 SYNC_STATE 消息并渲染游戏 UI
 * 2. 把 UI 产生的 ACT 消息回传给父窗口
 * 3. 本地调试时（URL 带 stateUrl/token）直接读取状态并调用 actionUrl
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Action } from '@nexusgame/game-sdk';
import TemplateUI from './ui';

interface GameState {
  perspective: any;
  isMyTurn: boolean;
  readonly: boolean;
  metadata?: {
    roomId: string;
    roleId: string;
    playerId?: string;
  };
}

const IframeApp: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stateUrl = params.get('stateUrl');
    const token = params.get('token');

    // 本地调试：直接从 worker 读取当前视角
    if (stateUrl && token) {
      const headers = { Authorization: `Bearer ${token}` };
      fetch(stateUrl, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setGameState({
              perspective: data.data,
              isMyTurn: data.data.your_role.is_current,
              readonly: false,
              metadata: {
                roleId: new URL(stateUrl).searchParams.get('roleId') as string,
                roomId: 'dev-room',
              },
            });
          }
        })
        .catch((err) => console.error('Failed to fetch state:', err));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'SYNC_STATE' && event.data.payload) {
        setGameState(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleAction = async (action: Action) => {
    const params = new URLSearchParams(window.location.search);
    const actionUrl = params.get('actionUrl');
    const token = params.get('token');

    // 本地调试：直接调用 worker 的 action 接口
    if (actionUrl && token) {
      try {
        const res = await fetch(actionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ roleId: action.role_id, action }),
        });
        const data = await res.json();
        if (!data.success) {
          console.error('Action failed:', data);
        }
      } catch (err) {
        console.error('Failed to submit action:', err);
      }
      return;
    }

    window.parent.postMessage({ type: 'ACT', payload: action }, '*');
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
      onAction={handleAction}
      isMyTurn={gameState.isMyTurn}
      readonly={gameState.readonly}
      metadata={gameState.metadata}
    />
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<IframeApp />);
