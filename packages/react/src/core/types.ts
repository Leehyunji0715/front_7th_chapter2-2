import type { HookType, NodeType } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any> & { children?: VNode[] };

export interface FunctionComponent<P extends Props> {
  (props: P): VNode | null;
  displayName?: string;
}

export interface VNode {
  type: string | symbol | React.ComponentType;
  key: string | null;
  props: Props;
}

export interface Instance {
  kind: NodeType;
  dom: HTMLElement | Text | null;
  node: VNode;
  children: (Instance | null)[];
  key: string | null;
  path: string;
}

export interface EffectHook {
  kind: HookType["EFFECT"];
  deps: unknown[] | null;
  cleanup: (() => void) | null;
  effect: () => (() => void) | void;
}

export interface StateHook {
  kind: HookType["STATE"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

export interface RootContext {
  container: HTMLElement | null;
  node: VNode | null;
  instance: Instance | null;

  reset(options: { container: HTMLElement; node: VNode }): void;
}

export type HookData = StateHook | EffectHook;

export interface HooksContext {
  state: Map<string, HookData[]>;
  cursor: Map<string, number>;
  visited: Set<string>;
  componentStack: string[];

  clear(): void;
  moveCursor(): void;

  readonly currentPath: string;
  readonly currentCursor: number;
  readonly currentHooks: HookData[];
}

export interface EffectsContext {
  queue: Array<{ path: string; cursor: number }>;
}

export interface Context {
  root: RootContext;
  hooks: HooksContext;
  effects: EffectsContext;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    interface ComponentType<P extends Props = Props> {
      (props: P): VNode | null;
    }
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [elemName: string]: any;
    }

    const Fragment: React.ComponentType;
  }
}
