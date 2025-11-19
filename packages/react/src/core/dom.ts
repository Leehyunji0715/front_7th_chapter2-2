/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeTypes } from "./constants";
import { Instance } from "./types";

const isFunctionHandler = ({ key, value }: { key: string; value: any }) => {
  return key.startsWith("on") && typeof value === "function";
};

const setSingleProp = (dom: HTMLElement, { key, value }: { key: string; value: any }) => {
  if (key === "children") return;

  if (isFunctionHandler({ key, value })) {
    const eventType = key.slice(2).toLowerCase();
    dom.addEventListener(eventType, value);
    return;
  }

  // className을 class로 변환
  if (key === "className") {
    dom.setAttribute("class", value);
    return;
  }

  // htmlFor를 for로 변환
  if (key === "htmlFor") {
    dom.setAttribute("for", value);
    return;
  }

  // style 객체 처리
  if (key === "style" && typeof value === "object") {
    const cssText = Object.entries(value)
      .map(([styleKey, styleValue]) => {
        // camelCase를 kebab-case로 변환 (fontSize -> font-size)
        const kebabKey = styleKey.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `${kebabKey}: ${styleValue}`;
      })
      .join("; ");
    (dom as any).style.cssText = cssText;
    return;
  }

  // 불린 속성 처리
  if (typeof value === "boolean") {
    if (value) {
      dom.setAttribute(key, "");
    }
    return;
  }

  // null이나 undefined는 속성 제거
  if (value == null) {
    dom.removeAttribute(key);
    return;
  }

  // 일반 속성
  dom.setAttribute(key, String(value));
};

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 */
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  Object.entries(props).forEach(([key, value]) => {
    setSingleProp(dom, { key, value });
  });
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  prevProps: Record<string, any> = {},
  nextProps: Record<string, any> = {},
): void => {
  for (const [key, value] of Object.entries(nextProps)) {
    if (prevProps[key] !== nextProps[key]) {
      if (isFunctionHandler({ key, value })) {
        const eventType = key.slice(2).toLowerCase();
        dom.removeEventListener(eventType, prevProps[key]);
      }

      setSingleProp(dom, { key, value });
    }
  }

  for (const key of Object.keys(prevProps)) {
    if (nextProps[key] === undefined) {
      dom.removeAttribute(key);
    }
  }
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  if (!instance) {
    return [];
  }

  // HOST나 TEXT 타입이면 직접 DOM 노드를 가지고 있음
  if (instance.kind === NodeTypes.HOST || instance.kind === NodeTypes.TEXT) {
    return instance.dom ? [instance.dom] : [];
  }

  // COMPONENT나 FRAGMENT 타입이면 자식들로부터 DOM 노드 수집
  const nodes: (HTMLElement | Text)[] = [];
  for (const child of instance.children) {
    nodes.push(...getDomNodes(child));
  }
  return nodes;
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (instance: Instance | null): HTMLElement | Text | null => {
  if (!instance) {
    return null;
  }

  // HOST나 TEXT 타입이면 직접 DOM 노드를 반환
  if (instance.kind === NodeTypes.HOST || instance.kind === NodeTypes.TEXT) {
    return instance.dom;
  }

  // COMPONENT나 FRAGMENT 타입이면 자식들로부터 첫 번째 DOM 노드 찾기
  return getFirstDomFromChildren(instance.children);
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (children: (Instance | null)[]): HTMLElement | Text | null => {
  for (const child of children) {
    const dom = getFirstDom(child);
    if (dom) {
      return dom;
    }
  }
  return null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  if (!instance) {
    return;
  }

  // 타입별 최적화된 처리
  switch (instance.kind) {
    case NodeTypes.HOST:
    case NodeTypes.TEXT:
      // 직접 DOM이 있는 경우 바로 삽입
      if (instance.dom) {
        parentDom.insertBefore(instance.dom, anchor);
      }
      break;

    case NodeTypes.COMPONENT:
    case NodeTypes.FRAGMENT: {
      // 자식들을 재귀적으로 삽입
      const domNodes = getDomNodes(instance);
      for (const domNode of domNodes) {
        if (domNode) {
          parentDom.insertBefore(domNode, anchor);
        }
      }
      break;
    }
  }
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  if (!instance) {
    return;
  }

  // DOM 노드들 제거
  const domNodes = getDomNodes(instance);
  for (const domNode of domNodes) {
    if (domNode && domNode.parentNode === parentDom) {
      parentDom.removeChild(domNode);
    }
  }
};
