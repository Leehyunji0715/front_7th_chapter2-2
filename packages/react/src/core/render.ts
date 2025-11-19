import { context } from "./context";
// import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
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

  // 2. 방문된 컴포넌트들의 훅 커서만 리셋
  for (const path of context.hooks.visited) {
    context.hooks.cursor.set(path, 0);
  }

  // 3. 새로운 렌더링 사이클을 위한 visited 준비
  const previousVisited = new Set(context.hooks.visited);
  context.hooks.visited.clear();

  // 4. reconcile 함수를 호출하여 루트 노드를 재조정
  const newInstance = reconcile(container, context.root.instance, node, "i0");

  // 5. 루트 인스턴스 업데이트
  context.root.instance = newInstance;

  // 6. 사용되지 않은 훅들을 정리 (visited 클리어 전의 상태로 확인)
  for (const [path] of context.hooks.state) {
    if (!context.hooks.visited.has(path) && previousVisited.has(path)) {
      // 이전에 존재했지만 현재 렌더링에서 방문되지 않은 컴포넌트 정리
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
