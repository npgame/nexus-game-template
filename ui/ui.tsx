import React from 'react';
import type { GameUIProps } from '@nexusgame/game-sdk';
import type { TemplateState } from '../logic';
import styles from './ui.module.css';

const TemplateUI: React.FC<GameUIProps<TemplateState>> = ({
  perspective,
  onAction,
  isMyTurn,
  readonly,
  metadata,
}) => {
  const { current_state, your_role } = perspective;
  const roleId = metadata?.roleId ?? your_role.identity;
  const passAction = perspective.action_space_definition.actions.find(
    (action) => action.action_id === 'pass'
  );

  return (
    <div className={styles.container}>
      <div className={styles.board}>
        <h2>Nexus Game Template</h2>
        <p>你的角色：{roleId}</p>
        <p>当前回合：{current_state.turn}</p>
        <p>当前行动：{current_state.currentRole}</p>

        {passAction ? (
          <button
            className={styles.button}
            disabled={!isMyTurn || readonly}
            onClick={() => onAction({ action_id: 'pass', role_id: roleId })}
          >
            结束回合
          </button>
        ) : (
          <p>{perspective.message ?? '等待其他玩家行动'}</p>
        )}
      </div>
    </div>
  );
};

export default TemplateUI;
