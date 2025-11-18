import { context } from "./context";
// import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue } from "../utils";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  // 1. 컨텍스트에서 필요한 정보 가져오기
  const { container, node } = context.root;

  if (!container || !node) {
    return;
  }

  // 2. 훅 컨텍스트 초기화 (visited 세트 클리어)
  context.hooks.visited.clear();

  // 3. reconcile 함수를 호출하여 루트 노드를 재조정
  const newInstance = reconcile(container, context.root.instance, node, "i0");

  // 4. 루트 인스턴스 업데이트
  context.root.instance = newInstance;

  // 5. 사용되지 않은 훅들을 정리
  cleanupUnusedHooks();
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
