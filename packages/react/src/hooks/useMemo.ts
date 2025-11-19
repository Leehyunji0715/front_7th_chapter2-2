import { DependencyList } from "./types";
import { useRef } from "./useRef";
import { shallowEquals } from "../utils";

/**
 * 계산 비용이 큰 함수의 결과를 메모이제이션합니다.
 * 의존성 배열(deps)의 값이 변경될 때만 함수를 다시 실행합니다.
 *
 * @param factory - 메모이제이션할 값을 생성하는 함수
 * @param deps - 의존성 배열
 * @param equals - 의존성을 비교할 함수 (기본값: shallowEquals)
 * @returns 메모이제이션된 값
 */
export const useMemo = <T>(factory: () => T, deps: DependencyList, equals = shallowEquals): T => {
  const prevDeps = useRef<DependencyList | undefined>(undefined);
  const memoized = useRef<T | undefined>(undefined);

  if (prevDeps.current === undefined || !equals(prevDeps.current, deps)) {
    memoized.current = factory();
    prevDeps.current = deps;
  }

  return memoized.current!;
};
