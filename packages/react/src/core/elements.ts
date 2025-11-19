/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue } from "../utils";
import { VNode } from "./types";
import { Fragment, TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: VNode): VNode | null => {
  // null, undefined, boolean 등 빈 값들은 렌더링하지 않음
  if (isEmptyValue(node)) {
    return null;
  }

  // 문자열이나 숫자는 텍스트 노드로 변환
  if (typeof node === "string" || typeof node === "number") {
    return createTextElement(String(node));
  }

  // 배열인 경우 평탄화하여 처리
  if (Array.isArray(node)) {
    // 배열을 평탄화하고 각 요소를 정규화
    return node
      .flat(Infinity)
      .map(normalizeNode)
      .filter((child) => child !== null);
  }

  // 이미 VNode 객체인 경우 그대로 반환
  if (node && typeof node === "object" && "type" in node) {
    return node;
  }

  return null;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
const createTextElement = (text: string): VNode => {
  return {
    type: TEXT_ELEMENT,
    key: null,
    props: {
      children: [],
      nodeValue: text,
    },
  };
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
) => {
  const props = originProps || {};

  // key를 props에서 추출
  const key = props.key || null;

  // children 정규화: 평탄화하고 null 제거
  const children = rawChildren
    .flat(Infinity)
    .map(normalizeNode)
    .filter((child) => child !== null);

  // key를 제외한 나머지 props
  const { key: _, ...restProps } = props;

  // 자식이 있는 경우만 children 속성 추가
  const nodeProps = children.length > 0 ? { ...restProps, children } : restProps;

  return {
    type,
    key,
    props: nodeProps,
  };
};

/**
 * 부모 경로와 자식의 key/index를 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  nodeType?: string | symbol | React.ComponentType,
  siblings?: VNode[],
): string => {
  let pathSegment: string;

  if (key !== null) {
    // key가 있으면 key 기반 경로
    pathSegment = `k${key}`;
  } else {
    // key가 없으면 타입별 인덱스 사용
    if (typeof nodeType === "function") {
      // 컴포넌트인 경우: 컴포넌트 이름 + 타입별 인덱스
      const componentName = nodeType.name || "Component";
      pathSegment = `c${componentName}${index}`;
    } else {
      // HTML 요소나 기타인 경우: 일반 인덱스
      pathSegment = `i${index}`;
    }
  }

  // 부모 경로가 비어있으면 현재 세그먼트만 반환, 아니면 점으로 연결
  return parentPath ? `${parentPath}.${pathSegment}` : pathSegment;
};
