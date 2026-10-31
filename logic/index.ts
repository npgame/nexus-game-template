/**
 * 通用游戏模板：最小可运行的回合制逻辑。
 *
 * 约束（平台契约）：
 * - 所有方法都是纯函数，不做任何 I/O、不读时间、不读随机数。
 * - 平台负责状态持久化、LLM 调度、WebSocket 和权限。
 * - 游戏 id / name 来自 nexus.game.json；该文件在注册游戏时由 publisher 写入，
 *   本地开发时使用仓库里的占位值。
 */

import {
  Action,
  ActionResult,
  ActionSpec,
  GameLogic,
  GameMetadata,
  GameState,
  HistoryEvent,
  InitContext,
  RolePerspective,
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
      getStatusText: (perspective) => `第 ${perspective.current_state.turn} 回合`,
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

  getCurrentRole(state: TemplateState): string {
    return state.currentRole;
  }

  getLegalActions(state: TemplateState, roleId: string | null): ActionSpec {
    if (roleId !== state.currentRole) {
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

  applyAction(state: TemplateState, action: Action): ActionResult<TemplateState> {
    if (action.role_id !== state.currentRole) {
      return { success: false, error: '不是你的回合' };
    }
    if (action.action_id !== 'pass') {
      return { success: false, error: `未知行动：${action.action_id}` };
    }

    const index = state.order.indexOf(state.currentRole);
    const nextRole = state.order[(index + 1) % state.order.length];

    return {
      success: true,
      nextState: {
        ...state,
        currentRole: nextRole,
        turn: state.turn + 1,
      },
    };
  }

  isTerminal(_state: TemplateState): boolean {
    return false;
  }

  getWinners(_state: TemplateState): string[] | null {
    return null;
  }

  toRolePerspective(
    state: TemplateState,
    roleId: string | null,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective<TemplateState> {
    const spectator = !roleId;
    const isCurrent = !spectator && state.currentRole === roleId;

    const message = spectator
      ? `观战模式 - 轮到 ${state.currentRole}`
      : isCurrent
        ? '轮到你了，请选择行动'
        : `等待 ${state.currentRole} 行动`;

    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: state,
      your_role: {
        identity: spectator ? 'Spectator' : roleId,
        goal: '在你的回合选择“结束回合”，把行动权交给下一位玩家。',
        is_current: isCurrent,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message,
    };
  }

  generateStatePrompt(perspective: RolePerspective<TemplateState>): string {
    const state = perspective.current_state;
    const actions = perspective.action_space_definition.actions
      .map((action) => action.action_id)
      .join(', ');

    return [
      '# 游戏状态',
      `回合：${state.turn}`,
      `当前行动角色：${state.currentRole}`,
      `你的身份：${perspective.your_role.identity}`,
      `可选行动：${actions || '无'}`,
    ].join('\n');
  }
}

export default new TemplateGameLogic();
