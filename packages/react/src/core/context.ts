import { Context } from "./types";

/**
 * Mini-React의 전역 컨텍스트입니다.
 * 렌더링 루트, 훅 상태, 이펙트 큐 등 모든 런타임 데이터를 관리합니다.
 */
export const context: Context = {
  /**
   * 렌더링 루트와 관련된 정보를 관리합니다.
   */
  root: {
    container: null,
    node: null,
    instance: null,
    reset({ container, node }) {
      this.container = container;
      this.node = node;
      this.instance = null;
    },
  },

  /**
   * 훅의 상태를 관리합니다.
   * 컴포넌트 경로(path)를 키로 사용하여 각 컴포넌트의 훅 상태를 격리합니다.
   */
  hooks: {
    state: new Map(),
    cursor: new Map(),
    visited: new Set(),
    componentStack: [],

    /**
     * 모든 훅 관련 상태를 초기화합니다.
     */
    clear() {
      this.state.clear();
      this.cursor.clear();
      this.visited.clear();
      this.componentStack = [];
    },

    /**
     * 현재 실행 중인 컴포넌트의 고유 경로를 반환합니다.
     */
    get currentPath() {
      if (this.componentStack.length === 0) {
        throw new Error("훅은 컴포넌트 내부에서만 호출되어야 합니다");
      }
      return this.componentStack[this.componentStack.length - 1];
    },

    /**
     * 현재 컴포넌트에서 다음에 실행될 훅의 인덱스(커서)를 반환합니다.
     */
    get currentCursor() {
      const path = this.currentPath;
      return this.cursor.get(path) || 0;
    },

    /**
     * 현재 컴포넌트의 훅 상태 배열을 반환합니다.
     */
    get currentHooks() {
      const path = this.currentPath;
      if (!this.state.has(path)) {
        this.state.set(path, []);
      }
      return this.state.get(path)!;
    },

    /**
     * 현재 컴포넌트의 훅 커서를 다음 위치로 이동시킵니다.
     */
    moveCursor() {
      const path = this.currentPath;
      const currentCursor = this.cursor.get(path) || 0;
      this.cursor.set(path, currentCursor + 1);
    },
  },

  /**
   * useEffect 훅의 실행을 관리하는 큐입니다.
   */
  effects: {
    queue: [],
  },
};
