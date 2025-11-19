import { shallowEquals, withEnqueue } from "../utils";
import { context } from "./context";
import { EffectHook, StateHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태를 정리합니다.
 * (Effect cleanup은 removeInstance에서 실행되므로 여기서는 상태만 정리)
 */
export const cleanupUnusedHooks = () => {
  // state에는 있지만 visited에는 없는 컴포넌트들 = 제거된 컴포넌트들
  for (const [path] of context.hooks.state) {
    if (!context.hooks.visited.has(path)) {
      // 이 컴포넌트는 더 이상 존재하지 않으므로 훅 상태 정리
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }
};

/**
 * 특정 경로의 컴포넌트에 대한 Effect cleanup을 실행합니다.
 */
export const cleanupComponentEffects = (path: string) => {
  const hooks = context.hooks.state.get(path);
  if (hooks) {
    hooks.forEach((hook) => {
      if (hook.kind === HookTypes.EFFECT) {
        const effectHook = hook as EffectHook;
        if (effectHook.cleanup) {
          effectHook.cleanup();
        }
      }
    });
  }
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 1. 현재 컴포넌트의 경로와 훅 커서를 가져옵니다.
  const currentCursor = context.hooks.currentCursor;
  const currentHooks = context.hooks.currentHooks;

  // 2. 첫 렌더링이라면 초기값으로 상태를 설정합니다.
  if (!currentHooks[currentCursor]) {
    const value = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;

    currentHooks[currentCursor] = {
      kind: HookTypes.STATE,
      value,
    };
  }

  const hook = currentHooks[currentCursor] as StateHook;
  const currentValue = hook.value as T;

  // 3. 상태 변경 함수(setter)를 생성합니다.
  const setState = (nextValue: T | ((prev: T) => T)) => {
    // 최신 상태 값을 가져옵니다 (동일한 이벤트 루프에서 여러 번 호출될 수 있음)
    const latestValue = hook.value as T;
    const newValue = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(latestValue) : nextValue;

    // 새 값이 이전 값과 같으면(Object.is) 재렌더링을 건너뜁니다.
    if (Object.is(newValue, latestValue)) {
      return;
    }

    // 값이 다르면 상태를 업데이트하고 재렌더링을 예약(enqueueRender)합니다.
    hook.value = newValue;
    enqueueRender();
  };

  // 4. 훅 커서를 증가시키고 [상태, setter]를 반환합니다.
  context.hooks.moveCursor();
  return [currentValue, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  const currentCursor = context.hooks.currentCursor;
  const currentHooks = context.hooks.currentHooks;

  // 첫 렌더링이면 훅 데이터 초기화 (effect는 실행하지 않고 저장만)
  if (!currentHooks[currentCursor]) {
    currentHooks[currentCursor] = {
      kind: HookTypes.EFFECT,
      deps: deps || null,
      cleanup: null,
      effect: effect,
    };

    // 첫 렌더링이므로 effect 실행 예약
    const executeEffect = withEnqueue(() => {
      const cleanup = effect();
      if (cleanup && typeof cleanup === "function") {
        (currentHooks[currentCursor] as EffectHook).cleanup = cleanup;
      }
    });
    executeEffect();
  } else {
    // 기존 훅이 있으면 의존성 비교
    const hook = currentHooks[currentCursor] as EffectHook;

    // 의존성이 변경되었는지 확인
    const depsChanged = !shallowEquals(hook.deps, deps);

    if (depsChanged) {
      // effect와 deps 업데이트
      hook.effect = effect;
      hook.deps = deps || null;

      // 이전 cleanup 실행 후 새 effect 예약
      const executeEffect = withEnqueue(() => {
        if (hook.cleanup) {
          hook.cleanup();
          hook.cleanup = null;
        }

        const cleanup = effect();
        if (cleanup && typeof cleanup === "function") {
          hook.cleanup = cleanup;
        }
      });
      executeEffect();
    }
  }

  // 훅 커서 이동
  context.hooks.moveCursor();
};
