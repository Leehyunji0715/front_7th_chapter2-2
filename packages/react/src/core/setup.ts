import { context } from "./context";
import { VNode } from "./types";
import { removeInstance } from "./dom";
import { cleanupUnusedHooks } from "./hooks";
import { render } from "./render";

/**
 * Mini-React 애플리케이션의 루트를 설정하고 첫 렌더링을 시작합니다.
 *
 * @param rootNode - 렌더링할 최상위 VNode
 * @param container - VNode가 렌더링될 DOM 컨테이너
 */
export const setup = (rootNode: VNode | null, container: HTMLElement): void => {
  // 1. 컨테이너 유효성을 검사합니다.
  if (!rootNode || !container) {
    throw new Error("rootNode와 container는 필수입니다");
  }

  // 2. 이전 렌더링 내용을 정리합니다.
  if (context.root.instance) {
    removeInstance(container, context.root.instance);
  }

  // 미사용 훅 정리
  cleanupUnusedHooks();

  // 컨테이너를 비웁니다.
  container.innerHTML = "";

  // 3. 루트 컨텍스트와 훅 컨텍스트를 리셋합니다.
  context.root.reset({
    container,
    node: rootNode,
  });

  // 훅 컨텍스트도 초기화
  context.hooks.clear();

  // 4. 첫 렌더링을 실행합니다.
  render();
};
