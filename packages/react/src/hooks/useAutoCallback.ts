import type { AnyFunction } from "../types";
import { useCallback } from "./useCallback";
import { useRef } from "./useRef";

/**
 * 항상 최신 상태를 참조하면서도, 함수 자체의 참조는 변경되지 않는 콜백을 생성합니다.
 *
 * @param fn - 최신 상태를 참조할 함수
 * @returns 참조가 안정적인 콜백 함수
 */
export const useAutoCallback = <T extends AnyFunction>(fn: T): T => {
  // 최신 함수를 ref에 저장 (렌더링마다 업데이트)
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // 안정적인 래퍼 함수 생성 (참조는 변경되지 않음)
  const stableWrapper = useCallback((...args: unknown[]) => {
    // 실행할 때마다 최신 함수 호출
    return fnRef.current(...args);
  }, []);

  return stableWrapper as T;
};
