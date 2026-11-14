/**
 * 通用游戏模板：最小可运行的回合制状态机。
 *
 * 约束（平台契约）：
 * - 所有方法都是纯函数，不做任何 I/O、不读时间、不读随机数。
 * - 平台负责状态持久化、LLM 调度、WebSocket 和权限。
 * - `apply(state, event, ctx)` 是唯一的状态迁移入口；`getTurnState(state)`
 *   返回每个角色可用的动作以及对局是否结束。
 * - 游戏 id / name 来自 nexus.game.json；该文件在注册游戏时由 publisher 写入，
 *   本地开发时使用仓库里的占位值。
 */

import {
  ActionResult,
  ActionSpec,
  ApplyContext,
  GameEvent,
  GameLogic,
  GameMetadata,
  GameState,
  InitContext,
  PerspectiveContext,
  RolePerspective,
  TurnState,
} from '@nexusgame/game-sdk';
import gameConfig from '../nexus.game.json';

export interface TemplateState extends GameState {
  /** 角色行动顺序，来自 InitContext.players */
  order: string[];
  currentRole: string;
  turn: number;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

export class TemplateGameLogic implements GameLogic<TemplateState> {
  getMetadata(): GameMetadata {
    return {
      id: gameConfig.id,
      name: gameConfig.name,
      description: '通用模板游戏：在你的回合选择“结束回合”，把行动权交给下一位玩家。',
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      roleIds: Array.from({ length: MAX_PLAYERS }, (_, i) => `player_${i + 1}`),
      enable_llm_memory: false,
      // 契约版本标记，别漏掉。
      modelVersion: 2,
    };
  }

  initState(ctx: InitContext): TemplateState {
    if (ctx.players.length < MIN_PLAYERS || ctx.players.length > MAX_PLAYERS) {
      throw new Error(`本游戏需要 ${MIN_PLAYERS}-${MAX_PLAYERS} 名玩家`);
    }

    return {
      order: [...ctx.players],
      currentRole: ctx.players[0],
      turn: 1,
    };
  }

  /**
   * `actions` 按角色组织：出现在表里的角色都可以提交一个行动，不是“所有人都
   * 必须提交”的窗口。模板里每回合只有当前角色一人。
   */
  getTurnState(state: TemplateState): TurnState {
    const spec = this.getLegalActions(state, state.currentRole);
    return {
      actions: spec.actions.length > 0 ? { [state.currentRole]: spec } : {},
      terminal: false,
      outcome: null,
    };
  }

  apply(
    state: TemplateState,
    event: GameEvent,
    _ctx: ApplyContext,
  ): ActionResult<TemplateState> {
    // 模板不创建定时器，只有行动事件会到达这里。
    if (event.kind !== 'action') {
      return { success: false, error: '未知事件', errorCode: 'UNKNOWN_EVENT' };
    }
    const action = event.action;

    if (!state.order.includes(action.role_id)) {
      return { success: false, error: '你不是本局参与者', errorCode: 'NOT_PLAYER' };
    }
    if (action.role_id !== state.currentRole) {
      return { success: false, error: '不是你的回合', errorCode: 'NOT_YOUR_TURN' };
    }
    if (action.action_id !== 'pass') {
      return { success: false, error: `未知行动：${action.action_id}`, errorCode: 'UNKNOWN_ACTION' };
    }

    const index = state.order.indexOf(state.currentRole);
    const nextRole = state.order[(index + 1) % state.order.length];

    // 纯函数：先复制再修改，不直接改动入参 state。
    return {
      success: true,
      nextState: {
        ...state,
        currentRole: nextRole,
        turn: state.turn + 1,
      },
    };
  }

  /** roleId 为 null 表示观战者。动作列表由引擎从 TurnState 单独下发。 */
  toRolePerspective(
    state: TemplateState,
    roleId: string | null,
    _ctx?: PerspectiveContext,
  ): RolePerspective<TemplateState> {
    const spectator = roleId === null;

    return {
      global_rules: this.getMetadata().description,
      // 模板没有隐藏信息，直接把权威状态暴露给所有人；有隐藏信息的游戏应
      // 在这里只返回该角色可见的子集。
      current_state: state,
      your_role: {
        identity: spectator ? 'Spectator' : roleId,
        goal: '在你的回合选择“结束回合”，把行动权交给下一位玩家。',
      },
    };
  }

  private getLegalActions(state: TemplateState, roleId: string | null): ActionSpec {
    if (roleId === null || roleId !== state.currentRole) {
      return { actions: [] };
    }

    return {
      actions: [
        {
          action_id: 'pass',
          description: '结束回合，把行动权交给下一位玩家',
          params_schema: null,
        },
      ],
    };
  }

  generateStatePrompt(
    perspective: RolePerspective<TemplateState>,
    actions: ActionSpec,
  ): string {
    const state = perspective.current_state;
    const actionText = actions.actions.map((action) => action.action_id).join(', ');

    return [
      '# 游戏状态',
      `回合：${state.turn}`,
      `当前行动角色：${state.currentRole}`,
      `你的身份：${perspective.your_role.identity}`,
      `可选行动：${actionText || '无'}`,
    ].join('\n');
  }
}

export default new TemplateGameLogic();
